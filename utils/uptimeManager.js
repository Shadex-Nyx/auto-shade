"use strict";

const fs = require("fs");
const path = require("path");

class UptimeManager {
    constructor() {
        this.dbPath = path.join(__dirname, "../data/uptime.json");
        this.sessions = new Map(); // Sessions interactives en cours
        this.initDB();
    }

    initDB() {
        if (!fs.existsSync(path.dirname(this.dbPath))) {
            fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
        }
    }

    getAllMonitors() {
        try {
            return JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
        } catch {
            return [];
        }
    }

    saveMonitor(monitor) {
        const monitors = this.getAllMonitors();
        monitors.push(monitor);
        fs.writeFileSync(this.dbPath, JSON.stringify(monitors, null, 2));
    }

    removeMonitor(id) {
        let monitors = this.getAllMonitors();
        monitors = monitors.filter(m => m.id.toString() !== id.toString());
        fs.writeFileSync(this.dbPath, JSON.stringify(monitors, null, 2));
    }

    // Gestion des sessions interactives avec expiration (3 min)
    setSession(userId, data) {
        // Nettoyer l'ancienne session si elle existe
        if (this.sessions.has(userId)) {
            clearTimeout(this.sessions.get(userId).timer);
        }

        const timer = setTimeout(() => {
            this.sessions.delete(userId);
        }, 3 * 60 * 1000); // 3 minutes

        this.sessions.set(userId, { ...data, timer });
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    clearSession(userId) {
        if (this.sessions.has(userId)) {
            clearTimeout(this.sessions.get(userId).timer);
            this.sessions.delete(userId);
        }
    }
}

module.exports = new UptimeManager();
