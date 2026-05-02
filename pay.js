import { getUser, addCoins, removeCoins } from "./db.js";

export async function pay(sock, msg, sender, args) {
    let target;

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

    const amount = parseInt(args[1]);

    // ❌ Checks
    if (!target) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Bitte erwähne einen User oder gib eine Nummer an!",
            quoted: msg
        });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gib einen gültigen Betrag an!",
            quoted: msg
        });
    }

    if (target === sender) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Du kannst dir nicht selbst Coins senden!",
            quoted: msg
        });
    }

    const senderData = getUser(sender);
    const targetData = getUser(target);

    if (senderData.coins < amount) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Du hast nicht genug Coins!",
            quoted: msg
        });
    }

    // 💸 Transfer
    removeCoins(sender, amount);
    addCoins(target, amount);

    return sock.sendMessage(msg.key.remoteJid, {
        text:
            `💸 *Coins gesendet!*\n\n` +
            `👤 Von: @${sender.split("@")[0]}\n` +
            `👤 An: @${target.split("@")[0]}\n` +
            `💰 Betrag: ${amount}`,
        mentions: [sender, target],
        quoted: msg
    });
}