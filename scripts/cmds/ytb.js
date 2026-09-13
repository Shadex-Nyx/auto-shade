"use strict";

const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const API_BASE = "https://your-download-hub.vercel.app";

const W = 640;
const HEADER_H = 80;
const ROW_H = 90;
const PADDING = 20;
const THUMB_W = 118;
const THUMB_H = 66;
const FOOT_H = 20;


/* =========================================================
 * UTILITIES
 * ========================================================= */

function formatViews(n) {
  if (n == null || n === 0) return "N/A views";

  const num = Number(n);

  if (Number.isNaN(num)) return "N/A views";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B views";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M views";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K views";

  return num + " views";
}


function truncate(text, maxLen) {
  text = String(text || "");

  return text.length > maxLen
    ? text.slice(0, maxLen - 1) + "…"
    : text;
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* =========================================================
 * YOUTUBE LOGO
 * ========================================================= */

function drawYTLogo(ctx, x, y) {
  const rw = 36;
  const rh = 26;
  const r = 6;

  ctx.fillStyle = "#FF0000";

  ctx.beginPath();

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + rw - r, y);

  ctx.quadraticCurveTo(
    x + rw,
    y,
    x + rw,
    y + r
  );

  ctx.lineTo(x + rw, y + rh - r);

  ctx.quadraticCurveTo(
    x + rw,
    y + rh,
    x + rw - r,
    y + rh
  );

  ctx.lineTo(x + r, y + rh);

  ctx.quadraticCurveTo(
    x,
    y + rh,
    x,
    y + rh - r
  );

  ctx.lineTo(x, y + r);

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";

  ctx.beginPath();

  const cx = x + rw / 2 + 2;
  const cy = y + rh / 2;

  ctx.moveTo(cx - 7, cy - 7);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx - 7, cy + 7);

  ctx.closePath();
  ctx.fill();
}


/* =========================================================
 * SEARCH IMAGE
 * ========================================================= */

async function generateSearchImage(results, query, type) {
  const totalH =
    HEADER_H +
    results.length * ROW_H +
    FOOT_H;

  const canvas = createCanvas(W, totalH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, W, totalH);

  drawYTLogo(ctx, PADDING, 22);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";

  ctx.fillText(
    "Search Results",
    PADDING + 44,
    43
  );

  const typeLabel =
    type === "audio"
      ? "Audio"
      : "Video";

  ctx.fillStyle = "#aaaaaa";
  ctx.font = "13px sans-serif";

  ctx.fillText(
    `"${truncate(query, 40)}" — ${typeLabel}`,
    PADDING + 44,
    62
  );

  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_H - 1);
  ctx.lineTo(W - PADDING, HEADER_H - 1);
  ctx.stroke();


  for (let i = 0; i < results.length; i++) {
    const r = results[i];

    const y = HEADER_H + i * ROW_H;
    const mid = y + ROW_H / 2;

    if (i % 2 === 0) {
      ctx.fillStyle = "#1f1f1f";
      ctx.fillRect(0, y, W, ROW_H);
    }

    ctx.fillStyle = "#666666";
    ctx.font = "bold 18px sans-serif";

    ctx.fillText(
      String(r.index),
      PADDING,
      mid + 7
    );


    const thumbX = PADDING + 30;
    const thumbY =
      y + (ROW_H - THUMB_H) / 2;

    ctx.fillStyle = "#333333";

    ctx.fillRect(
      thumbX,
      thumbY,
      THUMB_W,
      THUMB_H
    );


    if (r.thumbnail) {
      try {
        const imgBuf = await axios.get(
          r.thumbnail,
          {
            responseType: "arraybuffer",
            timeout: 6000
          }
        );

        const img = await loadImage(
          Buffer.from(imgBuf.data)
        );

        ctx.drawImage(
          img,
          thumbX,
          thumbY,
          THUMB_W,
          THUMB_H
        );
      } catch (_) {
        ctx.fillStyle = "#444444";

        ctx.fillRect(
          thumbX,
          thumbY,
          THUMB_W,
          THUMB_H
        );

        ctx.fillStyle = "#888888";
        ctx.font = "11px sans-serif";

        ctx.fillText(
          "No image",
          thumbX + 28,
          thumbY + 36
        );
      }
    }


    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;

    ctx.strokeRect(
      thumbX,
      thumbY,
      THUMB_W,
      THUMB_H
    );


    const textX =
      thumbX +
      THUMB_W +
      14;


    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";

    ctx.fillText(
      truncate(r.title, 52),
      textX,
      mid - 14
    );


    ctx.fillStyle = "#aaaaaa";
    ctx.font = "12px sans-serif";

    ctx.fillText(
      `${truncate(r.channel, 30)} • ${r.duration}`,
      textX,
      mid + 4
    );


    ctx.fillStyle = "#777777";
    ctx.font = "12px sans-serif";

    ctx.fillText(
      formatViews(r.views),
      textX,
      mid + 20
    );


    if (i < results.length - 1) {
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1;

      ctx.beginPath();

      ctx.moveTo(
        PADDING + 30,
        y + ROW_H
      );

      ctx.lineTo(
        W - PADDING,
        y + ROW_H
      );

      ctx.stroke();
    }
  }

  return canvas.toBuffer(
    "image/jpeg",
    { quality: 0.92 }
  );
}


