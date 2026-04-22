// ================= IMPORTS =================
import fs from "fs";

// ================= PATH =================
const DB_FILE = "./data/botdatabase.json";

// ================= INPUT =================
// node addCoinsAll.js 100000
const AMOUNT = parseInt(process.argv[2]);

if (!AMOUNT || isNaN(AMOUNT)) {
    console.log("❌ Bitte Coins angeben!");
    console.log("Beispiel: node addCoinsAll.js 100000");
    process.exit(1);
}

// ================= LOAD DB =================
const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

if (!db.users) db.users = {};

// ================= GIVE COINS =================
let count = 0;

for (const userId in db.users) {
    db.users[userId].coins = (db.users[userId].coins || 0) + AMOUNT;
    count++;
}

// ================= SAVE =================
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ================= LOG =================
console.log(`✅ ${AMOUNT} Coins an ${count} User vergeben!`);