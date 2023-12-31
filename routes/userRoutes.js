// routes/userRoutes.js
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const CSRF_SECRET = process.env.CSRF_SECRET;
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Team = require('../models/team');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();



// Inscription
router.post('/register', async (req, res) => {
    const { email, password , username} = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).send('L\'utilisateur existe déjà');

        user = new User({
            username,
            email,
            password
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        user.token = token;

        await user.save();
        res.status(201).json({ message: 'Inscription réussie', token});
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

// Connexion
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).send('Identifiants invalides');
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).send('Identifiants invalides');

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '72h' });
        user.token = token;
        await user.save();

        res.json({ message: 'Connexion réussie', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/logout', async (req, res) => {
    // Effacer le cookie CSRF si vous le stockez dans un cookie
    // res.clearCookie('csrf-tokenM');
    
    // Envoyer une réponse indiquant que la déconnexion a réussi
    res.status(200).json({ message: 'Déconnexion réussie' });
});

// Renvoie le rôle de l'utilisateur (Tout les utilisateurs)
router.get('/role', async (req, res) => {
    try {
        if (!req.user || !req.user.role) {
            return res.status(401).send('Utilisateur non authentifié ou rôle non défini');
        }
        res.json({ role: req.user.role });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

router.get('/info', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).send('Utilisateur non authentifié');
        }

        // Trouver l'utilisateur
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

router.get('/team', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).send('Utilisateur non authentifié');
        }

        // Trouver l'utilisateur
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }
        // Trouver l'équipe de l'utilisateur
        const team = await Team.findOne({ listUser: user._id });
        if (!team) {
            return res.json({ team: 'Aucune' });
        }

        res.json({ team: team._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});


// CRUD Operations

router.post('/', checkRole(['admin']), async (req, res) => {
    const { username, password, role , email} = req.body;
    try {
        let existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).send('L\'utilisateur existe déjà');

        const newUser = new User({ username, password, role, email});
        await newUser.save();
        res.status(201).json(newUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

// Lire tous les utilisateurs (admin et manager seulement)
router.get('/', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const users = await User.find().select('-token');
        const teams = await Team.find();

        const usersWithTeam = await Promise.all(users.map(async (user) => {
            const team = teams.find(team => team.listUser.includes(user._id));
            return {
                ...user._doc,
                team: team ? team.name : 'Aucune'
            };
        }));

        res.json(usersWithTeam);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});


// Lire un utilisateur spécifique (admin et manager seulement)
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-token');
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        const teams = await Team.find();
        const team = teams.find(team => team.listUser.includes(user._id));

        const userWithTeam = {
            ...user._doc,
            team: team ? team.name : 'Aucune'
        };

        res.json(userWithTeam);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});


// Mettre à jour un utilisateur (admin seulement)
router.put('/:id', checkRole(['admin']), async (req, res) => {
    const { username, password, role, email, team } = req.body;

    try {
        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        // Mise à jour de l'utilisateur
        if (username) user.username = username;
        if (role) user.role = role;
        if (email) user.email = email;
        if (password) user.password = password;

        // Gestion du changement ou de la suppression d'équipe
        if (team) {
            if (team === "Aucune") {
                // Rechercher l'équipe actuelle et retirer l'utilisateur
                const currentTeam = await Team.findOne({ listUser: user._id });
                if (currentTeam) {
                    currentTeam.listUser.pull(user._id);
                    await currentTeam.save();
                }
            } else {
                // Gérer le changement d'équipe
                const newTeam = await Team.findOne({ name: team });
                if (!newTeam) {
                    return res.status(404).send('Équipe non trouvée');
                }

                // Vérifiez et retirez de l'équipe actuelle si nécessaire
                const currentTeam = await Team.findOne({ listUser: user._id });
                if (currentTeam && currentTeam._id.toString() !== newTeam._id.toString()) {
                    currentTeam.listUser.pull(user._id);
                    await currentTeam.save();
                }

                // Ajouter l'utilisateur à la nouvelle équipe
                newTeam.listUser.push(user._id);
                await newTeam.save();
            }
        }

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});



// Supprimer un utilisateur (admin seulement)
router.delete('/:id', checkRole(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;

        // Mise à jour des équipes pour retirer l'utilisateur
        await Team.updateMany({ listUser: userId }, { $pull: { listUser: userId } });

        // Supprimer l'utilisateur
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }
        res.json({ msg: 'Utilisateur et ses références dans les équipes supprimés' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});




module.exports = router;