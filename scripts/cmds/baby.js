const axios = require("axios");
const API = "https://babyapis.vercel.app";
const TRIGGERS = ["baby", "bby", "bot", "jan"];
const path = params => `/baby?${new URLSearchParams(Object.entries(params).filter(([, value]) => value != null))}`;
const pair = value => {
  const match = String(value).match(/^\s*(.*?)\s*-\s*([\s\S]+?)\s*$/);
  return match && { key: match[1].trim(), value: match[2].trim() };
};
const result = data => {
  const text = data?.reply ?? data?.message ?? "Baby API returned no reply.";
  return /teach me.*\[reply\]/i.test(text) ? "🐥 Oi baby please teach me — teach [message] - [reply]" : text;
};
const replies = () => {
  if (!global.GoatBot) global.GoatBot = {};
  return global.GoatBot.onReply || (global.GoatBot.onReply = new Map());
};
const get = async params => {
  const data = (await axios.get(`${API}${path(params)}`, { timeout: 3000 })).data;
  if (!data || typeof data !== "object" || data.error) throw new Error(data?.message || "Invalid Baby API response");
  return data;
};
const send = async (message, event, body) => {
  const info = await message.reply(body);
  if (info?.messageID) replies().set(info.messageID, { commandName: "baby", messageID: info.messageID, author: String(event.senderID) });
  return info;
};
module.exports = {
  config: {
    name: "baby",
    aliases: ["bby"],
    version: "0.0.7",
    author: "Azadx69x",
    countDown: 0,
    role: 0,
    description: "Teach and chat with Baby API",
    category: "CHATTING",
    guide: "{pn} [message] | teach [message] - [reply] | remove [message] | edit [message] - [newMessage] | msg [message] | list [all]"
  },
  onStart: async function ({ message, event, args, usersData }) {
    const raw = args.join(" ").trim();
    const cmd = String(args[0] || "").toLowerCase();
    const senderID = event.senderID;
    try {
      if (!raw) return;
      if (cmd === "remove") {
        const value = raw.replace(/^remove\s+/i, "");
        const data = pair(value);
        if (data && /^\d+$/.test(data.value)) return send(message, event, result(await get({ remove: data.key, index: data.value, senderID })));
        if (!value) return send(message, event, "⛔ | Use: remove [message] OR remove [message] - [index]");
        return send(message, event, result(await get({ remove: value, senderID })));
      }
      if (cmd === "list") {
        const data = await get({ list: "all" });
        if (String(args[1] || "").toLowerCase() !== "all") return send(message, event, `📚 | Total Teach = ${data.length ?? 0}\n💬 | Total Response = ${data.responseLength ?? 0}`);
        const list = Array.isArray(data.teacher?.teacherList) ? data.teacher.teacherList.slice(0, Number(args[2]) || 100) : [];
        const teachers = await Promise.all(list.map(async item => {
          const id = Object.keys(item)[0];
          let name = id;
          try { name = await usersData.getName(id) || id; } catch {}
          return `${name}: ${item[id]}`;
        }));
        return send(message, event, `Total Teach = ${data.length ?? 0}\n🏆 | Teachers\n${teachers.join("\n") || "No teachers found."}`);
      }
      if (cmd === "msg") {
        const key = raw.replace(/^msg\s+/i, "").trim();
        if (!key) return send(message, event, "⛔ | Use: msg [message]");
        const data = await get({ list: key });
        return send(message, event, `Message ${key} = ${data.data || "Not taught yet"}`);
      }
      if (cmd === "edit") {
        const data = pair(raw.replace(/^edit\s+/i, ""));
        if (!data) return send(message, event, "⛔ | Use: edit [message] - [newMessage]");
        return send(message, event, result(await get({ edit: data.key, replace: data.value, senderID })));
      }
      if (cmd === "teach") {
        const data = pair(raw.replace(/^teach\s+/i, ""));
        if (!data) return send(message, event, "⛔ | Use: teach [message] - [reply or emoji]");
        const response = await get({ teach: data.key, reply: data.value, senderID, threadID: event.threadID });
        let name = "Unknown";
        try { name = await usersData.getName(senderID) || "Unknown"; } catch {}
        const apiMsg = String(response.message || "").replace(/reply\(ies\)/gi, "teach");
        return send(message, event, `${apiMsg}\n🧑 Teacher: ${name}\n📈 Total: ${response.teachs ?? "unknown"}`);
      }
      return send(message, event, result(await get({ text: raw, senderID, threadID: event.threadID })));
    } catch (error) {
      console.error("baby command error:", error);
      return send(message, event, `⚠️ | ${error.message || "Baby API is unavailable."}`);
    }
  },
  onReply: async function ({ message, event, Reply }) {
    if (event.type !== "message_reply" || !event.body?.trim() || !Reply || Reply.commandName !== "baby") return;
    if (Reply.author && String(event.senderID) !== String(Reply.author)) return;
    const body = String(event.body).trim();
    if (/^(?:baby|bby)\s+(?:teach|remove|edit|msg|list)\b/i.test(body)) return;
    if (/^(?:teach|remove|edit|msg|list)\b/i.test(body)) return;
    replies().delete(Reply.messageID);
    try {
      return send(message, event, result(await get({ text: body, senderID: event.senderID, threadID: event.threadID })));
    } catch (error) {
      return send(message, event, `⚠️ | ${error.message || "Baby API is unavailable."}`);
    }
  },
  onChat: async function ({ message, event }) {
    try {
      if (event.messageReply?.messageID && replies().has(event.messageReply.messageID)) return;
      const original = String(event.body || "").trim();
      const body = original.toLowerCase();
      const trigger = TRIGGERS.find(item => body === item || body.startsWith(`${item} `));
      if (!trigger) return;
      const text = original.slice(trigger.length).trim();
      if (!text) {
        const random = ["😚", "🫣", "😍", "Yes baby😀, I am here 🐥", "What's up? 🫤", "Bolo jaan ki korte pari tomar jonno 🐥"];
        return send(message, event, random[Math.floor(Math.random() * random.length)]);
      }
      if (/^(?:teach|remove|edit|msg|list)\b/i.test(text)) return;
      return send(message, event, result(await get({ text, senderID: event.senderID, threadID: event.threadID })));
    } catch (error) {
      console.error("baby onChat error:", error);
      return send(message, event, `⚠️ | ${error.message || "Baby API is unavailable."}`);
    }
  }
};
