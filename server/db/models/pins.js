const mongoose = require('mongoose')

var PinsSchema = new mongoose.Schema({
    img_src: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        required: false,
        maxlength: 35
    },
    stars: {
        type: Number,
        required: true
    },
    user_stars: [{
        type: String,
        required: true
    }],
    owner: {
        twitter_id: String,
        name: String,
        img: String
    }
});

PinsSchema.methods.checkUserId = function(id) {
    var pin = this;

    for (var i = 0; i < pin.user_stars.length; i++) {
        if (id === pin.user_stars[i].twitter_id) {
            return Promise.resolve({ pin, starred: true });
        }
    }
    return Promise.resolve({ pin, starred: false });
}

var Pins = mongoose.model('pin', PinsSchema)

module.exports = { Pins }