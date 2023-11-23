const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, '../log/server.log'), { flags: 'a' });

const logger = (req, res, next) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const logMessage = `
    ------------------------------
    Time: ${formattedDate}
    Request Method: ${req.method}
    Request URL: ${req.originalUrl}
    Headers: ${JSON.stringify(req.headers, null, 2)}
    Body: ${JSON.stringify(req.body, null, 2)}
    ------------------------------
    `;

    // Écrire dans un fichier de journal
    logStream.write(logMessage);

    // Également afficher dans la console
    console.log(logMessage);

    next();
};

module.exports = logger;
