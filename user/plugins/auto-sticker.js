import { downloadMediaMessage } from 'baileys'
import { loadJsonFallbackSync, saveJson, sendText, botInfo } from '#helper'
import fs from 'fs'
import path from 'path'

const dbPath = path.resolve('./user/data/auto-sticker.json')

/**
 * Cek dan Load Database Mappings Sticker
 * Format: { "keyword_text": "path/to/sticker.webp" }
 */
let stickerDb = loadJsonFallbackSync(dbPath, {})
const stickerFolder = path.resolve('./user/data/stickers')

// Pastikan folder untuk simpan gambar exist
if (!fs.existsSync(stickerFolder)) {
    fs.mkdirSync(stickerFolder, { recursive: true })
}

/**
 * @param {import('../types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, jid, text, command, prefix, q }) {

    // 1. ADD STICKER COMMAND
    if (command === 'addstick') {
        if (!text) return await sendText(sock, jid, `❌ *Format Salah*\nFormat: \`${prefix || ''}addstick <keyword>\`\n\n*Catatan*: Pastikan Abang me-reply (mengutip) sebuah pesan sticker saat mengetik command ini!`, m)
        if (!m.q || m.q.type !== 'stickerMessage') return await sendText(sock, jid, `❌ *Error*: Abang harus me-reply sebuah *Sticker*!`, m)

        const keyword = text.trim().toLowerCase()
        const fileName = `${Date.now()}-${keyword.replace(/[^a-z0-9]/g, '')}.webp`
        const filePath = path.join(stickerFolder, fileName)

        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } })

            // Download media sticker dari pesan yang direply (m.q)
            const mediaData = await downloadMediaMessage(
                m.q,
                'buffer',
                {},
                { logger: console }
            )

            // Simpan sticker ke file lokal
            fs.writeFileSync(filePath, mediaData)

            // Update database Map
            stickerDb[keyword] = filePath
            saveJson(stickerDb, dbPath)

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })
            return await sendText(sock, jid, `✅ Sticker berhasil disimpan untuk keyword: *${keyword}*`, m)

        } catch (error) {
            console.error(error)
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } })
            return await sendText(sock, jid, `❌ Gagal menyimpan media sticker:\n${error.message}`, m)
        }
    }


    // 2. AUTO-REPLY STICKER LOGIC
    // Ini berjalan terus-menerus tanpa prefix (bypassPrefix) jika pesan mengandung teks
    if (m.text) {
        const userText = m.text.toLowerCase().trim()

        // Cek apakah kalimat/pesan yang dikirim ada di database sticker
        if (stickerDb[userText]) {
            const getStickerPath = stickerDb[userText]

            // Verifikasi apakah file fisiknya masih ada di server
            if (fs.existsSync(getStickerPath)) {
                return await sock.sendMessage(jid, {
                    sticker: { url: getStickerPath }
                }, { quoted: m })
            } else {
                // File hilang tapi data ada, bersihkan DB otomatis
                delete stickerDb[userText]
                saveJson(stickerDb, dbPath)
            }
        }
    }

}


handler.pluginName = 'auto sticker reply'
handler.description = 'Membuat balasan bot otomatis menggunakan sticker.\n' +
    'Penggunaan:\n' +
    '1. Reply sebuah sticker dengan command: *addstick <kata kunci>*\n' +
    '2. Hapus sticker dari database: *(fitur coming soon)*'

handler.command = ['addstick']
handler.category = ['owner']

handler.config = {
    systemPlugin: false,
    bypassPrefix: true,      // Wajib true agar bot bisa "membaca" semua chat tanpa awalan titik/slash
    withoutContext: true     // Supaya script ini dipanggil setiap ada chat masuk (cocok untuk auto-reply)
}

handler.meta = {
    fileName: 'auto-sticker.js',
    version: '1.0.0',
    author: 'AI Assistant',
    note: 'Listener Auto Sticker'
}

export default handler
