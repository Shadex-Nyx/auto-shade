"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");

class DeployManager {
    constructor() {
        this.dbPath = path.join(__dirname, "../data/deployments.json");
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

    getAllDeployments() {
        try {
            const data = fs.readFileSync(this.dbPath, "utf8");
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    saveDeployment(deployment) {
        const deployments = this.getAllDeployments();
        deployments.push(deployment);
        fs.writeFileSync(this.dbPath, JSON.stringify(deployments, null, 2));
    }

    updateDeployment(name, newData) {
        let deployments = this.getAllDeployments();
        deployments = deployments.map(d => {
            if (d.name === name) {
                return { ...d, ...newData };
            }
            return d;
        });
        fs.writeFileSync(this.dbPath, JSON.stringify(deployments, null, 2));
    }

    removeDeployment(name) {
        let deployments = this.getAllDeployments();
        deployments = deployments.filter(d => d.name !== name);
        fs.writeFileSync(this.dbPath, JSON.stringify(deployments, null, 2));
    }

    findByName(name) {
        return this.getAllDeployments().find(d => d.name === name);
    }

    async analyzeRepository(repoUrl) {
        // Nettoyage de l'URL GitHub (retire les slashs de fin, .git, etc.)
        const cleanUrl = repoUrl.trim().replace(/\/$/, "").replace(/\.git$/, "");
        const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
        
        if (!match) {
            throw new Error("Format d'URL GitHub invalide. Utilisez : https://github.com/utilisateur/projet");
        }

        const owner = match[1];
        const repo = match[2];
        const fullName = `${owner}/${repo}`;
        const apiTreeUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;

        let files = [];
        let branch = "main";

        try {
            const res = await axios.get(apiTreeUrl, { 
                headers: { 
                    "User-Agent": "Messenger-Deploy-Bot",
                    "Accept": "application/vnd.github.v3+json"
                } 
            });
            files = res.data.map(f => f.name.toLowerCase());
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error("Repository GitHub inexistant ou privé. Vérifiez l'URL.");
            }
            // Si l'API tree échoue, on tente une détection par défaut basée sur du Node.js standard
            console.warn("[DeployManager] Avertissement API GitHub, passage sur une configuration par défaut Node.js");
        }

        let runtime = "node";
        let buildCommand = "npm install";
        let startCommand = "npm start";

        if (files.includes("dockerfile")) {
            runtime = "docker";
            buildCommand = "";
            startCommand = "";
        } else if (files.includes("requirements.txt")) {
            runtime = "python";
            buildCommand = "pip install -r requirements.txt";
            startCommand = "python main.py";
        } else if (files.length > 0 && files.includes("package.json")) {
            runtime = "node";
            if (files.includes("yarn.lock")) buildCommand = "yarn install";
            else if (files.includes("pnpm-lock.yaml")) buildCommand = "pnpm install";

            // Vérification de la branche (main ou master)
            try {
                const pkgRes = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`);
                if (pkgRes.data?.scripts?.start) {
                    startCommand = "npm start";
                }
            } catch {
                try {
                    const pkgResMaster = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/master/package.json`);
                    branch = "master";
                    if (pkgResMaster.data?.scripts?.start) {
                        startCommand = "npm start";
                    }
                } catch {}
            }
        }

        return {
            owner,
            repo,
            fullName,
            branch,
            runtime,
            buildCommand,
            startCommand,
            repoUrl: `https://github.com/${fullName}`
        };
    }
}

module.exports = new DeployManager();
