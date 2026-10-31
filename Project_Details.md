# Comprehensive Project Report: Packet Routing Simulator

## 1. Abstract
The **Packet Routing Simulator** is an interactive, web-based software application designed to visualize, evaluate, and benchmark how data packets traverse modern telecommunication networks. It provides an interactive canvas where network engineers, educators, and students can build custom topologies, simulate physical link cuts, evaluate cyber threat scenarios (route poisoning and blackhole attacks), test data center multi-path load balancing (ECMP), and observe how core algorithms (Dijkstra's Link-State and Bellman-Ford's Distance Vector) converge dynamically under varied traffic conditions.

---

## 2. Project Need and Objectives

### The Problem
In modern computer networks, routing protocols operate transparently in background firmware. When end users transmit requests, packets traverse complex meshes of autonomous systems (AS) and routers, recalculating paths dynamically in response to physical cable damage, buffer exhaustion, or security incidents. For engineers and students, understanding these abstract mathematical processes is challenging without an empirical, visual, and interactive platform.

### The Objective
1. **Visual Demystification:** Transform abstract shortest-path mathematics into tangible, interactive SVG visualizations showing hop-by-hop packet progress.
2. **Empirical Benchmarking:** Provide scientific microsecond-level latency benchmarks comparing Link-State and Distance Vector algorithmic complexity on identical topologies.
3. **Real-World Threat & Traffic Modeling:** Go beyond textbook static paths by incorporating cyber threat defense (RPKI validation against rogue route poisoning), data center Equal-Cost Multi-Path (ECMP) balancing, and Quality-of-Service (QoS) queue priorities.

---

## 3. Innovative Novelty Features in Detail

### Feature 1: Rogue Router Attack & RPKI Origin Validation Defense
* **Networking Theory:** Corresponds to BGP prefix hijacking and route poisoning (RFC 6811).
* **Attack Mechanism:** A malicious or compromised router injects fabricated zero-metric (or low-cost) advertisements to neighboring nodes. Unaware routers update their forwarding tables, redirecting packet streams directly into the compromised router.
* **Blackhole Sinkhole:** Once the packet enters the rogue router, it is intercepted and dropped (blackhole drop), accompanied by a security trace alert in the terminal.
* **Defense Countermeasure (RPKI):** When **RPKI Origin Validation & Quarantine** is activated, the routing engine enforces route origin authorization filters. The forged advertisement is flagged as anomalous, the compromised router is isolated/quarantined from the topology, and safe alternative paths are computed automatically.

### Feature 2: Equal-Cost Multi-Path (ECMP) Flow Balancing
* **Networking Theory:** Corresponds to RFC 2991/2992 deployed across modern hyperscale data center spine-leaf fabrics.
* **Mechanism:** Rather than confining traffic to a single path, Dijkstra's algorithm tracks all predecessors that yield the identical minimal metric distance ($d[v] = d[u] + w$).
* **Flow Burst Simulation:** When enabled, the simulator dispatches 4 discrete packet flows (Flow 101 to 104) across parallel paths. The frontend animates concurrent, color-differentiated packet markers across independent links, demonstrating throughput multiplication and load distribution.

### Feature 3: Quality of Service (QoS) & Router Buffer Queuing
* **Networking Theory:** Corresponds to DiffServ architecture and DSCP (Differentiated Services Code Point) traffic classification.
* **Mechanism:**
  * **Best-Effort (DSCP 0):** Standard bulk traffic that must wait in router buffer queues during network congestion, suffering simulated queuing delay (+12ms latency penalty).
  * **Expedited Forwarding (DSCP 46 - VoIP / Real-Time):** High-priority traffic designated for delay-sensitive applications. Routers grant strict priority scheduling, bypassing queue buffers with 0ms queuing latency penalty.

### Feature 4: Scientific Microsecond Compute Time Engine
* **Methodology:** Standard single-run JavaScript timers suffer from browser timer resolution limits and system interrupts. To deliver mathematically rigorous metrics, the backend runs an empirical benchmarking loop of **1,000 complete algorithmic iterations** for every simulation call:
  $$\text{Mean Compute Time} = \frac{t_{\text{elapsed}}}{1000} \quad (\mu\text{s})$$
  This captures exact CPU execution latency down to sub-microsecond precision without artificial minimum fallbacks.

