const express = require('express');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');
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

router.get('/generate-csv', async (req, res) => {
    try {
        // Vérification des StockError avec statut False
        const errorExists = await StockError.findOne({ statut: false });
        if (errorExists) {
            return res.status(400).json({ message: "Des erreurs de stock non résolues existent." });
        }

        // Récupérer toutes les Warehouse sauf "OPEN SI"
        const warehouses = await Warehouse.find({ name: { $ne: 'OPEN SI' } });
        let productsData = [];

        for (const warehouse of warehouses) {
            const products = await StockProduct.find({ warehouse: warehouse._id });
            let uniqueProducts = new Set(); // Utiliser un Set pour stocker les références uniques

            // Ajouter un seul exemplaire de chaque produit unique à la liste
            products.forEach(product => {
                if (!uniqueProducts.has(product.reference)) {
                    uniqueProducts.add(product.reference);
                    productsData.push({
                        warehouseName: warehouse.name,
                        reference: product.reference,
                        denomination: product.denomination,
                        quantity: product.quantity
                    });
                }
            });
        }

        // Chemin du fichier CSV à créer dans un dossier accessible publiquement
        const publicDir = path.join(__dirname, '../public'); // Assurez-vous que ce dossier est accessible publiquement
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        const filePath = path.join(publicDir, 'products.csv');

        // Création du fichier CSV
        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: 'warehouseName', title: 'Warehouse Name' },
                { id: 'reference', title: 'Reference' },
                { id: 'denomination', title: 'Denomination' },
                { id: 'quantity', title: 'Quantity' }
            ]
        });

        await csvWriter.writeRecords(productsData);

        // Renvoyer l'URL du fichier CSV
        const fileUrl = `${req.protocol}://${req.get('host')}/public/products.csv`; // Construire l'URL du fichier
        res.json({ fileUrl }); // Envoyer l'URL en réponse

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
