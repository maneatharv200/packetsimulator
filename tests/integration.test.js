const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const simulateHandler = require('../api/simulate');
const compareHandler = require('../api/compare');
const routingTableHandler = require('../api/routing-table');
const healthHandler = require('../api/health');

let server;
let port;
let baseUrl;

before(async () => {
    server = http.createServer((req, res) => {
        const parsedUrl = req.url.split('?')[0];
        if (parsedUrl === '/api/simulate') return simulateHandler(req, res);
        if (parsedUrl === '/api/compare') return compareHandler(req, res);
        if (parsedUrl === '/api/routing-table') return routingTableHandler(req, res);
        if (parsedUrl === '/api/health') return healthHandler(req, res);
        res.writeHead(404);
        res.end();
    });

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

describe('Full HTTP Integration Tests', () => {
    const fixtureNodes = [
        { id: "R1", name: "Router 1" },
        { id: "R2", name: "Router 2" },
        { id: "R3", name: "Router 3" },
        { id: "R4", name: "Router 4" },
        { id: "R5", name: "Router 5" },
        { id: "R6", name: "Router 6" },
        { id: "R7", name: "Router 7" }
    ];
    const fixtureEdges = [
        { id: "e1", source: "R1", target: "R2", weight: 4, active: true },
        { id: "e2", source: "R2", target: "R3", weight: 3, active: true },
        { id: "e3", source: "R1", target: "R4", weight: 2, active: true },
        { id: "e4", source: "R2", target: "R5", weight: 3, active: true },
        { id: "e5", source: "R3", target: "R6", weight: 2, active: true },
        { id: "e6", source: "R4", target: "R5", weight: 3, active: true },
        { id: "e7", source: "R5", target: "R6", weight: 2, active: true },
        { id: "e8", source: "R4", target: "R7", weight: 4, active: true },
        { id: "e9", source: "R6", target: "R7", weight: 3, active: true }
    ];

    it('GET /api/health returns 200 OK', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'ok');
    });

    it('POST /api/simulate with Attack ON and RPKI ON rejects rogue announcement', async () => {
        const res = await fetch(`${baseUrl}/api/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: 'R1',
                target: 'R7',
                algorithm: 'dijkstra',
                nodes: fixtureNodes,
                edges: fixtureEdges,
                options: {
                    simulateRogue: true,
                    rogueNodeId: 'R2',
                    rpkiEnabled: true
                }
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.delivered, true);
        assert.equal(data.securityStatus, 'RPKI_INVALID_REJECTED');
        assert.deepEqual(data.quarantinedNodes, ['R2']);
        assert.equal(data.rejectedRoutes.length, 1);
        assert.equal(data.rejectedRoutes[0].originAsn, 999);
        assert.deepEqual(data.path, ['R1', 'R4', 'R7']);
    });

    it('POST /api/compare returns benchmark stats', async () => {
        const res = await fetch(`${baseUrl}/api/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: 'R1',
                target: 'R7',
                nodes: fixtureNodes,
                edges: fixtureEdges
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.dijkstra.avgTimeUs > 0);
        assert.ok(data.distanceVector.avgTimeUs > 0);
    });

    it('POST /api/routing-table returns router FIB', async () => {
        const res = await fetch(`${baseUrl}/api/routing-table`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                routerId: 'R4',
                nodes: fixtureNodes,
                edges: fixtureEdges
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.routerId, 'R4');
        assert.ok(Array.isArray(data.table));
    });
});
