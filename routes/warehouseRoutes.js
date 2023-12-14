const express = require('express');
const Warehouse = require('../models/warehouse');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter un nouveau Warehouse
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const newWarehouse = new Warehouse(req.body);
        await newWarehouse.save();
        res.status(201).json(newWarehouse);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Récupérer tous les Warehouses avec les équipes assignées
router.get('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouses = await Warehouse.find().populate('listAssignedTeam');
        res.json(warehouses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Récupérer tous les StockProducts d'un Warehouse spécifique
router.get('/:id/product', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id).populate('listProduct');
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }

        // Les StockProducts sont maintenant inclus dans le document warehouse grâce à populate
        res.json(warehouse.listProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Récupérer un Warehouse spécifique par ID avec les équipes assignées
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id).populate('listAssignedTeam');
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }
        res.json(warehouse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// Mettre à jour un Warehouse
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const updatedWarehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedWarehouse) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }
        res.json(updatedWarehouse);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer un Warehouse
router.delete('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse non trouvé' });
        }
        res.json({ message: 'Warehouse supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Ajouter une équipe à l'entrepôt
router.put('/:id/team/:teamId', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id);
        const teamId = req.params.teamId;

        if (!warehouse) {
            return res.status(404).json({ message: 'Entrepôt non trouvé' });
        }

        // Vérifiez si l'équipe est déjà assignée à l'entrepôt
        if (!warehouse.listAssignedTeam.includes(teamId)) {
            warehouse.listAssignedTeam.push(teamId);
            await warehouse.save();
        }

        res.json(warehouse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Supprimer une équipe de l'entrepôt
router.delete('/:id/team/:teamId', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id);
        const teamId = req.params.teamId;

        if (!warehouse) {
            return res.status(404).json({ message: 'Entrepôt non trouvé' });
        }

        // Retirer l'équipe de la liste
        warehouse.listAssignedTeam = warehouse.listAssignedTeam.filter(id => id.toString() !== teamId);
        await warehouse.save();

        res.json({ message: "Équipe retirée de l'entrepôt" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



module.exports = router;
