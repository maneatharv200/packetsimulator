# In-Depth Technical Architecture & Code Explanation

This document provides a conceptual and architectural breakdown of the Packet Routing Simulator codebase, explaining data structures, algorithms, mathematical formulations, and execution flows across the backend and frontend.

---

## 1. Backend Architecture (`server.js`)

The backend is built as a zero-dependency HTTP server utilizing Node.js core modules (`http`, `fs`, `path`, and `perf_hooks`).

### A. Adjacency List & Graph Structure
In memory, the network graph is maintained as an array of node objects and edge objects:
* Each Node: `{ id: "R1", name: "Router 1", x: 100, y: 120 }`
* Each Edge: `{ id: "e1", source: "R1", target: "R2", weight: 4, active: true }`

Edges represent bidirectional physical cables. When an edge's `active` property is set to `false`, it is excluded from neighbor discovery, simulating a severed fiber cable or interface shutdown.

### B. Dijkstra Link-State Implementation with ECMP
The Dijkstra implementation solves the single-source shortest path problem and discovers all equal-cost shortest paths:

```javascript
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
    dist[src] = 0;
    pq.push({ id: src, dist: 0 });

    while (pq.length > 0) {
        pq.sort((a, b) => a.dist - b.dist);
        const u = pq.shift().id;

        const neighbors = edges.filter(e => e.active && (e.source === u || e.target === u));
        neighbors.forEach(e => {
            const v = (e.source === u) ? e.target : e.source;
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
```

* **Equal-Cost Multi-Path (ECMP) Backtracking:**
  When `alt < dist[v]`, any previous parent candidates are discarded, and `prevAll[v]` is reset to `[u]`.
  When `alt === dist[v]`, an alternative path of identical cost has been discovered, and `u` is added to `prevAll[v]`.
  The companion function `getAllShortestPaths(src, target, prevAll)` performs recursive depth-first backtracking from the destination back to the origin, extracting all parallel shortest path sequences.

### C. Distance Vector (Bellman-Ford) Engine
```javascript
function runDistanceVector(src, target, nodes, edges, options = {}) {
    // Distance array initialization
    for (let i = 0; i < nodes.length - 1; i++) {
        let updated = false;
        for (const e of activeEdges) {
            const u = e.source, v = e.target, w = e.weight;
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
```
* **Split Horizon Logic:** When enabled, reverse advertisements along the incoming next-hop link are suppressed to eliminate two-node count-to-infinity routing loops.

### D. Scientific Microsecond Compute Time Benchmarking
To circumvent timer granularity limits on single short computations, the backend executes a rigorous benchmark loop over 1,000 runs:

```javascript
const BENCHMARK_RUNS = 1000;
const tBenchStart = performance.now();
for (let i = 0; i < BENCHMARK_RUNS; i++) {
    if (algoStr === 'distance_vector') {
        runDistanceVector(src, target, activeNodes, simEdges, options);
    } else {
        runDijkstra(src, target, activeNodes, simEdges);
    }
}
const totalBenchmarkElapsed = performance.now() - tBenchStart;
const avgTimeMs = totalBenchmarkElapsed / BENCHMARK_RUNS;
const avgTimeUs = avgTimeMs * 1000;
```
This produces mathematically reproducible microsecond execution measurements ($\mu$s) that reflect true CPU processing latency.

### E. Cyber Threat Modeling: Rogue Router & RPKI Quarantine
* **Without RPKI Defense:** When a rogue router is active, the simulator injects low-cost link overrides ($w = 1$), causing neighboring shortest path trees to converge into the rogue node. If a packet enters the rogue router, the transmission loop breaks with a blackhole drop alert.
* **With RPKI Defense:** The origin validation filter detects the unauthorized advertisement, flags the anomaly, quarantines the rogue node from the active graph (`activeNodes = activeNodes.filter(...)`), and recalculates an authentic alternative route.

### F. Forwarding Information Base (FIB) Generation
The `/api/routing-table` endpoint invokes `computeRoutingTable(routerId, nodes, edges)`. It executes a single-pass link-state shortest path tree from the specified router to all other nodes in the network, returning a structured table of Destination, Next-Hop, Metric Cost, and Reachability Status.

