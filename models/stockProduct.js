// stockProduct.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockProductSchema = new Schema({
    quantity: {
        type: String, 
        required: true 
    },
    reference: {
        type: String,
        required: true
    },
    denomination: {
        type: String,
        required: true
    },
    EAN: {
        type: String,
        required: true
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required : true
    },
    assignedTeam : {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required : true
    },
    productHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'StockHistory'
    }]

});

module.exports = mongoose.model('StockProduct', stockProductSchema);
