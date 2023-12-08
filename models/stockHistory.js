// stockHistory.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockHistorySchema = new Schema({
    quantity: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: () => (new Date()).toISOString()
    },
    IDProduct: {
        type: Schema.Types.ObjectId,
        ref: 'StockProduct',
        required: true
    },
    IDWarehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true
    },
    IDTeam: {
        type: Schema.Types.ObjectId,
        ref: 'Teams',
        required: true
    }
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);
