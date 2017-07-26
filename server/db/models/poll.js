const mongoose = require('mongoose')

var VenueSchema = new mongoose.Schema({
    venue_id: {
        type: String,
        required: true,
        trim: true
    },
    going_ids: [{
        type: String,
        required: true
    }]
});

VenueSchema.methods.checkUserIP = function(ip) {
    var poll = this;

    for (var i = 0; i < poll.voters.length; i++) {
        if (ip === poll.voters[i].ip) {
            return Promise.resolve({ poll, err: true });
        }
    }
    return Promise.resolve({ poll, err: false });
}

var Venue = mongoose.model('venue', VenueSchema)

module.exports = { Venue }