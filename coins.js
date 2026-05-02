import { getUser } from "./db.js";

export async function balance(sock, msg, sender, args) {
    let target = sender;

    // 📌 Mention
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) {
        target = mentioned[0];
    } 
    // 📌 Nummer
    else if (args[0]) {
        const num = args[0].replace(/[^0-9]/g, "");
        target = num + "@s.whatsapp.net";
    }

    const user = getUser(target);

    return sock.sendMessage(msg.key.remoteJid, {
        text:
            `💰 *COIN KONTO*\n\n` +
            `👤 User: @${target.split("@")[0]}\n` +
            `💸 Coins: ${user.coins}`,
        mentions: [target],
        quoted: msg
    });
}