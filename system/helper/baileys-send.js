import { vString } from './general-helper.js'


export async function sendText(sock, jid, text, replyTo) {
    vString(jid, "param jid")
    vString(text, "param text")
    return await sock.sendMessage(jid, { text }, { quoted: replyTo })
}

export async function editText(sock, jid, m, text) {
    vString(jid, "param jid")
    vString(text, "param text")
    return await sock.sendMessage(jid, {
        text,
        edit: m.key
    })
}

// thumbnail
export async function sendFancyText(sock, jid, opts = {thumbnailUrlOrBuffer, renderLargerThumbnail, title, body, text, replyTo}) {
    vString(jid, "param jid")

    const {
        thumbnailUrlOrBuffer = 'https://i.pinimg.com/736x/8e/29/53/8e29535aa9736adb61ec89d47f59ea5e.jpg',
        renderLargerThumbnail = true,
        title = 'title',
        body = 'subtitle',
        text = 'message',
    } = opts


    // resolve (thumbnail)

    let thumbnailContent = {}
    if (Buffer.isBuffer(thumbnailUrlOrBuffer)) {
        thumbnailContent = { thumbnail: thumbnailUrlOrBuffer }
    } else {
        const url = thumbnailUrlOrBuffer
        thumbnailContent = { thumbnailUrl: url }
    }

    let externalAdReply = {
        title,
        body,
        mediaType: 1,
        renderLargerThumbnail,
    }

    externalAdReply = Object.assign(externalAdReply, thumbnailContent)

    return await sock.sendMessage(jid, {
        text: text,
        contextInfo: { externalAdReply }
    }, { quoted: opts?.replyTo })
}


function reviveBuffers(obj) {
    if (obj && typeof obj === 'object') {
        if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
            return Buffer.from(obj.data)
        }
        for (let k in obj) {
            obj[k] = reviveBuffers(obj[k])
        }
    }
    return obj
}

export async function sendQuickReplyButton(sock, jid, opts = {}) {
    const { bodyText, footerText = 'Near Bot', buttons = [], quotedMsg = null } = opts

    vString(jid, 'jid')
    vString(bodyText, 'bodyText')

    const rawContent = {
        interactiveMessage: {
            body: { text: bodyText },
            footer: { text: footerText },
            nativeFlowMessage: {
                buttons: buttons.map(btn => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.displayText,
                        id: btn.id
                    })
                }))
            }
        }
    }

    const content = reviveBuffers(rawContent)
    const messageId = "KGY" + Date.now()

    await sock.relayMessage(jid, content, {
        messageId,
        additionalNodes: [
            {
                tag: "biz",
                attrs: {},
                content: [
                    {
                        tag: "interactive",
                        attrs: { type: "native_flow", v: "1" },
                        content: [
                            { tag: "native_flow", attrs: { v: "9", name: "mixed" } }
                        ]
                    }
                ]
            }
        ]
    })

    return messageId
}