---

## 2. Frontend Architecture (`public/js/`)

### A. GraphUI Class (`graph-ui.js`)
* **Namespace Handling:** Utilizes `document.createElementNS("http://www.w3.org/2000/svg", tag)` to manipulate SVG vector elements directly within the browser DOM.
* **Physics & Easing:**
  Packet motion is calculated using a cubic easing function:
  $$E(p) = \begin{cases} 4p^3 & p < 0.5 \\ 1 - \frac{(-2p + 2)^3}{2} & p \ge 0.5 \end{cases}$$
  This ensures smooth acceleration from router departure to arrival.
* **Multi-Flow ECMP Rendering:**
  In Flow Burst mode, multiple packets (`packet-flow-1`, `packet-flow-2`, etc.) are spawned asynchronously and animated along their respective paths with staggered time offsets.
* **Speed Scaling:**
  A speed multiplier dynamically adjusts per-hop durations ($T = \frac{450\text{ ms}}{\text{speed}}$), supporting $1.0\times$, $2.0\times$, $0.5\times$, and instant rendering.

### B. Application State Management (`app.js`)
* **Interactive Mode State:** Tracks whether the user is in `idle`, `add_node`, or `add_edge` mode.
* **FIB Modal Integration:** Clicking any router in idle mode queries the backend via `API.fetchRoutingTable()` and renders a formatted table inside an accessible modal overlay.
* **Benchmark Comparison Modal:** The `btnCompare` handler requests `/api/compare` and constructs an empirical evaluation matrix comparing Dijkstra and Distance Vector across 2,000 iterations.

### C. Client API Module (`api.js`)
Encapsulates all asynchronous `fetch()` requests with standard JSON headers and error propagation. Employs `AbortController` on background health checks to prevent dangling sockets.

---

## 3. Communication Protocol (REST API Contracts)

### `POST /api/simulate`
* **Request Payload:**
  ```json
  {
    "source": "R1",
    "target": "R6",
    "algorithm": "dijkstra",
    "options": {
      "trafficMode": "flow_burst",
      "qosClass": "expedited_forwarding",
      "simulateRogue": true,
      "rogueNodeId": "R2",
      "rpkiEnabled": true,
      "congestionAware": false,
      "splitHorizon": true
    },
    "nodes": [...],
    "edges": [...]
  }
  ```
* **Response Payload:**
  ```json
  {
    "success": true,
    "algorithm": "dijkstra",
    "totalCost": 7,
    "hops": 3,
    "computationTimeMs": 0.0038,
    "computationTimeUs": 3.82,
    "benchmarkRuns": 1000,
    "delivered": true,
    "trace": [...],
    "ecmpPaths": [["R1","R2","R4","R6"], ["R1","R3","R5","R6"]],
    "quarantinedNodes": ["R2"],
    "qosApplied": "expedited_forwarding"
  }
  ```

### `POST /api/routing-table`
* **Request Payload:** `{ "routerId": "R1", "nodes": [...], "edges": [...] }`
* **Response Payload:**
  ```json
  {
    "success": true,
    "routerId": "R1",
    "table": [
      { "destination": "R2", "nextHop": "R2", "metric": 3, "hops": 1, "status": "Converged" },
      { "destination": "R6", "nextHop": "R3", "metric": 7, "hops": 3, "status": "Converged" }
    ]
  }
  ```

### `POST /api/compare`
* **Request Payload:** `{ "source": "R1", "target": "R6", "nodes": [...], "edges": [...] }`
* **Response Payload:**
  ```json
  {
    "success": true,
    "iterations": 2000,
    "dijkstra": { "protocol": "Link-State (OSPF)", "avgTimeUs": 3.32, "complexity": "O((V + E) log V)" },
    "distanceVector": { "protocol": "Distance Vector (RIP)", "avgTimeUs": 2.14, "complexity": "O(V * E)" }
  }
  ```
