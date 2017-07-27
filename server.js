var express = require('express');
var mongoose = require('mongoose');
var session = require('express-session');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const axios = require('axios');
var Twitter = require("node-twitter-api");
const _ = require('lodash');
var validator = require('validator');

const { ObjectID } = require('mongodb');
const { isLoggedin } = require('./server/middleware/isLoggedin');
const { Pins } = require('./server/db/models/pins');

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
app.use('/img', express.static(process.cwd() + '/public/img'));


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

    if (req.session.user)
        username = req.session.user.name;

    Pins.find()

    .then((pins) => {
        console.log(pins)
        if (req.session.user)
            return checkForUserStar(pins, req.session.user.id);
        else
            return res.render('home', {
                title: "Home",
                username,
                pins
            });
    })

    .then((newPins) => {
        if (newPins)
            res.render('home', {
                title: "Home",
                username,
                pins: newPins
            });
    })

    .catch((e) => res.send(e));
});

app.get('/star/rm/:id', isLoggedin, (req, res) => {
    var pin_id = req.params.id;

    Pins.findOneAndRemove({
        _id: pin_id,
        'owner.twitter_id': req.session.user.id
    })

    .then((pin) => {
        if (pin)
            res.send({ success: true });
        else
            res.send({ success: false });
        // WORK HERE!!!!!!!!!!!
    })

    .catch((e) => res.send(e));
});

app.get('/star/:id', isLoggedin, (req, res) => {
    var pin_id = req.params.id;

    Pins.findById(pin_id)

    .then((pin) => {
        if (pin) {
            return checkIfUserStarredBefore(pin, req.session.user.id);
        }
    })

    .then((response) => {
        console.log("CHECKING HERE ***\N", response)
        if (response.userStarred)
            return Pins.findByIdAndUpdate(pin_id, {
                $inc: {
                    stars: -1
                },
                $pull: {
                    user_stars: req.session.user.id
                }
            }, { new: true });
        else
            return Pins.findByIdAndUpdate(pin_id, {
                $inc: {
                    stars: 1
                },
                $push: {
                    user_stars: req.session.user.id
                }
            }, { new: true });
    })

    .then((pin) => {
        if (pin)
            res.send({ likes: pin.stars });
        else
            res.send({ e: "Error processing your request" });
    })

    .catch((e) => res.send(e));


});

app.get('/new', isLoggedin, (req, res) => {
    var username = null;

    if (req.session.user)
        username = req.session.user.name;

    res.render('pin-it', {
        title: "Add New Pin",
        username
    })
});

app.post('/new', isLoggedin, (req, res) => {
    var img_src = req.body.img_src,
        comment = null || req.body.comment;

    if (!validator.isURL(img_src))
        return res.render('pin-it', {
            title: "Add New Pin",
            username: req.session.user.name,
            message: "Please enter a valid URL!"
        })

    var pin = new Pins({
        img_src,
        comment,
        stars: 0,
        user_stars: [],
        owner: {
            twitter_id: req.session.user.id,
            name: req.session.user.screen_name,
            img: req.session.user.profile_image_url_https
        }
    });

    pin.save()

    .then((pin) => {
        console.log(pin);
        res.redirect('/');
    })

    .catch((e) => res.send(e));
});


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


function checkForUserStar(pins, id) {
    return new Promise((resolve, reject) => {
        for (var i = 0; i < pins.length; i++) {
            pins[i].user_starred = null;
            pins[i].userIsOwner = (pins[i].owner.twitter_id == id);

            for (var j = 0; j < pins[i].user_stars.length; j++) {
                if (id == pins[i].user_stars[j]) {
                    pins[i].user_starred = "clicked";
                }
            }
        }
        console.log("*********************** \n ", pins)
        resolve(pins);
    });
};

function checkIfUserStarredBefore(pin, id) {
    return new Promise((resolve, reject) => {
        for (var j = 0; j < pin.user_stars.length; j++) {
            if (id == pin.user_stars[j]) {
                resolve({
                    userStarred: true
                });
            }
        }

        resolve({
            userStarred: false
        });
    });
}


var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Node.js listening on port ' + port + '...');
});