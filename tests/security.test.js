const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCidr,
    isSubnetOf,
    DEFAULT_ROAS,
    validateRouteOrigin,
    createRouteAnnouncements,
    applySecurityPolicy
} = require('../api/security');

const {
    runDijkstra,
    runDistanceVector,
    getAllShortestPaths,
    computeRoutingTable
} = require('../api/algorithms');

const simulateHandler = require('../api/simulate');

// Standard 7-Router Test Fixture
function getStandardFixture() {
    return {
        nodes: [
            { id: "R1", name: "Router 1" },
            { id: "R2", name: "Router 2" },
            { id: "R3", name: "Router 3" },
            { id: "R4", name: "Router 4" },
            { id: "R5", name: "Router 5" },
            { id: "R6", name: "Router 6" },
            { id: "R7", name: "Router 7" }
        ],
        edges: [
            { id: "e1", source: "R1", target: "R2", weight: 4, active: true },
            { id: "e2", source: "R2", target: "R3", weight: 3, active: true },
            { id: "e3", source: "R1", target: "R4", weight: 2, active: true },
            { id: "e4", source: "R2", target: "R5", weight: 3, active: true },
            { id: "e5", source: "R3", target: "R6", weight: 2, active: true },
            { id: "e6", source: "R4", target: "R5", weight: 3, active: true },
            { id: "e7", source: "R5", target: "R6", weight: 2, active: true },
            { id: "e8", source: "R4", target: "R7", weight: 4, active: true },
            { id: "e9", source: "R6", target: "R7", weight: 3, active: true }
        ]
    };
}

// Disconnected Topology Fixture where intermediate node is the single bridge
function getBridgeFixture() {
    return {
        nodes: [
            { id: "R1", name: "Router 1" },
            { id: "R2", name: "Router 2" },
            { id: "R3", name: "Router 3" }
        ],
        edges: [
            { id: "e1", source: "R1", target: "R2", weight: 2, active: true },
            { id: "e2", source: "R2", target: "R3", weight: 2, active: true }
        ]
    };
}

function mockSimulate(payload) {
    return new Promise((resolve) => {
        const req = {
            method: 'POST',
            body: payload
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            setHeader: () => {},
            writeHead: (status) => { statusCode = status; },
            status: (status) => { statusCode = status; return res; },
            json: (data) => { responseData = data; resolve({ status: statusCode, body: data }); },
            send: (data) => { responseData = data; resolve({ status: statusCode, body: data }); },
            end: (data) => {
                if (data && typeof data === 'string') {
                    try { responseData = JSON.parse(data); } catch { responseData = data; }
                }
                resolve({ status: statusCode, body: responseData });
            }
        };
        simulateHandler(req, res);
    });
}

describe('RPKI Origin Validation & Security Engine', () => {

    it('Test 4: Valid origin announcement matches ROA', () => {
        const roas = [
            { prefix: '10.0.0.0/24', asn: 100, maxLength: 24 }
        ];
        const announcement = {
            prefix: '10.0.0.0/24',
            originAsn: 100,
            advertisingRouter: 'R7',
            id: 'ann-1'
        };
        const res = validateRouteOrigin(announcement, roas);
        assert.equal(res.status, 'VALID');
        assert.ok(res.matchedRoa);
        assert.equal(res.matchedRoa.asn, 100);
    });

    it('Test 5: Invalid origin ASN is rejected when covering ROA exists', () => {
        const roas = [
            { prefix: '10.0.0.0/24', asn: 100, maxLength: 24 }
        ];
        const announcement = {
            prefix: '10.0.0.0/24',
            originAsn: 999, // Rogue ASN
            advertisingRouter: 'R5',
            id: 'ann-rogue'
        };
        const res = validateRouteOrigin(announcement, roas);
        assert.equal(res.status, 'INVALID');
        assert.equal(res.matchedRoa, null);
        assert.match(res.reason, /Unauthorized origin AS 999/);
    });

    it('Test 6: Prefix-length violation exceeding maxLength produces INVALID', () => {
        const roas = [
            { prefix: '10.0.0.0/16', asn: 100, maxLength: 24 }
        ];
        // Announcing a /25 when max length is /24
        const announcement = {
            prefix: '10.0.0.0/25',
            originAsn: 100,
            advertisingRouter: 'R7',
            id: 'ann-too-specific'
        };
        const res = validateRouteOrigin(announcement, roas);
        assert.equal(res.status, 'INVALID');
        assert.match(res.reason, /exceeds authorized maxLength/);
    });

    it('Test 7: Route with no matching ROA returns NOT_FOUND', () => {
        const roas = [
            { prefix: '10.0.0.0/24', asn: 100, maxLength: 24 }
        ];
        const announcement = {
            prefix: '192.168.100.0/24',
            originAsn: 300,
            advertisingRouter: 'R3',
            id: 'ann-unknown'
        };
        const res = validateRouteOrigin(announcement, roas);
        assert.equal(res.status, 'NOT_FOUND');
        assert.equal(res.coveringRoas.length, 0);
    });
});

