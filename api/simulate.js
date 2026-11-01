const { runDijkstra, getAllShortestPaths, runDistanceVector } = require('./algorithms');
const {
    DEFAULT_ROAS,
    createRouteAnnouncements,
    applySecurityPolicy
} = require('./security');

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
        const algoStr = data.algorithm || 'dijkstra';
        const options = data.options || {};
        const nodes = data.nodes || [];
        const edges = data.edges || [];

        // 1. Validation & Input Sanitization
        if (!src || !target) {
            return sendJson(res, 400, { success: false, error: "Missing required fields: source and target router IDs." });
        }

        if (!Array.isArray(nodes) || nodes.length === 0) {
            return sendJson(res, 400, { success: false, error: "Invalid topology: nodes array is empty or missing." });
        }

        if (nodes.length > 100 || edges.length > 500) {
            return sendJson(res, 400, { success: false, error: "Topology exceeds maximum supported size (100 nodes, 500 edges)." });
        }

        const srcNode = nodes.find(n => n.id === src);
        if (!srcNode) {
            return sendJson(res, 400, { success: false, error: `Source router "${src}" not found in topology.` });
        }

        const targetNode = nodes.find(n => n.id === target);
        if (!targetNode) {
            return sendJson(res, 400, { success: false, error: `Destination router "${target}" not found in topology.` });
        }

        const rogueNodeId = options.rogueNodeId || null;
        const simulateRogue = Boolean(options.simulateRogue && rogueNodeId);
        const rpkiEnabled = Boolean(options.rpkiEnabled);

        if (simulateRogue && !nodes.some(n => n.id === rogueNodeId)) {
            return sendJson(res, 400, { success: false, error: `Compromised rogue router "${rogueNodeId}" not found in topology.` });
        }

        // 2. Deep clone topology to prevent mutation of client data
        let activeNodes = JSON.parse(JSON.stringify(nodes));
        let simEdges = JSON.parse(JSON.stringify(edges));

        // Optional dynamic congestion simulation
        if (options.congestionAware) {
            simEdges.forEach(e => {
                if (e.active && Math.random() > 0.3) {
                    e.weight += Math.floor(Math.random() * 6) + 3;
                }
            });
        }

        const trace = [];
        const destinationPrefix = options.destinationPrefix || '10.0.0.0/24';
        const targetAsn = options.targetAsn || 100;
        const rogueAsn = options.rogueAsn || 999;
        const roaList = Array.isArray(options.roas) ? options.roas : DEFAULT_ROAS;

        // 3. Security Engine: Route Announcements & RPKI Policy
        const announcements = createRouteAnnouncements({
            target,
            prefix: destinationPrefix,
            targetAsn,
            simulateRogue,
            rogueNodeId,
            rogueAsn
        });

        const {
            rpkiResults,
            eligibleRoutes,
            rejectedRoutes,
            quarantinedRoutes,
            securityEvents
        } = applySecurityPolicy(announcements, roaList, {
            rpkiEnabled,
            rejectNotFound: options.rejectNotFound
        });

        // Insert security events into protocol trace
        securityEvents.forEach(evt => {
            trace.push({
                node: src,
                edge: null,
                message: evt.message,
                timestamp: evt.timestamp
            });
        });

        let quarantinedNodes = [];
        let securityStatus = 'VERIFIED_NORMAL';

        // 4. Determine Active Routing Topology & Security State
        let destinationGoal = target;
        let isIntercepted = false;

        if (simulateRogue) {
            if (rpkiEnabled) {
                // Defense ON: Rogue announcement rejected & quarantined
                securityStatus = 'RPKI_INVALID_REJECTED';
                quarantinedNodes = [rogueNodeId];

                // Route policy isolates the invalid announcement.
                // To guarantee packet safety around the compromised node, isolate it from active topology.
                activeNodes = activeNodes.filter(n => n.id !== rogueNodeId);
                simEdges = simEdges.filter(e => e.source !== rogueNodeId && e.target !== rogueNodeId);

                trace.push({
                    node: src,
                    edge: null,
                    message: `[RPKI Defense Enforcement] Quarantined invalid route announcement from ${rogueNodeId}. Rerouting traffic along verified path to legitimate origin AS ${targetAsn} at ${target}.`
                });
            } else {
                // Defense OFF: Malicious announcement accepted, attracting traffic to rogue router
                securityStatus = 'ROGUE_ATTACK_ACTIVE';
                destinationGoal = rogueNodeId; // Traffic hijacked toward rogue router

                trace.push({
                    node: src,
                    edge: null,
                    message: `[SECURITY ALERT] Rogue router ${rogueNodeId} is broadcasting poisoned low-cost advertisements for prefix ${destinationPrefix} (Origin AS ${rogueAsn}). Traffic is being diverted!`
                });

                // Malicious advertisement lowers effective link metrics towards rogue router (Blackhole Sinkhole)
                simEdges.forEach(e => {
                    if (e.source === rogueNodeId || e.target === rogueNodeId) {
                        e.weight = Math.min(e.weight, 1);
                    }
                });
            }
        }

        // 5. Scientific Benchmark Measurement (1,000 Iterations)
        const BENCHMARK_RUNS = 1000;
        const tBenchStart = performance.now();
        for (let i = 0; i < BENCHMARK_RUNS; i++) {
            if (algoStr === 'distance_vector') {
                runDistanceVector(src, destinationGoal, activeNodes, simEdges, options);
            } else {
                runDijkstra(src, destinationGoal, activeNodes, simEdges);
            }
        }
        const totalBenchmarkElapsed = performance.now() - tBenchStart;
        const avgTimeMs = totalBenchmarkElapsed / BENCHMARK_RUNS;
        const avgTimeUs = avgTimeMs * 1000;

        // 6. Path Reconstruction
        let dist, prev, prevAll;
        if (algoStr === 'distance_vector') {
            ({ dist, prev } = runDistanceVector(src, destinationGoal, activeNodes, simEdges, options));
            if (options.splitHorizon) {
                trace.push({
                    node: src,
                    edge: null,
                    message: "Split Horizon Enabled: Poison reverse updates applied to suppress routing loops."
                });
            }
        } else {
            ({ dist, prev, prevAll } = runDijkstra(src, destinationGoal, activeNodes, simEdges));
        }

        // Edge case: Source === Destination
        if (src === target && !simulateRogue) {
            trace.push({
                node: src,
                edge: null,
                message: `Source and destination are the same router (${src}). Local host delivery confirmed.`
            });
            return sendJson(res, 200, {
                success: true,
                delivered: true,
                algorithm: algoStr,
                path: [src],
                totalCost: 0,
                hops: 0,
                trace,
                securityStatus: 'VERIFIED_NORMAL',
                securityEvents,
                rpkiResults,
                rejectedRoutes,
                quarantinedRoutes,
                quarantinedNodes: [],
                computationTimeMs: parseFloat(avgTimeMs.toFixed(4)),
                computationTimeUs: parseFloat(avgTimeUs.toFixed(2)),
                benchmarkRuns: BENCHMARK_RUNS,
                ecmpPaths: [[src]],
                qosApplied: options.qosClass || 'best_effort'
            });
        }

        let pathNodes = [];
        let curr = destinationGoal;
        const visitedPathCheck = new Set();

        while (curr && activeNodes.some(n => n.id === curr) && !visitedPathCheck.has(curr)) {
            visitedPathCheck.add(curr);
            pathNodes.unshift(curr);
            curr = prev ? prev[curr] : null;
        }

        let delivered = false;
        let totalCost = 0;
        let hops = 0;
        let ecmpPaths = [];

        // ECMP Calculation for Dijkstra
        if (algoStr === 'dijkstra' && prevAll && destinationGoal) {
            const allPaths = getAllShortestPaths(src, destinationGoal, prevAll);
            if (allPaths.length > 1) {
                ecmpPaths = allPaths;
                trace.push({
                    node: src,
                    edge: null,
                    message: `ECMP Optimization: Discovered ${allPaths.length} equal-cost parallel paths. Load-balancing traffic flows across links.`
                });
            }
        }

        const qosClass = options.qosClass || 'best_effort';
        const qosQueueDelayMs = qosClass === 'expedited_forwarding' ? 0 : 12;

        // Path Verification & Hop Tracing
        if (pathNodes.length > 0 && pathNodes[0] === src) {
            for (let i = 0; i < pathNodes.length - 1; i++) {
                const u = pathNodes[i];
                const v = pathNodes[i + 1];

                // Check if path entered compromised rogue node without RPKI defense
                if (simulateRogue && !rpkiEnabled && u === rogueNodeId) {
                    isIntercepted = true;
                    trace.push({
                        node: u,
                        edge: null,
                        dropped: true,
                        message: `CRITICAL: Packet intercepted by Rogue Router ${u} (Origin AS ${rogueAsn}). Malicious blackhole packet drop executed.`
                    });
                    break;
                }

                const edge = simEdges.find(e => e.active && ((e.source === u && e.target === v) || (e.source === v && e.target === u)));
                if (edge) {
                    totalCost += edge.weight;
                    hops++;

                    const qosNotice = qosClass === 'expedited_forwarding'
                        ? '[QoS: Expedited Forwarding - 0ms queue latency]'
                        : `[QoS: Best-Effort - +${qosQueueDelayMs}ms queue buffer delay]`;

                    trace.push({
                        node: u,
                        edge: edge.id,
                        message: `Forwarded via ${u} -> ${v} (link metric: ${edge.weight}) ${qosNotice}`
                    });
                }
            }

            // Check final node if it was the rogue node
            if (simulateRogue && !rpkiEnabled && pathNodes[pathNodes.length - 1] === rogueNodeId) {
                isIntercepted = true;
                trace.push({
                    node: rogueNodeId,
                    edge: null,
                    dropped: true,
                    message: `CRITICAL: Packet reached Rogue Router ${rogueNodeId} claiming origin AS ${rogueAsn}. Intercepted and discarded in blackhole sinkhole!`
                });
            } else if (!isIntercepted && pathNodes[pathNodes.length - 1] === target) {
                trace.push({
                    node: target,
                    edge: null,
                    message: `Packet successfully arrived at legitimate destination router ${target} (Prefix ${destinationPrefix}, Origin AS ${targetAsn}). Delivery confirmed.`
                });
                delivered = true;
            }
        } else {
            // No path found
            trace.push({
                node: src,
                edge: null,
                message: simulateRogue && rpkiEnabled
                    ? `RPKI defense quarantined invalid route, but no alternate physical path connects router ${src} to destination ${target}.`
                    : `No active path connects source router ${src} to destination router ${target}.`
            });
            if (simulateRogue && rpkiEnabled) {
                securityStatus = 'RPKI_BLOCKED_UNREACHABLE';
            }
        }

        return sendJson(res, 200, {
            success: true,
            delivered,
            algorithm: algoStr,
            path: pathNodes,
            totalCost: delivered ? totalCost : null,
            hops: delivered ? hops : null,
            trace,
            securityStatus,
            securityEvents,
            rpkiResults,
            rejectedRoutes,
            quarantinedRoutes,
            quarantinedNodes,
            computationTimeMs: parseFloat(avgTimeMs.toFixed(4)),
            computationTimeUs: parseFloat(avgTimeUs.toFixed(2)),
            benchmarkRuns: BENCHMARK_RUNS,
            ecmpPaths,
            qosApplied: qosClass
        });

    } catch (e) {
        return sendJson(res, 500, { success: false, error: e.message });
    }
};
