const autoFishMap = new Map();
const lastUserActivity = new Map();

const ACTIVE_PHASE_DURATION = 10 * 60 * 1000;
const REST_PHASE_DURATION = 30 * 60 * 1000;
const IDLE_LIMIT = 60 * 60 * 1000;

function getRandomDelay() {
    const baseMinutes = 3;
    const extraMinutes = Math.floor(Math.random() * 6);
    const seconds = Math.floor(Math.random() * 60);

    return ((baseMinutes + extraMinutes) * 60 + seconds) * 1000;
}

function getHumanLikeDelay() {
    let delay = getRandomDelay();

    if (Math.random() < 0.2) {
        delay += (5 + Math.random() * 15) * 60 * 1000;
    }

    return delay;
}

function getRandomCommand() {
    return Math.random() < 0.5 ? "!f" : "!fish";
}

export function updateUserActivity(sender) {
    lastUserActivity.set(sender, Date.now());
}

function isUserIdle(sender) {
    const last = lastUserActivity.get(sender) || 0;
    return (Date.now() - last) > IDLE_LIMIT;
}

export async function startAutoFish(sock, sender, chatId) {
    if (autoFishMap.has(sender)) return;

    autoFishMap.set(sender, {
        active: true,
        phaseStart: Date.now()
    });

    async function loop() {
        const data = autoFishMap.get(sender);
        if (!data) return;

        if (isUserIdle(sender)) {
            return setTimeout(loop, 60 * 1000);
        }

        const now = Date.now();
        const phaseTime = now - data.phaseStart;

        if (data.active && phaseTime > ACTIVE_PHASE_DURATION) {
            data.active = false;
            data.phaseStart = now;
        } else if (!data.active && phaseTime > REST_PHASE_DURATION) {
            data.active = true;
            data.phaseStart = now;
        }

        if (!data.active) {
            return setTimeout(loop, 2 * 60 * 1000);
        }

        if (Math.random() < 0.15) {
            return setTimeout(loop, getHumanLikeDelay());
        }

        const cmd1 = getRandomCommand();
        await sock.sendMessage(chatId, { text: cmd1 });

        if (Math.random() < 0.25) {
            const shortDelay = 2000 + Math.random() * 5000;

            setTimeout(async () => {
                if (!autoFishMap.has(sender)) return;

                const cmd2 = getRandomCommand();
                await sock.sendMessage(chatId, { text: cmd2 });
            }, shortDelay);
        }

        setTimeout(loop, getHumanLikeDelay());
    }

    loop();
}

export function stopAutoFish(sender) {
    autoFishMap.delete(sender);
}

const autoFishGroups = new Map();

export async function handleAutoFarm(sock, msg, command, args, prefix, sender, from, isWantedasa, reply) {
    if (command !== "autofarm") return;

    const sub = args[0];

    if (!isWantedasa(sender)) {
        return reply("❌ Nur Owner!");
    }

    // ================= SET =================
     if (sub === "set") {
        let groupId = args[1];

        if (!groupId) {
            if (!from.endsWith("@g.us")) {
                return reply("❌ Gib eine Gruppen-ID an oder nutze den Befehl in einer Gruppe.");
            }
            groupId = from;
        }

        if (!groupId.endsWith("@g.us")) {
            return reply("❌ Ungültige Gruppen-ID.");
        }

        autoFishGroups.set(sender, groupId);

        return reply(`✅ AutoFarm Gruppe gesetzt:\n${groupId}`);
    }

    // ================= START =================
    if (sub === "start") {
        const groupId = autoFishGroups.get(sender);

        if (!groupId) {
            return reply(`❌ Erst ${prefix}autofarm set verwenden.`);
        }

        startAutoFish(sock, sender, groupId);

        return reply("🎣 AutoFarm gestartet.");
    }

    // ================= STOP =================
    if (sub === "stop") {
        stopAutoFish(sender);
        return reply("🛑 AutoFarm gestoppt.");
    }

    // ================= DELETE =================
    if (sub === "del") {
        autoFishGroups.delete(sender);
        return reply("🗑️ AutoFarm Gruppe entfernt.");
    }

    // ================= HELP =================
    return reply(
`📌 *AutoFarm Menü*

${prefix}autofarm set   → Gruppe setzen
${prefix}autofarm start → starten
${prefix}autofarm stop  → stoppen
${prefix}autofarm del   → löschen`
    );
}