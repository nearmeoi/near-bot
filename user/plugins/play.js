import yts from "yt-search";
import axios from "axios";
import { sendText, sendFancyText, tag, botInfo, consumeRate } from "#helper";

/**
 * @param {import('../types/plugin.js').HandlerParams} params
 */

const BASE_URL = process.env.TUBE_BASE_URL || "https://my4tube.my.id";
const ACCESS_KEY = process.env.TUBE_ACCESS_KEY || "";

function formatDuration(seconds) {
    const min = ~~(seconds / 60);
    const sec = ~~(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
}

async function startDownload(url, format = "audio", quality = "high") {
    try {
        const { data } = await axios.post(`${BASE_URL}/download`,
            { url, format, quality },
            { headers: { "x-access-key": ACCESS_KEY } }
        );

        const taskId = data.taskId;
        let status;

        while (true) {
            const res = await axios.get(`${BASE_URL}/status/${taskId}`, {
                headers: { "x-access-key": ACCESS_KEY },
            });
            status = res.data;
            if (status.status === "done" || status.status === "failed") break;
            await new Promise((r) => setTimeout(r, 3000));
        }

        if (status.status === "done") return status.url;
        else throw new Error("Download gagal ❌");
    } catch (err) {
        console.error("Error:", err.message);
        throw err;
    }
}

async function handler({ sock, m, text, jid, prefix, command }) {
    if (!consumeRate(m.senderId)) return await sendText(sock, jid, '⏳ Terlalu sering, coba lagi nanti.', m)

    if (!text) return await sendText(sock, jid, `halo kak ${tag(m.senderId)}... masukkan judul lagu yang ingin dicari!`);

    try {
        const { all } = await yts(text);
        if (!all?.length) return await sendText(sock, jid, "❌ Lagu tidak ditemukan!");

        const { title, ago, url, views, seconds } = all[0];
        const vid = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
        const thumbnail = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        const duration = formatDuration(seconds);

        const caption = `
[ 🎵 PLAY MUSIC ]

[ 🎧 Judul ] ${title}
[ ⏱ Durasi ] ${duration}
[ 👁 Views ] ${views?.toLocaleString() || "-"}
[ 📅 Upload ] ${ago}
[ 🔗 Link ] ${url}

> 🔄 Mengunduh audio, harap tunggu...`.trim();

        // Mengirim info awal dengan gaya Fancy Text seperti menu
        await sendFancyText(sock, jid, {
            text: caption,
            title: botInfo.dn,
            body: `Sedang memproses lagu...`,
            thumbnailUrlOrBuffer: thumbnail
        });

        // Mulai download audio
        const audioUrl = await startDownload(url, "audio", "");

        await sock.sendMessage(
            jid,
            {
                audio: { url: audioUrl },
                mimetype: "audio/mp4",
                fileName: `${title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: `[ ${title} ]`,
                        body: `Durasi: ${duration}`,
                        thumbnailUrl: thumbnail,
                        sourceUrl: url,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                    },
                },
            },
            { quoted: m }
        );

    } catch (err) {
        console.error(err);
        await sendText(
            sock,
            jid,
            `❌ Terjadi kesalahan saat memproses permintaan.\n> ${err.message || err}`
        );
    }
}

handler.pluginName = 'play youtube'
handler.description = 'mencari dan mengunduh musik dari youtube.\n' +
    'contoh penggunaan:\n' +
    'play rewrite the stars\n' +
    'song die with a smile'

handler.command = ['play', 'song']
handler.category = ['downloader'] // Diubah agar sesuai dengan gaya string array

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'play.js',
    version: '1',
    author: botInfo.an,
    note: 'youtube downloader',
}

export default handler;