import { exec } from "child_process";
import { spawn } from "child_process";

let restarting = false;

function startBot() {
    console.log("🚀 Bot wird gestartet...");

    const bot = spawn("node", ["index.js"], {
        stdio: "inherit"
    });

    bot.on("exit", (code) => {
        console.log(`⚠️ Bot gestoppt (Code: ${code})`);

        if (restarting) return;

        restarting = true;

        console.log("♻️ Neustart in 2 Sekunden...");
        setTimeout(() => {
            restarting = false;
            startBot();
        }, 2000);
    });

    bot.on("error", (err) => {
        console.error("❌ Startfehler:", err);

        if (restarting) return;

        restarting = true;

        setTimeout(() => {
            restarting = false;
            startBot();
        }, 3000);
    });
}

startBot();


process.on("SIGINT", () => {
    console.log("\n🛑 Launcher beendet");
    process.exit(0);
});