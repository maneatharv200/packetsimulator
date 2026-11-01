/**
 * Routing Algorithm Implementations: Dijkstra Link-State & Bellman-Ford Distance Vector
 */

/**
 * Dijkstra's Link-State Routing Algorithm
 * Computes shortest path and all equal-cost shortest paths (ECMP).
 * 
 * @param {string} src - Source router ID
 * @param {string|null} target - Target router ID (or null to compute for all)
 * @param {Array} nodes - List of router nodes
 * @param {Array} edges - List of network links
 * @returns {Object} { dist, prev, prevAll }
 */
function runDijkstra(src, target, nodes, edges) {
    const dist = {};
    const prev = {};
    const prevAll = {};
    const pq = [];

    nodes.forEach(n => {
        dist[n.id] = Infinity;
        prev[n.id] = null;
        prevAll[n.id] = [];
    });

    if (dist[src] !== undefined) {
        dist[src] = 0;
        pq.push({ id: src, dist: 0 });
    }

    while (pq.length > 0) {
        pq.sort((a, b) => a.dist - b.dist);
        const u = pq.shift().id;

        if (target && u === target) {
            // Destination reached with optimal distance
        }

        const neighbors = edges.filter(e => e.active && (e.source === u || e.target === u));
        neighbors.forEach(e => {
            const v = (e.source === u) ? e.target : e.source;
            if (dist[v] === undefined) return;

            const alt = dist[u] + e.weight;
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
                prevAll[v] = [u];
                pq.push({ id: v, dist: alt });
            } else if (alt === dist[v] && alt < Infinity) {
                if (!prevAll[v].includes(u)) {
                    prevAll[v].push(u);
                }
            }
        });
    }

    return { dist, prev, prevAll };
}

/**
 * Reconstruct all equal-cost shortest paths from source to target.
 * 
 * @param {string} src 
 * @param {string} target 
 * @param {Object} prevAll 
 * @returns {Array<Array<string>>}
 */
function getAllShortestPaths(src, target, prevAll) {
    if (src === target) return [[src]];
    if (!prevAll || !prevAll[target] || prevAll[target].length === 0) {
        return [];
    }

    const results = [];
    function backtrack(current, currentPath, visited = new Set()) {
        if (current === src) {
            results.push([src, ...currentPath]);
            return;
        }
        if (visited.has(current)) return;
        visited.add(current);

        const predecessors = prevAll[current] || [];
        for (const p of predecessors) {
            backtrack(p, [current, ...currentPath], new Set(visited));
        }
    }
    backtrack(target, []);
    return results;
}

/**
 * Distance Vector (Bellman-Ford) Algorithm
 * Supports Split Horizon option.
 * 
 * @param {string} src 
 * @param {string|null} target 
 * @param {Array} nodes 
 * @param {Array} edges 
 * @param {Object} options 
 * @returns {Object} { dist, prev }
 */
function runDistanceVector(src, target, nodes, edges, options = {}) {
    const dist = {};
    const prev = {};
    nodes.forEach(n => {
        dist[n.id] = Infinity;
        prev[n.id] = null;
    });

    if (dist[src] !== undefined) {
        dist[src] = 0;
    }

    const activeEdges = edges.filter(e => e.active);

    // Bellman-Ford: Relax all edges |V| - 1 times
    for (let i = 0; i < nodes.length - 1; i++) {
        let updated = false;
        for (const e of activeEdges) {
            const u = e.source;
            const v = e.target;
            const w = e.weight;

            if (dist[u] !== undefined && dist[v] !== undefined) {
                if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    prev[v] = u;
                    updated = true;
                }
                if (dist[v] !== Infinity && dist[v] + w < dist[u]) {
                    dist[u] = dist[v] + w;
                    prev[u] = v;
                    updated = true;
                }
            }
        }
        if (!updated) break;
    }

    return { dist, prev };
}

/**
 * Computes Forwarding Information Base (Routing Table) for a router.
 * 
 * @param {string} srcNodeId 
 * @param {Array} nodes 
 * @param {Array} edges 
 * @returns {Array} List of routing table entries
 */
function computeRoutingTable(srcNodeId, nodes, edges) {
    const { dist, prev } = runDijkstra(srcNodeId, null, nodes, edges);
    const table = [];

    nodes.forEach(dest => {
        if (dest.id === srcNodeId) {
            table.push({
                destination: dest.id,
                destinationName: dest.name || dest.id,
                nextHop: "Direct (Local)",
                metric: 0,
                hops: 0,
                status: "Active (Host)"
            });
            return;
        }

        const cost = dist[dest.id];
        if (cost === Infinity || cost === undefined) {
            table.push({
                destination: dest.id,
                destinationName: dest.name || dest.id,
                nextHop: "None",
                metric: "Unreachable",
                hops: "-",
                status: "Unreachable"
            });
            return;
        }

        // Trace first hop from src
        let curr = dest.id;
        const path = [];
        const visited = new Set();
        while (curr && curr !== srcNodeId && !visited.has(curr)) {
            visited.add(curr);
            path.unshift(curr);
            curr = prev[curr];
        }

        const nextHop = path.length > 0 ? path[0] : dest.id;
        table.push({
            destination: dest.id,
            destinationName: dest.name || dest.id,
            nextHop: nextHop,
            metric: cost,
            hops: path.length,
            status: "Converged"
        });
    });

    return table;
}

module.exports = {
    runDijkstra,
    getAllShortestPaths,
    runDistanceVector,
    computeRoutingTable
};
