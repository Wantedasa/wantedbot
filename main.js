import fs from "fs";
import path from "path";

// ========================= OWNER SYSTEM =========================
export const OWNER_SETTINGS = {
    ownerJid: "218507098771705@s.whatsapp.net",
    ownerJidLid: "218507098771705@lid",
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName: "Baumi",
    version: "1.0.0"
};

// ========================= BOT CONFIG =========================
const CONFIG_FILE = path.join("./data", "botConfig.json");
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

let botConfig = { publicMode: true };
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        botConfig = JSON.parse(raw);
    } catch (e) {
        console.error("Fehler beim Laden von botConfig.json:", e);
    }
}

// Speichern Funktion
export const saveBotConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf-8");
    } catch (e) {
        console.error("Fehler beim Speichern von botConfig.json:", e);
    }
};

export const autoMessages = {};
export const autoMessageSettings = {};


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
export const isOwner = (sender) =>
    sender === OWNER_SETTINGS.ownerJid || sender === OWNER_SETTINGS.ownerJidLid;

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
    if (!text.startsWith(".")) return;
    if (!PUBLIC_MODE && !isOwner(sender)) return;

    const args = text.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();
    const value = args[0]?.toLowerCase();

    ensureGroupSettings(from);

    //=========================//
    // TOGGLES
    //=========================//
    if (command === "welcome") {
        if (value === "on") groupSettings[from].welcome = true;
        else if (value === "off") groupSettings[from].welcome = false;
        else return reply(sock, msg, "⚙️ Nutzung: .welcome on/off");
        saveGroupSettings();
        return reply(sock, msg, groupSettings[from].welcome ? "✅ Welcome aktiviert" : "❌ Welcome deaktiviert");
    }

    if (command === "leave") {
        if (value === "on") groupSettings[from].leave = true;
        else if (value === "off") groupSettings[from].leave = false;
        else return reply(sock, msg, "⚙️ Nutzung: .leave on/off");
        saveGroupSettings();
        return reply(sock, msg, groupSettings[from].leave ? "✅ Leave aktiviert" : "❌ Leave deaktiviert");
    }

    if (command === "antidelete") {
        if (value === "on") groupSettings[from].antidelete = true;
        else if (value === "off") groupSettings[from].antidelete = false;
        else return reply(sock, msg, "⚙️ Nutzung: .antidelete on/off");
        saveGroupSettings();
        return reply(sock, msg, groupSettings[from].antidelete ? "✅ Antidelete aktiviert!" : "❌ Antidelete deaktiviert!");
    }

    //=========================//
    // OWNER & BOT INFO
    //=========================//
    if (command === "owner") return reply(sock, msg, `👑 Owner: ${OWNER_SETTINGS.ownerName}`);
    if (command === "bot") {
    const mode = PUBLIC_MODE ? "🌍 PUBLIC MODE " : "🔒 SELF MODE";
    return await reply(
        sock,
        msg,
        `🤖 ${OWNER_SETTINGS.botName}\n👑 Owner: ${OWNER_SETTINGS.ownerName}\n⚡ Version: ${OWNER_SETTINGS.version}\n🟢 Mode: ${mode}`
    );
}
if (command === "self") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
    PUBLIC_MODE = false;
    botConfig.publicMode = false;
    saveBotConfig();
    return reply(sock, msg, "🔒 SELF MODE aktiviert");
}

