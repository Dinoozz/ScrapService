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
    fs.renameSync(tempPath, targetPath);

    try {
        // Suppression des StockHistory et StockProduct existants
        await StockHistory.deleteMany({});
        await StockProduct.deleteMany({});
        // Suppression des références de produits dans toutes les Warehouse
        await Warehouse.updateMany({}, { $set: { listProduct: [] } });

        // Recherche ou création de la Warehouse "OPEN SI"
        let openSiWarehouse = await Warehouse.findOne({ name: "OPEN SI" });
        let adminTeam = await Team.findOne({ name: "Admin" });

        if (!adminTeam) {
            adminTeam = new Team({ name: "Admin" });
            await adminTeam.save();
        }

        if (!openSiWarehouse) {
            openSiWarehouse = new Warehouse({
                name: "OPEN SI",
                listAssignedTeam: [adminTeam._id]
            });
            await openSiWarehouse.save();
        }

        // Obtenir la liste des noms de toutes les warehouses
        const allWarehouseNames = (await Warehouse.find({})).map(wh => wh.name);

        // Initialiser un objet pour stocker les produits par référence
        let productMap = {};
        let cree = 0;
        let doublon = 0;

        // Traitement du fichier CSV - Première lecture
        fs.createReadStream(targetPath)
            .pipe(iconv.decodeStream('win1252'))
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                const depotStock = row['Dépôt de stock'];
                const reference = row['Référence'];
                const denomination = row['Désignation'];
                const quantity = parseInt(row['Stock réel']);
                
                if (!depotStock || !allWarehouseNames.includes(depotStock)) {
                    return;
                }
                console.log("reference", reference,"denomination",denomination ,"quantity", quantity)
                if (reference && denomination) {
                    // Vérifier si le produit avec cette référence existe déjà
                    if (!productMap[reference]) {
                        cree = cree + 1;
                        console.log("cree", cree);
                        productMap[reference] = { denomination, totalQuantity: quantity, exists: false };
                    } else {
                        doublon = doublon + 1;
                        console.log("doublon", doublon);
                        productMap[reference].totalQuantity += quantity;
                    }
                }
            })
            .on('end', async () => {
                try {
                    // Parcourir productMap pour effectuer les mises à jour ou créations
                    for (const [reference, { denomination, totalQuantity, exists }] of Object.entries(productMap)) {
                        const existingProduct = await StockProduct.findOne({ reference, warehouse: openSiWarehouse._id });

                        if (existingProduct) {
                            existingProduct.quantity += totalQuantity;
                            await existingProduct.save();
                        } else {
                            const newProduct = new StockProduct({
                                reference,
                                denomination,
                                quantity: totalQuantity,
                                warehouse: openSiWarehouse._id,
                                assignedTeam: openSiWarehouse.listAssignedTeam[0]
                            });
                            await newProduct.save();
                            openSiWarehouse.listProduct.push(newProduct._id);
                        }
                    }
                    await openSiWarehouse.save(); // Sauvegarder les mises à jour de "OPEN SI"

                    // Deuxième lecture du CSV pour les autres Warehouses
                    let secondReadPromises = [];
                    let warehouseUpdates = {};

                    fs.createReadStream(targetPath)
                        .pipe(iconv.decodeStream('win1252'))
                        .pipe(csv({ separator: ';' }))
                        .on('data', (row) => {
                            const depotStock = row['Dépôt de stock'];
                            const reference = row['Référence'];
                            const denomination = row['Désignation'];
                            const quantity = parseInt(row['Stock réel']);

                            if (!depotStock || !allWarehouseNames.includes(depotStock)) {
                                return;
                            }

                            let secondReadPromise = Warehouse.findOne({ name: depotStock }).exec()
                                .then(warehouse => {
                                    if (warehouse && warehouse.listAssignedTeam.length > 0) {
                                        let productCreationPromises = warehouse.listAssignedTeam.map(teamId => {
                                            const newProduct = new StockProduct({
                                                reference,
                                                denomination,
                                                quantity: 0,
                                                warehouse: warehouse._id,
                                                assignedTeam: teamId
                                            });
                                            return newProduct.save().then(savedProduct => {
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
                        })
                        .on('end', async () => {
                            try {
                                await Promise.all(secondReadPromises);

                                // Mise à jour des Warehouses avec les nouveaux produits
                                for (const [warehouseId, productIds] of Object.entries(warehouseUpdates)) {
                                    if (productIds.length > 0) {
                                        await Warehouse.findByIdAndUpdate(warehouseId, {
                                            $addToSet: { listProduct: { $each: productIds } }
                                        });
                                    }
                                }

                                res.json({ message: "Fichier CSV traité avec succès et nouveaux produits créés" });
                            } catch (error) {
                                res.status(500).json({ message: error.message });
                            } finally {
                                if (fs.existsSync(targetPath)) {
                                    fs.unlinkSync(targetPath);
                                }
                            }
                        });
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
            });
    } catch (error) {
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

            res.json({ message: "Produit trouvé", product: products[0]});
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
router.put('/correction/:id', checkRole(['admin', 'manager']), async (req, res) => {
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
            { _id: req.params.id, warehouse: warehouseId, assignedTeam: teamId },
            { $set: { quantity: quantity } },  // Remplacement de la quantité
            { new: true }
        );
        if (!updatedStockProduct) {
            return res.status(404).json({ message: 'StockProduct non trouvé' });
        }

        res.json({ updatedStockProduct });
    } catch (error) {
        res.status(400).json({ message: error.message });
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
