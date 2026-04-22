// ================= IMPORTS =================
import { getUser, addCoins, removeCoins } from "./db.js";

// ================= CONFIG =================
const COOLDOWN = 5000;

const emojis = ["🍒", "🍋", "🍉", "🍇", "⭐", "7️⃣"];

const rewards = {
    "🍒🍒🍒": 3,
    "🍋🍋🍋": 4,
    "🍉🍉🍉": 5,
    "🍇🍇🍇": 6,
    "⭐⭐⭐": 10,
    "7️⃣7️⃣7️⃣": 25
};

const cooldownMap = {};

// ================= SLOT FUNCTION =================
export async function slot(sock, msg, sender, amount = 100) {
    const user = getUser(sender);

    if (cooldownMap[sender] && Date.now() - cooldownMap[sender] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (Date.now() - cooldownMap[sender])) / 1000);
        return sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Warte ${remaining}s bevor du wieder spielst!`
        });
    }

    if (user.coins < amount) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Du hast nicht genug Coins!\n💰 Benötigt: ${amount}`
        });
    }

    removeCoins(sender, amount);

    const r1 = emojis[Math.floor(Math.random() * emojis.length)];
    const r2 = emojis[Math.floor(Math.random() * emojis.length)];
    const r3 = emojis[Math.floor(Math.random() * emojis.length)];

    const result = `${r1}${r2}${r3}`;

    let win = 0;
    let text = `🎰 SLOT MACHINE\n\n[ ${r1} | ${r2} | ${r3} ]\n\n`;

    if (a === b && b === c) {
        win = amount * 5;
        text += `🎉 JACKPOT!\n💰 +${win}\n💰 Neuer Kontostand ${user.coins}`;
        addCoins(sender, win);
    }

    else if (a === b || b === c || a === c) {
        win = Math.floor(amount * 1.5);
        text += `✨ 2ER HIT!\n💰 +${win}\n💰 Neuer Kontostand ${user.coins}`;
        addCoins(sender, win);
    }

    else {
        text += `❌ Kein Gewinn\n💸 -${amount}\n💰 Neuer Kontostand ${user.coins}`;
    }

    cooldownMap[sender] = Date.now();

    return sock.sendMessage(msg.key.remoteJid, { text });
}