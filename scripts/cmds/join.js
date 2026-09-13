const axios = require("axios");
const fs = require("fs-extra");
const request = require("request");

module.exports = {
  config: {
    name: "join",
    version: "2.2",
    author: "Shade",
    countDown: 5,
    role: 5,
    shortDescription: "Join the group that bot is in",
    longDescription: "",
    category: "tools",
    guide: {
      en: "{p}{n}",
    },
  },
  
  onStart: async function ({ api, event, message }) {
    try {
      // Récupération de la liste des conversations (threads)
      const groupList = await api.getThreadList(20, null, ['INBOX']);
      
      // Filtrer uniquement les groupes (isGroup === true ou s'ils ont un nom de groupe)
      const filteredList = groupList.filter(group => group.isGroup === true || group.threadName || group.name);
      
      if (filteredList.length === 0) {
        return message.reply('No group chats found.');
      }
      
      // On limite à 10 pour l'affichage
      const limitedList = filteredList.slice(0, 10);
      const formattedList = limitedList.map((group, index) => {
        const name = group.name || group.threadName || "Groupe sans nom";
        return `│${index + 1}. ${name}\n│𝐓𝐈𝐃: ${group.threadID}`;
      });
      
      const textMessage = `╭─╮\n│𝐋𝐢𝐬𝐭 𝐨𝐟 𝐠𝐫𝐨𝐮𝐩 𝐜𝐡𝐚𝐭𝐬:\n${formattedList.join("\n")}\n╰───────────ꔪ`;
      
      // Send message and track for reply
      message.reply(textMessage, (err, sentMessage) => {
        if (err) return;
        global.GoatBot.onReply.set(sentMessage.messageID, {
          commandName: 'join',
          messageID: sentMessage.messageID,
          author: event.senderID,
          groupList: limitedList // On stocke la liste pour s'en servir au onReply
        });
      });
      
    } catch (error) {
      console.error("Error listing group chats", error);
      message.reply("An error occurred while fetching group chats.");
    }
  },

  onReply: async function ({ api, event, Reply, args, message }) {
    const { author, groupList } = Reply;
    if (event.senderID !== author) return;
    
    const groupIndex = parseInt(args[0], 10);
    if (isNaN(groupIndex) || groupIndex <= 0) {
      return message.reply('Invalid input.\nPlease provide a valid number.');
    }
    
    try {
      if (!groupList || groupIndex > groupList.length) {
        return message.reply('Invalid group number.\nPlease choose a number within the range.');
      }
      
      const selectedGroup = groupList[groupIndex - 1];
      const groupID = selectedGroup.threadID;
      const groupName = selectedGroup.name || selectedGroup.threadName || "ce groupe";
      
      await api.addUserToGroup(event.senderID, groupID);
      message.reply(`You have joined the group chat: ${groupName}`);
      
    } catch (error) {
      console.error("Error joining group chat", error);
      message.reply('An error occurred while joining the group chat. Make sure the bot has permission or that you aren\'t already in it.');
    } finally {
      global.GoatBot.onReply.delete(event.messageID);
    }
  },
};
