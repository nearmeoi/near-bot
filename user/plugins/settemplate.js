/**
 * Plugin: Set Template
 * Simpan template default laporan absensi per user
 * Command: settemplate [template teks]
 */

import { sendText } from '#helper'
import { findUser, updateUser } from '../../system/services/user-registry.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, command }) {
    if (command !== 'settemplate') return

    const senderId = m.senderId
    const user = findUser(senderId)

    if (!user) {
        return sendText(sock, jid, '❌ Kamu belum terdaftar. Ketik .daftar [email] [password]', m)
    }

    // Show current template if no text
    if (!text) {
        const current = user.template
        if (current) {
            return sendText(sock, jid, `📝 *Template kamu saat ini:*\n\n${current}\n\n---\n_Ubah dengan: .settemplate [teks baru]\nHapus dengan: .settemplate clear_`, m)
        } else {
            return sendText(sock, jid, `📝 Kamu belum punya template.\n\nSimpan template default agar saat ketik .absen tanpa cerita, template ini otomatis dipakai.\n\n*.settemplate [teks]*\nContoh:\n.settemplate Mengerjakan tugas harian sesuai SOP divisi dan koordinasi dengan tim.`, m)
        }
    }

    // Clear template
    if (text.trim().toLowerCase() === 'clear') {
        updateUser(senderId, { template: null })
        return sendText(sock, jid, '✅ Template berhasil dihapus.', m)
    }

    // Save template
    if (text.trim().length < 30) {
        return sendText(sock, jid, '❌ Template terlalu pendek (min 30 karakter). Template harus berisi deskripsi kegiatan default.', m)
    }

    updateUser(senderId, { template: text.trim() })
    return sendText(sock, jid, `✅ *Template disimpan!*\n\n${text.trim()}\n\n_Ketik .absen untuk generate laporan berdasarkan template ini._`, m)
}

handler.pluginName = 'set template'
handler.command = ['settemplate']
handler.category = ['magang']
handler.description = 'Simpan template default untuk laporan absensi. Format: .settemplate [teks]'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'settemplate.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