/* =========================================================
 * NORMALIZE SEARCH RESULTS
 * ========================================================= */

function normalizeSearchResults(payload) {
  let raw = [];

  if (Array.isArray(payload)) {
    raw = payload;
  } else if (Array.isArray(payload?.results)) {
    raw = payload.results;
  } else if (Array.isArray(payload?.data)) {
    raw = payload.data;
  } else if (Array.isArray(payload?.data?.results)) {
    raw = payload.data.results;
  } else if (Array.isArray(payload?.videos)) {
    raw = payload.videos;
  } else if (Array.isArray(payload?.data?.videos)) {
    raw = payload.data.videos;
  }

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const url =
        item.url ||
        item.videoUrl ||
        item.video_url ||
        item.link ||
        item.href;

      const title =
        item.title ||
        item.name ||
        item.videoTitle ||
        "Unknown title";

      const thumbnail =
        item.thumbnail ||
        item.thumbnailUrl ||
        item.thumbnail_url ||
        item.image ||
        item.cover ||
        "";

      const channel =
        item.channel ||
        item.author ||
        item.uploader ||
        item.creator ||
        item.channelName ||
        "YouTube";

      const duration =
        item.duration ||
        item.length ||
        "N/A";

      const views =
        item.views ||
        item.viewCount ||
        item.view_count ||
        0;

      if (!url) {
        return null;
      }

      return {
        index: index + 1,
        title: String(title),
        url: String(url),
        thumbnail: String(thumbnail),
        channel: String(channel),
        duration: String(duration),
        views
      };
    })
    .filter(Boolean);
}


/* =========================================================
 * EXTRACT MEDIA URL
 * ========================================================= */

