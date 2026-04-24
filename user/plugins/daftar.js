/**
 * Plugin: Daftar
 * Registrasi akun Kemnaker ke bot
 * Command: daftar [email] [password]
 */

import { sendText } from '#helper'
import { directLogin } from '../../system/services/magang-api.js'
import { addUser, findUserByEmail, findUser } from '../../system/services/user-registry.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text }) {
    const senderId = m.senderId
    if (!text) {
        return sendText(sock, jid, `📋 *CARA DAFTAR*\n\nKetik:\n.daftar [email] [password]\n\nContoh:\n.daftar nama@gmail.com password123\n\n_Pesan ini akan dihapus otomatis untuk keamanan._`, m)
    }

    const parts = text.trim().split(/\s+/)
    if (parts.length < 2) {
        return sendText(sock, jid, '❌ Format salah. Contoh: .daftar email@gmail.com password123', m)
    }

    const [email, password] = parts

    // Check if already registered by email or sender JID
    const existing = findUser(senderId) || findUserByEmail(email)
    if (existing) {
        const name = existing.name || email.split('@')[0]
        return sendText(sock, jid, `⚠️ *${name}* sudah terdaftar di bot!\n\nLangsung ketik *.cek* untuk cek status absensi.`, m)
    }

    await sendText(sock, jid, '🔐 Sedang memverifikasi akun ke Kemnaker...', m)

    const loginResult = await directLogin(email, password)
    if (!loginResult.success) {
        return sendText(sock, jid, `❌ Login gagal: ${loginResult.pesan}\n\nPastikan email dan password kamu benar.`, m)
    }

    // Save via centralized registry (auto-normalizes phone format)
    const { user, isNew } = addUser({
        phone: senderId,
        email,
        password
    })

    if (!isNew) {
        return sendText(sock, jid, `⚠️ User sudah terdaftar (email: ${user.email}). Ketik *.cek* untuk cek status.`, m)
    }

    return sendText(sock, jid, `✅ *Berhasil Terdaftar!*\n\nEmail: ${email}\nLogin ke Kemnaker: ${loginResult.sso_completed ? 'Full ✅' : 'Partial ✅'}\n\nSekarang kamu bisa:\n• *.cek* — cek status absensi\n• *.absen [cerita]* — kirim laporan absensi\n• *.riwayat* — lihat riwayat absensi\n• *.cekapprove* — lihat status approval`, m)
}

handler.pluginName = 'daftar magang'
handler.command = ['daftar']
handler.category = ['magang']
handler.description = 'Daftarkan akun Kemnaker ke bot. Format: .daftar [email] [password]'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'daftar.js',
    version: '2.0.0',
    author: 'Akmal'
}

export default handler
