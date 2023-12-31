// models/product.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  designation: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  prestashopId: {
    type: String,
    required: true,
    unique: true
  },

  originHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PriceHistory'
  }],

  priceHistories: [{
    type: Schema.Types.ObjectId,
    ref: 'PriceHistory'
  }]
});

module.exports = mongoose.model('Product', ProductSchema);
