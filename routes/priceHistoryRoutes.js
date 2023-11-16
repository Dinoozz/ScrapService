// routes/priceHistoryRoutes.js
const express = require('express');
const Product = require('../models/product');
const PriceHistory = require('../models/priceHistory');
const router = express.Router();

// Ajouter un nouveau prix
router.post('/', async (req, res) => {
  try {
    const newPriceHistory = new PriceHistory(req.body);
    const product = await Product.findById(newPriceHistory.product);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    await newPriceHistory.save();
    product.priceHistories.push(newPriceHistory);
    await product.save();
    res.status(201).json(newPriceHistory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Récupérer l'historique des prix d'un produit
router.get('/product/:productId', async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).populate('priceHistories');
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.json(product.priceHistories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
