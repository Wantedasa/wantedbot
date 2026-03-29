//=========================//
// index.js - Samuel V1 WhatsApp Bot
//=========================//
const { makeWASocket, useMultiFileAuthState } = require("@angstvorfrauen/baileys");
const pino = require("pino");
const readline = require("readline");
const chalk = require("chalk");
const gradient = require("gradient-string");

// IMPORTIEREN ALS COMMONJS
const mainModule = require("./main.js");
const { handleCommands, handleGroupParticipants, groupSettings, isGroup, isOwner, reply} = mainModule;

//=========================//
// Terminal & Eingabe
//=========================//
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

//=========================//
// Log-Arrays
//=========================//
const MAX_LOG = 20;
const groupMessages = {};
const commandsLog = [];

//=========================//
// Hilfsfunktionen
//=========================//
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

//=========================//
// Dashboard Renderer
//=========================//
const renderDashboard = () => {
    console.clear();
    console.log(chalk.bold(gradient.rainbow("📱 Samuel V1 WhatsApp Bot Dashboard")));
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

//=========================//
// Connect Bot + Pairing-Code
//=========================//
async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    // Wenn Bot noch nicht registriert, Pairing-Code
    if (!sock.authState.creds.registered) {
        let phoneNumber = await question(gradient("#ff0000", "#C00000")("📲 Deine Nummer (inkl. Ländervorwahl, z.B. +49123456789): "));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        // Device-ID beliebig
        let code = await sock.requestPairingCode(phoneNumber, "AAAAAAAA");
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(gradient("#ff0000", "#C00000")("🔑 Pairing Code: " + code));
    }

    //=========================//
    // EVENTS
    //=========================//
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") {
            console.log(chalk.red("❌ Verbindung geschlossen, reconnect..."));
            setTimeout(connectBot, 5000);
        } else if (connection === "open") {
            console.log(chalk.green("✅ Verbunden mit WhatsApp!"));
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const msg = messages[0];
        if (!msg.message) return;

        try {
            await handleCommands(sock, msg);

            const from = msg.key.remoteJid;
            const sender = msg.key.participant || from;
            let text = "";

            if (msg.message?.conversation) text = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
            else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;

            await logMessage(sock, from, sender, text);
        } catch (e) {
            console.log(chalk.red("❌ Fehler in messages.upsert:"), e);
        }
    });

sock.ev.on('messages.upsert', async (m) => {
    try {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const id = msg.key.id;

        if (isGroup(from)) {
            if (!messageCache[from]) messageCache[from] = {};
            messageCache[from][id] = msg;
            if (Object.keys(messageCache[from]).length > 200) {
                const oldest = Object.keys(messageCache[from])[0];
                delete messageCache[from][oldest];
            }
        }
        await handleCommands(sock, msg);

        if (msg.message.protocolMessage?.type === 0) {
            const deletedMsg = msg.message.protocolMessage;
            const sender = deletedMsg.key.participant || from;
            const deletedId = deletedMsg.key.id;

            if (!groupSettings[from]?.antidelete) return;

            const originalMsg = messageCache[from]?.[deletedId];

            let deletedContent = "[Nicht darstellbare Nachricht]";

            if (originalMsg) {
                deletedContent = originalMsg.message.conversation
                    || originalMsg.message?.extendedTextMessage?.text
                    || "[Nicht darstellbare Nachricht]";
            }

            await sock.sendMessage(from, {
                text: `🛡️ @${sender.split("@")[0]} hat eine Nachricht gelöscht:\n\n${deletedContent}`,
                mentions: [sender]
            });
        }
    } catch (err) {
        console.error("Fehler im messages.upsert Event:", err);
    }
});
    return sock;
}

connectBot();
