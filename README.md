# ScrapService
Ce projet est une api expressjs qui communique avec une base de donnée mongodb, il possède déjà des routes et une logique d'utilisateur, de permissions, et gère les JWT et CSRF. Et ici ca scrap

Penser a créer un fichier .env à la racine du projet tel que :
JWT_SECRET="mot_de_passe_de_haut_niveau"
SESSION_SECRET="mot_de_passe_de_haut_niveau"
COOKIE_SECRET="mot_de_passe_de_haut_niveau"
CSRF_SECRET="mot_de_passe_de_haut_niveau"
MONGODB_URI="url_de_la_base_de_donnée"

Chaque mot de passe dois être différent

npm init npm install node server.js
