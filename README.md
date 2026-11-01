# Packet Routing Simulator — Rogue Router Attack & RPKI Origin Validation Defense

An interactive, production-grade network topology visualizer and routing protocol benchmarking suite deployed on Vercel and executable locally via Node.js. The application simulates dynamic packet traversal, physical link failures, congestion avoidance, data center multi-path routing (ECMP), quality-of-service (QoS) queuing, and cryptographic cyber defense via **RPKI (Resource Public Key Infrastructure) Route Origin Validation (ROV)**.

---

## 1. System Architecture & Technical Stack

- **Serverless API Engine (Vercel / Node.js):**
  - Modular serverless entrypoints under `api/`:
    - `api/simulate.js`: Main routing simulation, rogue router attack injection, and RPKI policy enforcement.
    - `api/security.js`: RFC 6811 BGP Route Origin Validation, CIDR subnet matching, deterministic ROA store, and route announcement models.
    - `api/algorithms.js`: Dijkstra's Link-State (OSPF/IS-IS) with ECMP multi-path backtracking and Bellman-Ford Distance Vector (RIP).
    - `api/compare.js`: Simultaneous microsecond algorithmic benchmark comparing Dijkstra and Bellman-Ford across 2,000 iterations.
    - `api/routing-table.js`: Dynamic Forwarding Information Base (FIB) query handler.
    - `api/health.js`: Microservice uptime and telemetry endpoint.
- **Local Runtime (`server.js`):** Lightweight Node.js server sharing the exact same `api/` modules with the Vercel deployment, eliminating divergence between local and production environments.
- **Frontend Layer (`public/`):**
  - Vanilla HTML5 semantic structure and SVG DOM animation engine.
  - Zero external framework dependencies; pure CSS3 design system with Inter and JetBrains Mono typography.
  - Real-time Network Protocol Trace Terminal logging timestamped routing decisions and RPKI validation outcomes.

---

## 2. Cryptographic Security Model (RFC 6480 & RFC 6811)

### A. Route Origin Authorizations (ROAs)
A ROA is a cryptographically signed statement binding an IP address prefix to an authorized Origin Autonomous System Number (ASN). In this simulator, deterministic ROA records are defined:
- **Prefix:** Destination IP network block in CIDR notation (e.g., `10.0.0.0/24`).
- **Authorized ASN:** Permitted Origin Autonomous System Number (e.g., `AS 100`).
- **Max Length:** Maximum prefix length permitted for announcements (e.g., `/24`).

### B. RFC 6811 Origin Validation Logic
Every route announcement `(Prefix, Origin ASN)` is evaluated against the active ROA database:
1. **`VALID`:** A covering ROA exists in the database where `Announcement ASN === ROA ASN` and `Announcement Prefix Length <= ROA MaxLength`.
2. **`INVALID`:** One or more covering ROAs exist for the prefix, but the originating ASN does not match, or the announced prefix length exceeds `maxLength`. Indicates a BGP prefix hijack or route poisoning attack.
3. **`NOT_FOUND`:** No covering ROA exists for the prefix. In standard Internet routing, unvalidated routes without registered ROAs remain eligible under permissive policy to maintain backward compatibility.

### C. Rogue Router Attack Simulation
- **Attack Vector:** BGP Route Poisoning / Forged-Origin Prefix Hijack.
- **Mechanism:** The designated compromised router injects a deterministic malicious route announcement for target prefix `10.0.0.0/24` with unauthorized Origin `AS 999`.
- **Traffic Attraction:** When RPKI defense is inactive, routers install the poisoned announcement, directing packets into the rogue router where a malicious **Blackhole Packet Drop** is executed (`dropped: true`).

### D. RPKI Defense & Quarantine Policy
- **Policy Enforcement:** When RPKI Defense is armed (`rpkiEnabled: true`), announcements evaluated as `INVALID` are rejected and placed in `quarantinedRoutes`.
- **Clean Path Selection:** The invalid rogue route is stripped from the routing decision process. The algorithm falls back to verified legitimate announcements (Origin `AS 100`), calculating a clean, loop-free path to destination router `R7`.
- **Blocked/Unreachable Safeguard:** If no alternative physical path exists without traversing the quarantined route, the simulator accurately reports `RPKI_BLOCKED_UNREACHABLE` rather than fabricating a delivery.

