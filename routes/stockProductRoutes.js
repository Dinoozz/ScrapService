const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const StockProduct = require('../models/stockProduct');
const StockHistory = require('../models/stockHistory');
const Warehouse = require('../models/warehouse');
const Team = require('../models/team');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/csv', upload.single('csv'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Renommer le fichier pour inclure l'extension .csv
    const tempPath = req.file.path;
    const targetPath = tempPath + '.csv';
    fs.renameSync(tempPath, targetPath);

    try {
        // Suppression des StockHistory et StockProduct existants
        await StockHistory.deleteMany({});
        await StockProduct.deleteMany({});

        // Suppression des références de produits dans toutes les Warehouse
        await Warehouse.updateMany({}, { $set: { list_product: [] } });

        // Recherche ou création de la Warehouse "OPEN SI"
        let openSiWarehouse = await Warehouse.findOne({ name: "OPEN SI" });
        if (!openSiWarehouse) {
            const adminTeam = await Team.findOne({ name: "Admin" });
            openSiWarehouse = new Warehouse({ name: "OPEN SI", listAssignedTeam: adminTeam ? [adminTeam._id] : [] });
            await openSiWarehouse.save();
        }

        // Initialiser un tableau pour stocker les IDs des nouveaux produits
        let newProductIds = [];
        let productPromises = [];

        // Traitement du fichier CSV
        fs.createReadStream(targetPath)
            .pipe(csv({ separator: ';', encoding: 'ISO-8859-1' }))
            .on('data', (row) => {
                const reference = row['R�f�rence'];
                const denomination = row['D�signation'];
                const quantity = row['Stock r�el'];
            
                if (reference && denomination && quantity) {
                    let productPromise = StockProduct.findOne({ reference, warehouse: openSiWarehouse._id })
                        .then(async product => {
                            if (product) {
                                // Mise à jour de la quantité si le produit existe
                                product.quantity = parseInt(product.quantity) + parseInt(quantity);
                                return product.save();
                            } else {
                                // Création d'un nouveau produit
                                const newProduct = new StockProduct({
                                    reference,
                                    denomination,
                                    quantity,
                                    warehouse: openSiWarehouse._id,
                                    assignedTeam: openSiWarehouse.listAssignedTeam[0]
                                });
                                await newProduct.save();
                                return newProduct._id;
                            }
                        });
            
                    productPromises.push(productPromise);
                }
            })
            .on('end', async () => {
                try {
                    let newProductIds = await Promise.all(productPromises);
            
                    // Filtrer pour ne garder que les nouveaux IDs (undefined pour les produits existants)
                    newProductIds = newProductIds.filter(id => id !== undefined);
            
                    if (newProductIds.length > 0) {
                        await Warehouse.findByIdAndUpdate(openSiWarehouse._id, {
                            $push: { listProduct: { $each: newProductIds } }
                        });
                    }
            
                    res.json({ message: "Fichier CSV traité avec succès" });
                } catch (error) {
                    res.status(500).json({ message: error.message });
                } finally {
                    fs.unlinkSync(targetPath); // Suppression du fichier après traitement
                }
            });

    } catch (error) {
        // Suppression du fichier en cas d'erreur
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }
        res.status(500).json({ message: error.message });
    }
});

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

// Recherche de produit via scan
router.put('/searchproduct', async (req, res) => {
    const { reference, idProduit, warehouse, team, quantity } = req.body;
    try {
        let query = { warehouse: warehouse, assignedTeam: team };
        
        // Ajouter le critère de recherche spécifique
        if (reference) {
            query.reference = reference;
        } else if (idProduit) {
            query._id = idProduit;
        } else {
            return res.status(400).json({ message: 'Critère de recherche non fourni' });
        }
        
        // Recherche du produit
        const products = await StockProduct.find(query);
        
        // Vérification du nombre de produits trouvés
        if (products.length === 1) {
            // Mise à jour de la quantité si nécessaire
            // const product = products[0];
            // if (quantity) product.quantity = quantity;
            // await product.save();

            res.json({ message: "Produit trouvé", products});
        } else if (products.length > 1) {
            res.json({ message: "Plusieurs produits identiques" });
        } else {
            res.json({ message: "Produit non trouvé" });
        }

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
