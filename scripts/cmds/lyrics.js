const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = {
  config: {
    name: "lyrics",
    version: "3.5",
    author: "Shade x Christus",
    countDown: 5,
    role: 0,
    shortDescription: "Récupère les paroles d'une chanson via Shade Lyrics",
    longDescription: "Obtenez les paroles détaillées avec titre, artiste, album et pochette depuis l'API Shade Lyrics.",
    category: "search",
    guide: {
      en: "{pn} <nom de la chanson>\nExemple: {pn} Adele Hello"
    }
  },
  onStart: async function ({ api, event, args, message }) {
    const query = args.join(" ");
    if (!query) {
      return message.reply("⚠️ Veuillez donner un nom de chanson !\nExemple: lyrics Adele Hello");
    }

    const BASE_URL = "https://shade-lyrics-0rsc.onrender.com/v1";

    try {
      // 1. Recherche du morceau sur l'API Shade Lyrics
      const searchRes = await axios.get(
        `${BASE_URL}/search?query=${encodeURIComponent(query)}`,
        { timeout: 15000 }
      );
      const results = searchRes.data?.results;
      if (!results || results.length === 0) {
        return message.reply("❌ Aucune chanson trouvée. Essayez un autre titre ou vérifiez l'orthographe.");
      }

      // Sélection de la première chanson correspondante
      const firstResult = results[0];

      // 2. Récupération des paroles détaillées
      const lyricsRes = await axios.get(
        `${BASE_URL}/lyrics?id=${firstResult.id}`,
        { timeout: 15000 }
      );
      const songData = lyricsRes.data;
      const {
        title,
        artist,
        album,
        lyrics,
        coverArt
      } = songData;

      let lyricsText = lyrics || "Lyrics unavailable for this song.";
      if (lyricsText.length > 15000) {
        lyricsText = lyricsText.slice(0, 15000) + "\n\n... (suite tronquée)";
      }

      let messageBody = `🎵 ${title || firstResult.title}\n`;
      if (artist || firstResult.artist) messageBody += `👤 Artiste: ${artist || firstResult.artist}\n`;
      if (album || firstResult.album) messageBody += `💿 Album: ${album || firstResult.album}\n`;
      messageBody += `\n📜 Paroles:\n${lyricsText}`;

      // 3. Téléchargement de la pochette d'album si disponible
      let attachment = null;
      const imageUrl = coverArt || firstResult.coverArt;
      if (imageUrl) {
        try {
          const imgExt = imageUrl.split(".").pop().split("?")[0] || "jpg";
          const imgName = crypto.createHash("md5").update(imageUrl).digest("hex");
          const imgPath = path.join(__dirname, `lyrics_${imgName}.${imgExt}`);

          if (!fs.existsSync(imgPath)) {
            const imgResp = await axios.get(imageUrl, {
              responseType: "stream",
              timeout: 15000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
            const writer = fs.createWriteStream(imgPath);
            imgResp.data.pipe(writer);
            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });
          }

          attachment = fs.createReadStream(imgPath);

          setTimeout(() => {
            if (fs.existsSync(imgPath)) {
              try { fs.unlinkSync(imgPath); } catch (e) {}
            }
          }, 3600000);
        } catch (imgError) {
          console.error("Erreur téléchargement pochette:", imgError.message);
        }
      }

      // 4. Envoi du message avec l'image via message.reply
      return message.reply(
        {
          body: messageBody,
          attachment: attachment
        },
        () => {
          if (attachment && attachment.path) {
            try {
              if (fs.existsSync(attachment.path)) {
                fs.unlinkSync(attachment.path);
              }
            } catch (e) {}
          }
        }
      );

    } catch (err) {
      console.error("Erreur API Shade Lyrics:", err);
      let errorMsg = "❌ Erreur: Impossible de récupérer les paroles.\n";
      if (err.code === 'ECONNABORTED') {
        errorMsg += "⏰ Délai d'attente dépassé (le serveur Render redémarre peut-être).";
      } else if (err.response?.status === 404) {
        errorMsg += "📭 Aucune parole trouvée pour cette chanson.";
      } else if (err.response?.status === 500) {
        errorMsg += "🔧 Erreur serveur sur Shade Lyrics.";
      } else {
        errorMsg += "🔧 Vérifiez que le serveur Shade Lyrics est en ligne.";
      }
      return message.reply(errorMsg);
    }
  }
};
