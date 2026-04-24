
import { getContentType, normalizeMessageContent } from 'baileys'
import { getStore, getBot } from './shared-state.js'

export default function (WAMessage) {
    if (!WAMessage?.message) return null

    // normalize message
    const WAMessageContent = normalizeMessageContent(WAMessage.message)

    // m.chatId
    const chatId = WAMessage.key.remoteJid
    // m.senderId
    const senderId = WAMessage.key.participant || (WAMessage.key.fromMe ? getBot().lid : WAMessage.key.remoteJid)
    // m.pushName
    const pushName = WAMessage.pushName
    // m.type
    const type = getContentType(WAMessageContent)
    // m.text
    const text =
        // human
        WAMessageContent?.conversation || // text 
        WAMessageContent?.[type]?.text || // teks hyperlink, thumbnail dll
        WAMessageContent?.[type]?.caption || // gambar, video
        null

    // m.timestamp
    const timestamp = WAMessage.messageTimestamp

    // m.messageId
    const messageId = WAMessage.key.id

    // m.buttonId & m.buttonText (from buttonsResponseMessage)
    const buttonId = WAMessageContent?.buttonsResponseMessage?.selectedButtonId || null
    const buttonText = WAMessageContent?.buttonsResponseMessage?.selectedDisplayText || null

    const result = {
        chatId,
        senderId,
        pushName,
        type,
        text,
        messageId,
        timestamp,
        buttonId,
        buttonText
    }

    // m.key <-> jadi define property
    Object.defineProperty(result, 'key', {
        get() { return WAMessage.key },
        enumerable: true
    })

    // mese <-> jadi define property
    Object.defineProperty(result, 'message', {
        get() { return WAMessageContent },
        enumerable: true
    })

    // m.q <-> jadi define property
    Object.defineProperty(result, 'q', {
        get() {
            const qctx = WAMessageContent?.[type]?.contextInfo
            const q_iMessage = normalizeMessageContent(qctx?.quotedMessage)
            if (!q_iMessage) return undefined

            let q = {}
            // m.q.type
            const q_type = getContentType(q_iMessage)
            // m.q.text
            const q_text =
                // human
                q_iMessage?.conversation ||  // text
                q_iMessage?.[q_type]?.text ||  // text, thumbnail, url dll
                q_iMessage?.[q_type]?.caption || // gambar, video
                // bot
                q_iMessage?.[q_type]?.body?.text || // interactiveMessage
                null

            // m.q.sender
            let q_senderId = qctx?.participant?.endsWith('@s.whatsapp.net') ? senderId : (qctx?.participant || senderId)
            // m.q.pushName
            const q_pushName = getStore().contacts.get(q_senderId)?.notify || null
            q = {
                chatId: WAMessage.key.remoteJid,
                senderId: q_senderId,
                pushName: q_pushName,
                type: q_type,
                text: q_text,
            }
            // m.q.key <-> jadi define property
            Object.defineProperty(q, 'key', {
                get() {
                    const q_key = {
                        remoteJid: q_iMessage ? WAMessage.key.remoteJid : null,
                        id: qctx?.stanzaId || null,
                        participant: qctx?.participant || null,
                        fromMe: getBot().lid === qctx?.participant || getBot().pn === qctx?.participant
                    }
                    return q_key
                },
                enumerable: true
            })
            // m.q.message <-> jadi define property
            Object.defineProperty(q, 'message', {
                get() { return q_iMessage },
                enumerable: true
            })

            return q
        },
        enumerable: true
    })

    return result
}