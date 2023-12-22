const express = require('express');
const StockError = require('../models/stockError'); // Remplacez par le chemin correct de votre modèle
const router = express.Router();
const StockProduct = require('../models/stockProduct');
const Warehouse = require('../models/warehouse');
const checkRole = require('../middleware/roleMiddleware');

router.get('/process', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        await StockError.deleteMany({});
        // Trouver la Warehouse "OPEN SI"
        const openSiWarehouse = await Warehouse.findOne({ name: 'OPEN SI' }).populate('listProduct');
        if (!openSiWarehouse) {
            return res.status(404).json({ message: 'Warehouse "OPEN SI" non trouvé' });
        }

        for (const productId of openSiWarehouse.listProduct) {
            const product = await StockProduct.findById(productId);
            const allWarehouses = await Warehouse.find({ _id: { $ne: openSiWarehouse._id } });
            let totalQuantity = 0;
            let productIdsToCompare = [];
            let errorFound = false;

            for (const warehouse of allWarehouses) {
                const productsInWarehouse = await StockProduct.find({ reference: product.reference, warehouse: warehouse._id });

                if (productsInWarehouse.length > 1) {
                    const quantities = productsInWarehouse.map(p => p.quantity);
                    if (new Set(quantities).size !== 1) { // Si toutes les quantités ne sont pas égales
                        await new StockError({
                            statut: false,
                            origin: 'team',
                            listProduct: productsInWarehouse.map(p => p._id)
                        }).save();
                        errorFound = true;
                        break; // Passer au produit suivant dans "OPEN SI"
                    }
                }

                totalQuantity += productsInWarehouse.reduce((sum, p) => sum + p.quantity, 0);
                productIdsToCompare.push(...productsInWarehouse.map(p => p._id));
            }

            // Comparer avec la quantité dans "OPEN SI"
            if (!errorFound && totalQuantity !== product.quantity) {
                let errorProductIds = [product._id, ...productIdsToCompare.filter(id => !id.equals(product._id))];
                await new StockError({
                    statut: false,
                    origin: 'opensi',
                    listProduct: errorProductIds
                }).save();
            }
        }

        res.json({ message: 'Processus de vérification terminé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer tous les StockError
router.get('/', async (req, res) => {
    try {
        const stockErrors = await StockError.find();
        res.json(stockErrors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Récupérer un StockError spécifique par ID et populate listProduct
router.get('/:id', async (req, res) => {
    try {
        const stockError = await StockError.findById(req.params.id).populate('listProduct');
        if (!stockError) {
            return res.status(404).json({ message: 'StockError non trouvé' });
        }
        res.json(stockError);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour le statut d'un StockError
router.put('/:id', async (req, res) => {
    const { statut } = req.body;

    try {
        const updatedStockError = await StockError.findByIdAndUpdate(
            req.params.id,
            { $set: { statut: statut } },
            { new: true }
        );
        if (!updatedStockError) {
            return res.status(404).json({ message: 'StockError non trouvé' });
        }
        res.json(updatedStockError);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


module.exports = router;
