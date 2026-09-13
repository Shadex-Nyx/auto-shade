const fonts = require("../func/fonts.js");
const mongoose = require("mongoose");

module.exports = {
  config: {
    name: "resetall",
    version: "1.0.1",
    author: "Shade",
    countDown: 5,
    role: 2,
    shortDescription: { fr: "Réinitialise complètement la base de données MongoDB" },
    category: "owner",
    guide: { fr: "{p}resetall pour voir l'avertissement\n{p}resetall confirm pour exécuter" }
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const allowedUID = "61573867120837";

    // 1. Restriction stricte d'accès
    if (senderID !== allowedUID) {
      return api.sendMessage(
        fonts.christus("⚠️ Vous n'avez pas l'autorisation d'exécuter cette commande réservée au propriétaire."),
        threadID,
        messageID
      );
    }

    // 2. Vérification de la confirmation
    if (!args[0] || args[0].toLowerCase() !== "confirm") {
      const warningMessage = 
        `⚠️ AVERTISSEMENT CRITIQUE ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Cette action va SUPPRIMER DÉFINITIVEMENT toutes les données enregistrées dans MongoDB :\n` +
        `• Utilisateurs (usersData)\n` +
        `• Groupes (threadsData)\n` +
        `• Données globales (globalData)\n` +
        `• Dashboard & Banque (dashBoardData, bankData...)\n` +
        `• Toutes les autres collections existantes.\n\n` +
        `Cette opération est 100% IRRÉVERSIBLE.\n` +
        `Les données seront recréées à zéro au fur et à mesure.\n\n` +
        `👉 Pour confirmer, tapez : resetall confirm`;

      return api.sendMessage(
        fonts.christus(warningMessage),
        threadID,
        messageID
      );
    }

    // 3. Exécution du reset MongoDB
    await api.sendMessage(
      fonts.christus("🔄 Connexion à MongoDB et analyse des collections en cours..."),
      threadID,
      messageID
    );

    try {
      const db = mongoose.connection.db;

      if (!db) {
        return api.sendMessage(
          fonts.christus("❌ Impossible d'accéder directement à la base de données MongoDB."),
          threadID,
          messageID
        );
      }

      // Détection automatique de toutes les collections existantes
      const collections = await db.listCollections().toArray();
      
      if (collections.length === 0) {
        return api.sendMessage(
          fonts.christus("ℹ️ Aucune collection trouvée dans la base de données."),
          threadID,
          messageID
        );
      }

      let totalDeletedDocs = 0;
      let collectionsClearedCount = 0;
      const totalCollections = collections.length;

      // Parcours et vidage de chaque collection
      for (let i = 0; i < totalCollections; i++) {
        const colName = collections[i].name;
        
        // Exclure les collections système
        if (colName.startsWith("system.")) continue;

        const collection = db.collection(colName);
        const count = await collection.countDocuments();
        
        // Barre de progression
        const progress = Math.round(((i + 1) / totalCollections) * 100);
        const progressBar = "▓".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

        await api.sendMessage(
          fonts.christus(`⏳ NETTOYAGE EN COURS [${progressBar}] ${progress}%\n\n🗑️ Collection : ${colName} (${count} documents)...`),
          threadID
        );

        // Suppression complète de tous les documents de la collection
        const deleteResult = await collection.deleteMany({});
        totalDeletedDocs += deleteResult.deletedCount || 0;
        collectionsClearedCount++;
      }

      // Nettoyage sécurisé du cache en mémoire (global.db)
      if (global.db) {
        const resetCache = (target) => {
          if (!target) return;
          if (typeof target.clear === "function") {
            target.clear();
          } else if (Array.isArray(target)) {
            target.length = 0;
          } else if (typeof target === "object") {
            for (const key in target) {
              delete target[key];
            }
          }
        };

        resetCache(global.db.allUserData);
        resetCache(global.db.allThreadData);
        resetCache(global.db.allGlobalData);
      }

      // Résumé final
      const summaryMessage = 
        `✅ RÉINITIALISATION MONGODB TERMINÉE !\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Collections nettoyées : ${collectionsClearedCount}\n` +
        `🗑️ Documents supprimés : ${totalDeletedDocs}\n` +
        `🟢 Statut : La base de données est complètement à zéro.\n` +
        `💡 Les nouveaux messages recréeront automatiquement les données.`;

      return api.sendMessage(
        fonts.christus(summaryMessage),
        threadID,
        messageID
      );

    } catch (error) {
      return api.sendMessage(
        fonts.christus(`❌ Erreur lors du nettoyage de MongoDB : ${error.message}`),
        threadID,
        messageID
      );
    }
  }
};
