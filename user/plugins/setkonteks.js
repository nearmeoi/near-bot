/**
 * Plugin: Set Konteks
 * Simpan konteks/persona user agar AI menghasilkan laporan yang lebih akurat
 * Command: setkonteks [deskripsi diri & pekerjaan]
 */

import { sendText } from '#helper'
import { findUser, updateUser } from '../../system/services/user-registry.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, command }) {
    if (command !== 'setkonteks') return

    const senderId = m.senderId
    const user = findUser(senderId)

    if (!user) {
        return sendText(sock, jid, '❌ Kamu belum terdaftar. Ketik .daftar [email] [password]', m)
    }

    // Show current context if no text
    if (!text) {
        const current = user.context
        if (current) {
            return sendText(sock, jid, `🧠 *Konteks kamu saat ini:*\n\n${current}\n\n---\n_Ubah dengan: .setkonteks [teks baru]\nHapus dengan: .setkonteks clear_`, m)
        } else {
            return sendText(sock, jid, `🧠 Kamu belum punya konteks.\n\nKonteks membantu AI menulis laporan yang lebih akurat sesuai pekerjaanmu.\n\n*.setkonteks [teks]*\nContoh:\n.setkonteks Saya magang di bagian IT sebagai web developer. Fokus pada pengembangan sistem informasi dan debugging aplikasi.`, m)
        }
    }

    // Clear context
    if (text.trim().toLowerCase() === 'clear') {
        updateUser(senderId, { context: null })
        return sendText(sock, jid, '✅ Konteks berhasil dihapus.', m)
    }

    // Save context
    if (text.trim().length < 15) {
        return sendText(sock, jid, '❌ Konteks terlalu pendek (min 15 karakter). Jelaskan posisi dan fokus magang kamu.', m)
    }

    updateUser(senderId, { context: text.trim() })
    return sendText(sock, jid, `✅ *Konteks disimpan!*\n\n${text.trim()}\n\n_AI akan menggunakan konteks ini saat generate laporan absensi._`, m)
}

handler.pluginName = 'set konteks'
handler.command = ['setkonteks']
handler.category = ['magang']
handler.description = 'Simpan konteks magang untuk personalisasi AI. Format: .setkonteks [deskripsi]'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'setkonteks.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