function findMediaUrl(value, type) {
  if (!value) return null;

  if (typeof value === "string") {
    if (value.startsWith("http")) {
      return value;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMediaUrl(item, type);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }


  /*
   * Audio
   */

  if (type === "audio") {
    const audioKeys = [
      "audio",
      "audioUrl",
      "audio_url",
      "mp3",
      "m4a",
      "download"
    ];

    for (const key of audioKeys) {
      const found = findMediaUrl(
        value[key],
        type
      );

      if (found) {
        return found;
      }
    }
  }


  /*
   * Video
   */

  if (type === "video") {
    const videoKeys = [
      "video",
      "videoUrl",
      "video_url",
      "mp4",
      "download"
    ];

    for (const key of videoKeys) {
      const found = findMediaUrl(
        value[key],
        type
      );

      if (found) {
        return found;
      }
    }
  }


  /*
   * Common URL fields
   */

  const commonKeys = [
    "url",
    "mediaUrl",
    "media_url",
    "downloadUrl",
    "download_url",
    "fileUrl",
    "file_url",
    "src"
  ];

  for (const key of commonKeys) {
    const found = findMediaUrl(
      value[key],
      type
    );

    if (found) {
      return found;
    }
  }


  /*
   * Search nested objects
   */

  for (const key of Object.keys(value)) {
    if (
      [
        "title",
        "description",
        "thumbnail",
        "thumbnailUrl"
      ].includes(key)
    ) {
      continue;
    }

    const found = findMediaUrl(
      value[key],
      type
    );

    if (found) {
      return found;
    }
  }

  return null;
}


/* =========================================================
 * COMMAND
 * ========================================================= */

module.exports = {
  config: {
    name: "ytb",
    version: "1.0.0",
    author: "Shade x Christus",
    countDown: 5,
    role: 0,

    description:
      "Search YouTube and download audio or video",

    category: "media",

    guide:
      "{pn} -a <song name>\n" +
      "{pn} -v <video title>"
  },


  /* =======================================================
   * ON START
   * ======================================================= */

  onStart: async function ({
    message,
    args
  }) {

    const flag =
      (args[0] || "").toLowerCase();


    if (
      !flag ||
      !args[1]
    ) {
      return message.reply(
        "Usage:\n" +
        "-a <song name> → Audio\n" +
        "-v <title> → Video"
      );
    }


    const type =
      flag === "-a"
        ? "audio"
        : flag === "-v"
          ? "video"
          : null;


    if (!type) {
      return message.reply(
        "Use -a for audio or -v for video."
      );
    }


    const query =
      args
        .slice(1)
        .join(" ")
        .trim();


    if (!query) {
      return message.reply(
        "Please provide a search query."
      );
    }


    try {

      /*
       * ============================================
       * NEW CHRISTUS API
       * ============================================
       */

      const searchURL =
        `${API_BASE}/api/search/youtube` +
        `?q=${encodeURIComponent(query)}` +
        `&limit=10`;


      const response =
        await axios.get(
          searchURL,
          {
            timeout: 20000
          }
        );


      const results =
        normalizeSearchResults(
          response.data
        );


      if (!results.length) {
        return message.reply(
          `No results found for: ${query}`
        );
      }


      /*
       * Maximum 10 results
       */

      const limitedResults =
        results.slice(0, 10);


      limitedResults.forEach(
        (item, index) => {
          item.index = index + 1;
        }
      );


      /*
       * ============================================
       * GENERATE SEARCH IMAGE
       * ============================================
       */

      const imgBuf =
        await generateSearchImage(
          limitedResults,
          query,
          type
        );


      const tmpImg =
        path.join(
          os.tmpdir(),
          `yt_search_${Date.now()}.jpg`
        );


      fs.writeFileSync(
        tmpImg,
        imgBuf
      );


      /*
       * ============================================
       * SEND RESULTS
       * ============================================
       */

      const sentMsg =
        await message.reply({
          body:
            `Reply with 1–${limitedResults.length} ` +
            `to download ${type === "audio"
              ? "audio"
              : "video"}`,

          attachment:
            fs.createReadStream(tmpImg)
        });


      setTimeout(() => {
        try {
          fs.unlinkSync(tmpImg);
        } catch (_) {}
      }, 20000);


      /*
       * ============================================
       * SAVE REPLY DATA
       * ============================================
       */

      global.GoatBot.onReply.set(
        sentMsg.messageID,
        {
          commandName: "ytb",

          messageID:
            sentMsg.messageID,

          type,

          results:
            limitedResults,

          total:
            limitedResults.length,

          query
        }
      );


    } catch (err) {

      console.error(
        "[YTB SEARCH]",
        err
      );

      return message.reply(
        `Search failed: ${
          err.response?.data?.error ||
          err.message
        }`
      );
    }
  },


  /* =======================================================
   * ON REPLY
   * ======================================================= */

  onReply: async function ({
    message,
    event,
    Reply,
    api
  }) {

    if (
      !Reply ||
      Reply.commandName !== "ytb"
    ) {
      return;
    }


    const {
      results,
      type,
      total,
      messageID: searchMsgID
    } = Reply;


    const choice =
      parseInt(
        (event.body || "").trim(),
        10
      );


    if (
      Number.isNaN(choice) ||
      choice < 1 ||
      choice > total
    ) {
      return message.reply(
        `Please reply with a number between 1 and ${total}.`
      );
    }


    const selected =
      results[choice - 1];


    if (!selected) {
      return message.reply(
        "Invalid selection."
      );
    }


    /*
     * Remove reply listener
     */

    global.GoatBot.onReply.delete(
      searchMsgID
    );


    /*
     * Remove search message
     */

    try {
      await api.unsendMessage(
        searchMsgID
      );
    } catch (_) {}


    try {

      /*
       * ==========================================
       * DOWNLOAD USING CHRISTUS API
       * ==========================================
       */

      const downloadURL =
        `${API_BASE}/api/download/youtube` +
        `?url=${encodeURIComponent(selected.url)}`;


      const response =
        await axios.get(
          downloadURL,
          {
            timeout: 60000,

            headers: {
              "User-Agent":
                "Mozilla/5.0"
            }
          }
        );


      const payload =
        response.data;


      if (
        payload?.success === false
      ) {
        throw new Error(
          payload.error ||
          "Download API failed"
        );
      }


      /*
       * ==========================================
       * FIND MEDIA
       * ==========================================
       */

      const fileUrl =
        findMediaUrl(
          payload?.data || payload,
          type
        );


      if (!fileUrl) {
        console.error(
          "[YTB] API RESPONSE:",
          JSON.stringify(
            payload,
            null,
            2
          )
        );

        throw new Error(
          `No ${type} media found in API response`
        );
      }


      /*
       * ==========================================
       * DOWNLOAD FILE
       * ==========================================
       */

      const fileResponse =
        await axios.get(
          fileUrl,
          {
            responseType:
              "arraybuffer",

            timeout:
              120000,

            maxRedirects:
              10,

            headers: {
              "User-Agent":
                "Mozilla/5.0",
              "Referer":
                "https://www.youtube.com/"
            }
          }
        );


      /*
       * ==========================================
       * EXTENSION
       * ==========================================
       */

      let ext =
        type === "audio"
          ? "mp3"
          : "mp4";


      const contentType =
        String(
          fileResponse.headers[
            "content-type"
          ] || ""
        ).toLowerCase();


      if (
        type === "audio" &&
        contentType.includes("mp4")
      ) {
        ext = "m4a";
      }


      /*
       * ==========================================
       * SAVE TEMP FILE
       * ==========================================
       */

      const tmpFile =
        path.join(
          os.tmpdir(),
          `yt_${Date.now()}.${ext}`
        );


      fs.writeFileSync(
        tmpFile,
        Buffer.from(
          fileResponse.data
        )
      );


      if (
        !fs.existsSync(tmpFile) ||
        fs.statSync(tmpFile).size === 0
      ) {
        throw new Error(
          "Downloaded file is empty"
        );
      }


      /*
       * ==========================================
       * SEND MEDIA
       * ==========================================
       */

      await message.reply({
        body:
          type === "audio"
            ? `Audio : ${selected.title}`
            : `Video : ${selected.title}`,

        attachment:
          fs.createReadStream(tmpFile)
      });


      /*
       * ==========================================
       * CLEANUP
       * ==========================================
       */

      setTimeout(() => {
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}
      }, 30000);


    } catch (err) {

      console.error(
        "[YTB DOWNLOAD]",
        err.response?.data ||
        err
      );


      return message.reply(
        `Download failed: ${
          err.response?.data?.error ||
          err.message
        }`
      );
    }
  }
};
