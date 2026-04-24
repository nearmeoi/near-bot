import yts from 'yt-search'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'baileys'
import { sendText } from '#helper'

async function handler({ sock, m, text, jid }) {
    const target = m.q || m
    let query = text?.trim()

    if (!query && m.q) {
        query = (m.q.text || m.q.caption || m.q.body || '').trim()
    }

    if (!query) {
        return await sendText(sock, jid, 'Enter search keyword or reply to a message.', m)
    }

    try {
        const search = await yts(query)
        const videos = search.videos.slice(0, 10)

        if (!videos.length) {
            return await sendText(sock, jid, 'No results found.', target)
        }

        const cards = []

        for (const item of videos) {
            try {
                const media = await prepareWAMessageMedia(
                    { image: { url: item.thumbnail } },
                    { upload: sock.waUploadToServer }
                )

                cards.push({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: `\`\`\`Title: ${item.title}
Channel: ${item.author?.name || '-'}
Duration: ${item.timestamp || '-'}
Views: ${item.views?.toLocaleString() || '-'}
Uploaded: ${item.ago || '-'}\`\`\``
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: item.author?.name || 'YouTube'
                    }),
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: item.title,
                        hasMediaAttachment: true,
                        imageMessage: media.imageMessage
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons: [
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Watch on YT",
                                    url: item.url,
                                    merchant_url: item.url
                                })
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Video",
                                    id: `ytv ${item.url}`
                                })
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Audio",
                                    id: `yta ${item.url}`
                                })
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Lyrics",
                                    id: `lyrics ${query}`
                                })
                            }
                        ]
                    })
                })
            } catch {}
        }

        const msg = generateWAMessageFromContent(
            jid,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: `\`\`\`Result for: ${query}\`\`\``
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: `\`\`\`Find ur fav vids\`\`\``
                            }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                hasMediaAttachment: false
                            }),
                            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                                cards: cards
                            })
                        })
                    }
                }
            },
            { userJid: sock.user.id, quoted: target }
        )

        await sock.relayMessage(jid, msg.message, { 
            messageId: msg.key.id,
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

    } catch (error) {
        await sendText(sock, jid, `Error occurred: ${error.message}`, target)
    }
}

handler.pluginName = 'YouTube Search'
handler.command = ['yts']
handler.category = ['search']
handler.description = `Search YouTube videos using yt-search library and display results in carousel.`
handler.meta = {
    fileName: 'search-youtube.js'
}

export default handler