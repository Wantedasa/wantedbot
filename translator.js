import axios from "axios";

export async function translateCommand(sock, msg, args) {
    const targetLang = args[0];
    const text = args.slice(1).join(" ");

    if (!targetLang || !text) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Nutzung: +tr <sprache> <text>\nBeispiel: +tr en Hallo Welt"
        });
    }

    try {
        const res = await axios.post("https://libretranslate.de/translate", {
            q: text,
            source: "auto",
            target: targetLang,
            format: "text"
        }, {
            headers: { "Content-Type": "application/json" }
        });

        const translated = res.data.translatedText;

        await sock.sendMessage(msg.key.remoteJid, {
            text: `🌍 *Übersetzung*\n\n📝 ${text}\n➡️ ${translated}`
        });

    } catch (err) {
        console.error(err);
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Fehler bei der Übersetzung!"
        });
    }
}