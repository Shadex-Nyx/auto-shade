"use strict";

const axios = require("axios");
const qs = require("qs");

class UptimeService {
    constructor() {
        this.apiKey = process.env.UPTIMEROBOT_API_KEY;
        this.baseURL = "https://api.uptimerobot.com/v2";

        if (!this.apiKey) {
            console.warn("[UptimeService] UPTIMEROBOT_API_KEY manquant dans l'environnement.");
        }
    }

    async addMonitor({ friendlyName, url, interval = 300 }) {
        // Paramètres stricts acceptés par les plans de base/gratuit d'UptimeRobot
        const payload = {
            api_key: this.apiKey,
            format: "json",
            type: 1, // 1 = HTTP(s)
            url: url,
            friendly_name: friendlyName,
            interval: interval < 300 ? 300 : interval
        };

        const data = qs.stringify(payload);

        try {
            const response = await axios.post(`${this.baseURL}/newMonitor`, data, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            if (response.data.stat !== "ok") {
                throw new Error(response.data.error?.message || "Erreur lors de la création sur UptimeRobot.");
            }
            return response.data.monitor;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            throw new Error(`UptimeRobot API (Ajout) : ${msg}`);
        }
    }

    async getMonitors(monitorId = null) {
        const payload = {
            api_key: this.apiKey,
            format: "json",
            logs: 1
        };
        if (monitorId) payload.monitors = monitorId;

        const data = qs.stringify(payload);

        try {
            const response = await axios.post(`${this.baseURL}/getMonitors`, data, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            if (response.data.stat !== "ok") {
                throw new Error(response.data.error?.message || "Erreur de récupération.");
            }
            return response.data.monitors;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            throw new Error(`UptimeRobot API (Liste) : ${msg}`);
        }
    }

    async editMonitorStatus(monitorId, status) {
        const data = qs.stringify({
            api_key: this.apiKey,
            format: "json",
            id: monitorId,
            status: status
        });

        try {
            const response = await axios.post(`${this.baseURL}/editMonitor`, data, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            if (response.data.stat !== "ok") {
                throw new Error(response.data.error?.message || "Impossible de modifier le statut.");
            }
            return true;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            throw new Error(`UptimeRobot API (Modification) : ${msg}`);
        }
    }

    async deleteMonitor(monitorId) {
        const data = qs.stringify({
            api_key: this.apiKey,
            format: "json",
            id: monitorId
        });

        try {
            const response = await axios.post(`${this.baseURL}/deleteMonitor`, data, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            if (response.data.stat !== "ok") {
                throw new Error(response.data.error?.message || "Impossible de supprimer le moniteur.");
            }
            return true;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            throw new Error(`UptimeRobot API (Suppression) : ${msg}`);
        }
    }
}

module.exports = new UptimeService();
