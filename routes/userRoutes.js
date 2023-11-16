// routes/userRoutes.js
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();


// Middleware pour vérifier les rôles
const checkRole = roles => (req, res, next) => {
    // Ici, vous devrez extraire le rôle de req (probablement après avoir vérifié le JWT)
    const userRole = req.user.role;
    if (roles.includes(userRole)) {
        next();
    } else {
        res.status(403).send('Accès refusé');
    }
};

// Inscription
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (user) return res.status(400).send('L\'utilisateur existe déjà');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            username,
            password: hashedPassword
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        user.token = token;

        await user.save();
        res.status(201).json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

// Connexion
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) return res.status(400).send('Identifiants invalides');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).send('Identifiants invalides');

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        user.token = token;
        await user.save();

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/logout', async (req, res) => {
    // Effacer le cookie CSRF si vous le stockez dans un cookie
    res.clearCookie('csrf-tokenM');

    // Envoyer une réponse indiquant que la déconnexion a réussi
    res.status(200).json({ message: 'Déconnexion réussie' });
});

// CRUD Operations

router.post('/', checkRole(['admin']), async (req, res) => {
    const { username, password, role } = req.body;
    try {
        let existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).send('L\'utilisateur existe déjà');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, password: hashedPassword, role });
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
        const users = await User.find();
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

// Lire un utilisateur spécifique (admin et manager seulement)
router.get('/:id', checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

// Mettre à jour un utilisateur (admin seulement)
router.put('/:id', checkRole(['admin']), async (req, res) => {
    const { username, password, role } = req.body;
    try {
        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        if (username) user.username = username;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        if (role) user.role = role;

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
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        await user.remove();
        res.json({ msg: 'Utilisateur supprimé' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

module.exports = router;