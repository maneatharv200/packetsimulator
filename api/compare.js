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
        return sendJson(res, 405, { success: false, error: "Method not allowed. Use POST." });
    }

    try {
        const data = await parseBody(req);
        const src = data.source;
        const target = data.target;
        const nodes = data.nodes || [];
        const edges = data.edges || [];

        if (!src || !target) {
            return sendJson(res, 400, { success: false, error: "Source and target router IDs are required." });
        }

        const ITERATIONS = 2000;

        // Benchmark Dijkstra (Link-State)
        const dStart = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            runDijkstra(src, target, nodes, edges);
        }
        const dTotal = performance.now() - dStart;
        const dAvgUs = (dTotal * 1000) / ITERATIONS;

        // Benchmark Distance Vector (Bellman-Ford)
        const dvStart = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            runDistanceVector(src, target, nodes, edges);
        }
        const dvTotal = performance.now() - dvStart;
        const dvAvgUs = (dvTotal * 1000) / ITERATIONS;

        return sendJson(res, 200, {
            success: true,
            iterations: ITERATIONS,
            dijkstra: {
                protocol: "Link-State (OSPF / IS-IS)",
                avgTimeUs: parseFloat(dAvgUs.toFixed(2)),
                avgTimeMs: parseFloat((dTotal / ITERATIONS).toFixed(4)),
                complexity: "O((V + E) log V)",
                convergence: "Instant (Global Map)",
                loopFree: "Guaranteed (SPF Tree)"
            },
            distanceVector: {
                protocol: "Distance Vector (RIPv1 / RIPv2)",
                avgTimeUs: parseFloat(dvAvgUs.toFixed(2)),
                avgTimeMs: parseFloat((dvTotal / ITERATIONS).toFixed(4)),
                complexity: "O(V * E)",
                convergence: "Slow (Iterative Neighbor Exchange)",
                loopFree: "Requires Split Horizon / Poison Reverse"
            }
        });
    } catch (e) {
        return sendJson(res, 500, { success: false, error: e.message });
    }
};
