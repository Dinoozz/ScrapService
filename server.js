// server.js
require('dotenv').config();

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const CSRF_SECRET = process.env.CSRF_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const logger = require('./logger');
const connectDB = require('./mongodb_link');
const userRoutes = require('./routes/userRoutes');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');

const app = express();

// Connexion à MongoDB
connectDB();

// Configuration de cookie-parser
app.use(cookieParser(COOKIE_SECRET)); // Remplacez par votre secret de cookie

// Configuration de csrf-csrf
const doubleCsrfConfig = {
    // Ajoutez ici les configurations nécessaires
    getSecret: req => CSRF_SECRET, // Remplacez par votre secret pour CSRF
    cookieName: 'crsf-tokenM',
    // Ajoutez d'autres configurations si nécessaire
};

// Middleware pour vérifier le JWT, sauf pour les routes 'register' et 'login'
const verifyJwt = (req, res, next) => {
    if (req.path === '/api/users/register' || req.path === '/api/users/login') {
        return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé, token non fourni' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Token invalide' });
    }
};

const { doubleCsrfProtection } = doubleCsrf(doubleCsrfConfig);

app.use(express.json());
app.use(logger);

// Gestion de session
app.use(session({
    secret: SESSION_SECRET, // Remplacez par votre secret de session
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

// Appliquez le middleware CSRF à toutes les routes, sauf pour '/register' et '/login'
app.use((req, res, next) => {
    if (req.path === '/api/users/register' || req.path === '/api/users/login') {
        // Si la requête est pour l'inscription ou la connexion, passez au prochain middleware sans CSRF
        next();
    } else {
        // Pour toutes les autres routes, appliquez la protection CSRF
        doubleCsrfProtection(req, res, next);
    }
});

app.use(verifyJwt);

// Routes
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));