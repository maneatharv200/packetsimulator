module.exports = (req, res) => {
    if (res.setHeader) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
        if (res.status) return res.status(204).end();
        if (res.writeHead) res.writeHead(204);
        return res.end();
    }

    const payload = { status: "ok", version: "1.0" };
    if (res.status && res.json) {
        return res.status(200).json(payload);
    }
    const jsonStr = JSON.stringify(payload);
    if (res.writeHead) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(jsonStr);
    }
    if (res.send) {
        return res.send(jsonStr);
    }
    res.end(jsonStr);
};
