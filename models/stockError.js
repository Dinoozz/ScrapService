const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockErrorSchema = new Schema({
    statut: {
        type: Boolean,
        required: true
    },
    origin: {
        type: String,
        required: true
    },
    listProduct: [{
        type: Schema.Types.ObjectId,
        ref: 'StockProduct',
        required: true
    }]
});

const StockError = mongoose.model('StockError', stockErrorSchema);

module.exports = StockError;
