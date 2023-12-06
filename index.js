// server.js
require('dotenv').config();

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const CSRF_SECRET = process.env.CSRF_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const logger = require('./middleware/loggerMiddleware');
const connectDB = require('./mongodb_link');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const priceHistoryRoutes = require('./routes/priceHistoryRoutes');
const session = require('express-session');
const User = require('./models/user');
var cors = require('cors')

const app = express();


// Création d'un profile Admin si il n'éxiste pas
async function initializeAdminUser() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const adminUser = new User({
                username: 'admin',
                password: 'P@ssw0rdP@ssw0rd',
                email: "admin@mail.fr",
                role: 'admin'
            });
            await adminUser.save();
            console.log('Compte administrateur créé');
        }
    } catch (error) {
        console.error('Erreur lors de la création du compte administrateur', error);
    }
};

// Connexion à MongoDB
connectDB().then(initializeAdminUser);

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


app.use(express.json());
app.use(logger);
app.use(cors())

// Gestion de session/*
app.use(session({
    secret: SESSION_SECRET, // Remplacez par votre secret de session
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: false, secure: true }
}));


app.use(verifyJwt);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/priceHistory', priceHistoryRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));