// mongodb_link.js
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const mongoose = require('mongoose');
 // Remplacez avec votre URI de MongoDB

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connecté...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
