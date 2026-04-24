import {
    pluginManager,
    sendText,
    tag,
    pickRandom,
    botInfo,
    textOnlyMessage
} from '#helper'
import { prepareWAMessageMedia } from 'baileys'

/**
 * Menu Plugin - Near Bot Style using Raw Relay Message
 */

const uintToB64 = u => Buffer.from(u).toString('base64')

async function handler({ sock, m, text, jid, command, prefix }) {

    if (!textOnlyMessage(m)) return

    const pc = `${prefix || ''}${command}`
    const urlLink = "https://github.com/nearmeoi/near-bot"
    
    // Greeting
    const hour = new Date().getHours()
    const ucapan = hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam'
    const titleText = `selamat ${ucapan} ${botInfo.an || 'kak'}`

    // 1. DYNAMIC MEDIA UPLOAD (Mendapatkan mediaKey, directPath, dll dari !tm)
    let mediaData = {}
    let faviconData = {}
    
    try {
        // Upload main thumbnail
        const mainMedia = await prepareWAMessageMedia(
            { image: { url: botInfo.tm } },
            { upload: sock.waUploadToServer, mediaTypeOverride: "thumbnail-link" }
        )
        const i = mainMedia.imageMessage
        
        if (i) {
            mediaData = {
                jpegThumbnail: i.jpegThumbnail ? uintToB64(i.jpegThumbnail) : "",
                thumbnailDirectPath: i.directPath,
                thumbnailSha256: uintToB64(i.fileSha256),
                thumbnailEncSha256: uintToB64(i.fileEncSha256),
                mediaKey: uintToB64(i.mediaKey),
                mediaKeyTimestamp: Math.floor(Date.now() / 1000),
                thumbnailHeight: i.height,
                thumbnailWidth: i.width
            }

            // Generate Favicon (Small version)
            faviconData = {
                thumbnailDirectPath: i.directPath,
                thumbnailSha256: uintToB64(i.fileSha256),
                thumbnailEncSha256: uintToB64(i.fileEncSha256),
                mediaKey: uintToB64(i.mediaKey),
                thumbnailHeight: 64,
                thumbnailWidth: 64
            }
        }
    } catch (e) {
        console.error('[MENU] Gagal generate media metadata:', e.message)
    }

    const sendNearBotMenu = async (bodyText, title) => {
        return await sock.relayMessage(jid, {
            extendedTextMessage: {
                text: `${urlLink}\n\n${bodyText}`,
                matchedText: urlLink,
                description: "mau main apa? silakan cek menu di bawah",
                title: title,
                previewType: 0,
                ...mediaData,
                inviteLinkGroupTypeV2: 0,
                faviconMMSMetadata: faviconData,
                contextInfo: {
                    mentionedJid: [m.senderId],
                    remoteJid: m.chatId
                }
            }
        }, {})
    }

    // 1. MAIN MENU (CATEGORIES)
    if (!text) {
        const header = `daftar menu\n\n`
        const content = pluginManager.forMenu.menuText
        const footer = `\n\nketik *${pc} all* untuk melihat semua menu.`
        
        return await sendNearBotMenu(header + content + footer, titleText)
    }

    // 2. MENU ALL
    if (text === 'all') {
        const content = pluginManager.forMenu.menuAllText
        return await sendNearBotMenu(content, titleText)
    }

    // 3. SUB-MENU
    const validCategory = pluginManager.forMenu.category.get(text)
    if (!validCategory) return sendText(sock, jid, `maaf kak ${tag(m.senderId)}... kategori *${text}* tidak tersedia`, m)

    return await sendNearBotMenu(validCategory, `${botInfo.dn} - ${text.toUpperCase()}`)
}

handler.pluginName = 'tampilkan menu'
handler.command = ['menu']
handler.category = ['built-in']

handler.config = {
    systemPlugin: true,
    bypassPrefix: true
}

handler.meta = {
    fileName: 'main-menu.js',
    version: '3.8.0',
    author: botInfo.an,
    note: 'Near Bot Style using Raw Relay Message & Dynamic Media Discovery',
}

export default handler