import { makeWASocket, useMultiFileAuthState } from "@angstvorfrauen/baileys";
import pino from "pino";
import readline from "readline";
import chalk from "chalk";
import gradient from "gradient-string";
import fs from "fs";

import * as mainModule from "./main.js";
const { handleCommands, handleGroupParticipants, botConfig, loadAutoMessages } = mainModule;


let isGroup = (jid) => jid.endsWith("@g.us");
const messageCache = {};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

const MAX_LOG = 20;
const groupMessages = {};
const commandsLog = [];

const jidToPhone = (jid) => {
    if (!jid) return "";
    return jid.includes("@s.whatsapp.net") ? "+" + jid.split("@")[0] : jid;
};

const jidToGroupName = async (sock, jid) => {
    if (!jid) return "Unbekannte Gruppe";
    try {
        const metadata = await sock.groupMetadata(jid);
        return metadata.subject || "Gruppe";
    } catch (e) {
        return jid;
    }
};

const renderDashboard = () => {
    console.clear();
    console.log(chalk.bold(gradient.rainbow("📱 Wantedasa V1 WhatsApp Bot Dashboard")));
    console.log(chalk.gray("──────────────────────────────────────────"));

    for (const groupName in groupMessages) {
        console.log(chalk.green.bold(`👥 ${groupName}`));
        const msgs = groupMessages[groupName];
        if (!msgs || msgs.length === 0) console.log(chalk.gray("Keine Nachrichten"));
        else msgs.slice().reverse().forEach(line => console.log(line)); // neueste unten
        console.log(chalk.gray("──────────────────────────────────────────"));
    }

    console.log(chalk.yellow.bold("⚡ Befehle:"));
    if (commandsLog.length === 0) console.log(chalk.gray("Keine Befehle"));
    else commandsLog.slice().reverse().forEach(line => console.log(line)); // neueste unten
    console.log(chalk.gray("──────────────────────────────────────────"));
};

//=========================//
// Logging Funktion
//=========================//
const logMessage = async (sock, groupJid, senderJid, text, type = "msg") => {
    const senderDisplay = jidToPhone(senderJid);
    const time = new Date().toLocaleTimeString("de-DE", { hour12: false });
    let groupName = "";

    if (groupJid && groupJid.endsWith("@g.us")) {
        groupName = await jidToGroupName(sock, groupJid);
        if (!groupMessages[groupName]) groupMessages[groupName] = [];
    } else {
        groupName = "Privatchat";
        if (!groupMessages[groupName]) groupMessages[groupName] = [];
    }

    let line = "";
    switch(type) {
        case "sticker": line = chalk.magenta(`[${time}] ${senderDisplay} » [Sticker] ${text}`); break;
        case "media": line = chalk.cyan(`[${time}] ${senderDisplay} » [Media] ${text}`); break;
        case "afk": line = chalk.red(`[${time}] ${senderDisplay} » [AFK] ${text}`); break;
        default: line = `[${time}] ${senderDisplay} » ${text}`; break;
    }

    groupMessages[groupName].push(line);
    if (groupMessages[groupName].length > MAX_LOG) groupMessages[groupName].shift();
    renderDashboard();
};

export const sessions = new Map();

