/**
 * Plugin: Admin Group Controls
 * Port dari absenbot — ESM, Near Bot format
 * Commands: kick, promote, demote, mute, unmute, revoke, linkgrup
 */

import { sendText } from '#helper'
import { isJidGroup } from 'baileys'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, q, command }) {
    if (!isJidGroup(jid)) {
        return sendText(sock, jid, '❌ Perintah ini hanya bisa digunakan di grup.', m)
    }

    // Check if bot is admin
    const gm = await sock.groupMetadata(jid)
    const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'
    const botLid = sock.user?.id
    const botParticipant = gm.participants.find(p => p.id === botId || p.id === botLid)

    if (!botParticipant || !botParticipant.admin) {
        return sendText(sock, jid, '❌ Bot bukan admin di grup ini.', m)
    }

    // Find the target user (from mention or reply)
    const mentionedJids = m.message?.[m.type]?.contextInfo?.mentionedJid || []
    const targetId = q?.senderId || mentionedJids[0]

    switch (command) {
        case 'kick': {
            if (!targetId) return sendText(sock, jid, '❌ Mention atau reply user yang mau di-kick.', m)
            await sock.groupParticipantsUpdate(jid, [targetId], 'remove')
            await sendText(sock, jid, `✅ Berhasil mengeluarkan @${targetId.split('@')[0]} dari grup.`, m)
            break
        }

        case 'promote': {
            if (!targetId) return sendText(sock, jid, '❌ Mention atau reply user yang mau di-promote.', m)
            await sock.groupParticipantsUpdate(jid, [targetId], 'promote')
            await sendText(sock, jid, `✅ @${targetId.split('@')[0]} sekarang menjadi admin.`, m)
            break
        }

        case 'demote': {
            if (!targetId) return sendText(sock, jid, '❌ Mention atau reply user yang mau di-demote.', m)
            await sock.groupParticipantsUpdate(jid, [targetId], 'demote')
            await sendText(sock, jid, `✅ @${targetId.split('@')[0]} sudah bukan admin.`, m)
            break
        }

        case 'mute': {
            await sock.groupSettingUpdate(jid, 'announcement')
            await sendText(sock, jid, '🔇 Grup di-mute. Hanya admin yang bisa mengirim pesan.', m)
            break
        }

        case 'unmute': {
            await sock.groupSettingUpdate(jid, 'not_announcement')
            await sendText(sock, jid, '🔊 Grup di-unmute. Semua anggota bisa mengirim pesan.', m)
            break
        }

        case 'revoke':
        case 'linkgrup': {
            if (command === 'revoke') {
                await sock.groupRevokeInvite(jid)
                await sendText(sock, jid, '🔗 Link grup lama sudah di-revoke. Minta link baru dengan .linkgrup', m)
            } else {
                const code = await sock.groupInviteCode(jid)
                await sendText(sock, jid, `🔗 *Link Grup:*\nhttps://chat.whatsapp.com/${code}`, m)
            }
            break
        }

        default:
            await sendText(sock, jid, '❌ Perintah tidak dikenali.', m)
    }
}

handler.pluginName = 'admin group'
handler.command = ['kick', 'promote', 'demote', 'mute', 'unmute', 'revoke', 'linkgrup']
handler.category = ['admin']
handler.description = 'Kelola anggota & pengaturan grup. (Bot harus jadi admin)'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'admin-group.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
