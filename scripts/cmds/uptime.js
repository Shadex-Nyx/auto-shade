"use strict";

const uptimeService = require("../../services/uptime.service");
const uptimeManager = require("../../utils/uptimeManager");

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  fonts = { bold: (t) => t, sansSerif: (t) => t, monospace: (t) => t };
}

module.exports = {
    config: {
        name: "uptime",
        aliases: ["monitor"],
        version: "2.0.1",
        author: "Shade",
        countDown: 5,
        role: 3, 
        shortDescription: { fr: "Gestion des moniteurs UptimeRobot" },
        longDescription: { fr: "Permet de créer, lister, mettre en pause ou supprimer des moniteurs UptimeRobot." },
        category: "owner",
        guide: {
            fr:
                "{pn} add <url>\n" +
                "{pn} list\n" +
                "{pn} status <id>\n" +
                "{pn} pause <id>\n" +
                "{pn} resume <id>\n" +
                "{pn} delete <id>\n" +
                "{pn} help"
        }
    },

    onStart: async function ({ api, event, args, message }) {
        const subCommand = args[0]?.toLowerCase();
        const userId = event.senderID;

        // 1. HELP
        if (!subCommand || subCommand === "help") {
            return message.reply(
                `${fonts.bold("🤖 UPTIMEROBOT")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${fonts.monospace("uptime add <url>")} – Ajouter un moniteur\n` +
                `${fonts.monospace("uptime list")} – Lister les moniteurs\n` +
                `${fonts.monospace("uptime status <id>")} – Infos détaillées\n` +
                `${fonts.monospace("uptime pause <id>")} – Mettre en pause\n` +
                `${fonts.monospace("uptime resume <id>")} – Reprendre\n` +
                `${fonts.monospace("uptime delete <id>")} – Supprimer\n` +
                `${fonts.monospace("uptime help")} – Aide`
            );
        }

        // 2. LIST
        if (subCommand === "list") {
            try {
                const monitors = await uptimeService.getMonitors();
                if (!monitors || monitors.length === 0) {
                    return message.reply("📦 Aucun moniteur trouvé sur UptimeRobot.");
                }

                let text = `${fonts.bold("🤖 UPTIMEROBOT — LISTE")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                monitors.forEach((m, idx) => {
                    let statusEmoji = "🟢 UP";
                    if (m.status === 9) statusEmoji = "🔴 DOWN";
                    if (m.status === 0) statusEmoji = "🟡 PAUSED";

                    text += `${idx + 1}. ${fonts.bold(m.friendly_name)}\n`;
                    text += `   🆔 ID : ${fonts.monospace(m.id)}\n`;
                    text += `   🌐 URL : ${m.url}\n`;
                    text += `   📊 Statut : ${statusEmoji}\n`;
                    text += `   ⏱️ Intervalle : ${m.interval / 60} min\n\n`;
                });

                return message.reply(text.trim());
            } catch (error) {
                return message.reply(`❌ ${error.message}`);
            }
        }

        // 3. STATUS
        if (subCommand === "status") {
            const id = args[1];
            if (!id) return message.reply(`⚠️ Précisez l'ID : ${fonts.monospace("uptime status <id>")}`);

            try {
                const res = await uptimeService.getMonitors(id);
                const m = res[0];
                if (!m) return message.reply("❌ Moniteur introuvable.");

                let statusText = m.status === 2 ? "🟢 UP" : m.status === 9 ? "🔴 DOWN" : "🟡 PAUSED";
                return message.reply(
                    `${fonts.bold(`📊 RAPPORT — ${m.friendly_name}`)}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 ID : ${fonts.monospace(m.id)}\n` +
                    `🌐 URL : ${m.url}\n` +
                    `📊 Statut : ${statusText}\n` +
                    `⏱️ Intervalle : ${m.interval / 60} minutes\n` +
                    `📈 Uptime total : ${m.all_time_uptime_ratio || "N/A"}%`
                );
            } catch (error) {
                return message.reply(`❌ ${error.message}`);
            }
        }

        // 4. PAUSE / RESUME / DELETE direct par ID
        if (["pause", "resume", "delete"].includes(subCommand)) {
            const id = args[1];
            if (!id) return message.reply(`⚠️ Précisez l'ID : ${fonts.monospace(`uptime ${subCommand} <id>`)}`);

            try {
                if (subCommand === "pause") {
                    await uptimeService.editMonitorStatus(id, 0);
                    return message.reply(`🟡 Le moniteur ID ${id} a été mis en pause.`); // Erreur corrigée ici
                }
                if (subCommand === "resume") {
                    await uptimeService.editMonitorStatus(id, 1);
                    return message.reply(`🟢 Le moniteur ID ${id}a repris.`);
                }
                if (subCommand === "delete") {
                    await uptimeService.deleteMonitor(id);
                    uptimeManager.removeMonitor(id);
                    return message.reply(`🗑️ Moniteur ID ${id} supprimé avec succès.`);
                }
            } catch (error) {
                return message.reply(`❌ ${error.message}`);
            }
        }

        // 5. ADD (Workflow interactif)
        if (subCommand === "add") {
            const url = args[1];
            if (!url || !/^https?:\/\//i.test(url)) {
                return message.reply(`⚠️ Fournissez une URL valide.\nExemple : ${fonts.monospace("uptime add https://mon-api.onrender.com")}`);
            }

            // Initialisation de la session interactive étape 1
            uptimeManager.setSession(userId, {
                step: "getName",
                url: url
            });

            return message.reply(`${fonts.bold("🤖 UPTIMEROBOT")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏷️ Quel nom veux-tu donner au monitor ?`);
        }
    },

    onChat: async function ({ api, event, message }) {
        const userId = event.senderID;
        const session = uptimeManager.getSession(userId);
        if (!session) return;

        const text = event.body?.trim();
        if (!text) return;

        // Commande d'annulation globale
        if (text.toLowerCase() === "cancel") {
            uptimeManager.clearSession(userId);
            return message.reply("❌ Opération annulée.");
        }

        // ÉTAPE 2 : Récupération du nom
        if (session.step === "getName") {
            session.name = text;
            session.step = "getInterval";
            uptimeManager.setSession(userId, session);

            return message.reply(
                `${fonts.bold("🤖 UPTIMEROBOT")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⏱️ Choisis l'intervalle :\n` +
                `1️⃣ 5 minutes\n` +
                `2️⃣ 10 minutes\n` +
                `3️⃣ 15 minutes\n` +
                `4️⃣ 30 minutes\n` +
                `5️⃣ 60 minutes\n\n` +
                `(Réponds avec le chiffre correspondant)`
            );
        }

        // ÉTAPE 3 : Choix de l'intervalle
        if (session.step === "getInterval") {
            const choice = text;
            const intervals = { "1": 300, "2": 600, "3": 900, "4": 1800, "5": 3600 };
            const minutesMap = { "1": 5, "2": 10, "3": 15, "4": 30, "5": 60 };

            if (!intervals[choice]) {
                return message.reply("⚠️ Choix invalide. Réponds par un chiffre entre 1 et 5.");
            }

            session.intervalSeconds = intervals[choice];
            session.intervalMinutes = minutesMap[choice];
            session.step = "confirm";
            uptimeManager.setSession(userId, session);

            return message.reply(
                `${fonts.bold("🔎 CONFIRMATION")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🏷️ Nom : ${session.name}\n` +
                `🌐 URL : ${session.url}\n` +
                `⏱️ Intervalle : ${session.intervalMinutes} minutes\n\n` +
                `Réponds yes pour confirmer ou no pour annuler.`
            );
        }

        // ÉTAPE 4 : Confirmation Finale
        if (session.step === "confirm") {
            const answer = text.toLowerCase();

            if (answer === "no") {
                uptimeManager.clearSession(userId);
                return message.reply("🛑 Création annulée.");
            }

            if (answer === "yes") {
                try {
                    await message.reply("⏳ Création du moniteur sur UptimeRobot...");

                    const newMon = await uptimeService.addMonitor({
                        friendlyName: session.name,
                        url: session.url,
                        interval: session.intervalSeconds
                    });

                    uptimeManager.saveMonitor({
                        id: newMon.id,
                        name: session.name,
                        url: session.url,
                        interval: session.intervalMinutes
                    });

                    uptimeManager.clearSession(userId);

                    return message.reply(
                        `✅ ${fonts.bold("MONITOR CRÉÉ")}\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `🏷️ Nom : ${session.name}\n` +
                        `🌐 URL : ${session.url}\n` +
                        `⏱️ Intervalle : ${session.intervalMinutes} minutes\n` +
                        `📊 Status : MONITORING\n` +
                        `🆔 ID : ${fonts.monospace(newMon.id)}`
                    );
                } catch (error) {
                    uptimeManager.clearSession(userId);
                    return message.reply(`❌ Erreur : ${error.message}`);
                }
            } else {
                return message.reply("⚠️ Réponds par yes ou non.");
            }
        }
    }
};
