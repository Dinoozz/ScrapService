const express = require('express');
const Team = require('../models/team');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();

// Ajouter une nouvelle équipe Team
router.post('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const newTeam = new Team(req.body);
        await newTeam.save();
        res.status(201).json(newTeam);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

/// Récupérer toutes les équipes Team avec les détails des utilisateurs
router.get('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const team = await Team.find().populate('listUser');
        res.json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Récupérer une équipe Team spécifique par ID avec les détails des utilisateurs
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const team = await Team.findById(req.params.id).populate('listUser');
        if (!team) {
            return res.status(404).json({ message: 'Team non trouvé' });
        }
        res.json(team);  // Cette réponse inclura le champ '_id' du document
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour une équipe Team
router.put('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const updatedTeam = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedTeam) {
            return res.status(404).json({ message: 'Team non trouvé' });
        }
        res.json(updatedTeam);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer une équipe Team
router.delete('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const teamId = req.params.id;

        // Trouver la Team sans la supprimer pour vérifier son nom
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team non trouvée' });
        } else if (team.name === "Admin") {
            return res.status(400).json({ message: 'Impossible de supprimer la Team Admin' });
        }

        // Supprimer la Team
        await Team.findByIdAndDelete(teamId);

        // Retirer l'ID de la Team des listAssignedTeam dans toutes les Warehouse
        await Warehouse.updateMany({}, { $pull: { listAssignedTeam: teamId } });

        // Trouver et supprimer tous les StockProduct assignés à cette Team
        const productsToRemove = await StockProduct.find({ assignedTeam: teamId });
        const productIdsToRemove = productsToRemove.map(product => product._id);
        await StockProduct.deleteMany({ assignedTeam: teamId });

        // Mettre à jour les listProduct dans toutes les Warehouse
        await Warehouse.updateMany({}, { $pull: { listProduct: { $in: productIdsToRemove } } });

        res.json({ message: 'Team supprimée avec succès et données associées mises à jour' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
