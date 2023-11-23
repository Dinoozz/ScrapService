# Utiliser une image de base officielle Node.js
FROM node:latest
# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/api
# Copier les fichiers package.json et package-lock.json
COPY package*.json ./
# Installer les dépendances du projet
RUN npm ci
# Copier le reste des fichiers du projet dans le répertoire de travail
COPY . .
# Exposer le port sur lequel l'application s'exécute
EXPOSE 5000
# Commande pour exécuter l'application
CMD ["node", "index.js"]