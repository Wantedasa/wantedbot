const autoFishMap = new Map();
const lastUserActivity = new Map();

// ================= CONFIG =================
const ACTIVE_PHASE_DURATION = 10 * 60 * 1000;
const REST_PHASE_DURATION = 30 * 60 * 1000;
const IDLE_LIMIT = 60 * 60 * 1000;

// ================= HELPERS =================
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

// ================= ACTIVITY TRACK =================
export function updateUserActivity(sender) {
    lastUserActivity.set(sender, Date.now());
}

function isUserIdle(sender) {
    const last = lastUserActivity.get(sender) || 0;
    return (Date.now() - last) > IDLE_LIMIT;
}

// ================= AUTO FISH =================
export async function startAutoFish(sock, sender, chatId) {
    if (autoFishMap.has(sender)) return;

    autoFishMap.set(sender, {
        active: true,
        phaseStart: Date.now()
    });

    async function loop() {
        const data = autoFishMap.get(sender);
        if (!data) return;

        // idle check
        if (isUserIdle(sender)) {
            return setTimeout(loop, 60 * 1000);
        }

        const now = Date.now();
        const phaseTime = now - data.phaseStart;

        // phase switch
        if (data.active && phaseTime > ACTIVE_PHASE_DURATION) {
            data.active = false;
            data.phaseStart = now;
        } else if (!data.active && phaseTime > REST_PHASE_DURATION) {
            data.active = true;
            data.phaseStart = now;
        }

        // rest phase
        if (!data.active) {
            return setTimeout(loop, 2 * 60 * 1000);
        }

        // skip chance
        if (Math.random() < 0.15) {
            return setTimeout(loop, getHumanLikeDelay());
        }

        // send fish command
        try {
            await sock.sendMessage(chatId, {
                text: getRandomCommand()
            });
        } catch (e) {
            console.error("AutoFish send error:", e);
        }

        // double fish
        if (Math.random() < 0.25) {
            const shortDelay = 2000 + Math.random() * 5000;

            setTimeout(async () => {
                if (!autoFishMap.has(sender)) return;

                try {
                    await sock.sendMessage(chatId, {
                        text: getRandomCommand()
                    });
                } catch (e) {
                    console.error("AutoFish double error:", e);
                }
            }, shortDelay);
        }

        setTimeout(loop, getHumanLikeDelay());
    }

    loop();
}

// ================= STOP =================
export function stopAutoFish(sender) {
    autoFishMap.delete(sender);
}

// ================= COMMAND HANDLER =================
export async function handleAutoFarm(
    sock,
    msg,
    command,
    args,
    prefix,
    sender,
    from,
    isWantedasa,
    reply,
    botConfig,
    saveBotConfig
) {

    if (command !== "autofarm") return false;

    const sub = args[0];

    if (!isWantedasa(sender)) {
        return reply("❌ Nur Owner!");
    }

    botConfig.autoFishGroups = botConfig.autoFishGroups || {};

    // ================= SET =================
    if (sub === "set") {
        let groupId = args[1];

        if (!groupId) {
            if (!from.endsWith("@g.us")) {
                return reply("❌ Nutze in Gruppe oder gib ID an.");
            }
            groupId = from;
        }

        if (!groupId.endsWith("@g.us")) {
            return reply("❌ Ungültige Gruppen-ID.");
        }

        botConfig.autoFishGroups[sender] = groupId;
        saveBotConfig();

        return reply(`✅ AutoFarm gesetzt:\n${groupId}`);
    }

    // ================= START =================
    if (sub === "start") {
        const groupId = botConfig.autoFishGroups[sender];

        if (!groupId) {
            return reply(`❌ Erst ${prefix}autofarm set verwenden.`);
        }

        if (autoFishMap.has(sender)) {
            return reply("⚠️ AutoFarm läuft bereits.");
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
        delete botConfig.autoFishGroups[sender];
        saveBotConfig();

        return reply("🗑️ AutoFarm gelöscht.");
    }

    // ================= HELP =================
    return reply(
`📌 AutoFarm

${prefix}autofarm set [groupId]
${prefix}autofarm start
${prefix}autofarm stop
${prefix}autofarm del`
    );
}