describe('Packet Simulation & Rogue Attack Defense Scenarios', () => {

    it('Test 1: Normal routing with attack disabled (Attack OFF)', async () => {
        const fixture = getStandardFixture();
        const payload = {
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: false,
                rpkiEnabled: false
            }
        };

        const res = await mockSimulate(payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.delivered, true);
        assert.equal(res.body.securityStatus, 'VERIFIED_NORMAL');
        // Optimal path R1 -> R4 -> R7 (cost: 2 + 4 = 6)
        assert.deepEqual(res.body.path, ['R1', 'R4', 'R7']);
        assert.equal(res.body.totalCost, 6);
        assert.equal(res.body.hops, 2);
    });

    it('Test 2: Rogue attack enabled and RPKI defense disabled (Attack ON, Defense OFF)', async () => {
        const fixture = getStandardFixture();
        const payload = {
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: false,
                rogueAsn: 999
            }
        };

        const res = await mockSimulate(payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        // Packets diverted towards rogue R2 and intercepted/dropped
        assert.equal(res.body.delivered, false);
        assert.equal(res.body.securityStatus, 'ROGUE_ATTACK_ACTIVE');
        assert.ok(res.body.trace.some(t => t.dropped === true && t.node === 'R2'));
        assert.ok(res.body.rpkiResults.some(r => r.isRogue && r.status === 'INVALID'));
    });

    it('Test 3: Rogue attack enabled and RPKI defense enabled (Attack ON, Defense ON)', async () => {
        const fixture = getStandardFixture();
        const payload = {
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: true,
                rogueAsn: 999
            }
        };

        const res = await mockSimulate(payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.delivered, true);
        assert.equal(res.body.securityStatus, 'RPKI_INVALID_REJECTED');
        // Safe alternative route taken to legitimate destination R7
        assert.deepEqual(res.body.path, ['R1', 'R4', 'R7']);
        assert.deepEqual(res.body.quarantinedNodes, ['R2']);
        assert.equal(res.body.rejectedRoutes.length, 1);
        assert.equal(res.body.quarantinedRoutes.length, 1);
        assert.equal(res.body.rejectedRoutes[0].originAsn, 999);
    });

    it('Test 8: Unreachable destination after RPKI quarantine filtering', async () => {
        // Topology: R1 -- R2 (rogue) -- R3. R2 is the ONLY link to R3.
        const fixture = getBridgeFixture();
        const payload = {
            source: 'R1',
            target: 'R3',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: true
            }
        };

        const res = await mockSimulate(payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        // Delivery must report false because no alternative path exists around quarantined R2
        assert.equal(res.body.delivered, false);
        assert.equal(res.body.securityStatus, 'RPKI_BLOCKED_UNREACHABLE');
        assert.ok(res.body.trace.some(t => t.message.includes('no alternate physical path')));
    });

    it('Test 9: Source equals destination (Local Delivery)', async () => {
        const fixture = getStandardFixture();
        const payload = {
            source: 'R1',
            target: 'R1',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: false,
                rpkiEnabled: false
            }
        };

        const res = await mockSimulate(payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.delivered, true);
        assert.deepEqual(res.body.path, ['R1']);
        assert.equal(res.body.totalCost, 0);
        assert.equal(res.body.hops, 0);
    });

    it('Test 10: Unknown source, destination, or rogue router IDs', async () => {
        const fixture = getStandardFixture();

        // Unknown source
        const resBadSrc = await mockSimulate({
            source: 'NON_EXISTENT',
            target: 'R7',
            nodes: fixture.nodes,
            edges: fixture.edges
        });
        assert.equal(resBadSrc.status, 400);
        assert.match(resBadSrc.body.error, /Source router "NON_EXISTENT" not found/);

        // Unknown destination
        const resBadDst = await mockSimulate({
            source: 'R1',
            target: 'UNKNOWN_DST',
            nodes: fixture.nodes,
            edges: fixture.edges
        });
        assert.equal(resBadDst.status, 400);
        assert.match(resBadDst.body.error, /Destination router "UNKNOWN_DST" not found/);

        // Unknown rogue node
        const resBadRogue = await mockSimulate({
            source: 'R1',
            target: 'R7',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'FAKE_ROGUE'
            }
        });
        assert.equal(resBadRogue.status, 400);
        assert.match(resBadRogue.body.error, /Compromised rogue router "FAKE_ROGUE" not found/);
    });

    it('Test 11: Both Dijkstra and Distance Vector with security enabled', async () => {
        const fixture = getStandardFixture();

        // Run Dijkstra with security
        const resDijkstra = await mockSimulate({
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: true
            }
        });

        // Run Distance Vector with security
        const resDV = await mockSimulate({
            source: 'R1',
            target: 'R7',
            algorithm: 'distance_vector',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: true
            }
        });

        assert.equal(resDijkstra.body.delivered, true);
        assert.equal(resDV.body.delivered, true);
        assert.deepEqual(resDijkstra.body.path, resDV.body.path);
        assert.equal(resDijkstra.body.totalCost, resDV.body.totalCost);
        assert.equal(resDijkstra.body.securityStatus, resDV.body.securityStatus);
    });

    it('Test 12: Original topology remains unchanged after simulation', async () => {
        const fixture = getStandardFixture();
        const nodesCloneBefore = JSON.stringify(fixture.nodes);
        const edgesCloneBefore = JSON.stringify(fixture.edges);

        await mockSimulate({
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R2',
                rpkiEnabled: true,
                congestionAware: true
            }
        });

        assert.equal(JSON.stringify(fixture.nodes), nodesCloneBefore);
        assert.equal(JSON.stringify(fixture.edges), edgesCloneBefore);
    });

    it('Test 13: Accurate security outcomes without contradictions', async () => {
        const fixture = getStandardFixture();
        const res = await mockSimulate({
            source: 'R1',
            target: 'R7',
            algorithm: 'dijkstra',
            nodes: fixture.nodes,
            edges: fixture.edges,
            options: {
                simulateRogue: true,
                rogueNodeId: 'R5',
                rpkiEnabled: true
            }
        });

        assert.equal(res.body.success, true);
        assert.equal(res.body.delivered, true);
        assert.ok(res.body.totalCost > 0);
        assert.ok(res.body.hops > 0);
        assert.ok(Array.isArray(res.body.path) && res.body.path.length > 0);
        // Quarantined node must not be in final path
        assert.ok(!res.body.path.includes('R5'));
        // Quarantined route list must be populated
        assert.equal(res.body.quarantinedRoutes.length, 1);
        assert.equal(res.body.quarantinedRoutes[0].advertisingRouter, 'R5');
    });

    it('Test 14: Strict RPKI policy rejects NOT_FOUND when configured', () => {
        const announcements = [{
            id: 'ann-unregistered',
            prefix: '198.51.100.0/24',
            originAsn: 64500,
            advertisingRouter: 'R4'
        }];
        const roas = DEFAULT_ROAS;

        // Default policy permits NOT_FOUND
        const defaultPolicy = applySecurityPolicy(announcements, roas, { rpkiEnabled: true, rejectNotFound: false });
        assert.equal(defaultPolicy.eligibleRoutes.length, 1);
        assert.equal(defaultPolicy.rejectedRoutes.length, 0);

        // Strict policy rejects NOT_FOUND
        const strictPolicy = applySecurityPolicy(announcements, roas, { rpkiEnabled: true, rejectNotFound: true });
        assert.equal(strictPolicy.eligibleRoutes.length, 0);
        assert.equal(strictPolicy.rejectedRoutes.length, 1);
        assert.equal(strictPolicy.rejectedRoutes[0].id, 'ann-unregistered');
    });
});

