//=========================//
// main.js - Full System + Toggles
//=========================//

// ========================= OWNER SYSTEM =========================
const OWNER_SETTINGS = {
    ownerJid: "218507098771705@s.whatsapp.net",
    ownerJidLid: "218507098771705@lid",
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName: "Baumi",
    version: "1.0.0"
}

let PUBLIC_MODE = true;

// ========================= GROUP SETTINGS =========================
const groupSettings = {}; // { groupJid: { welcome: true, leave: true } }

//=========================//
// Helper
//=========================//
const getText = (msg) => {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return "";
};

const isGroup = (jid) => jid.endsWith("@g.us");

const isOwner = (sender) => {
    return sender === OWNER_SETTINGS.ownerJid || sender === OWNER_SETTINGS.ownerJidLid;
};

const isAdmin = async (sock, jid, user) => {
    try {
        const meta = await sock.groupMetadata(jid);
        const admin = meta.participants.find(p => p.id === user);
        return admin?.admin !== null;
    } catch {
        return false;
    }
};

const reply = async (sock, msg, text, extra = {}) => {
    return await sock.sendMessage(
        msg.key.remoteJid,
        { text, ...extra },
        { quoted: msg }
    );
};

//=========================//
// COMMAND HANDLER
//=========================//
async function handleCommands(sock, msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const text = getText(msg);
    if (!text.startsWith(".")) return;

    if (!PUBLIC_MODE && !isOwner(sender)) return;

    const args = text.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();

    // Init settings wenn nicht vorhanden
    if (isGroup(from) && !groupSettings[from]) {
        groupSettings[from] = { welcome: true, leave: true };
    }

    //=========================//
    // MENU
    //=========================//
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
║ ├ .kick @user
║ ├ .welcome on/off
║ ├ .leave on/off
║
║ 🔒 OWNER
║ ├ .self
║ ├ .public
╚═════════════════════`
        );
    }

    //=========================//
    // TOGGLES
    //=========================//
    if (command === "welcome") {
        if (!isGroup(from)) return;
        if (!(await isAdmin(sock, from, sender)) && !isOwner(sender)) {
            return reply(sock, msg, "❌ Nur Admin oder Owner!");
        }

        const value = args[0];

        if (value === "on") {
            groupSettings[from].welcome = true;
            return reply(sock, msg, "✅ Welcome aktiviert");
        } else if (value === "off") {
            groupSettings[from].welcome = false;
            return reply(sock, msg, "❌ Welcome deaktiviert");
        } else {
            return reply(sock, msg, "⚙️ Nutzung: .welcome on/off");
        }
    }

    if (command === "leave") {
        if (!isGroup(from)) return;
        if (!(await isAdmin(sock, from, sender)) && !isOwner(sender)) {
            return reply(sock, msg, "❌ Nur Admin oder Owner!");
        }

        const value = args[0];

        if (value === "on") {
            groupSettings[from].leave = true;
            return reply(sock, msg, "✅ Leave aktiviert");
        } else if (value === "off") {
            groupSettings[from].leave = false;
            return reply(sock, msg, "❌ Leave deaktiviert");
        } else {
            return reply(sock, msg, "⚙️ Nutzung: .leave on/off");
        }
    }

    //=========================//
    // INFO
    //=========================//
    if (command === "owner") {
        return reply(sock, msg, `👑 Owner: ${OWNER_SETTINGS.ownerName}`);
    }

    if (command === "bot") {
        return reply(sock, msg,
`🤖 ${OWNER_SETTINGS.botName}
👑 Owner: ${OWNER_SETTINGS.ownerName}
⚡ Version: ${OWNER_SETTINGS.version}`
        );
    }

    //=========================//
    // OWNER MODE
    //=========================//
    if (command === "self") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        PUBLIC_MODE = false;
        return reply(sock, msg, "🔒 SELF MODE aktiviert");
    }

    if (command === "public") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        PUBLIC_MODE = true;
        return reply(sock, msg, "🌍 PUBLIC MODE aktiviert");
    }

    //=========================//
    // HIDETAG
    //=========================//
    if (command === "hidetag") {
        if (!isGroup(from)) return;

        const meta = await sock.groupMetadata(from);
        const participants = meta.participants.map(p => p.id);

        const message = args.join(" ") || "👀";

        return await sock.sendMessage(
            from,
            { text: message, mentions: participants },
            { quoted: msg }
        );
    }

    //=========================//
    // KICK
    //=========================//
    if (command === "kick") {
        if (!isGroup(from)) return;

        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) {
            return reply(sock, msg, "❌ Nur Admin oder Owner!");
        }

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        if (!mentioned || mentioned.length === 0) {
            return reply(sock, msg, "❌ Markiere jemanden!");
        }

        await sock.groupParticipantsUpdate(from, mentioned, "remove");

        return reply(sock, msg, "🚫 User wurde gekickt!");
    }
}

//=========================//
// GROUP EVENTS
//=========================//
async function handleGroupParticipants(sock, update) {
    const { id, participants, action } = update;

    if (!groupSettings[id]) {
        groupSettings[id] = { welcome: true, leave: true };
    }

    for (let user of participants) {

        // WELCOME
        if (action === "add" && groupSettings[id].welcome) {
            let metadata = await sock.groupMetadata(id);
            let groupName = metadata.subject || "Gruppe";
            let groupDesc = metadata.desc || "Keine Beschreibung vorhanden.";

            await sock.sendMessage(id, {
                text: `👋 Willkommen @${user.split("@")[0]} in *${groupName}*!

📜 *Gruppenbeschreibung:*
${groupDesc}`,
                mentions: [user]
            });
        }

        // LEAVE
        if (action === "remove" && groupSettings[id].leave) {
            await sock.sendMessage(id, {
                text: `😢 @${user.split("@")[0]} hat die Gruppe verlassen`,
                mentions: [user]
            });
        }
    }
}

//=========================//
// EXPORT
//=========================//
module.exports = {
    handleCommands,
    handleGroupParticipants
};
