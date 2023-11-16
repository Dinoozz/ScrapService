// models/priceHistory.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PriceHistorySchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  site: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);
