const express = require('express');
const StockHistory = require('../models/stockHistory');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter un nouvel historique StockHistory
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const newStockHistory = new StockHistory(req.body);
        await newStockHistory.save();
        res.status(201).json(newStockHistory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Récupérer tous les historiques StockHistory
router.get('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistories = await StockHistory.find();
        res.json(stockHistories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer l'historique de stock par ID de produit
router.get('/product/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistories = await StockHistory.find({ IDProduct: req.params.id });
        res.json(stockHistories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer l'historique de stock par ID d'équipe
router.get('/team/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistories = await StockHistory.find({ IDTeams: req.params.id });
        res.json(stockHistories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer l'historique de stock par ID d'entrepôt
router.get('/warehouse/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistories = await StockHistory.find({ IDWarehouse: req.params.id });
        res.json(stockHistories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer un historique StockHistory spécifique par ID
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistory = await StockHistory.findById(req.params.id);
        if (!stockHistory) {
            return res.status(404).json({ message: 'StockHistory non trouvé' });
        }
        res.json(stockHistory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour un historique StockHistory
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const updatedStockHistory = await StockHistory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedStockHistory) {
            return res.status(404).json({ message: 'StockHistory non trouvé' });
        }
        res.json(updatedStockHistory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer un historique StockHistory
router.delete('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockHistory = await StockHistory.findByIdAndDelete(req.params.id);
        if (!stockHistory) {
            return res.status(404).json({ message: 'StockHistory non trouvé' });
        }
        res.json({ message: 'StockHistory supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
