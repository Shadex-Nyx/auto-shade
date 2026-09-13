"use strict";

module.exports = {
  config: {
    name: "nickname",
    aliases: ["nick", "setname"],
    version: "1.0.0",
    author: "Shade",
    countDown: 5,
    role: 1,
    shortDescription: {
      en: "Change the nickname of a group member"
    },
    longDescription: {
      en: "Change the nickname of a mentioned member or all group members"
    },
    category: "box chat",
    guide: {
      en: [
        "{pn} @mention NewName",
        "{pn} all NewName",
        "{pn} reset @mention",
        "{pn} reset all"
      ]
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const threadID = event.threadID;

    if (!args.length) {
      return message.reply(
        "Usage:\n" +
        "nickname @mention NouveauNom\n" +
        "nickname all NouveauNom\n" +
        "nickname reset @mention\n" +
        "nickname reset all"
      );
    }

    const threadInfo = await new Promise((resolve, reject) => {
      api.getThreadInfo(threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info);
      });
    }).catch(() => null);

    if (!threadInfo) {
      return message.reply(
        "Impossible de récupérer les informations du groupe."
      );
    }

    const firstArg = args[0].toLowerCase();

    /*
     * ============================
     * RESET
     * ============================
     */

    if (firstArg === "reset") {
      const secondArg = args[1]?.toLowerCase();

      // reset all
      if (secondArg === "all") {
        const members = threadInfo.participantIDs || [];

        if (!members.length) {
          return message.reply("Aucun membre trouvé.");
        }

        await message.reply(
          `Réinitialisation des pseudos de ${members.length} membres...`
        );

        let success = 0;
        let failed = 0;

        for (const userID of members) {
          try {
            await changeNickname(api, "", threadID, userID);
            success++;

            // Petite pause pour éviter les appels trop rapides
            await sleep(500);
          } catch (error) {
            failed++;
          }
        }

        return message.reply(
          `Réinitialisation terminée.\n\n` +
          `Réussis : ${success}\n` +
          `Échecs : ${failed}`
        );
      }

      // reset mention
      const mentionedIDs = Object.keys(event.mentions || {});

      if (!mentionedIDs.length) {
        return message.reply(
          "Mentionne la personne dont tu veux réinitialiser le pseudo."
        );
      }

      const userID = mentionedIDs[0];

      try {
        await changeNickname(api, "", threadID, userID);

        return message.reply(
          "Le pseudo a été réinitialisé."
        );
      } catch (error) {
        return message.reply(
          "Impossible de réinitialiser ce pseudo."
        );
      }
    }

    /*
     * ============================
     * ALL
     * ============================
     */

    if (firstArg === "all") {
      const newNickname = args.slice(1).join(" ").trim();

      if (!newNickname) {
        return message.reply(
          "Utilisation : nickname all NouveauNom"
        );
      }

      if (newNickname.length > 50) {
        return message.reply(
          "Le pseudo est trop long. Maximum : 50 caractères."
        );
      }

      const members = threadInfo.participantIDs || [];

      if (!members.length) {
        return message.reply(
          "Aucun membre trouvé dans ce groupe."
        );
      }

      await message.reply(
        `Changement des pseudos de ${members.length} membres...`
      );

      let success = 0;
      let failed = 0;

      for (const userID of members) {
        try {
          await changeNickname(
            api,
            newNickname,
            threadID,
            userID
          );

          success++;

          await sleep(500);
        } catch (error) {
          failed++;
        }
      }

      return message.reply(
        `Opération terminée.\n\n` +
        `Nouveau pseudo : ${newNickname}\n` +
        `Réussis : ${success}\n` +
        `Échecs : ${failed}`
      );
    }

    /*
     * ============================
     * MENTION
     * ============================
     */

    const mentionedIDs = Object.keys(event.mentions || {});

    if (!mentionedIDs.length) {
      return message.reply(
        "Mentionne une personne.\n\n" +
        "Exemple : nickname @Shade Boss"
      );
    }

    const newNickname = args
      .slice(1)
      .join(" ")
      .trim();

    if (!newNickname) {
      return message.reply(
        "Indique le nouveau pseudo."
      );
    }

    if (newNickname.length > 50) {
      return message.reply(
        "Le pseudo est trop long. Maximum : 50 caractères."
      );
    }

    const userID = mentionedIDs[0];

    try {
      await changeNickname(
        api,
        newNickname,
        threadID,
        userID
      );

      return message.reply(
        `Pseudo modifié en : ${newNickname}`
      );
    } catch (error) {
      console.error(
        "[nickname] changeNickname error:",
        error
      );

      return message.reply(
        "Impossible de modifier le pseudo de cette personne."
      );
    }
  }
};


/*
 * ==========================================
 * CHANGE NICKNAME
 * ==========================================
 */

function changeNickname(api, name, threadID, userID) {
  return new Promise((resolve, reject) => {
    api.changeNickname(
      name,
      threadID,
      userID,
      (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      }
    );
  });
}


/*
 * ==========================================
 * DELAY
 * ==========================================
 */

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
