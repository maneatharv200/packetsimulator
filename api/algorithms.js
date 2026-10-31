function runDijkstra(src, target, nodes, edges) {
    let dist = {}, prev = {};
    let pq = [];

    nodes.forEach(n => {
        dist[n.id] = Infinity;
        prev[n.id] = null;
    });
    dist[src] = 0;
    pq.push({ id: src, dist: 0 });

    while (pq.length > 0) {
        pq.sort((a, b) => a.dist - b.dist);
        let u = pq.shift().id;

        if (u === target) break;

        let neighbors = edges.filter(e => e.active && (e.source === u || e.target === u));
        neighbors.forEach(e => {
            let v = (e.source === u) ? e.target : e.source;
            let alt = dist[u] + e.weight;
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
                pq.push({ id: v, dist: alt });
            }
        });
    }
    return { dist, prev };
}

function runDistanceVector(src, target, nodes, edges) {
    let dist = {}, prev = {};
    nodes.forEach(n => {
        dist[n.id] = Infinity;
        prev[n.id] = null;
    });
    dist[src] = 0;

    let activeEdges = edges.filter(e => e.active);

    // Bellman-Ford: Relax all edges |V| - 1 times
    for (let i = 0; i < nodes.length - 1; i++) {
        let updated = false;
        for (let e of activeEdges) {
            let u = e.source, v = e.target, w = e.weight;
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
        if (!updated) break;
    }
    return { dist, prev };
}

module.exports = {
    runDijkstra,
    runDistanceVector
};
