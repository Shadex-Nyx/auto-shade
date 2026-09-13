"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
    config: {
        name: "gem",
        aliases: [],
        version: "2.3",
        author: "Christus",
        countDown: 5,
        role: 3,
        description: {
            en: "Génère et modifie des images artistiques via l'API GEM."
        },
        category: "ai",
        guide: {
            en: "{pn} <prompt> [--r X:Y] [--nw]"
        }
    },

    onStart: async function ({ api, event, args, message }) {
        if (!args[0]) {
            return message.reply("🎨 | Veuillez fournir une description (prompt).");
        }

        // Réaction initiale "Création en cours"
        try {
            await api.setMessageReaction("🎨", event.messageID, () => {}, true);
        } catch (_) {}

        try {
            let promptParts = [];
            let ratioArg = "1:1"; // Ratio par défaut
            let unfilteredMode = false;

            // Parsing des arguments
            for (let i = 0; i < args.length; i++) {
                if (args[i] === "--r" && i + 1 < args.length) {
                    ratioArg = args[i + 1];
                    i++;
                } else if (args[i] === "--nw") {
                    unfilteredMode = true;
                } else {
                    promptParts.push(args[i]);
                }
            }

            const userPrompt = promptParts.join(" ");
            if (!userPrompt) {
                return message.reply("🎨 | Veuillez fournir un prompt valide.");
            }

            // Logique d'optimisation artistique
            let finalPrompt = userPrompt;
            if (unfilteredMode) {
                finalPrompt = `Sophisticated fine art photography, classical figure study, artistic lighting, gallery quality: ${userPrompt}`;
            }

            let payload = {
                prompt: finalPrompt,
                ratio: ratioArg,
                format: "jpg"
            };
            let endpoint = "https://image-gen-fix.vercel.app/generate";

            // Gestion de la modification d'image via message cité (reply) sur Messenger
            const messageReply = event.messageReply;
            if (messageReply && messageReply.attachments && messageReply.attachments[0] && messageReply.attachments[0].type === "photo") {
                try {
                    const imageUrl = messageReply.attachments[0].url;
                    const responseImg = await axios.get(imageUrl, { responseType: "arraybuffer" });
                    const imgBase64 = Buffer.from(responseImg.data).toString("base64");
                    
                    endpoint = "https://image-gen-fix.vercel.app/edit";
                    payload.image = imgBase64;
                    delete payload.ratio; // L'API d'édition gère le ratio basé sur l'image d'entrée
                } catch (downloadError) {
                    console.error("Erreur lors du téléchargement de l'image citée:", downloadError);
                    return message.reply("❌ | Impossible de lire l'image citée pour la modification.");
                }
            }

            // Requête vers l'API de génération / édition
            const res = await axios.post(endpoint, payload, {
                responseType: "arraybuffer",
                timeout: 180000
            });

            const imageBuffer = Buffer.from(res.data);
            
            // Création automatique du dossier cache s'il n'existe pas
            const cacheDir = path.join(__dirname, "../cache");
            await fs.ensureDir(cacheDir);

            const filePath = path.join(cacheDir, `gem_${event.senderID}.jpg`);
            await fs.writeFile(filePath, imageBuffer);

            // Réaction Succès
            try {
                await api.setMessageReaction("✅", event.messageID, () => {}, true);
            } catch (_) {}

            // Envoi de l'image générée via message.reply
            return message.reply({
                body: `🎨✨ | Chef-d'œuvre créé !${unfilteredMode ? " [Mode Artistique]" : ""}`,
                attachment: fs.createReadStream(filePath)
            }, () => {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });

        } catch (error) {
            console.error("Erreur de génération d'image:", error);
            
            // Réaction Échec
            try {
                await api.setMessageReaction("❌", event.messageID, () => {}, true);
            } catch (_) {}

            let errorMessage = error.message;
            if (error.response && error.response.data) {
                try {
                    errorMessage = Buffer.from(error.response.data).toString("utf8");
                } catch (_) {}
            }
            return message.reply(`❌ | Échec de la génération : ${errorMessage}`);
        }
    }
};
