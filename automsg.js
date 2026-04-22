// ================= IMPORTS =================
import { botConfig } from "./main.js";

// ================= CONFIG =================
const CHECK_INTERVAL = 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 15;
const MAX_FAILS = 5;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 3000;

// ================= STATE =================
let autoMessageInterval = null;
let autoFailCount = {};
let saveTimeout = null;

// ================= SAVE (DEBOUNCE) =================
function saveConfigDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveBotConfig();
    }, 2000);
}

// ================= SAFE SEND =================
async function sendMessageSafe(sock, chatId, data) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            const delay = 1000 + Math.random() * 4000;
            await new Promise(res => setTimeout(res, delay));

            const text = data.texts
                ? data.texts[Math.floor(Math.random() * data.texts.length)]
                : data.text;

            await sock.sendMessage(chatId, { text });

            data.lastSent = Date.now();
            autoFailCount[chatId] = 0;

            saveConfigDebounced();

            console.log(`✅ AutoMsg gesendet → ${chatId}`);
            return true;

        } catch (err) {
            console.error(`❌ Fehler (${chatId}) Versuch ${attempt}:`, err);
            await new Promise(res => setTimeout(res, RETRY_DELAY));
        }
    }

    autoFailCount[chatId] = (autoFailCount[chatId] || 0) + 1;

    console.log(`⚠️ Fail Count (${chatId}): ${autoFailCount[chatId]}`);

    if (autoFailCount[chatId] >= MAX_FAILS) {
        console.log(`🛑 AutoMsg deaktiviert → ${chatId}`);

        delete botConfig.autoMessages[chatId];
        saveConfigDebounced();
    }

    return false;
}

// ================= MAIN SYSTEM =================
export const loadAutoMessages = async (sock) => {
    if (!botConfig.autoMessages) return;

    if (autoMessageInterval) {
        clearInterval(autoMessageInterval);
    }

    autoMessageInterval = setInterval(async () => {
        try {
            const now = Date.now();

            const entries = Object.entries(botConfig.autoMessages);

            for (let i = 0; i < entries.length; i += 3) {
                const chunk = entries.slice(i, i + 3);

                await Promise.all(chunk.map(async ([chatId, data]) => {
                    if (!data) return;

                    if (data.paused) return;

                    if (!data.interval) {
                        data.interval = DEFAULT_INTERVAL_MINUTES;
                        saveConfigDebounced();
                    }

                    if (!data.text && !data.texts) return;

                    const intervalMs = data.interval * 60 * 1000;
                    const lastSent = data.lastSent || 0;
                    if (data.activeHours) {
                        const hour = new Date().getHours();
                        if (hour < data.activeHours.from || hour > data.activeHours.to) {
                            return;
                        }
                    }
                    if (now - lastSent >= intervalMs) {
                        console.log(`⏳ Sende AutoMsg → ${chatId}`);
                        await sendMessageSafe(sock, chatId, data);
                    }
                }));
            }

        } catch (err) {
            console.error("🔥 Global AutoMsg Error:", err);
        }

    }, CHECK_INTERVAL);

    console.log("🚀 Auto-Message System gestartet");
};

// ================= STOP FUNCTION =================
export const stopAutoMessages = () => {
    if (autoMessageInterval) {
        clearInterval(autoMessageInterval);
        autoMessageInterval = null;
        console.log("🛑 Auto-Message System gestoppt");
    }
};