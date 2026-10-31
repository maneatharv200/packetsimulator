const API = {
    async checkHealth() {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            const res = await fetch('/api/health', { signal: controller.signal });
            clearTimeout(id);
            return res.ok;
        } catch {
            return false;
        }
    },

    async simulate(payload) {
        try {
            const res = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Simulation backend error");
            return await res.json();
        } catch (e) {
            console.error("Simulation request failed:", e);
            throw e;
        }
    },

    async compare(payload) {
        try {
            const res = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Comparison backend error");
            return await res.json();
        } catch (e) {
            console.error("Comparison request failed:", e);
            throw e;
        }
    },

    async fetchRoutingTable(routerId, nodes, edges) {
        try {
            const res = await fetch('/api/routing-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routerId, nodes, edges })
            });
            if (!res.ok) throw new Error("Routing table backend error");
            return await res.json();
        } catch (e) {
            console.error("Routing table query failed:", e);
            throw e;
        }
    }
};