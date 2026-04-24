import { sendText } from '#helper'

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, jid }) { // <-- Udah dibenerin pake jid
    // Cek apakah lu nge-reply sebuah pesan
    if (!m.q) {
        await sendText(sock, jid, 'Reply pesan dari gue (bot) yang mau dihapus/ditarik bro.', m)
        return
    }

    // Ambil "key" dari pesan yang di-reply (hasil dari serialize.js lu)
    const messageKey = m.q.key

    try {
        // Tembak command delete for everyone bawaan Baileys
        await sock.sendMessage(jid, { delete: messageKey })
        
    } catch (error) {
        console.error('[Error Delete Message]:', error)
        await sendText(sock, jid, 'Waduh, gagal narik pesan nih. Pastiin pesannya emang dikirim sama bot ya.', m)
    }
}

handler.pluginName = 'Delete Pesan'
handler.description = 'Menarik/menghapus pesan bot (termasuk SWGC).'
handler.command = ['del', 'd']
handler.category = ['owner', 'tools']

handler.meta = {
    fileName: 'del.js',
    version: '1.0.1',
    author: 'near',
    note: 'Fixed parameter jid.',
}

export default handler