describe('Protocol Benchmark & Routing Table API Endpoints', () => {
    const compareHandler = require('../api/compare');
    const routingTableHandler = require('../api/routing-table');

    function mockApiCall(handler, payload) {
        return new Promise((resolve) => {
            const req = { method: 'POST', body: payload };
            let statusCode = 200;
            const res = {
                setHeader: () => {},
                writeHead: (s) => { statusCode = s; },
                status: (s) => { statusCode = s; return res; },
                json: (d) => resolve({ status: statusCode, body: d }),
                send: (d) => resolve({ status: statusCode, body: d }),
                end: (d) => {
                    try { resolve({ status: statusCode, body: JSON.parse(d) }); }
                    catch { resolve({ status: statusCode, body: d }); }
                }
            };
            handler(req, res);
        });
    }

    it('Compare API returns complete benchmarking schema', async () => {
        const fixture = getStandardFixture();
        const res = await mockApiCall(compareHandler, {
            source: 'R1',
            target: 'R7',
            nodes: fixture.nodes,
            edges: fixture.edges
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.dijkstra.avgTimeUs > 0);
        assert.ok(res.body.distanceVector.avgTimeUs > 0);
        assert.equal(res.body.dijkstra.protocol, 'Link-State (OSPF / IS-IS)');
        assert.equal(res.body.distanceVector.protocol, 'Distance Vector (RIPv1 / RIPv2)');
    });

    it('Routing Table API computes FIB entries for requested router', async () => {
        const fixture = getStandardFixture();
        const res = await mockApiCall(routingTableHandler, {
            routerId: 'R1',
            nodes: fixture.nodes,
            edges: fixture.edges
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.routerId, 'R1');
        assert.ok(Array.isArray(res.body.table));
        assert.equal(res.body.table.length, 7);

        const r1Self = res.body.table.find(e => e.destination === 'R1');
        assert.equal(r1Self.metric, 0);
        assert.equal(r1Self.nextHop, 'Direct (Local)');

        const r7Entry = res.body.table.find(e => e.destination === 'R7');
        assert.equal(r7Entry.metric, 6);
        assert.equal(r7Entry.nextHop, 'R4');
        assert.equal(r7Entry.status, 'Converged');
    });
});

