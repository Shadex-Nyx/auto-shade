const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const dossierCache = path.join(__dirname, "cache");

if (!fs.existsSync(dossierCache)) {
  fs.mkdirSync(dossierCache);
}

// URLs des images hébergées pour chaque résultat
const urlImageInitiale = "https://i.ibb.co/3sS7J5M/penalty-start.png";
const urlImageArretee   = "https://i.ibb.co/Q8N9X5B/penalty-stopped.png";
const urlImageRatee     = "https://i.ibb.co/v3L5W2y/penalty-missed.png";
const urlImageReussie   = "https://i.ibb.co/yQ5F28L/penalty-goal.png";

module.exports = {
  config: {
    name: "penalty",
    version: "1.0",
    author: "Raph",
    countDown: 60,
    role: 0,
    shortDescription: { fr: "Jeu de tir au but" },
    longDescription: { fr: "Jeu de tir au but" },
    category: "game",
    guide: { fr: "{p}penalty <montant>" }
  },

  onStart: async function ({ api, args, message, event, usersData }) {
    try {
      // Vérification de la mise
      if (args.length !== 1 || isNaN(parseInt(args[0]))) {
        return message.reply("Veuillez fournir un montant de mise valide.");
      }

      const bet = parseInt(args[0]);
      const senderID = event.senderID;
      const userData = await usersData.get(senderID);

      if (bet > userData.money) {
        return message.reply("Vous n'avez pas assez d'argent pour placer cette mise.");
      }

      // Chargement et envoi de l'image initiale
      const imageObj = await loadImage(urlImageInitiale);
      const cachePath = await sauvegarderImageDansCache(imageObj);
      const msgInfo = await message.reply({ attachment: fs.createReadStream(cachePath) });

      // Stockage de la session de jeu
      global.GoatBot.onReply.set(msgInfo.messageID, {
        commandName: "penalty",
        uid: senderID,
        bet: bet,
        result: null
      });

    } catch (e) {
      console.error("Erreur dans la commande penalty:", e);
      message.reply("Une erreur s'est produite.");
    }
  },

  onReply: async function ({ api, message, event, args, usersData }) {
    const replyData = global.GoatBot.onReply.get(event.messageReply.messageID);
    if (!replyData || replyData.uid !== event.senderID) return;

    const { commandName, uid, bet } = replyData;
    if (commandName !== "penalty") return;

    const userData = await usersData.get(uid);
    const direction = args[0].toLowerCase();

    // Directions acceptées : gauche, droite, centre, etc.
    const validDirections = ["gauche", "droit", "droite", "centre", "center"];

    if (validDirections.includes(direction)) {
      const chance = Math.random();
      let isGoal = false;

      // Calcul des probabilités selon le tir
      if (direction === "gauche" || direction === "droit") {
        isGoal = chance < 0.5;
      } else if (direction === "droite") {
        isGoal = chance < 0.7;
      } else if (direction === "centre" || direction === "center") {
        isGoal = chance < 0.4;
      }

      let resultImg, msgText;

      if (isGoal) {
        // Victoire !
        resultImg = await loadImage(urlImageReussie);
        msgText = `🎉 BUUUT ! Vous avez gagné ${bet * 2}$ !`;
        await usersData.set(uid, { money: userData.money + bet });
      } else {
        // Défaite (arrêt ou raté)
        if (chance < 0.1) {
          resultImg = await loadImage(urlImageArretee);
          msgText = `🧤 Arrêté par le gardien ! Vous avez perdu ${bet}$ !`;
        } else {
          resultImg = await loadImage(urlImageRatee);
          msgText = `❌ Tir raté ! Vous avez perdu ${bet}$ !`;
        }
        await usersData.set(uid, { money: userData.money - bet });
      }

      // Envoi du résultat
      const resultPath = await sauvegarderImageDansCache(resultImg);
      await message.reply({ attachment: fs.createReadStream(resultPath) });
      await message.reply(msgText);

      // Suppression de l'écouteur de réponse
      global.GoatBot.onReply.delete(event.messageReply.messageID);

    } else {
      message.reply("Veuillez choisir une direction valide (gauche, droite, centre).");
    }
  }
};

async function sauvegarderImageDansCache(image) {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);

  const filePath = path.join(dossierCache, "penalty_" + Date.now() + ".png");
  await fs.promises.writeFile(filePath, canvas.toBuffer());
  return filePath;
}
