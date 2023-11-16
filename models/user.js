// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'user', // Les valeurs possibles sont 'user', 'manager', 'admin'
    },
    token: {
        type: String
    }
});

module.exports = mongoose.model('User', UserSchema);
