// warehouse.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const warehouseSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    listProduct: [{
        type: Schema.Types.ObjectId, 
        ref: 'StockProduct'
    }],
    listAssignedTeam: [{
        type: Schema.Types.ObjectId, 
        ref: 'Team'
    }]
});


module.exports = mongoose.model('Warehouse', warehouseSchema);
