require("dotenv").config();

var express = require("express");
var app = express();
const crypto = require("crypto");
const flash = require('connect-flash')

var formidable = require("express-formidable");
app.use(formidable());

//database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;
var mongoose = require("mongoose");


//http starter servern
var http = require("http").createServer(app);
//hasher passwords
var bcrypt = require("bcrypt");
//se filer i dit projekt nemmere
var fileSystem = require("fs");

//bliver brugt til authentication hvor brugeren får en personlig webtoken
var jwt = require("jsonwebtoken");
var accessTokenSecret = "myAccessTokenSecret1234567890";

//ejs er design virker ligesom html css
app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");



const session = require('express-session')

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}))


app.use(flash())


app.use((req,res,next)=> {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error  = req.flash('error');
    next();
})


//socket.io er med til realtime communication så brugeren ikke skal refreshe deres side konstant
var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

const sgMail = require("@sendgrid/mail");
const { Router } = require("express");
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

var mainURL = "http://localhost:3000";

socketIO.on("connection", function(socket) {
    console.log("user connected", socket.id);
    socketID = socket.id;
});


// Schema
const {User} = require("./models/user");


mongoose.connect("mongodb://localhost:27017/eksamens_projekt", {
    useNewUrlParser: true,
    useUnifiedTopology: true })
const db = mongoose.connection
db.on('error', error => console.error(error))
db.once('open', () => console.log('Connected to mongoose'))


mongoose.connection.on('open', function (ref) {
    //get collection names
    mongoose.connection.db.listCollections().toArray(function (err, names) {
        console.log(names);  [{ name: 'dbname.myCollection' }]
        module.exports.Collection = names;
    });
})