export async function connectBot(sessionName = "main", phoneNumber) {
    const sessionPath = `./sessions/${sessionName}`;

    if (!fs.existsSync("./sessions")) fs.mkdirSync("./sessions");

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    sessions.set(sessionName, sock);

    let pairingCode = null;

    if (!sock.authState.creds.registered && phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
        let code = await sock.requestPairingCode("+" + cleanNumber, "AAAAAAAA");
        pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;

        console.log(gradient("#ff0000", "#C00000")(`🔑 Pairing Code (${sessionName}): ${pairingCode}`));
    }

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;

        if (connection === "close") {
            console.log(chalk.red(`❌ ${sessionName} disconnected → reconnect...`));

            sessions.delete(sessionName);

            setTimeout(() => connectBot(sessionName), 5000);

        } else if (connection === "open") {
            console.log(chalk.green(`✅ ${sessionName} verbunden!`));

            loadAutoMessages(sock);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

    

sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== "notify") return;

    try {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const id = msg.key.id;

        // Cache für Gruppen
        if (isGroup(from)) {
            if (!messageCache[from]) messageCache[from] = {};
            messageCache[from][id] = {
                msg,
                sender,
            };

            if (Object.keys(messageCache[from]).length > 999) {
                const oldest = Object.keys(messageCache[from])[0];
                delete messageCache[from][oldest];
            }
        }

        await handleCommands(sock, msg);
        

const isGroupChat = from.endsWith("@g.us");
const isPrivateChat = !isGroupChat;

if (isGroupChat && botConfig.autoReadGroups) {
    try {
        await sock.readMessages([msg.key]);
    } catch (err) {
        console.error("Fehler beim Lesen (Gruppe):", err);
    }
}

if (isPrivateChat && botConfig.autoReadPrivate) {
    try {
        await sock.readMessages([msg.key]);
    } catch (err) {
        console.error("Fehler beim Lesen (Privat):", err);
    }
}

        // Nachrichtentext für Logging
        let text = "";
        if (msg.message?.conversation) text = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
        else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
        else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;
        else if (msg.message?.stickerMessage) text = "[Sticker]";
        else if (msg.message?.documentMessage) text = `[Dokument] ${msg.message.documentMessage.fileName || ""}`;
        else if (msg.message?.buttonsResponseMessage) text = `[Button Antwort] ${msg.message.buttonsResponseMessage.selectedDisplayText || ""}`;
        await logMessage(sock, from, sender, text);

        // Antidelete
        if (msg.message.protocolMessage?.type === 0) {
            
const groupSetting = botConfig.groupSettings[from];
if (!groupSetting?.antidelete) return;

const deletedMsgKey = msg.message.protocolMessage?.key;
if (!deletedMsgKey) return;

const deletedMsg = msg.message.protocolMessage;
const deletedId = deletedMsg.key.id;

            const cached = messageCache[from]?.[deletedId];
            if (!cached) return;

            const originalMsg = cached.msg;
            const originalSender = cached.sender;

            let deletedContent = "[Nicht darstellbare Nachricht]";
            if (originalMsg) {
                if (originalMsg.message?.conversation) deletedContent = originalMsg.message.conversation;
                else if (originalMsg.message?.extendedTextMessage?.text) deletedContent = originalMsg.message.extendedTextMessage.text;
                else if (originalMsg.message?.imageMessage?.caption) deletedContent = "[Bild] " + originalMsg.message.imageMessage.caption;
                else if (originalMsg.message?.videoMessage?.caption) deletedContent = "[Video] " + originalMsg.message.videoMessage.caption;
                else if (originalMsg.message?.stickerMessage) deletedContent = "[Sticker]";
                else if (originalMsg.message?.documentMessage) deletedContent = `[Dokument] ${originalMsg.message.documentMessage.fileName || ""}`;
                else if (originalMsg.message?.buttonsResponseMessage) deletedContent = `[Button Antwort] ${originalMsg.message.buttonsResponseMessage.selectedDisplayText || ""}`;
            }

            // Nachrichtentyp-Emoji
            const typeEmoji = originalMsg.message?.conversation ? "Text 📝 🟢" :
                              originalMsg.message?.imageMessage ? "Bild 🖼️ 🟡" :
                              originalMsg.message?.videoMessage ? "Video 🎥 🔴" :
                              originalMsg.message?.stickerMessage ? "Sticker 🌟 🔵" :
                              originalMsg.message?.documentMessage ? "Dokument 📄 ⚪️" :
                              originalMsg.message?.buttonsResponseMessage ? "Button Antwort 🔘" :
                              "Unbekannt ❔";

            // Zeitstempel
            const timestamp = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

            await sock.sendMessage(from, {
                text: `╔═════════════════════╗
║ 🛡️  ANTI-DELETE ALERT
╠═════════════════════╣
║ ⏰ Zeit: ${timestamp}
║ 🔹 Absender: @${originalSender.split("@")[0]}
║ 🔹 Typ: ${typeEmoji}
╠═════════════════════╣
║ 🔹 Inhalt:
║   ${deletedContent.split("\n").join("\n║   ")}
╚═════════════════════╝`,
                mentions: [originalSender]
            });
        }

    } catch (err) {
        console.error("Fehler im messages.upsert Event:", err);
    }
});

return sock, paringCode;
}
connectBot();
