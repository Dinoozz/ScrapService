// routes/priceHistoryRoutes.js
const express = require('express');
const Product = require('../models/product');
const PriceHistory = require('../models/priceHistory');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter un nouveau prix
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
  try {
      const { isOrigin } = req.body; // Ajoutez ce nouveau paramètre
      const newPriceHistory = new PriceHistory(req.body);
      const product = await Product.findById(newPriceHistory.product);
      if (!product) {
          return res.status(404).json({ message: 'Produit non trouvé' });
      }
      await newPriceHistory.save();

      // Ajouter à originHistory si isOrigin est vrai, sinon à priceHistories
      if (isOrigin) {
          product.originHistory.push(newPriceHistory);
      } else {
          product.priceHistories.push(newPriceHistory);
      }

      await product.save();
      res.status(201).json(newPriceHistory);
  } catch (error) {
      res.status(400).json({ message: error.message });
  }
});

router.get('/product/', async (req, res) => {
  try {
    const products = await Product.find().populate('priceHistories').populate('originHistory');
    const productsWithLatestHistory = await Promise.all(products.map(async (product) => {
      // Traitement pour priceHistories
      const latestPriceBySite = {};
      product.priceHistories.forEach(history => {
        const site = history.site;
        if (!latestPriceBySite[site] || latestPriceBySite[site].date < history.date) {
          latestPriceBySite[site] = history;
        }
      });

      // Traitement pour originHistory
      const latestOriginBySite = {};
      product.originHistory.forEach(history => {
        const site = history.site;
        if (!latestOriginBySite[site] || latestOriginBySite[site].date < history.date) {
          latestOriginBySite[site] = history;
        }
      });

      // Construire l'objet de réponse sans inclure les tableaux complets originHistory et priceHistories
      return {
        _id: product._id,
        origin: product.origin,
        designation: product.designation,
        reference: product.reference,
        price: product.price,
        latestPriceHistory: Object.values(latestPriceBySite),
        latestOriginHistory: Object.values(latestOriginBySite)
      };
    }));

    res.json(productsWithLatestHistory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Récupérer l'historique des prix d'un produit, avec option de filtrer par site
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { site } = req.query; 

    const product = await Product.findById(productId).populate('priceHistories').populate('originHistory');
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    let histories = [...product.priceHistories, ...product.originHistory];
    if (site) {
      histories = histories.filter(history => history.site === site);
    }

    if (histories.length === 0) {
      return res.status(404).json({ message: 'Aucun historique de prix trouvé' });
    }

    res.json(histories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
