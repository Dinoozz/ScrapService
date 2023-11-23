// routes/productRoutes.js
const express = require('express');
const Product = require('../models/product');
const PriceHistory = require('../models/priceHistory');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter un nouveau produit
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Récupérer tous les produits
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Récupérer un produit spécifique par son ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('priceHistories');
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mettre à jour un produit
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Supprimer un produit
router.delete('/:id', checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const productId = req.params.id;

    // Supprimer le produit
    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Supprimer tout l'historique de prix associé à ce produit
    await PriceHistory.deleteMany({ product: productId });

    res.json({ message: 'Produit et son historique de prix supprimés' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
