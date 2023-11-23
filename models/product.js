// models/product.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  origin: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  price: {
    type: String,
    required: true,
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
