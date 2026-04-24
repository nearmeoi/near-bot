import { sendText } from '#helper'

/**
 * @param {import('../../system/types/plugin').HandlerParams} params
 */
async function handler({ sock, m, jid }) {
    if (!m.q || !m.q.message) {
        return await sendText(sock, jid, "Reply pesan atau SW yang mau lu copas ke status lu bro!", m)
    }

    try {
        // Biar SW lu bisa diliat, lu harus masukin daftar nomor kontak lu di sini.
        // Formatnya wajib pakai @s.whatsapp.net
        const penontonSW = [
            sock.user.id.split(':')[0] + "@s.whatsapp.net", // Nomor bot
            m.senderId // Nomor lu
            // "628123456xxx@s.whatsapp.net", // Tambahin nomor temen lu yang lain
        ]

        // Jurus copas mentah-mentah ke Status WA
        await sock.sendMessage(
            "status@broadcast", 
            { forward: m.q }, 
            { statusJidList: penontonSW }
        )

        await sendText(sock, jid, "Berhasil maling dan post ulang ke SW!", m)
    } catch (err) {
        console.error('[Error SW Copas]:', err)
        await sendText(sock, jid, `Gagal post ke SW:\n${err.message}`, m)
    }
}

handler.pluginName = 'SW Copas'
handler.description = 'Meneruskan pesan/SW orang lain langsung ke SW kita sendiri.'
handler.command = ['swcopas', 'maling']
handler.category = ['owner']

// INI DIA OBAT PENAWAR ERRORNYA
handler.meta = {
    fileName: "swcopas.js",
    version: "1.0.0",
    author: "near",
    note: "Fitur maling SW ke status bot"
}

export default handler