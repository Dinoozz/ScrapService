// stockTeams.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    listUser: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
});


module.exports = mongoose.model('Team', TeamSchema);
