class GraphUI {
    constructor(svgId) {
        this.svg = document.getElementById(svgId);
        this.ns = "http://www.w3.org/2000/svg";
        this.nodes = {};
        this.edges = {};
        this.activePackets = [];
        this.currentSpeed = 1.0;
    }

    setSpeed(speedVal) {
        this.currentSpeed = parseFloat(speedVal);
    }

    clear() {
        this.svg.innerHTML = '';
        this.nodes = {};
        this.edges = {};
        this.clearActivePackets();

        // Architectural Dot Grid Background
        const defs = document.createElementNS(this.ns, "defs");
        const pattern = document.createElementNS(this.ns, "pattern");
        pattern.setAttribute("id", "grid");
        pattern.setAttribute("width", "28");
        pattern.setAttribute("height", "28");
        pattern.setAttribute("patternUnits", "userSpaceOnUse");

        const circle = document.createElementNS(this.ns, "circle");
        circle.setAttribute("cx", "14");
        circle.setAttribute("cy", "14");
        circle.setAttribute("r", "1");
        circle.setAttribute("fill", "#CBD5E1");

        pattern.appendChild(circle);
        defs.appendChild(pattern);
        this.svg.appendChild(defs);

        const rect = document.createElementNS(this.ns, "rect");
        rect.setAttribute("width", "100%");
        rect.setAttribute("height", "100%");
        rect.setAttribute("fill", "url(#grid)");
        this.svg.appendChild(rect);
    }

