/**
 * Plugin: Riwayat Absensi
 * Lihat riwayat absensi N hari terakhir
 * Command: riwayat [jumlah_hari]
 */

import { sendText } from '#helper'
import { getAttendanceHistory } from '../../system/services/magang-api.js'
import { findUser } from '../../system/services/user-registry.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text }) {
    const senderId = m.senderId
    const user = findUser(senderId)

    if (!user) {
        return sendText(sock, jid, '❌ Kamu belum terdaftar. Ketik .daftar [email] [password]', m)
    }

    let days = 3
    if (text && !isNaN(parseInt(text))) {
        days = Math.min(Math.max(parseInt(text), 1), 10)
    }

    await sendText(sock, jid, `🔍 Mengambil riwayat ${days} hari terakhir...`, m)

    const result = await getAttendanceHistory(user.email, user.password, days)

    if (!result.success || !result.logs?.length) {
        return sendText(sock, jid, `❌ Gagal ambil riwayat: ${result.pesan || 'Tidak ada data'}`, m)
    }

    let historyText = `📊 *RIWAYAT ABSENSI (${days} hari)*\n`

    result.logs.forEach(log => {
        historyText += `\n━━━━━━━━━━━━━━━━━━\n`
        historyText += `📅 *${log.date}*\n`
        if (!log.activity_log) {
            historyText += `_Tidak ada log absensi_\n`
        } else {
            historyText += `\n*Aktivitas:*\n${log.activity_log}\n`
            if (log.lesson_learned) historyText += `\n*Pembelajaran:*\n${log.lesson_learned}\n`
            if (log.obstacles) historyText += `\n*Kendala:*\n${log.obstacles}\n`
            if (log.approval_status) historyText += `\n*Status:* ${log.approval_status}\n`
        }
    })

    // Send to DM if in group
    const isGroup = jid.endsWith('@g.us')
    if (isGroup) {
        await sendText(sock, jid, '📨 Riwayat absensi sudah dikirim ke DM kamu.', m)
        return sendText(sock, senderId, historyText)
    }
    return sendText(sock, jid, historyText, m)
}

handler.pluginName = 'riwayat absen'
handler.command = ['riwayat', 'history']
handler.category = ['magang']
handler.description = 'Lihat riwayat absensi. Format: .riwayat [jumlah_hari] (default: 3)'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'riwayat.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
