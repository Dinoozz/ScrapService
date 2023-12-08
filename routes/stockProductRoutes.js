const express = require('express');
const StockProduct = require('../models/stockProduct');
const Warehouse = require('../models/warehouse');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter un nouveau StockProduct
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
    const { warehouse } = req.body;

    try {
        // Vérifier si l'ID de Warehouse existe
        const warehouseExists = await Warehouse.findById(warehouse);
        if (!warehouseExists) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }

        // Créer le StockProduct
        const newStockProduct = new StockProduct(req.body);
        await newStockProduct.save();

        // Ajouter l'ID du nouveau StockProduct à la liste de produits du Warehouse
        warehouseExists.listProduct.push(newStockProduct._id);
        await warehouseExists.save();

        res.status(201).json(newStockProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Récupérer tous les StockProducts
router.get('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockProducts = await StockProduct.find();
        res.json(stockProducts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer un StockProduct spécifique par ID
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockProduct = await StockProduct.findById(req.params.id);
        if (!stockProduct) {
            return res.status(404).json({ message: 'StockProduct non trouvé' });
        }
        res.json(stockProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour un StockProduct
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    const { warehouse } = req.body;

    try {
        // Vérifier si l'ID de Warehouse existe
        if (warehouse) {
            const warehouseExists = await Warehouse.findById(warehouse);
            if (!warehouseExists) {
                return res.status(404).json({ message: 'Warehouse non trouvé' });
            }
        }

        const updatedStockProduct = await StockProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedStockProduct) {
            return res.status(404).json({ message: 'StockProduct non trouvé' });
        }
        res.json(updatedStockProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


// Supprimer un StockProduct
router.delete('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const stockProduct = await StockProduct.findById(req.params.id);
        if (!stockProduct) {
            return res.status(404).json({ message: 'StockProduct non trouvé' });
        }

        // Récupérer le Warehouse associé et retirer la référence du StockProduct
        if (stockProduct.warehouse) {
            const warehouse = await Warehouse.findById(stockProduct.warehouse);
            if (warehouse) {
                warehouse.listProduct = warehouse.listProduct.filter(p => p.toString() !== stockProduct._id.toString());
                await warehouse.save();
            }
        }

        // Supprimer le StockProduct
        await stockProduct.remove();
        res.json({ message: 'StockProduct supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
