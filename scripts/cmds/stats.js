const { createCanvas, registerFont } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

const FONTS_DIR = path.join(__dirname, "cache", "fonts");
const HEADER = "[ STATISTIQUES ]\n───────────────────\n";
const pastelColors = [
  "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF",
  "#E8AEFF", "#FFC6FF", "#BDB2FF", "#A0C4FF", "#C9C9FF"
];

let fontsRegistered = false;
let fontFamily = "sans-serif";

function regFonts() {
  if (fontsRegistered) return;
  try {
    registerFont(path.join(FONTS_DIR, "Poppins-Bold.ttf"), { family: "Poppins", weight: "bold" });
    registerFont(path.join(FONTS_DIR, "Poppins-Regular.ttf"), { family: "Poppins" });
    fontFamily = "Poppins";
  } catch (e) {}
  fontsRegistered = true;
}

module.exports = {
  config: {
    name: "cmdstats",
    aliases: ["cmdstat","stats"],
    version: "1.0.0",
    author: "Raph",
    countDown: 10,
    role: 0,
    category: "utility",
    shortDescription: { fr: "Affiche le top des commandes" },
    longDescription: { fr: "Affiche un graphique en camembert des commandes les plus utilisées" },
    guide: { fr: "{p}cmdstats" }
  },

  onStart: async function ({ message, globalData }) {
    regFonts();
    try {
      const statsData = await globalData.get("system", "commandStats", {});
      if (!statsData || Object.keys(statsData).length === 0) {
        return message.reply(HEADER + "Aucune donnée de commande disponible.");
      }

      // Tri des 10 commandes les plus utilisées
      const sortedStats = Object.entries(statsData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      const topStats = Object.fromEntries(sortedStats);

      // Création du Canvas pour le graphique
      const width = 1000;
      const height = 700;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // Dessin du fond et du camembert...
      // (Rendu visuel du graphique en image PNG)

      // Envoi du message avec l'image générée en pièce jointe
      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);
      const imagePath = path.join(cacheDir, `stats_${Date.now()}.png`);
      
      await fs.writeFile(imagePath, canvas.toBuffer("image/png"));

      let textResponse = HEADER + "📊 Top 10 des commandes les plus utilisées :\n\n";
      sortedStats.forEach(([cmd, count], index) => {
        textResponse += `${index + 1}. ${cmd} : ${count} fois\n`;
      });

      await message.reply({
        body: textResponse.trim(),
        attachment: fs.createReadStream(imagePath)
      });

      fs.remove(imagePath).catch(() => {});
    } catch (error) {
      console.error("Erreur cmdstats:", error);
      return message.reply(HEADER + "Une erreur s'est produite : " + error.message);
    }
  }
};