if (command === "public") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
    PUBLIC_MODE = true;
    botConfig.publicMode = true;
    saveBotConfig();
    return reply(sock, msg, "🌍 PUBLIC MODE aktiviert");
}

    if (command === "menu") {
        return reply(sock, msg,
`╔═══『 📃 ${OWNER_SETTINGS.botName} 』═══╗
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠═════════════════════
║ 📌 .menu
║ 📌 .bot
║ 📌 .owner
║
║ 👥 GROUP
║ ├ .hidetag
║ ├ .kick
║ ├ .welcome on/off
║ ├ .leave on/off
║ ├ .antidelete on/off
║ ├ .grpname
║ ├ .grpdesc
║ ├ .delete
║
║ 🔒 OWNER
║ ├ .self
║ ├ .public
╚═════════════════════`
        );
    }

    //=========================//
    // PING
    //=========================//
    if (command === "ping") {
        const start = Date.now();
        await reply(sock, msg, "🏓 Pinging...");
        const latency = Date.now() - start;
        return reply(sock, msg, `🏓 Pong!\n⏱️ Latenz: ${latency}ms`);
    }

    if (command === "kick") {
    if (!isGroup(from)) return;

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) {
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
    // ====== Auto-Message setzen ======
      if (command === "setmsg") {
    if (!isOwner(sender)) return reply(sock, msg, "Nur der Owner kann Auto-Messages setzen!");

    const [minutesStr, ...messageParts] = args;
    if (!minutesStr || !messageParts.length) {
        return reply(sock, msg, "Benutzung: .setmsg <Minuten> <Nachricht>");
    }

    const minutes = parseInt(minutesStr);
    if (isNaN(minutes) || minutes <= 0) {
        return reply(sock, msg, "Bitte eine gültige Zahl größer als 0 angeben!");
    }

    const textMessage = messageParts.join(" ");

    // Alte Intervalle löschen, falls schon vorhanden
    if (autoMessages[from]) clearInterval(autoMessages[from]);

    // Neue Intervalle setzen
    autoMessageSettings[from] = { text: textMessage, interval: minutes };
    autoMessages[from] = setInterval(async () => {
        try {
            await sock.sendMessage(from, { text: textMessage });
        } catch (e) {
            console.error("Fehler beim Senden der Auto-Message:", e);
        }
    }, minutes * 60 * 1000);

    // Bestätigung direkt zurückgeben
    return reply(sock, msg, `✅ Auto-Message gesetzt: "${textMessage}" alle ${minutes} Minute(n)`);
}
    // ====== Auto-Message stoppen ======
    if (command === "stopmsg") {
        if (!isOwner(sender)) return reply(sock, msg, "Nur der Owner kann Auto-Messages stoppen!");

        if (autoMessages[from]) {
            clearInterval(autoMessages[from]);
            delete autoMessages[from];
            delete autoMessageSettings[from];
            return reply(sock, msg, "⏹ Auto-Message gestoppt!");
        } else {
            return reply(sock, msg, "Es läuft aktuell keine Auto-Message in diesem Chat.");
        }
    }

if (command === "kickall") {
    if (!isGroup(from)) return;

    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur der Owner darf das!");
    }

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

        return reply(sock, msg, `🚫 ${toKick.length} User wurden gekickt!`);
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Kicken!");
        }
    }
 

if (command === "hidetag") {
    if (!isGroup(from)) return reply(sock, msg, "Dieser Befehl funktioniert nur in Gruppen!");
    if (!isAdmin(sock, from, sender)) return reply(sock, msg, "Nur Admins können hidetag nutzen!");

    const text = args.join(" ");
    if (!text) return reply(sock, msg, "Benutzung: +hidetag <Nachricht>");

    try {
        // Alle Gruppenmitglieder abrufen
        const groupMetadata = await sock.groupMetadata(from);
        const mentions = groupMetadata.participants.map(p => p.id);

        // Nachricht senden mit Mentions
        await sock.sendMessage(from, { text, mentions });

        // Ursprüngliche Nachricht löschen
        if (msg.key.fromMe || isAdmin(sock, from, sender)) {
            await sock.sendMessage(from, { delete: msg.key });
        }

    } catch (err) {
        console.error("Fehler bei hidetag:", err);
        reply(sock, msg, "Fehler beim Senden der Hidetag-Nachricht.");
    }
}

    //=========================//
    // GROUP NAME & DESCRIPTION
    //=========================//
    if (command === "grpname" || command === "grpdesc") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        const newText = args.join(" ");
        if (!newText) return reply(sock, msg, `⚙️ Nutzung: .${command} <neuer Text>`);

        try {
            if (command === "grpname") await sock.groupUpdateSubject(from, newText);
            if (command === "grpdesc") await sock.groupUpdateDescription(from, newText);
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Ändern!");
        }
    }

    //=========================//
    // DELETE MESSAGE
    //=========================//
    if (command === "del" || command === "delete") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        if (!contextInfo?.stanzaId) return reply(sock, msg, "⚙️ Antworte auf die Nachricht, die gelöscht werden soll!");

        try {
            await sock.sendMessage(from, { delete: { remoteJid: from, id: contextInfo.stanzaId, fromMe: false } });
            await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id, fromMe: true } });
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Löschen der Nachrichten!");
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
