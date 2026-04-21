import { Sticker, StickerTypes } from 'wa-sticker-formatter';
//import { downloadContentFromMessage } from '@angstvorfrauen/baileys';

export default async function ({ message, sock, event, config }) {
    const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const msg = event.message?.imageMessage || 
                event.message?.videoMessage || 
                quoted?.imageMessage || 
                quoted?.videoMessage;

    if (!msg) return message.reply("✕ Markiere ein Bild oder Video mit @sticker!");

    await message.reply("⏳ Sticker wird erstellt...");

    try {
        const type = (event.message?.imageMessage || quoted?.imageMessage) ? 'image' : 'video';

        const stream = await downloadContentFromMessage(msg, type);
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const sticker = new Sticker(buffer, {
            pack: config.botName || "My Pack",
            author: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
            type: StickerTypes.FULL,
            categories: ['🤩', '🎉'],
            id: '12345',
            quality: 70,
        });

        const stickerBuffer = await sticker.toBuffer();

        await sock.sendMessage(
            message.threadID,
            { sticker: stickerBuffer },
            { quoted: event }
        );

    } catch (e) {
        console.error(e);
        message.reply("✕ Fehler beim Erstellen des Stickers. Vielleicht ist das Video zu lang?");
    }
}