### Feature 5: Forwarding Information Base (FIB) Inspector
* Users can click any router node on the canvas (or use the dedicated action button) to open its live **Routing Table (FIB)**:
  * Destination Router Subnet
  * Next-Hop Forwarding Interface
  * Accumulated Metric Cost
  * Hop Distance
  * Convergence Status

### Feature 6: Empirical Protocol Comparison Suite
* A side-by-side benchmark modal evaluating Dijkstra vs. Distance Vector over **2,000 iterations**:
  * Mean execution time ($\mu$s)
  * Time and space complexity
  * Convergence speed under topology alterations
  * Loop vulnerability (Count-to-Infinity)
  * Standard protocol equivalents (OSPF vs. RIP)

---

## 4. Core Algorithms Explained

### A. Dijkstra's Algorithm (Link-State Protocol)
* **Concept:** Every router maintains a complete, synchronized link-state database (LSDB) of the network topology.
* **Implementation:** Employs a Min-Heap priority queue to iteratively extract the lowest-cost unvisited node, relaxing adjacent edges until all shortest paths are resolved.
* **ECMP Extension:** While standard Dijkstra stores a single parent node `prev[v] = u`, our implementation maintains dynamic predecessor sets `prevAll[v] = [u1, u2, ...]`, enabling recursive backtracking to extract all equal-cost paths.
* **Time Complexity:** $O((V + E) \log V)$ using a binary min-heap.
* **Real-World Equivalent:** Open Shortest Path First (OSPF), Intermediate System to Intermediate System (IS-IS).

### B. Distance Vector Algorithm (Bellman-Ford)
* **Concept:** Routers exchange distance estimates exclusively with their immediate physical neighbors.
* **Implementation:** The algorithm relaxes active edges iteratively $|V| - 1$ times.
* **Loop Prevention:** Incorporates Split Horizon and Poison Reverse logic, suppressing reverse route advertisements along links from which updates were learned.
* **Time Complexity:** $O(V \cdot E)$.
* **Real-World Equivalent:** Routing Information Protocol (RIPv1, RIPv2).

---

## 5. Object-Oriented Programming (OOP) Concepts

1. **Classes and Objects:**
   * Frontend: `class GraphUI` encapsulates SVG rendering, coordinate mapping, and multi-flow animation physics. Instances manage individual network components and states.
   * Backend: Router and Link data models maintain independent state vectors (active flags, latency weights, coordinates).
2. **Encapsulation:**
   * State variables (SVG node dictionaries, coordinate arrays, animation frames) are isolated within `GraphUI`. Application logic accesses them via structured interface methods (`drawGraph`, `animateSimulation`, `clearActiveRoutes`).
3. **Inheritance & Modular Design:**
   * Algorithmic handlers inherit common benchmark timing, trace formatting, and metric calculation primitives.
4. **Polymorphism:**
   * Unified interface contracts: the simulation endpoint executes `calculateRoute(src, dst)` dynamically whether Link-State or Distance Vector is specified.

---

## 6. System Architecture & Tech Stack

* **Frontend UI:** HTML5, CSS3, Vanilla JavaScript.
* **Vector Graphics Rendering:** Hardware-accelerated SVG DOM manipulation.
* **Backend Engine:** Node.js HTTP server (`server.js`) with high-resolution performance counters (`perf_hooks`).
* **Data Protocol:** Standard RESTful JSON exchange over HTTP:
  * `POST /api/simulate`: Executes routing algorithms, ECMP extraction, security filtering, and trace generation.
  * `POST /api/compare`: Runs multi-thousand-iteration empirical benchmark comparisons.
  * `POST /api/routing-table`: Builds router-specific Forwarding Information Bases.
  * `GET /api/health`: Provides continuous liveness monitoring.

---

## 7. Setup and Execution Guide

1. Ensure **Node.js** (v18+) is installed.
2. In the project directory, run:
   ```bash
   node server.js
   ```
3. Open a browser and navigate to:
   ```
   http://localhost:8080
   ```
4. **Usage Instructions:**
   * **Standard Simulation:** Select Source and Destination routers, pick an algorithm, and click **Run Simulation**.
   * **ECMP Multi-Path:** Click **Load Multi-Path Grid (ECMP)**, ensure Traffic Mode is set to *Traffic Flow Burst*, and click **Run Simulation**.
   * **Security Testing:** Check *Simulate Rogue Router*, run simulation to observe blackhole drop, then check *RPKI Origin Validation & Quarantine* to observe automated containment and rerouting.
   * **FIB Inspection:** Click any router node in idle mode or click **Inspect Routing Table (FIB)**.
