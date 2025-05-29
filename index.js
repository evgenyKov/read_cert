// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

//const { handleRequest } = require('./public/ProxyHandler.js');

const app = express();
const port = 4433;

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

app.use('/js', express.static(path.join(__dirname, 'public/JS')));
app.use('/Data', express.static(path.join(__dirname, 'public/CA')));

// Віддаємо файл index.html при GET запиті
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

/*
// Proxy
app.post('/proxyHandler', (req, res) => {
  handleRequest(req, res);
});

app.get('/proxyHandler', (req, res) => {
  handleRequest(req, res);
});
*/

// HTTPS сервер
https.createServer(sslOptions, app).listen(port, () => {
  console.log('HTTPS сервер запущено на https://localhost:' + port);
});
