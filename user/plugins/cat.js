import { textOnlyMessage, sendText } from '#helper'
// Pastikan import downloadContentFromMessage sesuai dengan bawaan library yang lu pake
import { downloadContentFromMessage } from 'baileys' 
import fs from 'fs'
import path from 'path'

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, text, jid }) {
    // SKENARIO 1: Membaca file document dari WhatsApp (Reply File)
    if (m.q && m.q.type === 'documentMessage') {
        try {
            const documentMessage = m.q.message.documentMessage
            const stream = await downloadContentFromMessage(documentMessage, 'document')
            
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            const fileContent = buffer.toString('utf-8')

            if (fileContent.length > 10000) {
                return await sendText(sock, jid, `Isi dokumennya kepanjangan bro (lebih dari 10k karakter). WA bisa nge-lag.`, m)
            }

            // TAMPILKAN RAW MESSAGE POLOSAN
            return await sendText(sock, jid, fileContent, m)
            
        } catch (error) {
            console.error('[Error Cat Document]:', error)
            return await sendText(sock, jid, `Gagal ngebaca dokumen dari WA nih.`, m)
        }
    }

    // SKENARIO 2: Membaca file plugin lokal (Cek folder user/plugins)
    if (text) {
        const fileName = text.trim().endsWith('.js') ? text.trim() : `${text.trim()}.js`
        const filePath = path.join(process.cwd(), 'user', 'plugins', fileName) 

        try {
            if (!fs.existsSync(filePath)) {
                return await sendText(sock, jid, `File *${fileName}* nggak ketemu di folder plugins lu. Coba cek lagi pakai command ls.`, m)
            }

            const fileContent = fs.readFileSync(filePath, 'utf-8')

            if (fileContent.length > 10000) {
                return await sendText(sock, jid, `Kodenya kepanjangan (lebih dari 10k karakter). Mending buka di VSCode aja.`, m)
            }

            // TAMPILKAN RAW MESSAGE POLOSAN
            return await sendText(sock, jid, fileContent, m)

        } catch (error) {
            console.error('[Error Cat Local File]:', error)
            return await sendText(sock, jid, `Gagal ngebaca file plugin. Cek terminal ya.`, m)
        }
    }

    // SKENARIO 3: Kalau user cuma ngetik 'cat' doang tanpa reply dan tanpa nama file
    await sendText(sock, jid, `Cara pake command *cat*:\n1. Reply file dokumen/kode di chat, ketik *cat*\n2. Atau ketik nama file lokal lu, misal: *cat absen*`, m)
}

handler.pluginName = 'Super Cat (Read File & Plugin)'
handler.description = 'Membaca file dari reply WA atau source code plugin lokal.'
handler.command = ['cat']
handler.category = ['owner', 'tools'] 

handler.meta = {
    fileName: 'cat.js',
    version: '2.0.2',
    author: 'near',
    note: 'Output raw text polosan tanpa format code block.',
}

export default handler