---

## 3. Step-by-Step Demonstration Procedure

### Scenario 1: Baseline Routing (Attack OFF, Defense OFF)
1. Set **Source Router** to `Router 1` (`R1`) and **Destination Router** to `Router 7` (`R7`).
2. Keep **Simulate Rogue Router** UNCHECKED.
3. Click **Run Simulation**.
4. **Observed Outcome:**
   - **Delivery Status:** `Delivered (Optimal)`
   - **Total Link Cost:** `6` (Path: `R1 -> R4 -> R7`, 2 hops)
   - **Security State:** `Verified Normal`

### Scenario 2: Rogue Router Route Poisoning (Attack ON, Defense OFF)
1. Check **Simulate Rogue Router (Route Poisoning)**.
2. The *RPKI Scenario Ground Truth* card appears (`Target: 10.0.0.0/24 | Authorized: AS 100 | Rogue: AS 999`).
3. Select `Router 2` (`R2`) as the Compromised Router.
4. Keep **RPKI Origin Validation & Quarantine** UNCHECKED.
5. Click **Run Simulation**.
6. **Observed Outcome:**
   - **Delivery Status:** `Dropped (Rogue Intercept)`
   - **Security State:** `Rogue Attack Active (Blackhole Intercept)`
   - **RPKI Badge:** `INVALID (Defense Disabled)`
   - **Trace Terminal:** Logs the acceptance of the unvalidated announcement and the subsequent blackhole drop at `R2`.

### Scenario 3: RPKI Origin Validation & Quarantine (Attack ON, Defense ON)
1. Check **RPKI Origin Validation & Quarantine**.
2. Click **Run Simulation**.
3. **Observed Outcome:**
   - **Delivery Status:** `Delivered (Safe Reroute)`
   - **Security State:** `RPKI Enforced: Invalid Route Rejected`
   - **RPKI Badge:** `INVALID (Unauthorized Origin) - Quarantined`
   - **Canvas Animation:** Router `R2` is visually marked quarantined; packets navigate cleanly along the verified path (`R1 -> R4 -> R7`).
   - **Trace Terminal:** Displays cryptographic verification details:
     `[RPKI Origin Validation: INVALID] Announcement from router R2 for 10.0.0.0/24 (Origin AS 999) REJECTED.`

---

## 4. REST API Reference

### `POST /api/simulate`
Executes routing computation, attack simulation, and origin validation.

**Request Payload:**
```json
{
  "source": "R1",
  "target": "R7",
  "algorithm": "dijkstra",
  "nodes": [{ "id": "R1" }, { "id": "R2" }, { "id": "R7" }],
  "edges": [{ "id": "e1", "source": "R1", "target": "R7", "weight": 6, "active": true }],
  "options": {
    "simulateRogue": true,
    "rogueNodeId": "R2",
    "rpkiEnabled": true,
    "destinationPrefix": "10.0.0.0/24",
    "targetAsn": 100,
    "rogueAsn": 999
  }
}
```

**Response Payload:**
```json
{
  "success": true,
  "delivered": true,
  "algorithm": "dijkstra",
  "path": ["R1", "R4", "R7"],
  "totalCost": 6,
  "hops": 2,
  "securityStatus": "RPKI_INVALID_REJECTED",
  "securityEvents": [
    {
      "type": "RPKI_INVALID_REJECTED",
      "routerId": "R2",
      "prefix": "10.0.0.0/24",
      "originAsn": 999,
      "message": "[RPKI Origin Validation: INVALID] Announcement ... REJECTED.",
      "action": "QUARANTINE_ROUTE"
    }
  ],
  "rpkiResults": [
    {
      "announcementId": "ann-rogue-R2",
      "prefix": "10.0.0.0/24",
      "originAsn": 999,
      "status": "INVALID",
      "reason": "Unauthorized origin AS 999 for prefix 10.0.0.0/24. Authorized AS(es): AS100"
    }
  ],
  "rejectedRoutes": [...],
  "quarantinedRoutes": [...],
  "quarantinedNodes": ["R2"],
  "computationTimeMs": 0.0035,
  "computationTimeUs": 3.52,
  "benchmarkRuns": 1000
}
```

