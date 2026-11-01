const http = require('http');
const fs = require('fs');
const path = require('path');

const simulateHandler = require('./api/simulate');
const compareHandler = require('./api/compare');
const routingTableHandler = require('./api/routing-table');
const healthHandler = require('./api/health');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    // CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Route API requests to shared handlers
    const parsedUrl = req.url.split('?')[0];

    if (parsedUrl === '/api/simulate') {
        return simulateHandler(req, res);
    }

    if (parsedUrl === '/api/compare') {
        return compareHandler(req, res);
    }

    if (parsedUrl === '/api/routing-table') {
        return routingTableHandler(req, res);
    }

    if (parsedUrl === '/api/health') {
        return healthHandler(req, res);
    }

    // Static File Serving
    if (req.method === 'GET') {
        const filePath = parsedUrl === '/' ? '/index.html' : parsedUrl;
        const staticDir = fs.existsSync(path.join(__dirname, 'public'))
            ? path.join(__dirname, 'public')
            : path.join(__dirname, 'web');
        const fullPath = path.join(staticDir, filePath);

        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end("Resource not found");
                return;
            }
            const ext = path.extname(fullPath);
            let mime = 'text/html';
            if (ext === '.css') mime = 'text/css';
            if (ext === '.js') mime = 'application/javascript';
            if (ext === '.json') mime = 'application/json';
            if (ext === '.svg') mime = 'image/svg+xml';
            res.writeHead(200, { 'Content-Type': mime });
            res.end(data);
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
    console.log(`Packet Routing Simulator backend running on http://localhost:${PORT}`);
});
