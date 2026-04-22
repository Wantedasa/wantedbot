// ================= IMPORTS =================
import { getUser, addCoins, removeCoins } from "./db.js";

// ================= CONFIG =================
const COOLDOWN = 5000;
const DEFAULT_AMOUNT = 100;

const emojis = ["🍒", "🍋", "🍉", "🍇", "⭐", "7️⃣"];

const cooldownMap = {};

// ================= SLOT FUNCTION =================
export async function slot(sock, msg, sender, amount) {
    const user = getUser(sender);

    if (!amount || isNaN(amount)) {
        amount = DEFAULT_AMOUNT;
    }

    amount = parseInt(amount);

    if (cooldownMap[sender] && Date.now() - cooldownMap[sender] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (Date.now() - cooldownMap[sender])) / 1000);

        return sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Warte ${remaining}s bevor du wieder spielst!`
        });
    }

    if (user.coins < amount) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Nicht genug Coins!\n💰 Benötigt: ${amount}`
        });
    }

    removeCoins(sender, amount);

    const r1 = emojis[Math.floor(Math.random() * emojis.length)];
    const r2 = emojis[Math.floor(Math.random() * emojis.length)];
    const r3 = emojis[Math.floor(Math.random() * emojis.length)];

    let win = 0;
    let text = `🎰 SLOT MACHINE\n\n[ ${r1} | ${r2} | ${r3} ]\n\n`;

    if (r1 === r2 && r2 === r3) {
        win = amount * 5;
        addCoins(sender, win);

        const balance = getUser(sender).coins;

        text += `🎉 JACKPOT!\n💰 +${win}\n💳 Balance: ${balance}`;
    }
    else if (r1 === r2 || r2 === r3 || r1 === r3) {
        win = Math.floor(amount * 1.5);
        addCoins(sender, win);

        const balance = getUser(sender).coins;

        text += `✨ 2ER HIT!\n💰 +${win}\n💳 Balance: ${balance}`;
    }
    else {
        const balance = getUser(sender).coins;

        text += `❌ Kein Gewinn\n💸 -${amount}\n💳 Balance: ${balance}`;
    }

    cooldownMap[sender] = Date.now();

    return sock.sendMessage(msg.key.remoteJid, { text });
}