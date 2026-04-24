/**
 * Plugin: Broadcast & Group Management
 * ESM, Near Bot format
 * Commands: broadcast, addgroup, removegroup, listgroups
 */

import { sendText } from '#helper'
import { loadGroupSettings, updateGroup, removeGroup, getAllGroupIds } from '../../system/services/group-settings.js'
import { isJidGroup } from 'baileys'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, command }) {
    switch (command) {

        case 'broadcast': {
            if (!text) return sendText(sock, jid, '❌ Format: .broadcast [pesan]', m)
            const groupIds = getAllGroupIds()
            if (groupIds.length === 0) {
                return sendText(sock, jid, '❌ Tidak ada grup terdaftar. Tambahkan dulu dengan .addgroup', m)
            }
            let sukses = 0
            let gagal = 0
            for (const groupId of groupIds) {
                try {
                    const gm = await sock.groupMetadata(groupId)
                    const mentions = gm.participants.map(p => p.id)
                    await sock.sendMessage(groupId, { text, mentions })
                    sukses++
                    await new Promise(r => setTimeout(r, 1500))
                } catch (e) {
                    gagal++
                    console.error(`[BROADCAST] Gagal kirim ke ${groupId}:`, e.message)
                }
            }
            return sendText(sock, jid, `📢 Broadcast selesai!\n✅ Berhasil: ${sukses} grup\n❌ Gagal: ${gagal} grup`, m)
        }

        case 'addgroup': {
            const targetJid = isJidGroup(jid) ? jid : (text?.trim() || null)
            if (!targetJid || !isJidGroup(targetJid)) {
                return sendText(sock, jid, '❌ Jalankan perintah ini di dalam grup, atau: .addgroup [group-jid]', m)
            }
            let name = targetJid
            try {
                const gm = await sock.groupMetadata(targetJid)
                name = gm.subject
            } catch (e) { }
            updateGroup(targetJid, { name, schedulerEnabled: true })
            return sendText(sock, jid, `✅ Grup *${name}* ditambahkan ke daftar broadcast & scheduler.`, m)
        }

        case 'removegroup': {
            const targetJid = isJidGroup(jid) ? jid : (text?.trim() || null)
            if (!targetJid || !isJidGroup(targetJid)) {
                return sendText(sock, jid, '❌ Jalankan perintah ini di dalam grup, atau: .removegroup [group-jid]', m)
            }
            const removed = removeGroup(targetJid)
            return sendText(sock, jid, removed
                ? `✅ Grup berhasil dihapus dari daftar.`
                : `❌ Grup tidak ditemukan dalam daftar.`, m)
        }

        case 'listgroups': {
            const settings = loadGroupSettings()
            const entries = Object.entries(settings)
            if (entries.length === 0) {
                return sendText(sock, jid, '📋 Belum ada grup terdaftar.', m)
            }
            const list = entries.map(([id, c], i) => `${i + 1}. *${c.name || id.split('@')[0]}*\n   ⏰ Scheduler: ${c.schedulerEnabled ? '✅' : '❌'}\n   🕐 TZ: ${c.timezone}`).join('\n\n')
            return sendText(sock, jid, `📋 *Daftar Grup Terdaftar (${entries.length}):*\n\n${list}`, m)
        }
    }
}

handler.pluginName = 'broadcast & group management'
handler.command = ['broadcast', 'addgroup', 'removegroup', 'listgroups']
handler.category = ['admin']
handler.description = 'Broadcast pesan ke semua grup terdaftar & kelola daftar grup.'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'broadcast.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
