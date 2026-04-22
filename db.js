// ================= IMPORTS =================
import fs from "fs";
import path from "path";

// ================= PATH =================
const DB_FOLDER = "./data";
const DB_FILE = path.join(DB_FOLDER, "botdatabase.json");

// ================= CONFIG =================
const PRESTIGE_LEVEL_REQUIREMENT = 10;
const PRESTIGE_XP_MULTIPLIER = 0.1;

// ================= INIT =================
if (!fs.existsSync(DB_FOLDER)) {
    fs.mkdirSync(DB_FOLDER);
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: {}
    }, null, 2));
}

// ================= LOAD =================
function loadDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (err) {
        console.error("❌ DB Load Error:", err);
        return { users: {} };
    }
}

// ================= SAVE =================
function saveDB(db) {
    try {
        const temp = DB_FILE + ".tmp";
        fs.writeFileSync(temp, JSON.stringify(db, null, 2));
        fs.renameSync(temp, DB_FILE);
    } catch (err) {
        console.error("❌ DB Save Error:", err);
    }
}

// ================= MEMORY =================
let db = loadDB();

if (!db.users) db.users = {};

// ================= DEFAULT USER =================
function createUser(id) {
    return {
        id,
        coins: 1000,
        xp: 0,
        level: 1,
        prestige: 0
    };
}

// ================= GET USER =================
export function getUser(id) {
    if (!db.users[id]) {
        db.users[id] = createUser(id);
        saveDB(db);
    }
    return db.users[id];
}

// ================= SAVE USER =================
export function saveUser(id, data) {
    db.users[id] = data;
    saveDB(db);
}

// ================= COINS =================
export function addCoins(id, amount) {
    const user = getUser(id);
    user.coins += amount;

    saveDB(db);
    return user.coins;
}

export function removeCoins(id, amount) {
    const user = getUser(id);

    user.coins = Math.max(0, user.coins - amount);

    saveDB(db);
    return user.coins;
}

// ================= XP + LEVEL =================
export function addXP(id, amount) {
    const user = getUser(id);

    // 🔥 Prestige Boost
    const boost = 1 + (user.prestige * PRESTIGE_XP_MULTIPLIER);
    const finalXP = Math.floor(amount * boost);

    user.xp += finalXP;

    let needed = user.level * 100;

    while (user.xp >= needed) {
        user.xp -= needed;
        user.level++;

        needed = user.level * 100;
    }

    saveDB(db);
    return user;
}

// ================= PRESTIGE =================
export function prestigeUser(id) {
    const user = getUser(id);

    if (user.level < PRESTIGE_LEVEL_REQUIREMENT) {
        return {
            success: false,
            message: `❌ Du brauchst Level ${PRESTIGE_LEVEL_REQUIREMENT} zum Prestigen!`
        };
    }

    user.level = 1;
    user.xp = 0;
    user.prestige += 1;

    saveDB(db);

    return {
        success: true,
        message: `🌟 Prestige erreicht! Du bist jetzt Prestige ${user.prestige}`
    };
}

// ================= INFO =================
export function getPrestigeInfo(id) {
    const user = getUser(id);

    return {
        prestige: user.prestige,
        boost: (user.prestige * PRESTIGE_XP_MULTIPLIER * 100).toFixed(0) + "%"
    };
}

// ================= GET ALL USERS =================
export function getAllUsers() {
    return db.users;
}