/**
 * Plugin: List User (Admin)
 * Tampilkan daftar semua user terdaftar
 * Command: listuser
 */

import { sendText } from '#helper'
import { getUsers } from '../../system/services/user-registry.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m }) {
    const users = getUsers()

    if (users.length === 0) {
        return sendText(sock, jid, '📋 Belum ada user terdaftar.', m)
    }

    const list = users.map((u, i) => {
        const name = u.name || u.email?.split('@')[0] || 'Unknown'
        const phone = u.phone?.split('@')[0] || '-'
        const cycleDay = u.cycle_day ? `Batch ${u.cycle_day === 16 ? '3' : '2'}` : '-'
        return `${i + 1}. *${name}*\n   📞 ${phone} | 📅 ${cycleDay}`
    }).join('\n\n')

    return sendText(sock, jid, `👥 *DAFTAR USER TERDAFTAR (${users.length})*\n${'━'.repeat(28)}\n\n${list}`, m)
}

handler.pluginName = 'list user'
handler.command = ['listuser', 'daftaruser']
handler.category = ['admin', 'magang']
handler.description = 'Tampilkan semua user yang terdaftar di bot.'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'listuser.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
