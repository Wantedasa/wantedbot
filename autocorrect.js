import fs from "fs";
import path from "path";

const AUTO_FILE = path.join("./data", "autocorrect.json");
const WHITELIST_FILE = path.join("./data", "autocorrect_whitelist.json");

// Ordner erstellen
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

// -----------------------
// Autocorrect DB
let autoDB = {};
if (fs.existsSync(AUTO_FILE)) {
    autoDB = JSON.parse(fs.readFileSync(AUTO_FILE));
}
function saveAutoDB() {
    fs.writeFileSync(AUTO_FILE, JSON.stringify(autoDB, null, 2));
}

// -----------------------
// Whitelist
let WHITELIST = new Set();
if (fs.existsSync(WHITELIST_FILE)) {
    WHITELIST = new Set(JSON.parse(fs.readFileSync(WHITELIST_FILE)));
}
function saveWhitelist() {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify([...WHITELIST], null, 2));
}

// -----------------------
// Gruppen-Cache
const messageCache = {}; // messageCache[group][msgId] = { msg, sender }

// -----------------------
// Hilfsfunktionen
function isValidWord(word) {
    if (word.length < 3) return false;              // Kurze Wörter ignorieren
    if (/\d|[\u{1F300}-\u{1FAFF}]/u.test(word)) return false; // Emojis/Zahlen ignorieren
    if (WHITELIST.has(word.toLowerCase())) return false;      // Whitelist ignorieren
    return true;
}

function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
            else
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
        }
    }
    return matrix[b.length][a.length];
}

// -----------------------
// Auto-Learn Funktion
function tryAutoLearn(sender, oldText, newText) {
    if (!oldText || !newText) return;
    if (newText.startsWith(".")) return;

    const oldWords = oldText.split(" ");
    const newWords = newText.split(" ");

    // Ganze Satzkorrektur
    if (oldWords.length === newWords.length) {
        let learned = false;
        for (let i = 0; i < oldWords.length; i++) {
            const wrong = oldWords[i];
            const right = newWords[i];
            if (wrong.toLowerCase() !== right.toLowerCase() && isValidWord(wrong) && isValidWord(right)) {
                autoDB[wrong.toLowerCase()] = right.toLowerCase();
                learned = true;
            }
        }
        if (learned) saveAutoDB();
        return;
    }

    // Einzelwortkorrektur
    const oldWordSet = new Set(oldWords.map(w => w.toLowerCase()));
    for (const word of newWords) {
        const w = word.toLowerCase();
        if (!oldWordSet.has(w) && isValidWord(w)) {
            let closest = null;
            let minDistance = Infinity;

            for (const oldWord of oldWords) {
                const ow = oldWord.toLowerCase();
                if (!isValidWord(ow)) continue;
                const d = levenshteinDistance(ow, w);
                if (d < minDistance && d > 0) {
                    minDistance = d;
                    closest = ow;
                }
            }

            if (closest) {
                autoDB[closest] = w;
                saveAutoDB();
            }
        }
    }
}

// -----------------------
// Autokorrektur
async function autoCorrect(sock, msg, botConfig) {
    if (!botConfig.autocorrect) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text || text.startsWith(".")) return;

    let corrected = text;
    for (const wrong in autoDB) {
        const right = autoDB[wrong];
        const regex = new RegExp(`\\b${wrong}\\b`, "gi");
        corrected = corrected.replace(regex, right);
    }

    if (corrected === text) return;

    try {
        await sock.sendMessage(msg.key.remoteJid, { text: corrected, edit: msg.key });
    } catch (e) {
        console.log("Edit Fehler:", e);
    }
}

// -----------------------
// Handler für Nachrichten
async function handleAutoCorrect(sock, msg, botConfig) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const from = msg.key.remoteJid;
    const id = msg.key.id;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    // Gruppen-Cache speichern
    if (isGroup(from)) {
        if (!messageCache[from]) messageCache[from] = {};
        messageCache[from][id] = { msg: text, sender };

        if (Object.keys(messageCache[from]).length > 999) {
            const oldest = Object.keys(messageCache[from])[0];
            delete messageCache[from][oldest];
        }
    }

    // Letzte Nachricht vom Sender suchen
    let lastText = null;
    if (isGroup(from) && Object.keys(messageCache[from]).length > 1) {
        const lastEntry = Object.values(messageCache[from]).reverse()
            .find(e => e.sender === sender && e.msg !== text);
        if (lastEntry) lastText = lastEntry.msg;
    }

    // Lernen
    if (lastText) tryAutoLearn(sender, lastText, text);

    // Autokorrektur
    await autoCorrect(sock, msg, botConfig);
}

// -----------------------
// Subcommands
function autoCorrectCommand(sock, msg, args, botConfig, saveBotConfig, reply) {
    if (!args[0]) return reply(sock, msg, "❌ Nutzung: .autocorrect <on|off|unlearn|reset|whitelist> [args]");
    const sub = args[0].toLowerCase();

    if (sub === "on" || sub === "off") {
        botConfig.autocorrect = sub === "on";
        saveBotConfig();
        return reply(sock, msg, `🔧 Autokorrektur ${botConfig.autocorrect ? "aktiviert" : "deaktiviert"}`);
    }

    if (sub === "unlearn") {
        if (!args[1]) return reply(sock, msg, "❌ Nutzung: .autocorrect unlearn <wort>");
        const word = args[1].toLowerCase();
        if (autoDB[word]) {
            delete autoDB[word];
            saveAutoDB();
            return reply(sock, msg, `✅ "${word}" wurde vergessen`);
        } else {
            return reply(sock, msg, `❌ "${word}" ist nicht in der Autokorrektur`);
        }
    }

    if (sub === "reset") {
        autoDB = {};
        saveAutoDB();
        return reply(sock, msg, "🗑️ Autokorrektur DB wurde komplett zurückgesetzt");
    }

    // Whitelist Subcommands
    if (sub === "whitelist") {
        const action = args[1]?.toLowerCase();
        const word = args[2]?.toLowerCase();
        if (!action) return reply(sock, msg, "❌ Nutzung: .autocorrect whitelist <add|remove|list|reset> [wort]");

        if (action === "add") {
            if (!word) return reply(sock, msg, "❌ Nutzung: .autocorrect whitelist add <wort>");
            WHITELIST.add(word);
            saveWhitelist();
            return reply(sock, msg, `✅ "${word}" zur Whitelist hinzugefügt`);
        }

        if (action === "remove") {
            if (!word) return reply(sock, msg, "❌ Nutzung: .autocorrect whitelist remove <wort>");
            WHITELIST.delete(word);
            saveWhitelist();
            return reply(sock, msg, `✅ "${word}" von der Whitelist entfernt`);
        }

        if (action === "list") {
            return reply(sock, msg, `📋 Whitelist:\n${[...WHITELIST].join(", ") || "leer"}`);
        }

        if (action === "reset") {
            WHITELIST = new Set();
            saveWhitelist();
            return reply(sock, msg, "🗑️ Whitelist wurde zurückgesetzt");
        }

        return reply(sock, msg, "❌ Unbekannter Whitelist-Subcommand. Nutze add/remove/list/reset");
    }

    return reply(sock, msg, "❌ Subcommand nicht erkannt. Nutze on/off/unlearn/reset/whitelist");
}

// -----------------------
export { handleAutoCorrect, autoCorrectCommand };