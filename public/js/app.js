let graph = {
    nodes: [],
    edges: []
};

const ui = new GraphUI("visualization");

function showToast(msg, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

/**
 * Standard Multi-Router Topology (7 Nodes)
 */
function generateDemoGraph() {
    return {
        nodes: [
            { id: "R1", name: "Router 1", x: 100, y: 120 },
            { id: "R2", name: "Router 2", x: 300, y: 100 },
            { id: "R3", name: "Router 3", x: 500, y: 120 },
            { id: "R4", name: "Router 4", x: 120, y: 320 },
            { id: "R5", name: "Router 5", x: 300, y: 300 },
            { id: "R6", name: "Router 6", x: 480, y: 320 },
            { id: "R7", name: "Router 7", x: 300, y: 500 }
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

/**
 * Equal-Cost Multi-Path (ECMP) Topology
 * Designed with two identical minimum-cost paths (cost 6) between R1 and R6.
 */
function generateEcmpGraph() {
    return {
        nodes: [
            { id: "R1", name: "Spine Router 1 (Src)", x: 120, y: 280 },
            { id: "R2", name: "Leaf Router 2 (North)", x: 300, y: 140 },
            { id: "R3", name: "Leaf Router 3 (South)", x: 300, y: 420 },
            { id: "R4", name: "Aggregator 4", x: 480, y: 140 },
            { id: "R5", name: "Aggregator 5", x: 480, y: 420 },
            { id: "R6", name: "Spine Router 6 (Dst)", x: 650, y: 280 }
        ],
        edges: [
            // North equal-cost path (3 + 2 + 2 = 7)
            { id: "e1", source: "R1", target: "R2", weight: 3, active: true },
            { id: "e2", source: "R2", target: "R4", weight: 2, active: true },
            { id: "e3", source: "R4", target: "R6", weight: 2, active: true },
            // South equal-cost path (3 + 2 + 2 = 7)
            { id: "e4", source: "R1", target: "R3", weight: 3, active: true },
            { id: "e5", source: "R3", target: "R5", weight: 2, active: true },
            { id: "e6", source: "R5", target: "R6", weight: 2, active: true },
            // Cross-mesh interconnects
            { id: "e7", source: "R2", target: "R5", weight: 5, active: true },
            { id: "e8", source: "R3", target: "R4", weight: 5, active: true }
        ]
    };
}

function updateSelects() {
    const src = document.getElementById("sourceNode");
    const dst = document.getElementById("destNode");
    const rogue = document.getElementById("rogueNodeSelect");

    const srcVal = src.value;
    const dstVal = dst.value;
    const rogueVal = rogue.value;

    src.innerHTML = '';
    dst.innerHTML = '';
    rogue.innerHTML = '';

    graph.nodes.forEach(n => {
        src.add(new Option(n.name, n.id));
        dst.add(new Option(n.name, n.id));
        rogue.add(new Option(n.name, n.id));
    });

    if (srcVal && graph.nodes.some(n => n.id === srcVal)) src.value = srcVal;
    if (dstVal && graph.nodes.some(n => n.id === dstVal)) dst.value = dstVal;
    else if (graph.nodes.length > 1) dst.value = graph.nodes[graph.nodes.length - 1].id;

    if (rogueVal && graph.nodes.some(n => n.id === rogueVal)) rogue.value = rogueVal;
    else if (graph.nodes.length > 2) rogue.value = graph.nodes[1].id; // Default intermediate router

    refreshCanvas();
}

function refreshCanvas(extraOptions = {}) {
    const isRogueActive = document.getElementById("chkSimulateRogue").checked;
    const rogueId = isRogueActive ? document.getElementById("rogueNodeSelect").value : null;

    ui.drawGraph(graph, {
        srcNodeId: document.getElementById("sourceNode").value,
        dstNodeId: document.getElementById("destNode").value,
        rogueNodeId: rogueId,
        quarantinedNodes: extraOptions.quarantinedNodes || []
    });
}

// Topology Button Listeners
document.getElementById("btnLoadDemo").addEventListener("click", () => {
    graph = generateDemoGraph();
    updateSelects();
    showToast("Loaded standard mesh topology (7 routers)", "info");
});

document.getElementById("btnLoadEcmp").addEventListener("click", () => {
    graph = generateEcmpGraph();
    updateSelects();
    document.getElementById("trafficMode").value = "flow_burst";
    showToast("Loaded multi-path topology for ECMP flow balancing", "info");
});

document.getElementById("btnClear").addEventListener("click", () => {
    graph = { nodes: [], edges: [] };
    updateSelects();
    document.getElementById("logContent").innerHTML = "";
    document.getElementById("resStatus").textContent = "-";
    document.getElementById("resCost").textContent = "-";
    document.getElementById("resHops").textContent = "-";
    document.getElementById("resTime").textContent = "-";
    document.getElementById("resSecurity").textContent = "Idle";
    showToast("Canvas cleared", "info");
});

// Speed selector listener
document.getElementById("simSpeed").addEventListener("change", (e) => {
    ui.setSpeed(e.target.value);
});

// Security Controls toggle
const chkSimulateRogue = document.getElementById("chkSimulateRogue");
const rogueSelectContainer = document.getElementById("rogueSelectContainer");

chkSimulateRogue.addEventListener("change", () => {
    if (chkSimulateRogue.checked) {
        rogueSelectContainer.style.display = "flex";
        document.getElementById("resSecurity").textContent = "Rogue Node Armed";
        showToast("Rogue router simulation enabled", "info");
    } else {
        rogueSelectContainer.style.display = "none";
        document.getElementById("resSecurity").textContent = "Verified Normal";
    }
    refreshCanvas();
});

document.getElementById("rogueNodeSelect").addEventListener("change", () => refreshCanvas());
document.getElementById("chkRpkiDefense").addEventListener("change", () => refreshCanvas());

// Mode state: idle, add_node, add_edge
let appMode = 'idle';
let edgeStartNode = null;

document.getElementById("btnAddNode").addEventListener("click", () => {
    appMode = 'add_node';
    showToast("Click anywhere on the grid canvas to place a router", "info");
});

document.getElementById("btnAddEdge").addEventListener("click", () => {
    appMode = 'add_edge';
    edgeStartNode = null;
    showToast("Click the first router to begin link creation", "info");
});

document.getElementById("visualization").addEventListener("click", (e) => {
    if (appMode === 'add_node') {
        if (e.target.tagName !== 'svg' && e.target.tagName !== 'rect') return;
        const rect = document.getElementById("visualization").getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        const id = "R" + (graph.nodes.length + 1);
        graph.nodes.push({ id: id, name: "Router " + (graph.nodes.length + 1), x: x, y: y });
        appMode = 'idle';
        updateSelects();
        showToast(`Added ${id} at coordinates (${x}, ${y})`, "success");
    }
});

window.addEventListener('node-clicked', (e) => {
    const clickedNodeId = e.detail;

    if (appMode === 'add_edge') {
        if (!edgeStartNode) {
            edgeStartNode = clickedNodeId;
            showToast(`Selected origin router ${clickedNodeId}. Now click destination router.`, "info");
        } else {
            if (edgeStartNode !== clickedNodeId) {
                const weightStr = prompt(`Enter metric link weight between ${edgeStartNode} and ${clickedNodeId} (e.g. 1 - 10):`, "2");
                if (weightStr !== null) {
                    const weight = parseInt(weightStr) || 1;
                    const edgeId = "e" + (graph.edges.length + 1);
                    graph.edges.push({
                        id: edgeId,
                        source: edgeStartNode,
                        target: clickedNodeId,
                        weight: weight,
                        active: true
                    });
                    updateSelects();
                    showToast(`Created link between ${edgeStartNode} and ${clickedNodeId} (metric: ${weight})`, "success");
                }
            }
            edgeStartNode = null;
            appMode = 'idle';
        }
    } else if (appMode === 'idle') {
        // Inspect clicked router's Forwarding Information Base (FIB)
        openRoutingTableModal(clickedNodeId);
    }
});

[document.getElementById("sourceNode"), document.getElementById("destNode")].forEach(el => {
    el.addEventListener("change", () => refreshCanvas());
});

window.logTrace = function(msg, type = "normal") {
    if (!msg) return;
    const log = document.getElementById("logContent");
    const entry = document.createElement("div");
    entry.className = "log-entry";
    
    let msgClass = "log-msg";
    if (type === "security-alert") msgClass += " security-alert";
    if (type === "defense-alert") msgClass += " defense-alert";

    entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="${msgClass}">${msg}</span>`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
};

document.getElementById("btnClearLog").addEventListener("click", () => {
    document.getElementById("logContent").innerHTML = "";
});

/**
 * Execute Simulation Core
 */
async function runSimulation() {
    if (graph.nodes.length < 2) {
        showToast("Create at least 2 routers to run simulation", "error");
        return;
    }

    window.cancelAnimation = true; // Terminate any ongoing packet animation

    const src = document.getElementById("sourceNode").value;
    const dst = document.getElementById("destNode").value;
    const algo = document.getElementById("algorithm").value;
    const isRogueActive = document.getElementById("chkSimulateRogue").checked;
    const rogueId = isRogueActive ? document.getElementById("rogueNodeSelect").value : null;
    const isRpkiActive = isRogueActive && document.getElementById("chkRpkiDefense").checked;
    const trafficMode = document.getElementById("trafficMode").value;
    const qosClass = document.getElementById("qosClass").value;

    const payload = {
        source: src,
        target: dst,
        algorithm: algo,
        nodes: graph.nodes,
        edges: graph.edges,
        options: {
            congestionAware: document.getElementById("chkCongestion").checked,
            splitHorizon: document.getElementById("chkSplitHorizon").checked,
            simulateRogue: isRogueActive,
            rogueNodeId: rogueId,
            rpkiEnabled: isRpkiActive,
            trafficMode: trafficMode,
            qosClass: qosClass
        }
    };

    document.getElementById("resStatus").textContent = "Calculating...";
    document.getElementById("logContent").innerHTML = "";

    try {
        const res = await API.simulate(payload);

        // Update Compute Time Display scientifically
        const timeUs = res.computationTimeUs;
        const timeMs = res.computationTimeMs;
        const runs = res.benchmarkRuns || 1000;

        if (typeof timeUs === 'number') {
            document.getElementById("resTime").textContent = `${timeUs.toFixed(2)} µs (${runs.toLocaleString()} runs avg)`;
        } else if (typeof timeMs === 'number') {
            document.getElementById("resTime").textContent = `${timeMs.toFixed(3)} ms`;
        } else {
            document.getElementById("resTime").textContent = "-";
        }

        // Update Security Status Display
        if (isRogueActive) {
            if (isRpkiActive) {
                document.getElementById("resSecurity").textContent = "RPKI Quarantined & Rerouted";
            } else {
                document.getElementById("resSecurity").textContent = "Rogue Blackhole Intercept";
            }
        } else {
            document.getElementById("resSecurity").textContent = "Verified Normal";
        }

        // Refresh canvas with quarantined node state if applicable
        if (res.quarantinedNodes && res.quarantinedNodes.length > 0) {
            refreshCanvas({ quarantinedNodes: res.quarantinedNodes });
        }

        if (!res.success || !res.delivered) {
            document.getElementById("resStatus").textContent = isRogueActive && !isRpkiActive ? "Dropped (Rogue)" : "Unreachable";
            document.getElementById("resCost").textContent = "-";
            document.getElementById("resHops").textContent = "-";
            showToast(isRogueActive && !isRpkiActive ? "Packet intercepted by rogue router" : "No path found between selected routers", "error");
            if (res.trace) {
                await ui.animateSimulation(res, { trafficMode });
            }
            return;
        }

        // Delivery Succeeded
        if (trafficMode === 'flow_burst' && res.ecmpPaths && res.ecmpPaths.length > 1) {
            document.getElementById("resStatus").textContent = `Delivered (ECMP ${res.ecmpPaths.length} Paths)`;
        } else {
            document.getElementById("resStatus").textContent = "Delivered (Optimal)";
        }

        document.getElementById("resCost").textContent = res.totalCost;
        document.getElementById("resHops").textContent = `${res.hops} hops`;

        await ui.animateSimulation(res, { trafficMode });

    } catch (e) {
        showToast("Backend connection error", "error");
        document.getElementById("resStatus").textContent = "Error";
    }
}

document.getElementById("btnSimulate").addEventListener("click", runSimulation);

/**
 * Protocol Benchmark Comparison Modal
 */
document.getElementById("btnCompare").addEventListener("click", async () => {
    if (graph.nodes.length < 2) {
        showToast("Load a network topology first", "error");
        return;
    }

    const modal = document.getElementById("compareModal");
    const modalBody = document.getElementById("compareModalBody");
    modal.style.display = "flex";
    modalBody.innerHTML = "<p style='color: var(--text-muted);'>Benchmarking Dijkstra and Distance Vector across 2,000 iterations...</p>";

    try {
        const payload = {
            source: document.getElementById("sourceNode").value,
            target: document.getElementById("destNode").value,
            nodes: graph.nodes,
            edges: graph.edges
        };

        const res = await API.compare(payload);

        if (res.success) {
            modalBody.innerHTML = `
                <table class="benchmark-table">
                    <thead>
                        <tr>
                            <th>Evaluation Metric</th>
                            <th>Dijkstra (Link-State)</th>
                            <th>Distance Vector (Bellman-Ford)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Mean Execution Time</strong></td>
                            <td class="cell-highlight">${res.dijkstra.avgTimeUs} µs (${res.dijkstra.avgTimeMs} ms)</td>
                            <td class="cell-highlight">${res.distanceVector.avgTimeUs} µs (${res.distanceVector.avgTimeMs} ms)</td>
                        </tr>
                        <tr>
                            <td><strong>Benchmark Sample Size</strong></td>
                            <td>${res.iterations.toLocaleString()} complete runs</td>
                            <td>${res.iterations.toLocaleString()} complete runs</td>
                        </tr>
                        <tr>
                            <td><strong>Time Complexity</strong></td>
                            <td><code>${res.dijkstra.complexity}</code></td>
                            <td><code>${res.distanceVector.complexity}</code></td>
                        </tr>
                        <tr>
                            <td><strong>Real-World Protocol Equivalent</strong></td>
                            <td>${res.dijkstra.protocol}</td>
                            <td>${res.distanceVector.protocol}</td>
                        </tr>
                        <tr>
                            <td><strong>Convergence Speed</strong></td>
                            <td>${res.dijkstra.convergence}</td>
                            <td>${res.distanceVector.convergence}</td>
                        </tr>
                        <tr>
                            <td><strong>Routing Loop Vulnerability</strong></td>
                            <td>${res.dijkstra.loopFree}</td>
                            <td>${res.distanceVector.loopFree}</td>
                        </tr>
                    </tbody>
                </table>
                <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                    <em>Empirical Insight:</em> Dijkstra calculates the complete shortest path tree in one pass using global link metrics, achieving microsecond-level convergence. Distance Vector computes neighbor-by-neighbor relaxation iteratively, which requires higher CPU cycles on dense graphs.
                </p>
            `;
        } else {
            modalBody.innerHTML = "<p style='color: var(--failed-link);'>Benchmark calculation failed on backend.</p>";
        }
    } catch {
        modalBody.innerHTML = "<p style='color: var(--failed-link);'>Failed to connect to simulation backend.</p>";
    }
});

document.getElementById("btnCloseCompare").addEventListener("click", () => {
    document.getElementById("compareModal").style.display = "none";
});

/**
 * Forwarding Information Base (FIB) Routing Table Modal
 */
async function openRoutingTableModal(routerId) {
    const modal = document.getElementById("routingTableModal");
    const modalBody = document.getElementById("routingTableBody");
    const modalTitle = document.getElementById("routingTableTitle");

    modal.style.display = "flex";
    modalTitle.textContent = `Forwarding Information Base (FIB) - Router ${routerId}`;
    modalBody.innerHTML = "<p style='color: var(--text-muted);'>Querying router forwarding table...</p>";

    try {
        const res = await API.fetchRoutingTable(routerId, graph.nodes, graph.edges);
        if (res.success && res.table) {
            let rowsHtml = '';
            res.table.forEach(entry => {
                rowsHtml += `
                    <tr>
                        <td><strong>${entry.destination}</strong> (${entry.destinationName})</td>
                        <td class="cell-highlight">${entry.nextHop}</td>
                        <td>${entry.metric}</td>
                        <td>${entry.hops}</td>
                        <td><span style="color: ${entry.status === 'Unreachable' ? 'var(--failed-link)' : 'var(--source-color)'}; font-weight: 600;">${entry.status}</span></td>
                    </tr>
                `;
            });

            modalBody.innerHTML = `
                <table class="fib-table">
                    <thead>
                        <tr>
                            <th>Destination Router</th>
                            <th>Next-Hop Interface</th>
                            <th>Metric Cost</th>
                            <th>Hop Distance</th>
                            <th>Prefix Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
        } else {
            modalBody.innerHTML = "<p style='color: var(--failed-link);'>Could not load routing table.</p>";
        }
    } catch {
        modalBody.innerHTML = "<p style='color: var(--failed-link);'>Failed to connect to backend.</p>";
    }
}

document.getElementById("btnViewRoutingTable").addEventListener("click", () => {
    const selectedRouter = document.getElementById("sourceNode").value;
    if (!selectedRouter) {
        showToast("Select a router first", "error");
        return;
    }
    openRoutingTableModal(selectedRouter);
});

document.getElementById("btnCloseRoutingTable").addEventListener("click", () => {
    document.getElementById("routingTableModal").style.display = "none";
});

// Close modals when clicking backdrop
window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
        e.target.style.display = "none";
    }
});

// Trigger simulation re-run dynamically if graph links change
window.addEventListener('graph-updated', () => {
    const statusText = document.getElementById("resStatus").textContent;
    if (statusText.includes("Delivered") || statusText.includes("Dropped")) {
        runSimulation();
    }
});

// Backend Health Checker Polling
setInterval(async () => {
    const isUp = await API.checkHealth();
    const badge = document.getElementById("serverStatus");
    if (isUp) {
        badge.textContent = "Server Online (Port 8080)";
        badge.className = "status-badge connected";
    } else {
        badge.textContent = "Server Offline";
        badge.className = "status-badge offline";
    }
}, 3000);

// Initialize with standard demo graph
graph = generateDemoGraph();
updateSelects();