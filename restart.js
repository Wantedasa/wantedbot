const { spawn } = require("child_process");

console.log("♻️ Restart wird ausgeführt...");

const child = spawn("node", ["index.js"], {
    stdio: "inherit",
    detached: true
});

child.unref();

process.exit(0);