/*
http.listen(3000, function () {
    console.log("Server started.");

    mongoClient.connect("mongodb://localhost:27017", function(error, client){
        var database = client.db("eksamens_projekt");
        console.log("Database connected.");
        useUnifiedTopology: true

*/



        app.get("/signup", function (req, res){
            res.render("signup");

        });

        app.post("/signup", function (req, res) {
            var name = req.fields.name;
            var username = req.fields.username;
            var email = req.fields.email;
            var password = req.fields.password;
            var gender = req.fields.gender;
            //checker hvis en bruger allerede existerer

                                                                                
            User.findOne({$or:[{email : email}, {username : username}]}).exec((err,user)=>{
                if (user == null) {
                    var userObj = {
                        "name": name,
                        "username": username,
                        "email": email,
                        "password": password,
                        "gender": gender,
                        "emailToken": crypto.randomBytes(64).toString("hex"),
                        "isVerified": false,
                    }


                var newUser = new User(userObj);

                bcrypt.genSalt(10,(err,salt)=>
                bcrypt.hash(newUser.password,salt,
                    (err,hash)=> {
                        if(err) throw err;
                            //save pass to hash
                            newUser.password = hash;
                        //save user
                        newUser.save()
                        .then((value)=>{
                            console.log(value)
                            //req.flash('success_msg','You have now registered!');
                            res.redirect(`/verify-email?token=${userObj.emailToken}`);
                        })
                        .catch(value=> console.log(value));
           
                    }));

            
                } else {
                     res.json({
                            "status": "error",
                            "message": "Email or username already exist."

                        });
                    };
            })
        })
            app.get("/login", function (req, res) {
                res.render("login");
            });
            app.post("/login", function (req, res) {
                var email = req.fields.email;
                var password = req.fields.password;

                User.findOne({email : email}).exec((err,user)=>{
                    if(user) {
                        console.log(user);
                        
                        bcrypt.compare(password,user.password,(err,isMatch)=>{
                            if(err) throw err;
                            if(isMatch){
                                console.log('password correct');
                                console.log(user);

                                if (user.isVerified == true) {

                                    var accessToken = jwt.sign ({ email: email}, accessTokenSecret);
                                    User.findOne({email : email}).exec((err,user)=>{
                                       user.accessToken = accessToken
                                    })
                                    res.json({
                                       "status": "success",
                                       "message": "Login Successful",
                                       "accessToken": accessToken,
                                       "profileImage": user.profileImage
                                    })

                                } else {
                                    res.json({
                                        "status": "error",
                                        "message": "Your profile is not verified"
                                    })
                                }



                                //res.render("updateProfile");
                
                            } else{
                                console.log('password incorrect');
                                res.json({
                                    "status": "error",
                                    "message": "Email or password does not exist, or is incorrect"
                                })
                            }
                        })
                    } else {
                      console.log('email incorrect');
                      res.json({
                        "status": "error",
                        "message": "Email or password does not exist, or is incorrect"
                    })
                    }
                  })
                  
                  });
                  app.get("/updateProfile", function (request, result){
                    result.render("updateProfile");
                })

                  app.post("/getUser", function (request, result) {
                      var accessToken = request.fields.accessToken;
                      database.collection("users").findOne({
                          "accessToken": accessToken
                      }, function (error, user) {
                          if (user == null) {
                              result.json({
                                  "status": "error",
                                  "message": "User has been logged out. Please login again"
                              });
                          } else {
                              result.json({
                                  "status": "sucess",
                                  "message": "Record has been fetched.",
                                  "data": user
                              });
                          }
                      });   
                  });
                  app.get("/logout", function(request, result){
                      result.redirect("/login");
                  });

                  app.post("/uploadCoverPhoto", function (request, result){
                      var accessToken = request.fields.accessToken;
                      var coverPhoto = "";

                      database.collection("users").findOne({
                          "accessToken": accessToken
                      }, function (error, user) {
                          if (user == null) {
                              result.json({
                                  "status": "error",
                                  "message": "User has been logged out. Please try again"
                              });
                          } else {
                              if (request.files.coverPhoto.size > 0 && request.files.coverPhoto.type.includes("image")) {

                                if (user.coverPhoto !="") {
                                    fileSystem.unlink(user.coverPhoto, function (error) {
                                      //  
                                    });
                                }
                                coverPhoto = "public/image/" + new Date().getTime() + "-" + request.files.coverPhoto.name;
                                fileSystem.rename(request.files.coverPhoto.path, coverPhoto, function (error){
                                    
                                });
                              
                              
                              database.collection("users").updateOne({
                                  "accessToken": accessToken
                              }, {
                                  $set: {
                                      "coverPhoto": coverPhoto
                                  }
                              }, function (error, data) {
                                  result.json({
                                      "status": "status",
                                      "message": "Cover photo has been updated.",
                                      data: mainURL + "/" + coverPhoto
                                  }); 
                              });
                            } else {
                                result.json({
                                    "status": "error",
                                    "message": "Please select valid image." 
                                })
                            };
                         
                    };
                });
            });
                    app.post("/uploadProfileImage", function (request, result ) {
                        var accessToken = request.fields.accessToken;
                        var profileImage = "";

                        database.collection("users"). findOne ({
                            "accessToken": accessToken
                        }, function (error, user) {
                            if (user == null) {
                                result.json({
                                    "status": "error",
                                    "message": "User has been logged out please login again."
                                });
                            } else {
                                
                                if (request.files.profileImage.size > 0 && request.files.profileImage.type.includes("image")) {

                                    if (user.profileImage !="") {
                                        fileSystem.unlink(user.profileImage, function (error) {
                                            
                                        });
                                    }

                                    profileImage = "public/image/" + new Date().getTime() + "-" + request.files.profileImage.name;
                                    fileSystem.rename(request.files.profileImage.path, profileImage, function (error) {

                                    });

                                    database.collection("users").updateOne({
                                        "accessToken": accessToken
                                    }, {

                                        $set: {
                                            "profileImage": profileImage
                                        }
                                    }, function (error, data) {
                                        result.json({
                                            "status": "status",
                                            "message": "Profile image has been updated.",
                                            data: mainURL + "/" + profileImage
                                        });
                                    });
                                } else {
                                    result.json({
                                        "status": "error",
                                        "message": "Please select valid image."
                                    });
                                };
                            };
                            
                        });
                   });

                   // Email Verification route
app.get('/verify-email', async(req, res, next) => {
    try {
        console.log('erik: '+ req.query.token)

        //User.findOne({$or:[{email : email}, {username : username}]}).exec((err,user)=>{

        
        var user = await User.findOne({ emailToken: req.query.token });
        if (!user) {
            req.flash('error', 'Token is invalid. Please contact us for assistance at service@YaSite.com');
            return res.redirect('/');
        }
        user.emailToken = null;
        user.isVerified = true;
        try{
            await user.save();
            res.redirect('/login');
        } catch (error){
            throw error;
        }
    } catch (error) {
        console.log(error);
        req.flash('error', 'Token is invalid. Please contact us for assistance at service@YaSite.com');
        res.redirect('/');
    }
})

                //})
              //  })

app.listen(process.env.PORT || 3000)