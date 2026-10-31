const { runDijkstra, runDistanceVector } = require('./algorithms');

function parseBody(req) {
    if (req.body && typeof req.body === 'object') {
        return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
        try {
            return Promise.resolve(JSON.parse(req.body));
        } catch {
            return Promise.resolve({});
        }
    }
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}

function sendJson(res, statusCode, data) {
    if (typeof res.status === 'function') {
        const chain = res.status(statusCode);
        if (chain && typeof chain.json === 'function') {
            return chain.json(data);
        }
        if (chain && typeof chain.send === 'function') {
            return chain.send(data);
        }
    }
    if (typeof res.json === 'function') {
        return res.json(data);
    }
    const jsonStr = JSON.stringify(data);
    if (typeof res.writeHead === 'function') {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        return res.end(jsonStr);
    }
    if (typeof res.end === 'function') {
        return res.end(jsonStr);
    }
}

module.exports = async (req, res) => {
    if (typeof res.setHeader === 'function') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
        if (typeof res.status === 'function') return res.status(204).end();
        if (typeof res.writeHead === 'function') res.writeHead(204);
        if (typeof res.end === 'function') return res.end();
        return;
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: "Method not allowed" });
    }

    try {
        const data = await parseBody(req);
        const src = data.source;
        const target = data.target;
        const nodes = data.nodes || [];
        const edges = data.edges || [];

        // Run algorithms 1,000 times to get measurable latency
        let dStart = performance.now();
        for (let i = 0; i < 1000; i++) runDijkstra(src, target, nodes, edges);
        let dTime = (performance.now() - dStart).toFixed(2);

        let dvStart = performance.now();
        for (let i = 0; i < 1000; i++) runDistanceVector(src, target, nodes, edges);
        let dvTime = (performance.now() - dvStart).toFixed(2);

        return sendJson(res, 200, {
            success: true,
            message: `Benchmark (1,000 iterations):\nDijkstra: ${dTime} ms\nDistance Vector: ${dvTime} ms`
        });
    } catch (e) {
        return sendJson(res, 500, { error: e.message });
    }
};
