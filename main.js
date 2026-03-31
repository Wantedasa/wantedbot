import fs from "fs";
import path from "path";

// ========================= OWNER SYSTEM =========================
export const OWNER_SETTINGS = {
    ownerJid: "4915129559931@s.whatsapp.net",
    ownerJidLid: "218507098771705@lid",
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName: "Baumi",
    version: "1.0.0"
};

// ========================= BOT CONFIG =========================
const CONFIG_FILE = path.join("./data", "botConfig.json");
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

let botConfig = { 
    publicMode: true, 
    autoRead: false,
    autoMessages: {}
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

// Speichern Funktion
export const saveBotConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf-8");
    } catch (e) {
        console.error("Fehler beim Speichern von botConfig.json:", e);
    }
};

export {botConfig};

const autoIntervals = {};
const chats = {};
const autoFailCount = {};



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

    

if (command === "welcome") {
    // Gruppe initialisieren
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, "⚙️ Nutzung: .welcome on/off");
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
        return reply(sock, msg, "⚙️ Nutzung: .leave on/off");
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
        return reply(sock, msg, "⚙️ Nutzung: .antidelete on/off");
    }

    botConfig.groupSettings[from].antidelete = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].antidelete ? "✅ Antidelete aktiviert!" : "❌ Antidelete deaktiviert!");
}
if (command === "autoread") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur der Owner kann diese Einstellung ändern!");

    const value = args[0]?.toLowerCase();
    if (!value || !["on","off"].includes(value)) return reply(sock, msg, "⚙️ Nutzung: !autoread on/off");

    botConfig.autoRead = value === "on";
    saveBotConfig();
    return reply(sock, msg, `✅ Automatisches Lesen ist jetzt ${botConfig.autoRead ? "aktiviert" : "deaktiviert"}`);
}

    //=========================//
    // OWNER & BOT INFO
    //=========================//
    if (command === "owner") return reply(sock, msg, `👑 Owner: ${OWNER_SETTINGS.ownerName}`);
    if (command === "bot") {
    // PUBLIC / SELF Mode
    const mode = PUBLIC_MODE ? "🌍 PUBLIC MODE" : "🔒 SELF MODE";

    // Auto-Read Status aus botConfig
    const autoReadStatus = botConfig?.autoRead ? "✅ AN" : "❌ AUS";

    return await reply(
        sock,
        msg,
        `🤖 ${OWNER_SETTINGS.botName}\n👑 Owner: ${OWNER_SETTINGS.ownerName}\n⚡ Version: ${OWNER_SETTINGS.version}\n🟢 Mode: ${mode}\n📖 Auto-Read: ${autoReadStatus}`
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
║ ├ .grpname
║ ├ .grpdesc
║ ├ .delete
║ ├ .promote/demote
║ ├ .mute/unmute
║
║ 🔒 OWNER
║ ├ .self
║ ├ .public
║ ├ .info
║ ├ .autoread
║ ├ .grpleave
║ ├ .device
║ ├ .block/unblock
║ ├ .antidelete on/off
║ ├ .automsg set/stop
╚═════════════════════`
        );
    }

    //=========================//
    // PING
    //=========================//
    if (command === "ping" || command === "p") {
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
            return reply(sock, msg, "❌ Nutzung: .getpic <nummer> oder auf Nachricht antworten");
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
 
if (command === "grpleave" || command === "leavegrp") {
    if (!isGroup(from)) {
        return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    }

    if (!isOwner(sender)) {
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

    const text = args.join(" ");
    if (!text) return reply(sock, msg, "❌ Benutzung: .hidetag <Nachricht>");

    try {
        const groupMetadata = await sock.groupMetadata(from);
        const mentions = groupMetadata.participants.map(p => p.id);

        let styledText;

        if (isOwner(sender)) {
            styledText = `${text}\n\n— by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ`;
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
        if (!newText) return reply(sock, msg, `⚙️ Nutzung: .${command} <neuer Text>`);

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

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner darf Nachrichten löschen!");

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
    if (command === "add") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");

    if (!args[0]) return reply(sock, msg, "❌ Nutzung: .add 49123,49222");

    let numbers = args[0].split(",");
    let jids = numbers.map(n => n.replace(/[^0-9]/g, "") + "@s.whatsapp.net");

    try {
        await sock.groupParticipantsUpdate(from, jids, "add");
        reply(sock, msg, "✅ Nutzer hinzugefügt!");
    } catch {
        const code = await sock.groupInviteCode(from);
        const link = `https://chat.whatsapp.com/${code}`;
        reply(sock, msg, `❌ Add fehlgeschlagen\n🔗 ${link}`);
    }
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

    if (!targets || targets.length === 0) return reply(sock, msg, `❌ Nutzung: .${command} @user oder auf Nachricht antworten`);

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
    if (command === "automsg") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");

    const sub = args[0];

    if (!sub) {
        return reply(sock, msg,
`📌 AutoMsg Befehle:

.automsg set <Minuten> <Text>
.automsg stop
.automsg list`);
    }

    // =========================
    // SET
    // =========================
    if (sub === "set") {
        const minutes = parseInt(args[1]);
        const text = args.slice(2).join(" ");

        if (!minutes || !text) {
            return reply(sock, msg, "❌ Nutzung: .automsg set <Minuten> <Text>");
        }

        if (minutes <= 0) {
            return reply(sock, msg, "❌ Minuten müssen > 0 sein!");
        }

        // alten stoppen
        if (autoIntervals[from]) {
            clearInterval(autoIntervals[from]);
            delete autoIntervals[from];
        }

        // speichern
        botConfig.autoMessages[from] = {
            text,
            interval: minutes
        };
        saveBotConfig();

        // starten
        autoIntervals[from] = setInterval(async () => {
            try {
                await sock.sendMessage(from, { text });
            } catch (e) {
                console.error("AutoMsg Fehler:", e);
            }
        }, minutes * 60 * 1000);

        return reply(sock, msg, `✅ AutoMsg gesetzt (${minutes} min)`);
    }

    // =========================
    // STOP
    // =========================
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
if (command === "info") {
    try {
        let target;

        // 1️⃣ Ziel bestimmen: Antwort, Markierung, oder Nummer
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid[0];
        } else if (args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            target = number + "@s.whatsapp.net";
        } else {
            return reply(sock, msg, "❌ Bitte markiere jemanden, antworte oder gib eine Nummer an!");
        }

        const number = target.split("@")[0]; // reine Nummer/LID
        const jid = target;
        const lid = msg.key.lid

        // 👤 PushName holen
        let pushName = "Unbekannt";
        try {
            const contact = sock.contacts[target];
            if (contact?.notify) pushName = contact.notify;
        } catch {}

        // 🖼 Profilbild
        let ppUrl = null;
        let hasProfilePic = "❌ Nein";
        try {
            ppUrl = await sock.profilePictureUrl(target, "image");
            hasProfilePic = "✅ Ja";
        } catch {}

        // 🏢 Business
        let isBusiness = "❌ Nein";
        try {
            const biz = await sock.getBusinessProfile(target);
            if (biz) isBusiness = "✅ Ja";
        } catch {}

        // 👥 Gemeinsame Gruppen
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

        // 📅 Account-Erstellung schätzen
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

        // 📝 Ausgabe bauen
        const text = `╭───〔 👤 USER INFO 〕───⬣
│
│ 📱 Nummer: ${number}
│ 🆔 JID: ${jid}
│ 🆔 LID: ${lid}
│ 👤 Name: ${pushName}
│ 🖼️ Profilbild: ${hasProfilePic}
│ 🏢 Business: ${isBusiness}
│ 📅 Erstellt: ${createdAt}
│
│ 👥 Gemeinsame Gruppen: ${groupCount}
${groupList}
│
╰────────────────⬣`;

        if (ppUrl) {
            await sock.sendMessage(from, {
                image: { url: ppUrl },
                caption: text
            }, { quoted: msg });
        } else {
            reply(sock, msg, text);
        }

    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Fehler beim Abrufen der Infos!");
    }
}
if (command === "block") {
    // Prüfen, ob der Befehl vom Owner kommt
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden blockieren!");

    // Ziel-Nummer holen: Entweder durch Reply oder Argument
    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    // Nummer in JID-Format bringen
    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "block"); // Nummer blockieren
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich blockiert.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Blockieren fehlgeschlagen.");
    }
}
if (command === "unblock") {
    // Prüfen, ob der Befehl vom Owner kommt
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden entblocken!");

    // Ziel-Nummer holen: Entweder durch Reply oder Argument
    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    // Nummer in JID-Format bringen
    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "unblock"); // Nummer entblocken
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich entblockt.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Entblocken fehlgeschlagen.");
    }
}

}


