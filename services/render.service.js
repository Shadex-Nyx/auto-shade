"use strict";

const axios = require("axios");

class RenderService {
    constructor() {
        this.apiKey = process.env.RENDER_API_KEY;
        this.ownerId = process.env.RENDER_OWNER_ID;
        this.baseURL = "https://api.render.com/v1";

        if (!this.apiKey || !this.ownerId) {
            console.warn("[RenderService] RENDER_API_KEY ou RENDER_OWNER_ID manquant dans l'environnement.");
        }
    }

    get headers() {
        return {
            "Authorization": `Bearer ${this.apiKey}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
    }

    async createWebService({ name, repo, branch = "main", env, buildCommand, startCommand, rootDir = "" }) {
        const payload = {
            type: "web_service",
            name: name,
            ownerId: this.ownerId,
            repo: repo,
            branch: branch,
            autoDeploy: "yes",
            serviceDetails: {
                env: env,
                plan: "free",
                rootDir: rootDir,
                envSpecificDetails: {
                    buildCommand: buildCommand,
                    startCommand: startCommand
                }
            }
        };

        try {
            const response = await axios.post(`${this.baseURL}/services`, payload, { headers: this.headers });
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
            throw new Error(`Erreur API Render (Création) : ${errorMsg}`);
        }
    }

    async getService(serviceId) {
        try {
            const response = await axios.get(`${this.baseURL}/services/${serviceId}`, { headers: this.headers });
            return response.data;
        } catch (error) {
            throw new Error(`Erreur API Render (Récupération) : ${error.response?.data?.message || error.message}`);
        }
    }

    async restartService(serviceId) {
        try {
            await axios.post(`${this.baseURL}/services/${serviceId}/restart`, {}, { headers: this.headers });
            return true;
        } catch (error) {
            throw new Error(`Erreur API Render (Redémarrage) : ${error.response?.data?.message || error.message}`);
        }
    }

    async deleteService(serviceId) {
        try {
            await axios.delete(`${this.baseURL}/services/${serviceId}`, { headers: this.headers });
            return true;
        } catch (error) {
            throw new Error(`Erreur API Render (Suppression) : ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new RenderService();
