const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const fs = require('fs');
const StockProduct = require('../models/stockProduct');
const StockHistory = require('../models/stockHistory');
const Warehouse = require('../models/warehouse');
const Team = require('../models/team');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/csv', checkRole(['admin', 'manager']), upload.single('csv'), async (req, res) => {
    if (!req.file) {
        console.log('Aucun fichier fourni');
        return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    const tempPath = req.file.path;
    const targetPath = tempPath + '.csv';
    console.log('Chemin temporaire:', tempPath);
    console.log('Chemin cible:', targetPath);
    fs.renameSync(tempPath, targetPath);

    try {
        // Suppression des StockHistory et StockProduct existants
        await StockHistory.deleteMany({});
        await StockProduct.deleteMany({});
        // Suppression des références de produits dans toutes les Warehouse
        await Warehouse.updateMany({}, { $set: { listProduct: [] } });
        console.log('Collections StockHistory, StockProduct et listProduct des Warehouses vidées');
        // Recherche ou création de la Warehouse "OPEN SI"
        let openSiWarehouse = await Warehouse.findOne({ name: "OPEN SI" });
        // Recherche ou création de l'équipe "Admin"
        let adminTeam = await Team.findOne({ name: "Admin" });

        if (!adminTeam) {
            // Créer l'équipe Admin si elle n'existe pas
            adminTeam = new Team({ name: "Admin" });
            await adminTeam.save();
        }

        if (!openSiWarehouse) {
            openSiWarehouse = new Warehouse({
                name: "OPEN SI",
                listAssignedTeam: [adminTeam._id] // Ajouter l'ID de l'équipe Admin
            });
            await openSiWarehouse.save();
        }
        // Initialiser un tableau pour stocker les IDs des nouveaux produits
        let newProductIds = [];
        let productPromises = [];
        // Traitement du fichier CSV
        fs.createReadStream(targetPath)
            .pipe(iconv.decodeStream('win1252'))
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                const reference = row['Référence'];
                const denomination = row['Désignation'];
                const quantity = row['Stock réel'];
            
                if (reference && denomination && quantity > 0) {
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
                console.log('Première lecture du CSV terminée');
                try {
                    let newProductIds = await Promise.all(productPromises);
                    // Filtrer pour ne garder que les nouveaux IDs (undefined pour les produits existants)
                    newProductIds = newProductIds.filter(id => id !== undefined);


                    if (newProductIds.length > 0) {
                        await Warehouse.findByIdAndUpdate(openSiWarehouse._id, {
                            $addToSet: { listProduct: { $each: newProductIds } }
                        });
                    }
                } catch (error) {
                    console.error('Erreur lors du traitement du CSV:', error);
                    res.status(500).json({ message: error.message });
                }
                // Deuxième lecture du CSV pour les autres Warehouses
                let secondReadPromises = [];
                let warehouseUpdates = {};
                console.log('Chemin temporaire:', tempPath);
                console.log('Chemin cible:', targetPath);

                fs.createReadStream(targetPath)
                    .pipe(iconv.decodeStream('win1252'))
                    .pipe(csv({ separator: ';' }))
                    .on('data', (row) => {
                        const depotStock = row['Dépôt de stock'];
                        const reference = row['Référence'];
                        const denomination = row['Désignation'];
                        const quantity = row['Stock réel'];
                    
                        if (reference && denomination && quantity > 0 && depotStock) {
                            let secondReadPromise = Warehouse.findOne({ name: depotStock }).exec()
                                .then(warehouse => {
                                    if (warehouse && warehouse.listAssignedTeam.length > 0) {
                                        let productCreationPromises = warehouse.listAssignedTeam.map(teamId => {
                                            const newProduct = new StockProduct({
                                                reference,
                                                denomination,
                                                quantity : 0,
                                                warehouse: warehouse._id,
                                                assignedTeam: teamId
                                            });
                                            return newProduct.save().then(savedProduct => {
                                                // Ici, on collecte l'ID du produit pour la mise à jour de la Warehouse
                                                warehouseUpdates[warehouse._id] = warehouseUpdates[warehouse._id] || [];
                                                warehouseUpdates[warehouse._id].push(savedProduct._id);
                                                return savedProduct;
                                            });
                                        });
                    
                                        return Promise.all(productCreationPromises);
                                    } else {
                                        return [];
                                    }
                                });
                    
                            secondReadPromises.push(secondReadPromise);
                        }
                    })
                    .on('end', async () => {
                        try {
                            console.log('Deuxième lecture du CSV terminée');
                            await Promise.all(secondReadPromises);

                            // Mise à jour des Warehouses avec les nouveaux produits
                            for (const [warehouseId, productIds] of Object.entries(warehouseUpdates)) {
                                if (productIds.length > 0) {
                                    await Warehouse.findByIdAndUpdate(warehouseId, {
                                        $addToSet: { listProduct: { $each: productIds } }
                                    });
                                }
                            }
                            console.log('Mises à jour des Warehouses terminées');
                            res.json({ message: "Fichier CSV traité avec succès et nouveaux produits créés" });
                        } catch (error) {
                            console.error('Erreur lors du traitement du CSV:', error);
                            res.status(500).json({ message: error.message });
                        } finally {
                            if (fs.existsSync(targetPath)) {
                                console.log('Suppression du fichier CSV');
                                fs.unlinkSync(targetPath); // Suppression du fichier après traitement
                            }
                        }
                    })
            })
    } catch (error) {
        console.error('Erreur lors de la préparation du fichier CSV:', error);
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }
        res.status(500).json({ message: error.message });
    }
});


