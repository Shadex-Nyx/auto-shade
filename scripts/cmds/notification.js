const fonts = require("../func/fonts.js");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "notification",
    aliases: ["noti"],
    version: "8.0",
    author: "Shade",
    countDown: 5,
    role: 4,
    description: "Envoie un communiqué officiel à tous les groupes actifs.",
    category: "owner",
    guide: {
      fr: "{p}notification [votre message]"
    }
  },

  onStart: async function ({ api, event, args, usersData, message }) {
    if (!args[0]) {
      return message.reply(fonts.christus("⚠️ Veuillez saisir le message du communiqué à diffuser."));
    }

    const messageContent = args.join(" ");
    const adminName = await usersData.getName(event.senderID) || "Administration";

    const sentMsg = await message.reply(fonts.christus("⚠️ Voulez-vous inclure une photo avec ce communiqué ?\nRépondez par 'oui' ou 'non'."));

    global.GoatBot.onReply.set(sentMsg.messageID, {
      commandName: this.config.name,
      author: event.senderID,
      step: "ask_photo",
      messageContent,
      adminName,
      photoUrl: null
    });
  },

  onReply: async function ({ api, event, Reply, message }) {
    if (event.senderID !== Reply.author) return;

    const answer = event.body ? event.body.trim().toLowerCase() : "";

    // --- ÉTAPE 1 : Choix de la photo ---
    if (Reply.step === "ask_photo") {
      if (["oui", "o", "yes", "y"].includes(answer)) {
        const sentMsg = await message.reply(fonts.christus("⚠️ Veuillez répondre à ce message en y joignant la photo de votre choix."));
        global.GoatBot.onReply.set(sentMsg.messageID, {
          commandName: this.config.name,
          author: event.senderID,
          step: "get_photo",
          messageContent: Reply.messageContent,
          adminName: Reply.adminName,
          photoUrl: null
        });
        return;
      } else if (["non", "n", "no"].includes(answer)) {
        const sentMsg = await message.reply(fonts.christus("⚠️ Êtes-vous sûr de vouloir diffuser ce communiqué à tous les groupes sans photo ?\nRépondez 'oui' pour confirmer ou 'non' pour annuler."));
        global.GoatBot.onReply.set(sentMsg.messageID, {
          commandName: this.config.name,
          author: event.senderID,
          step: "confirm_send",
          messageContent: Reply.messageContent,
          adminName: Reply.adminName,
          photoUrl: null
        });
        return;
      } else {
        return message.reply(fonts.christus("⚠️ Veuillez répondre par 'oui' ou 'non'."));
      }
    }

    // --- ÉTAPE 2 : Récupération de la photo ---
    if (Reply.step === "get_photo") {
      let photoUrl = null;
      if (event.type === "message_reply" && event.messageReply?.attachments?.[0]) {
        const att = event.messageReply.attachments[0];
        if (att.type === "photo" || att.type === "image") photoUrl = att.url;
      } else if (event.attachments?.[0]) {
        const att = event.attachments[0];
        if (att.type === "photo" || att.type === "image") photoUrl = att.url;
      }

      if (!photoUrl) {
        return message.reply(fonts.christus("⚠️ Aucune photo valide détectée. Veuillez répondre avec une photo."));
      }

      const sentMsg = await message.reply(fonts.christus("⚠️ Êtes-vous sûr de vouloir diffuser ce communiqué avec la photo attachée à tous les groupes ?\nRépondez 'oui' pour confirmer ou 'non' pour annuler."));
      global.GoatBot.onReply.set(sentMsg.messageID, {
        commandName: this.config.name,
        author: event.senderID,
        step: "confirm_send",
        messageContent: Reply.messageContent,
        adminName: Reply.adminName,
        photoUrl
      });
      return;
    }

    // --- ÉTAPE 3 : Confirmation finale et envoi ---
    if (Reply.step === "confirm_send") {
      if (["oui", "o", "yes", "y"].includes(answer)) {
        message.reply(fonts.christus("📡 Diffusion du communiqué en cours dans tous les groupes actifs..."));

        try {
          const threads = await api.getThreadList(100, null, ["INBOX"]) || [];
          const activeGroups = threads.filter(t => t.isGroup && t.name);

          if (activeGroups.length === 0) {
            return message.reply(fonts.christus("❌ Le bot n'est présent dans aucun groupe actif."));
          }

          let successCount = 0;
          let localImagePath = null;
          let cleanAdminName = Reply.adminName.replace(/@/g, "");

          if (Reply.photoUrl) {
            const cacheDir = path.join(__dirname, "cache");
            await fs.ensureDir(cacheDir);
            localImagePath = path.join(cacheDir, `noti_${Date.now()}.jpg`);

            const response = await axios({
              method: 'GET',
              url: Reply.photoUrl,
              responseType: 'stream'
            });

            await new Promise((resolve, reject) => {
              const writer = fs.createWriteStream(localImagePath);
              response.data.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
          }

          for (const group of activeGroups) {
            try {
              let mentionsList = [];
              let formattedText = `📢 𝐍𝐎𝐓𝐈𝐅𝐈𝐂𝐀𝐓𝐈𝐎𝐍 𝐃𝐄 𝐋'𝐀𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐓𝐄𝐔𝐑\n━━━━━━━━━━━━━━━━━━\nFrom : ${cleanAdminName}\n💬 : ${Reply.messageContent}\n🏷️ Groupe : ${group.name}\n🔗 ID : ${group.threadID}`;

              if (group.participantIDs && group.participantIDs.includes(event.senderID)) {
                mentionsList.push({
                  tag: cleanAdminName,
                  id: event.senderID
                });
              }

              const msgObj = {
                body: fonts.christus(formattedText),
                mentions: mentionsList
              };

              if (localImagePath && fs.existsSync(localImagePath)) {
                msgObj.attachment = fs.createReadStream(localImagePath);
              }

              await api.sendMessage(msgObj, group.threadID);
              successCount++;
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
              console.error(`[NOTIFY ERR] Échec sur le groupe ${group.threadID}:`, err.message);
            }
          }

          if (localImagePath && fs.existsSync(localImagePath)) {
            try { fs.unlinkSync(localImagePath); } catch (e) {}
          }

          return message.reply(fonts.christus(`✅ Communiqué officiel envoyé avec succès dans ${successCount} groupes !`));

        } catch (globalErr) {
          console.error(globalErr);
          return message.reply(fonts.christus(`❌ Erreur critique : ${globalErr.message}`));
        }
      } else {
        return message.reply(fonts.christus("⚠️ Diffusion annulée."));
      }
    }
  }
};
