import { makeWASocket, useMultiFileAuthState } from "@angstvorfrauen/baileys";
import pino from "pino";
import readline from "readline";
import chalk from "chalk";
import gradient from "gradient-string";

import * as mainModule from "./main.js";
const {
    handleCommands,
    handleGroupParticipants,
    botConfig,
    loadAutoMessages,
    isOwner,
    sendOnlineMessages
} = mainModule;

let isGroup = (jid) => jid?.endsWith("@g.us");

const messageCache = {};
const messageLog = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

const MAX_LOG = 99;

// =========================
// Helpers
// =========================
const jidToPhone = (jid) =>
    jid?.includes("@s.whatsapp.net") ? `+${jid.split("@")[0]}` : jid || "";

const jidToGroupName = async (sock, jid) => {
    if (!jid) return "Unbekannte Gruppe";
    try {
        const metadata = await sock.groupMetadata(jid);
        return metadata.subject || "Gruppe";
    } catch {
        return "Gruppe (unknown)";
    }
};

const isAdmin = async (sock, groupJid, userJid) => {
    try {
        const meta = await sock.groupMetadata(groupJid);
        const participant = meta.participants.find(p => p.id === userJid);
        return participant?.admin === "admin" || participant?.admin === "superadmin";
    } catch {
        return false;
    }
};

// =========================
// Logging
// =========================
const logMessage = async (sock, groupJid, senderJid, text, type = "msg") => {
    const senderDisplay = jidToPhone(senderJid);
    const time = new Date().toLocaleTimeString("de-DE", { hour12: false });
    const groupName = isGroup(groupJid)
        ? await jidToGroupName(sock, groupJid)
        : "Privatchat";

    const typeLabels = {
        msg: "MSG",
        sticker: "STICKER",
        media: "MEDIA",
        afk: "AFK",
        command: "CMD"
    };

    const icon = isGroup(groupJid) ? "👥" : "👤";

    const block =
        chalk.green(`│ [${time}] ${icon} USER: ${senderDisplay}\n`) +
        chalk.green(`│ ↳ CHAT: ${groupName}\n`) +
        chalk.green(`│ ↳ TYPE: ${typeLabels[type]}\n`) +
        chalk.green(`│ ↳ DATA: ${text}\n`) +
        chalk.green(`│`);

    messageLog.push(block);
    if (messageLog.length > MAX_LOG) messageLog.shift();

    console.clear();
    console.log(chalk.green("┌─[ WANTED BOT // LIVE LOG ]"));
    console.log(chalk.green("│"));
    messageLog.forEach(l => console.log(l));
    console.log(chalk.green("└────────────────────────────"));
};

// =========================
// MAIN BOT
// =========================
async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    // =========================
    // Pairing
    // =========================
    if (!sock.authState.creds.registered) {
        let phoneNumber = await question(
            gradient("#ff0000", "#C00000")("📲 Nummer eingeben (+49...): ")
        );

        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        let code = await sock.requestPairingCode(phoneNumber, "AAAAAAAA");
        code = code?.match(/.{1,4}/g)?.join("-") || code;

        console.log(
            gradient("#ff0000", "#C00000")("🔑 Pairing Code: " + code)
        );
    }
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log(chalk.green("✅ ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Verbunden mit WhatsApp!"));
            console.log(chalk.green("-----------------------------------------"));
            console.log(chalk.yellowBright("⚡᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Bot-Prefix: " + botConfig.prefix));

            loadAutoMessages(sock);
            sendOnlineMessages(sock);

        }

        if (connection === "close") {
            console.log(chalk.red("❌ Verbindung geschlossen → Launcher restart"));
            process.exit(0);
        }
    });

    sock.ev.on("creds.update", saveCreds);
    const callCounts = new Map();

    setInterval(() => callCounts.clear(), 60 * 60 * 1000);

    sock.ev.on("call", async (call) => {
        if (!botConfig.antiCall) return;

        const callData = call[0];
        if (!callData) return;

        const { id, from, status } = callData;

        if (status === "offer") {
            try {
                const current = callCounts.get(from) || 0;
                const newCount = current + 1;
                callCounts.set(from, newCount);

                await sock.rejectCall(id, from);

                if (newCount >= 5) {
                    await sock.sendMessage(from, {
                        text: "🚫 Du wirst blockiert wegen Spam-Anrufen."
                    });

                    await sock.updateBlockStatus(from, "block");
                    callCounts.delete(from);
                }

            } catch (err) {
                console.log("AntiCall Error:", err);
            }
        }
    });

    // =========================
    // Messages
    // =========================
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        try {
            const msg = messages[0];
            if (!msg?.message) return;

            const from = msg.key.remoteJid;
            const sender = msg.key.participant || from;
            const id = msg.key.id;

            // Cache system
            if (isGroup(from)) {
                if (!messageCache[from]) messageCache[from] = {};

                messageCache[from][id] = { msg, sender };

                if (Object.keys(messageCache[from]).length > 300) {
                    const oldest = Object.keys(messageCache[from])[0];
                    delete messageCache[from][oldest];
                }
            }

            await handleCommands(sock, msg);

            // Auto Read
            if (isGroup(from) && botConfig.autoReadGroups) {
                await sock.readMessages([msg.key]);
            }

            if (!isGroup(from) && botConfig.autoReadPrivate) {
                await sock.readMessages([msg.key]);
            }

            // Auto Block Private
            if (!isGroup(from) && botConfig.autoBlock) {
                if (isOwner(sender)) return;
                await sock.updateBlockStatus(sender, "block");
            }

            // Text extract
            let text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                (msg.message?.stickerMessage && "[Sticker]") ||
                (msg.message?.documentMessage && "[Dokument]");

            await logMessage(sock, from, sender, text);

            // =========================
            // Anti Delete
            // =========================
            if (msg.message?.protocolMessage?.type === 0) {
                const groupSetting = botConfig.groupSettings?.[from];
                if (!groupSetting?.antidelete) return;

                const deletedId = msg.message.protocolMessage.key.id;
                const cached = messageCache[from]?.[deletedId];
                if (!cached) return;

                const original = cached.msg;
                const originalSender = cached.sender;

                let content = "[nicht lesbar]";

                if (original.message?.conversation)
                    content = original.message.conversation;

                else if (original.message?.extendedTextMessage?.text)
                    content = original.message.extendedTextMessage.text;

                const timestamp = new Date().toLocaleTimeString("de-DE");

                await sock.sendMessage(from, {
                    text:
`🛡️ ANTI-DELETE

⏰ ${timestamp}
👤 @${originalSender.split("@")[0]}

📩 Inhalt:
${content}`,
                    mentions: [originalSender]
                });
            }

        } catch (err) {
            console.error("Message Error:", err);
        }
    });

    return sock;
}

connectBot();