/**
 * Plugin: Sticker
 * Port dari absenbot — ESM, Near Bot format
 * Command: s / sticker
 * Reply gambar/video dengan perintah ini untuk jadiin sticker.
 */

import { sendText } from '#helper'
import { StickerTypes, createSticker } from 'wa-sticker-formatter'
import { downloadMediaMessage } from 'baileys'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, q }) {
    const quotedMsg = q?.message

    if (!quotedMsg) {
        return sendText(sock, jid, '❌ Reply gambar atau video dulu, baru ketik .s', m)
    }

    const isImage = q?.type === 'imageMessage'
    const isVideo = q?.type === 'videoMessage'
    const isSticker = q?.type === 'stickerMessage'

    if (!isImage && !isVideo && !isSticker) {
        return sendText(sock, jid, '❌ Format yang didukung: gambar atau video (max 10 detik).', m)
    }

    try {
        // Build a fake WAMessage for download purposes
        const fakeMsg = {
            key: { ...m.key, id: q.key.id },
            message: quotedMsg
        }

        const mediaBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, {
            logger: { info: () => { }, error: () => { } },
            reuploadRequest: sock.updateMediaMessage
        })

        const sticker = await createSticker(mediaBuffer, {
            pack: 'Near Bot',
            author: 'Akmal',
            type: isVideo ? StickerTypes.ANIMATED : StickerTypes.DEFAULT,
            quality: 70,
        })

        await sock.sendMessage(jid, { sticker }, { quoted: m })
    } catch (e) {
        console.error('[PLUGIN:STICKER] Error:', e.message)
        return sendText(sock, jid, `❌ Gagal buat sticker.\nError: ${e.message}`, m)
    }
}

handler.pluginName = 'sticker'
handler.command = ['s', 'sticker']
handler.category = ['media']
handler.description = 'Konversi gambar/video menjadi sticker. Caranya: reply media → .s'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'sticker.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