// Ajouter un nouveau StockProduct
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
    const { warehouseId, teamId, quantity, denomination, reference } = req.body;

    try {
        const warehouse = await Warehouse.findById(warehouseId).populate('listAssignedTeam');
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }

        const userTeam = await Team.findById(teamId);
        if (!userTeam) {
            return res.status(404).json({ message: 'Team non trouvé' });
        }

        let userStockProduct = null;

        // Créer le StockProduct pour chaque équipe assignée à la Warehouse
        let newProductIds = [];
        for (const assignedTeam of warehouse.listAssignedTeam) {
            const isUserTeam = assignedTeam._id.equals(userTeam._id);
            const newProductQuantity = isUserTeam ? quantity : 0;

            const newStockProduct = new StockProduct({
                quantity: newProductQuantity,
                reference: reference,
                denomination: denomination,
                warehouse: warehouse._id,
                assignedTeam: assignedTeam._id,
            });
            await newStockProduct.save();
            newProductIds.push(newStockProduct._id);

            if (isUserTeam) {
                userStockProduct = newStockProduct;
                const newStockHistory = new StockHistory({
                    quantity: quantity,
                    IDProduct: newStockProduct._id,
                    IDWarehouse: warehouse._id,
                    IDTeam: teamId,
                });
                await newStockHistory.save();
            }
        }

        // Ajouter les IDs des nouveaux produits à la liste de produits du Warehouse
        await Warehouse.findByIdAndUpdate(warehouseId, {
            $push: { listProduct: { $each: newProductIds } }
        });

        // Créer un produit supplémentaire pour "OPEN SI" et "Admin"
        const openSiWarehouse = await Warehouse.findOne({ name: 'OPEN SI' });
        const adminTeam = await Team.findOne({ name: 'Admin' });

        if (openSiWarehouse && adminTeam) {
            const openSiProduct = new StockProduct({
                quantity: 0,
                reference: reference,
                denomination: denomination,
                warehouse: openSiWarehouse._id,
                assignedTeam: adminTeam._id,
            });
            await openSiProduct.save();

            // Ajouter ce produit à la liste de produits de "OPEN SI"
            await Warehouse.findByIdAndUpdate(openSiWarehouse._id, {
                $push: { listProduct: openSiProduct._id }
            });
        }

        res.status(201).json({ userStockProduct });
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

// Mettre à jour un StockProduct et créer un StockHistory
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    const { warehouseId, teamId, quantity } = req.body;

    try {
        // Vérifier si l'ID de Warehouse et Team existent
        if (warehouseId && !(await Warehouse.findById(warehouseId))) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }
        if (teamId && !(await Team.findById(teamId))) {
            return res.status(404).json({ message: 'Team non trouvé' });
        }

        // Rechercher et mettre à jour le StockProduct
        const updatedStockProduct = await StockProduct.findOneAndUpdate(
            { _id: req.params.id, warehouse: warehouseId, assignedTeam:teamId },
            { $inc: { quantity } },
            { new: true }
        );
        if (!updatedStockProduct) {
            return res.status(404).json({ message: 'StockProduct non trouvé' });
        }

        // Créer un nouveau StockHistory après la mise à jour du produit
        const newStockHistory = new StockHistory({
            quantity: quantity,
            IDProduct: updatedStockProduct._id,
            IDWarehouse: warehouseId,
            IDTeam: teamId
        });
        await newStockHistory.save();
        updatedStockProduct.productHistory.push(newStockHistory._id);
        await updatedStockProduct.save();

        res.json({ updatedStockProduct });
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
