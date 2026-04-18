const { spawn } = require("child_process");

console.log("♻️ Restart wird ausgeführt...");

const child = spawn("node", ["launcher.js"], {
    stdio: "inherit",
    detached: true
});

child.unref();

process.exit(0);