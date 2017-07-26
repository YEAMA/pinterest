var express = require('express');
var mongoose = require('mongoose');
var session = require('express-session');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const axios = require('axios');
var Twitter = require("node-twitter-api");
const _ = require('lodash');

const { ObjectID } = require('mongodb');
const { isLoggedin } = require('./server/middleware/isLoggedin');
const { Venue } = require('./server/db/models/poll');
const { appUser } = require('./server/db/models/appUser')

var app = express();
require('dotenv').load();

const baseURL = "https://fcc-socialapp.herokuapp.com/";

mongoose.connect(process.env.MONGO_URI);
mongoose.Promise = global.Promise;

app.use('/controllers', express.static(process.cwd() + '/app/controllers'));
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/common', express.static(process.cwd() + '/app/common'));

app.use('/css', express.static(process.cwd() + '/public/css'));
app.use('/js', express.static(process.cwd() + '/public/js'));


app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

hbs.registerPartials(__dirname + '/views/partials');

app.set('view engine', 'hbs');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

var twitter = new Twitter({
    consumerKey: process.env.CONSUMER_KEY,
    consumerSecret: process.env.CONSUMER_SECRET,
    callback: process.env.CALLBACK_URL
});

var _requestSecret;

app.get('/', (req, res) => {
    var username = null;

    // var pins = {
    //     owner_id, owner_name, owner_img, img_src, comment, stars, (user_star)
    // }

    if (req.session.user)
        username = req.session.user.name;

    res.render('home', {
        title: "Home",
        username
        // pins
    });
})

app.get('/fetch_rt', (req, res) => {

    twitter.getRequestToken(function(err, requestToken, requestSecret, results) {
        if (err)
            res.send(err);
        else {
            _requestSecret = requestSecret;
            res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
        }
    });

});

app.get('/fetched_rt', (req, res) => {
    var requestToken = req.query.oauth_token,
        verifier = req.query.oauth_verifier;

    twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
        if (err)
            res.send(err);
        else
            twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
                if (err)
                    res.send(err);
                else {
                    req.session.user = user;
                    req.session.user.AT = accessToken;
                    req.session.user.AS = accessSecret;
                    res.redirect('/');
                }
            });
    });
});

app.get('/logout', function(req, res) {
    if (req.session.user)
        req.session.destroy(function(err) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                res.redirect('/');
            }
        });

});

// ************************************************************

// FOR DEFAULT 404 PAGE
app.get('*', function(req, res) {
    res.render('404');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Node.js listening on port ' + port + '...');
});