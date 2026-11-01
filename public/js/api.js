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
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMessage = (data && data.error) ? data.error : `Simulation backend error (${res.status})`;
                throw new Error(errMessage);
            }
            return data;
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
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMessage = (data && data.error) ? data.error : `Comparison backend error (${res.status})`;
                throw new Error(errMessage);
            }
            return data;
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
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMessage = (data && data.error) ? data.error : `Routing table backend error (${res.status})`;
                throw new Error(errMessage);
            }
            return data;
        } catch (e) {
            console.error("Routing table query failed:", e);
            throw e;
        }
    }
};