import { sendText } from '#helper'

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, text, jid }) {
    if (!m.q) {
        await sendText(sock, jid, 'Reply pesan (teks/gambar/video) yang mau dijadikan story grup dulu ya!', m)
        return
    }

    let targetJid = jid
    let customCaption = ''

    // Logika pinter buat misahin JID dan Custom Caption
    if (text) {
        const args = text.split(/\s+/)
        if (args[0].endsWith('@g.us')) {
            targetJid = args[0] // Kata pertama jadi JID
            customCaption = args.slice(1).join(' ') // Sisanya jadi caption
        } else {
            customCaption = text // Kalau ga masukin JID, seluruh teks jadi caption ke grup ini
        }
    }

    if (!targetJid.endsWith('@g.us')) {
        await sendText(sock, jid, 'Format JID grup tidak valid atau ini bukan di dalam grup.', m)
        return
    }

    try {
        // PENTING: Kita nge-CLONE object pesannya pakai JSON parse & stringify
        // Biar kita bisa ngubah captionnya tanpa ngerusak data aslinya di memori bot lu.
        const quotedRaw = JSON.parse(JSON.stringify(m.q.message))

        if (!quotedRaw) {
            await sendText(sock, jid, 'Gagal mengambil data pesan murni. Pastikan kamu me-reply pesan.', m)
            return
        }

        // PROSES INJEKSI CUSTOM CAPTION
        if (customCaption) {
            const msgType = Object.keys(quotedRaw)[0] // Dapet tipe: imageMessage, videoMessage, dll
            
            if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                quotedRaw[msgType].caption = customCaption
            } else if (msgType === 'extendedTextMessage') {
                quotedRaw[msgType].text = customCaption
            } else if (msgType === 'conversation') {
                // Diubah ke extendedTextMessage biar aman pas di-relay
                quotedRaw.extendedTextMessage = { text: customCaption }
                delete quotedRaw.conversation
            }
        }

        // Trik payload GroupStatusMessageV2
        let temp = {
            groupStatusMessageV2: {
                message: quotedRaw
            }
        }

        for (let i = 0; i < 5; i++) {
            temp = {
                groupStatusMessageV2: {
                    message: temp
                }
            }
        }

        await sock.relayMessage(targetJid, temp, {})

        const successMsg = (targetJid !== jid) 
            ? `✅ Berhasil upload story ke grup:\n${targetJid}` 
            : `✅ Berhasil upload story ke grup ini!`
        await sendText(sock, jid, successMsg, m)

    } catch (err) {
        console.error('[SWGC2 ERROR]', err)
        await sendText(sock, jid, 'Gagal: ' + (err.message || 'Terjadi kesalahan saat mengirim'), m)
    }
}

handler.pluginName = 'Story GC V2 (Custom Caption)'
handler.description = 'Upload pesan reply sebagai story ke grup dengan fitur custom caption.'
handler.command = ['swgc2', 'statusgc2', 'storygc2', 'upgc2']
handler.category = ['grup', 'owner'] 

handler.meta = {
    fileName: 'swgc2.js',
    version: '1.0.2',
    author: 'near',
    note: 'Added custom caption injection logic.',
}

export default handler