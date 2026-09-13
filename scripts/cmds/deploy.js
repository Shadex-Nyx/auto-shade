"use strict";

const renderService = require("../../services/render.service");
const deployManager = require("../../utils/deployManager");

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  fonts = { bold: (t) => t, sansSerif: (t) => t, monospace: (t) => t };
}

module.exports = {
    config: {
        name: "deploy",
        version: "2.0.0",
        author: "Shade",
        countDown: 5,
        role: 6,
        shortDescription: {
            fr: "Déploie des projets GitHub sur Render"
        },
        longDescription: {
            fr: "Analyse et déploie automatiquement des projets GitHub sur Render."
        },
        category: "owner",
        guide: {
            fr:
                "{pn} <github_url>\n" +
                "{pn} list\n" +
                "{pn} status <nom>\n" +
                "{pn} restart <nom>\n" +
                "{pn} delete <nom>\n" +
                "{pn} help"
        }
    },

    onStart: async function ({ api, event, args, message }) {
        const subCommand = args[0]?.toLowerCase();

        // ============================================================
        // HELP
        // ============================================================
        if (!subCommand || subCommand === "help") {
            const helpMsg =
                `${fonts.bold("🚀 COMMANDES DEPLOY")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${fonts.bold("deploy <url>")} – déploie un projet GitHub sur Render\n` +
                `${fonts.bold("deploy list")} – affiche les projets déployés\n` +
                `${fonts.bold("deploy status <nom>")} – vérifie le statut\n` +
                `${fonts.bold("deploy restart <nom>")} – redémarre un service\n` +
                `${fonts.bold("deploy delete <nom>")} – supprime un service\n` +
                `${fonts.bold("deploy help")} – affiche cette aide\n\n` +
                `${fonts.bold("📌 EXEMPLES :")}\n` +
                `• ${fonts.monospace("deploy https://github.com/user/project")}\n` +
                `• ${fonts.monospace("deploy list")}\n` +
                `• ${fonts.monospace("deploy status shade-lyrics")}\n` +
                `• ${fonts.monospace("deploy restart shade-lyrics")}\n` +
                `• ${fonts.monospace("deploy delete shade-lyrics")}`;
            return message.reply(helpMsg);
        }

        // ============================================================
        // LIST
        // ============================================================
        if (subCommand === "list") {
            const deployments = deployManager.getAllDeployments();
            if (!deployments.length) {
                return message.reply(
                    `${fonts.bold("📦 PROJETS DÉPLOYÉS")}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Aucun projet n'est actuellement enregistré.`
                );
            }
            let text =
                `${fonts.bold("📦 PROJETS DÉPLOYÉS")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            deployments.forEach((deployment, index) => {
                text +=
                    `${fonts.bold(`${index + 1}. ${deployment.name}`)}\n` +
                    `🌐 ${deployment.url || "N/A"}\n` +
                    `📊 ${deployment.status || "UNKNOWN"}\n` +
                    `🆔 ${deployment.serviceId}\n\n`;
            });
            return message.reply(text.trim());
        }

        // ============================================================
        // STATUS
        // ============================================================
        if (subCommand === "status") {
            const name = args[1];
            if (!name) {
                return message.reply(
                    `${fonts.bold("⚠️ UTILISATION")}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `${fonts.monospace("deploy status <nom>")}`
                );
            }
            const deployment = deployManager.findByName(name);
            if (!deployment) {
                return message.reply(
                    `❌ Aucun projet nommé ${fonts.bold(name)} n'a été trouvé.`
                );
            }
            try {
                const serviceInfo = await renderService.getService(deployment.serviceId);
                const service = serviceInfo?.service || serviceInfo;
                const status = service?.suspended
                    ? "SUSPENDED"
                    : service?.suspenders?.length
                        ? "SUSPENDED"
                        : "ACTIVE";
                const serviceUrl =
                    service?.serviceDetails?.url ||
                    service?.url ||
                    deployment.url ||
                    "N/A";
                return message.reply(
                    `${fonts.bold(`📊 STATUT — ${name}`)}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📦 Projet : ${deployment.name}\n` +
                    `📊 État : ${status}\n` +
                    `🌐 URL : ${serviceUrl}\n` +
                    `🆔 Service : ${deployment.serviceId}`
                );
            } catch (error) {
                return message.reply(
                    `${fonts.bold("❌ ERREUR")}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `${error.message}`
                );
            }
        }

        // ============================================================
        // RESTART
        // ============================================================
        if (subCommand === "restart") {
            const name = args[1];
            if (!name) {
                return message.reply(
                    `⚠️ Utilisation : ${fonts.monospace("deploy restart <nom>")}`
                );
            }
            const deployment = deployManager.findByName(name);
            if (!deployment) {
                return message.reply(
                    `❌ Projet ${fonts.bold(name)} introuvable.`
                );
            }
            try {
                await message.reply(
                    `${fonts.bold("🔄 REDÉMARRAGE")}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `⏳ Redémarrage de ${name}...`
                );
                await renderService.restartService(deployment.serviceId);
                deployManager.updateDeployment(name, {
                    status: "RESTARTED"
                });
                return message.reply(
                    `✅ ${fonts.bold("SERVICE REDÉMARRÉ")}\n\n` +
                    `📦 Projet : ${name}\n` +
                    `📊 Status : RESTARTED`
                );
            } catch (error) {
                return message.reply(
                    `❌ ${fonts.bold("ÉCHEC DU REDÉMARRAGE")}\n\n` +
                    `${error.message}`
                );
            }
        }

        // ============================================================
        // DELETE
        // ============================================================
        if (subCommand === "delete") {
            const name = args[1];
            if (!name) {
                return message.reply(
                    `⚠️ Utilisation : ${fonts.monospace("deploy delete <nom>")}`
                );
            }
            const deployment = deployManager.findByName(name);
            if (!deployment) {
                return message.reply(
                    `❌ Projet ${fonts.bold(name)} introuvable.`
                );
            }
            try {
                await message.reply(
                    `${fonts.bold("🗑️ SUPPRESSION")}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `⏳ Suppression de ${name} sur Render...`
                );
                await renderService.deleteService(deployment.serviceId);
                deployManager.removeDeployment(name);
                return message.reply(
                    `✅ ${fonts.bold("SERVICE SUPPRIMÉ")}\n\n` +
                    `📦 Projet : ${name}\n` +
                    `🗑️ Le service a été supprimé de Render.`
                );
            } catch (error) {
                return message.reply(
                    `❌ ${fonts.bold("ÉCHEC DE SUPPRESSION")}\n\n` +
                    `${error.message}`
                );
            }
        }

        // ============================================================
        // DEPLOY
        // ============================================================
        const repoUrl = args[0];
        if (!repoUrl) {
            return message.reply(
                `⚠️ Fournis l'URL d'un repository GitHub.\n\n` +
                `Exemple :\n` +
                `${fonts.monospace("deploy https://github.com/user/project")}`
            );
        }
        if (!/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(repoUrl)) {
            return message.reply(
                `❌ URL GitHub invalide.\n\n` +
                `Exemple :\n` +
                `${fonts.monospace("deploy https://github.com/user/project")}`
            );
        }

        try {
            await message.reply(
                `${fonts.bold("🔍 ANALYSE DU PROJET")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🔗 ${repoUrl}\n\n` +
                `⏳ Analyse du repository GitHub...`
            );

            const analysis = await deployManager.analyzeRepository(repoUrl);

            const existing = deployManager.findByName(analysis.repo);
            if (existing) {
                return message.reply(
                    `⚠️ ${fonts.bold("PROJET DÉJÀ DÉPLOYÉ")}\n\n` +
                    `📦 Nom : ${analysis.repo}\n` +
                    `🌐 URL : ${existing.url}\n` +
                    `🆔 Service : ${existing.serviceId}`
                );
            }

            await message.reply(
                `${fonts.bold("🧠 PROJET ANALYSÉ")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Projet : ${analysis.repo}\n` +
                `🧠 Runtime : ${analysis.runtime.toUpperCase()}\n` +
                `🌿 Branch : ${analysis.branch}\n\n` +
                `🔨 Build :\n` +
                `${fonts.monospace(analysis.buildCommand || "N/A")}\n\n` +
                `▶️ Start :\n` +
                `${fonts.monospace(analysis.startCommand || "N/A")}\n\n` +
                `⏳ Création du service Render...`
            );

            const renderRes = await renderService.createWebService({
                name: analysis.repo,
                repo: analysis.repoUrl,
                env: analysis.runtime,
                branch: analysis.branch,
                buildCommand: analysis.buildCommand,
                startCommand: analysis.startCommand
            });

            const service = renderRes?.service || renderRes;
            const serviceId = service?.id || renderRes?.id;

            if (!serviceId) {
                throw new Error("Render n'a pas retourné de serviceId.");
            }

            const serviceUrl =
                service?.serviceDetails?.url ||
                service?.url ||
                `https://${analysis.repo}.onrender.com`;

            deployManager.saveDeployment({
                name: analysis.repo,
                repository: analysis.fullName,
                repoUrl: analysis.repoUrl,
                serviceId: serviceId,
                url: serviceUrl,
                status: "DEPLOYING",
                date: new Date().toISOString(),
                user: event.senderID
            });

            return message.reply(
                `${fonts.bold("🚀 DÉPLOIEMENT LANCÉ")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Projet : ${analysis.repo}\n` +
                `🧠 Runtime : ${analysis.runtime.toUpperCase()}\n` +
                `🆔 Service : ${serviceId}\n\n` +
                `🌐 URL :\n` +
                `${serviceUrl}\n\n` +
                `⏳ Render est maintenant en train de construire et déployer le projet.\n\n` +
                `📊 Vérifie avec :\n` +
                `${fonts.monospace(`deploy status ${analysis.repo}`)}`
            );

        } catch (error) {
            console.error("[DEPLOY ERROR]", error);
            return message.reply(
                `${fonts.bold("❌ ÉCHEC DU DÉPLOIEMENT")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Projet : ${repoUrl}\n\n` +
                `⚠️ ${error.message}`
            );
        }
    }
};