    drawGraph(graphData, options = {}) {
        this.clear();

        const srcNodeId = options.srcNodeId || (document.getElementById("sourceNode") ? document.getElementById("sourceNode").value : null);
        const dstNodeId = options.dstNodeId || (document.getElementById("destNode") ? document.getElementById("destNode").value : null);
        const rogueNodeId = options.rogueNodeId || null;
        const quarantinedNodes = options.quarantinedNodes || [];

        // Draw Links (Edges)
        graphData.edges.forEach(e => {
            const source = graphData.nodes.find(n => n.id === e.source);
            const target = graphData.nodes.find(n => n.id === e.target);
            if (source && target) {
                const line = document.createElementNS(this.ns, "line");
                line.setAttribute("x1", source.x);
                line.setAttribute("y1", source.y);
                line.setAttribute("x2", target.x);
                line.setAttribute("y2", target.y);
                line.setAttribute("class", e.active ? "edge" : "edge failed");
                this.svg.appendChild(line);

                this.edges[e.id] = { line, source, target, model: e };

                const bg = document.createElementNS(this.ns, "rect");
                bg.setAttribute("class", "edge-bg");
                const text = document.createElementNS(this.ns, "text");
                text.setAttribute("class", "edge-text");
                text.textContent = e.weight;

                this.svg.appendChild(bg);
                this.svg.appendChild(text);

                const updateLabelPos = () => {
                    const mx = (parseFloat(line.getAttribute("x1")) + parseFloat(line.getAttribute("x2"))) / 2;
                    const my = (parseFloat(line.getAttribute("y1")) + parseFloat(line.getAttribute("y2"))) / 2;
                    text.setAttribute("x", mx);
                    text.setAttribute("y", my);
                    text.setAttribute("dominant-baseline", "middle");
                    text.setAttribute("text-anchor", "middle");
                    try {
                        const bbox = text.getBBox();
                        bg.setAttribute("x", bbox.x - 4);
                        bg.setAttribute("y", bbox.y - 2);
                        bg.setAttribute("width", bbox.width + 8);
                        bg.setAttribute("height", bbox.height + 4);
                    } catch {
                        // In case element is not yet rendered in DOM
                    }
                };
                setTimeout(updateLabelPos, 0);
                this.edges[e.id].updateLabelPos = updateLabelPos;

                // Click link to toggle physical failure state
                line.addEventListener("click", () => {
                    e.active = !e.active;
                    line.setAttribute("class", e.active ? "edge" : "edge failed");
                    window.dispatchEvent(new Event('graph-updated'));
                });
            }
        });

        // Draw Routers (Nodes)
        graphData.nodes.forEach(n => {
            const group = document.createElementNS(this.ns, "g");
            group.setAttribute("class", "node-group");

            const outerCircle = document.createElementNS(this.ns, "circle");
            outerCircle.setAttribute("cx", 0);
            outerCircle.setAttribute("cy", 0);
            outerCircle.setAttribute("r", 20);
            outerCircle.setAttribute("class", "node-outer");

            const isQuarantined = quarantinedNodes.includes(n.id);
            const isRogue = (n.id === rogueNodeId);

            if (n.id === srcNodeId) {
                outerCircle.classList.add("source-node");
            } else if (n.id === dstNodeId) {
                outerCircle.classList.add("dest-node");
            }

            if (isRogue) {
                outerCircle.classList.add("rogue-node");
            } else if (isQuarantined) {
                outerCircle.classList.add("quarantined-node");
            }

            const innerCircle = document.createElementNS(this.ns, "circle");
            innerCircle.setAttribute("cx", 0);
            innerCircle.setAttribute("cy", 0);
            innerCircle.setAttribute("r", 7);
            innerCircle.setAttribute("class", "node-inner");

            const label = document.createElementNS(this.ns, "text");
            label.setAttribute("x", 0);
            label.setAttribute("y", 34);
            label.setAttribute("class", "node-label");
            label.textContent = n.name || n.id;

            group.appendChild(outerCircle);
            group.appendChild(innerCircle);
            group.appendChild(label);

            if (isRogue) {
                const subtext = document.createElementNS(this.ns, "text");
                subtext.setAttribute("x", 0);
                subtext.setAttribute("y", 46);
                subtext.setAttribute("class", "node-subtext");
                subtext.textContent = isQuarantined ? "Quarantined" : "Rogue Attacker";
                group.appendChild(subtext);
            }

            group.setAttribute("transform", `translate(${n.x}, ${n.y})`);
            this.svg.appendChild(group);
            this.nodes[n.id] = { group, x: n.x, y: n.y, model: n, outerCircle };

            // Dragging interactions
            let isDragging = false;
            let hasDragged = false;

            outerCircle.addEventListener('mousedown', (e) => {
                isDragging = true;
                hasDragged = false;
                e.stopPropagation();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                hasDragged = true;
                const rect = this.svg.getBoundingClientRect();
                const newX = Math.round(e.clientX - rect.left);
                const newY = Math.round(e.clientY - rect.top);

                group.setAttribute("transform", `translate(${newX}, ${newY})`);
                this.nodes[n.id].x = newX;
                this.nodes[n.id].y = newY;
                n.x = newX;
                n.y = newY;

                Object.values(this.edges).forEach(ed => {
                    if (ed.source.id === n.id) {
                        ed.line.setAttribute("x1", newX);
                        ed.line.setAttribute("y1", newY);
                    }
                    if (ed.target.id === n.id) {
                        ed.line.setAttribute("x2", newX);
                        ed.line.setAttribute("y2", newY);
                    }
                    if (ed.source.id === n.id || ed.target.id === n.id) {
                        ed.updateLabelPos();
                    }
                });
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            outerCircle.addEventListener('click', () => {
                if (!hasDragged) {
                    window.dispatchEvent(new CustomEvent('node-clicked', { detail: n.id }));
                }
            });
        });
    }

    clearActiveRoutes() {
        Object.values(this.edges).forEach(e => {
            if (e.model.active) {
                e.line.setAttribute("class", "edge");
            }
        });
        this.clearActivePackets();
    }

    clearActivePackets() {
        this.activePackets.forEach(p => p.remove());
        this.activePackets = [];
    }

    /**
     * Animate a single packet traversing a specific node path
     */
    async animateSinglePacket(trace, flowIndex = 0, totalFlows = 1) {
        if (!trace || trace.length === 0) return;

        const packet = document.createElementNS(this.ns, "circle");
        packet.setAttribute("r", "7");

        const flowClasses = ["packet-flow-1", "packet-flow-2", "packet-flow-3", "packet-flow-4"];
        const packetClass = flowClasses[flowIndex % flowClasses.length];
        packet.setAttribute("class", packetClass);

        this.svg.appendChild(packet);
        this.activePackets.push(packet);

        const startNode = this.nodes[trace[0].node];
        if (!startNode) return;
        packet.setAttribute("cx", startNode.x);
        packet.setAttribute("cy", startNode.y);

        // Instant mode
        if (this.currentSpeed === 0) {
            trace.forEach(step => {
                if (step.edge && this.edges[step.edge]) {
                    this.edges[step.edge].line.classList.add("active-route");
                }
                if (typeof window.logTrace === "function") {
                    window.logTrace(step.message, step.dropped ? "security-alert" : "normal");
                }
            });
            const lastStep = trace[trace.length - 1];
            const endNode = this.nodes[lastStep.node];
            if (endNode) {
                packet.setAttribute("cx", endNode.x);
                packet.setAttribute("cy", endNode.y);
            }
            return;
        }

        const baseHopDuration = 450;
        const hopDuration = Math.round(baseHopDuration / this.currentSpeed);

        for (let i = 0; i < trace.length; i++) {
            if (window.cancelAnimation) break;
            const step = trace[i];
            const targetNode = this.nodes[step.node];

            if (i > 0 && targetNode) {
                if (step.edge && this.edges[step.edge]) {
                    this.edges[step.edge].line.classList.add(totalFlows > 1 ? "active-route-ecmp" : "active-route");
                }

                const startX = parseFloat(packet.getAttribute("cx"));
                const startY = parseFloat(packet.getAttribute("cy"));

                await new Promise(resolve => {
                    const startTime = performance.now();
                    const frame = (t) => {
                        if (window.cancelAnimation) return resolve();
                        const p = Math.min((t - startTime) / hopDuration, 1);
                        // Ease-in-out cubic
                        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
                        packet.setAttribute("cx", startX + (targetNode.x - startX) * eased);
                        packet.setAttribute("cy", startY + (targetNode.y - startY) * eased);
                        if (p < 1) {
                            requestAnimationFrame(frame);
                        } else {
                            resolve();
                        }
                    };
                    requestAnimationFrame(frame);
                });
            }

            if (typeof window.logTrace === "function" && step.message) {
                const logType = step.dropped ? "security-alert" : (step.message.includes("RPKI") ? "defense-alert" : "normal");
                window.logTrace(step.message, logType);
            }

            // If packet was dropped by blackhole
            if (step.dropped) {
                packet.style.transition = "opacity 0.4s ease, transform 0.4s ease";
                packet.style.opacity = "0";
                break;
            }

            if (i < trace.length - 1) {
                await new Promise(r => setTimeout(r, Math.round(150 / this.currentSpeed)));
            }
        }
    }

    /**
     * Animate simulation, supporting both single packet and ECMP multi-flow bursts
     */
    async animateSimulation(simResult, options = {}) {
        this.clearActiveRoutes();
        window.cancelAnimation = false;

        const isFlowBurst = (options.trafficMode === 'flow_burst');
        const ecmpPaths = simResult.ecmpPaths || [];

        // If ECMP paths exist and Flow Burst is enabled
        if (isFlowBurst && ecmpPaths.length > 1) {
            const totalFlows = 4;
            const flowPromises = [];

            for (let f = 0; f < totalFlows; f++) {
                const chosenPath = ecmpPaths[f % ecmpPaths.length];
                const flowTrace = [];

                for (let i = 0; i < chosenPath.length; i++) {
                    const u = chosenPath[i];
                    let edgeId = null;
                    if (i < chosenPath.length - 1) {
                        const v = chosenPath[i + 1];
                        const edge = Object.values(this.edges).find(e => 
                            (e.model.source === u && e.model.target === v) || 
                            (e.model.source === v && e.model.target === u)
                        );
                        if (edge) edgeId = edge.model.id;
                    }
                    flowTrace.push({
                        node: u,
                        edge: edgeId,
                        message: i === 0 ? `Flow #${f + 101} dispatched on Path [${chosenPath.join(" -> ")}]` : null
                    });
                }

                // Stagger flow starts slightly
                const runFlow = async () => {
                    await new Promise(r => setTimeout(r, f * (this.currentSpeed === 0 ? 0 : 250)));
                    return this.animateSinglePacket(flowTrace, f, totalFlows);
                };
                flowPromises.push(runFlow());
            }

            await Promise.all(flowPromises);
        } else {
            // Standard single packet stream
            await this.animateSinglePacket(simResult.trace, 0, 1);
        }
    }
}