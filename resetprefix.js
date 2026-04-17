import fs from "fs";
const file = "./data/botConfig.json";
const defaultPrefix = ".";
let config = JSON.parse(fs.readFileSync(file, "utf8"));
config.prefix = defaultPrefix;
fs.writeFileSync(file, JSON.stringify(config, null, 2));
console.log("✅ Prefix wurde zurückgesetzt auf:", defaultPrefix);