### Other Endpoints:
- `POST /api/compare`: Runs 2,000 empirical iterations comparing Link-State vs Distance Vector time complexity and execution time.
- `POST /api/routing-table`: Returns the Forwarding Information Base (FIB) next-hop routing table for a given router.
- `GET /api/health`: Health status endpoint returning `{ "status": "ok", "version": "2.0.0" }`.

---

## 5. Automated Test Suite

The project includes unit and full HTTP integration test suites using Node.js built-in `node:test` and `node:assert`.

### Running Tests
Execute the automated test suite locally:
```bash
npm test
```
Or directly via Node.js:
```bash
node --test tests/**/*.test.js
```

### Test Coverage Highlights:
- **Test 1:** Baseline routing with attack disabled.
- **Test 2:** Rogue router attack enabled and RPKI defense disabled (verifies blackhole packet drop).
- **Test 3:** Rogue router attack enabled and RPKI defense enabled (verifies invalid route rejection and safe rerouting).
- **Test 4:** ROA validation for legitimate announcements (`VALID`).
- **Test 5:** ROA validation for unauthorized origin AS (`INVALID`).
- **Test 6:** Prefix-length constraint checking exceeding `maxLength` (`INVALID`).
- **Test 7:** Unregistered prefix validation (`NOT_FOUND`).
- **Test 8:** Destination unreachable after RPKI quarantine filtering.
- **Test 9:** Local delivery edge case (`source === target`).
- **Test 10:** Input validation (unknown source, destination, or rogue node IDs).
- **Test 11:** Protocol parity (Dijkstra vs Distance Vector with security applied).
- **Test 12:** Immutability assurance (original graph topology remains unmutated).
- **Test 13-14:** Accurate security outcomes and strict policy evaluation.
- **HTTP Integration Tests:** Live HTTP server testing for `/api/health`, `/api/simulate`, `/api/compare`, and `/api/routing-table`.

---

## 6. Practical Limitations & Design Abstractions

1. **Graph Abstraction vs Full BGP Stack:** This simulator models BGP Route Origin Validation conceptually on top of graph topologies. It does not run a complete TCP/BGP state machine with full route-reflector peering or AS-Path attribute manipulation.
2. **Deterministic ROA Set:** The default demonstration environment relies on pre-configured ROA entries for `10.0.0.0/24`. Dynamic ROAs can be supplied in API requests via `options.roas`.
3. **Stateless Serverless Execution:** In accordance with Vercel serverless architecture, each simulation invocation is purely stateless and idempotent.

---

## 7. Vercel Deployment & Verification

### Deployment Steps:
1. Ensure your local branch is committed:
   ```bash
   git status
   ```
2. Deploy directly via Vercel CLI:
   ```bash
   npx vercel --prod
   ```
   Or push to GitHub to trigger the Vercel Git integration:
   ```bash
   git push origin main
   ```

### Post-Deployment Checklist:
- [x] Verify `/api/health` returns HTTP 200 `{ status: "ok" }`.
- [x] Test Attack OFF: Confirm `Delivered (Optimal)` and `Verified Normal`.
- [x] Test Attack ON, Defense OFF: Confirm `Dropped (Rogue Intercept)` and `Rogue Attack Active`.
- [x] Test Attack ON, Defense ON: Confirm `Delivered (Safe Reroute)` and `RPKI Enforced: Invalid Route Rejected`.
- [x] Inspect Routing Table (FIB modal) to confirm table generation.
- [x] Compare Protocols modal to verify 2,000-iteration microsecond benchmark rendering.