export const loadAutoMessages = async (sock) => {
    if (!botConfig.autoMessages) return;

    for (const chatId in botConfig.autoMessages) {
        const data = botConfig.autoMessages[chatId];

        // Gruppennamen sicher holen
        let groupName = chatId;
        try {
            if (chatId.endsWith("@g.us")) {
                const metadata = await sock.groupMetadata(chatId);
                groupName = metadata.subject || chatId;
            }
        } catch (err) {
            console.error(`Fehler beim Abrufen des Gruppennamens für ${chatId}:`, err);
        }

        autoFailCount[chatId] = 0;

        // Intervall starten
        autoIntervals[chatId] = setInterval(async () => {
            try {
                await sock.sendMessage(chatId, { text: data.text });
                autoFailCount[chatId] = 0; // Reset bei Erfolg

            } catch (e) {
                console.error("AutoMsg Fehler:", e);
                autoFailCount[chatId]++;

                // Direkt Owner informieren
                try {
                    await sock.sendMessage(ownerJid, {
                        text: `⚠️ Auto-Message fehlgeschlagen!\n\nChat: ${groupName} (${chatId})\nGrund: Fehler beim Senden.`
                    });
                } catch {}

                // Nach 5 Fehlern deaktivieren
                if (autoFailCount[chatId] >= 5) {
                    console.log(`❌ AutoMsg deaktiviert für ${chatId}`);
                    clearInterval(autoIntervals[chatId]);
                    delete autoIntervals[chatId];
                    delete botConfig.autoMessages[chatId];

                    if (typeof saveBotConfig === "function") saveBotConfig();

                    try {
                        await sock.sendMessage(ownerJid, {
                            text: `⚠️ Auto-Message deaktiviert!\n\nChat: ${groupName} (${chatId})\nGrund: 5x Fehler beim Senden.`
                        });
                    } catch (err) {
                        console.error("Owner Nachricht fehlgeschlagen:", err);
                    }
                }
            }
        }, data.interval * 60 * 1000);
    }

    console.log("✅ Auto-Messages geladen:", Object.keys(botConfig.autoMessages).length);
};

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
