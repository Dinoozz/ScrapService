// roleMiddleware.js
const checkRole = roles => (req, res, next) => {
    // Ici, vous devrez extraire le rôle de req (probablement après avoir vérifié le JWT)
    const userRole = req.user.role;
    if (roles.includes(userRole)) {
        next();
    } else {
        res.status(403).send('Accès refusé');
    }
};
  
module.exports = checkRole;
  