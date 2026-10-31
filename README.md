# Packet Routing Simulator

An interactive, high-performance network topology visualizer and routing protocol benchmarking suite. The application simulates dynamic packet traversal, physical link failures, congestion avoidance, cyber threat modeling, data center multi-path routing, and quality-of-service queue handling.

---

## Key Features

### Core Routing Algorithms
- **Dijkstra Link-State Protocol (OSPF / IS-IS Equivalent):** Computes globally optimal shortest paths using a Min-Heap priority queue. Guarantees loop-free convergence across arbitrary mesh topologies.
- **Distance Vector Protocol (Bellman-Ford / RIP Equivalent):** Simulates distributed distance vector exchanges with built-in Split Horizon and Poison Reverse loop prevention.

### Novelty Engineering Features
1. **Cyber Security Simulation: Rogue Router & RPKI Origin Validation Defense**
   - Simulates malicious BGP prefix hijacking and route poisoning where a compromised router advertises fabricated low-cost metrics.
   - Implements a blackhole packet sinkhole drop animation.
   - Features an RPKI (Resource Public Key Infrastructure) defense switch that detects anomalous origin advertisements, isolates/quarantines the rogue router, and dynamically calculates clean alternative paths.
2. **Data Center Traffic Engineering: Equal-Cost Multi-Path (ECMP) Flow Bursts**
   - Discovers all parallel paths sharing identical minimal cost metrics.
   - Dispatches multi-flow packet bursts (Flow 101 to 104) across parallel spine-leaf links using flow-based load balancing.
3. **Quality of Service (QoS) & Buffer Queuing**
   - Supports Best-Effort (DSCP 0) and Expedited Forwarding (DSCP 46 - VoIP / Real-Time).
   - Simulates router queue buffer delays under congestion; high-priority traffic bypasses queue latency penalties with strict priority scheduling.
4. **Scientific Microsecond Compute Time Benchmarking**
   - Replaced single-run timer resolution limitations with an empirical 1,000-iteration sample loop executed in the backend.
   - Delivers sub-microsecond algorithmic compute times (e.g., 3.82 µs) averaged across 1,000 complete runs.
5. **Forwarding Information Base (FIB) Routing Table Inspector**
   - Inspect the live routing table of any network router on demand.
   - Displays Destination Subnets, Next-Hop Interfaces, Metric Costs, Hop Distances, and Prefix Status.
6. **Side-by-Side Protocol Benchmark Modal**
   - Benchmarks Dijkstra and Distance Vector simultaneously across 2,000 iterations.
   - Generates an empirical comparison matrix covering mean execution time (µs), algorithmic complexity, convergence rates, and protocol equivalents.

---

## System Architecture

- **Backend:** Node.js HTTP server (`server.js`) implementing pure mathematical routing engines without external third-party dependencies. Optional C++17 engine included in `src/` and `algorithms/`.
- **Frontend:** Vanilla HTML5, CSS3 (custom design system, Inter and JetBrains Mono typography), and Scalable Vector Graphics (SVG) DOM manipulation.
- **Communication Protocol:** RESTful JSON endpoints (`/api/simulate`, `/api/compare`, `/api/routing-table`, `/api/health`).

---

## Installation and Execution

### Prerequisites
- Node.js (version 18 or higher recommended)

### Quick Start
1. Open the project root folder in your terminal:
   ```bash
   cd PACKETSIMULATOR
   ```
2. Start the simulation server:
   ```bash
   node server.js
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

---

## Repository Structure

```
PACKETSIMULATOR/
├── server.js                        # Node.js routing and benchmark backend
├── package.json                     # Project manifest
├── README.md                        # Project documentation
├── Project_Details.md               # Detailed academic project report
├── Code_Explanation.md              # Technical architecture and code mechanics
├── Simulation_Output_Analysis.md    # Analysis of simulation traces and metrics
├── public/                          # Web frontend assets
│   ├── index.html                   # Interactive application layout
│   ├── css/
│   │   └── style.css                # Visual design system and modal styles
│   └── js/
│       ├── api.js                   # Client REST API wrapper
│       ├── app.js                   # State orchestration and event handlers
│       └── graph-ui.js              # SVG canvas and multi-flow animation physics
├── src/                             # C++ simulator implementation
├── algorithms/                      # C++ routing algorithm implementations
├── include/                         # C++ header files
└── server/                          # C++ socket server implementation
```

---

## License
MIT License.
