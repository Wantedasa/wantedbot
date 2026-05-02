import fs from "fs";

const DB_FILE = "./data/botdatabase.json";

export async function top(sock, msg, sender) {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

    if (!db.users) db.users = {};

    const users = Object.entries(db.users);

    // 🔽 Sortieren
    const sorted = users.sort((a, b) => (b[1].coins || 0) - (a[1].coins || 0));

    // 🏆 Top 10
    const top10 = sorted.slice(0, 10);

    // 👑 Medaillen
    const medals = ["🥇", "🥈", "🥉"];

    let text = `╭── 🏆 *TOP 10 RICHLIST* ──⬣\n\n`;
    let mentions = [];

    top10.forEach(([id, data], index) => {
        const coins = data.coins || 0;
        const number = id.split("@")[0];

        const icon = medals[index] || `#${index + 1}`;

        text += `│ ${icon} @${number}\n`;
        text += `│ 💰 ${coins} Coins\n\n`;

        mentions.push(id);
    });

    text += `╰──────────────⬣\n`;

    // 📊 Eigene Platzierung finden
    const userIndex = sorted.findIndex(([id]) => id === sender);
    const userData = db.users[sender] || { coins: 0 };

    if (userIndex !== -1) {
        text += `\n📊 *Dein Rang*\n`;
        text += `🏅 Platz: #${userIndex + 1}\n`;
        text += `💰 Coins: ${userData.coins}\n`;
    }

    if (top10.length === 0) {
        text = "❌ Keine Daten vorhanden!";
    }

    return sock.sendMessage(msg.key.remoteJid, {
        text,
        mentions,
        quoted: msg
    });
}