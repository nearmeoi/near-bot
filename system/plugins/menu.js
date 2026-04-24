import { pluginManager, sendText, tag, pickRandom, botInfo, textOnlyMessage } from '../helper.js'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'baileys'

/**
 * @param {import('../types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, q, text, jid, command, prefix }) {
    // return return hm
    if (!textOnlyMessage(m)) return
    if (q) return

    const target = m
    const pc = `${prefix || ''}${command}`
    
    // Siapkan Media Thumbnail
    let media;
    try {
        media = await prepareWAMessageMedia(
            { image: { url: botInfo.tm } },
            { upload: sock.waUploadToServer }
        )
    } catch (e) {
        console.error('Gagal prepare media menu:', e)
    }

    // Jika tidak ada parameter (Menu Utama)
    if (!text) {
        const headerText = `Halo kak ${tag(m.senderId)}\nBerikut kategori plugin yang tersedia:`
        const footerText = `Ketik *${pc} <kategori>* untuk membuka menu.`
        
        const cards = pluginManager.categoryArray.map(cat => ({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `Klik tombol di bawah untuk melihat menu kategori *${cat}*`
            }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: botInfo.st
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                title: `Kategori: ${cat}`,
                hasMediaAttachment: !!media,
                imageMessage: media?.imageMessage
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `Buka Menu ${cat}`,
                            id: `${pc} ${cat}`
                        })
                    }
                ]
            })
        }))

        // Tambahkan kartu "All Menu" di akhir
        cards.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `Lihat semua perintah yang tersedia di ${botInfo.dn}`
            }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: botInfo.st
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                title: `Semua Menu`,
                hasMediaAttachment: !!media,
                imageMessage: media?.imageMessage
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `Tampilkan Semua`,
                            id: `${pc} all`
                        })
                    }
                ]
            })
        })

        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: headerText }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footerText }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false }),
                        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards })
                    })
                }
            }
        }, { userJid: sock.user.id, quoted: target })

        return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
    }

    // Menu All
    if (text === 'all') {
        const content = pluginManager.forMenu.menuAllText
        const footer = `\n\nGunakan param *-h* untuk mengetahui fungsi command.\nContoh: *${pc} -h*`
        
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: content }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: `✨ ${botInfo.dn.toUpperCase()} ALL MENU ✨`,
                            hasMediaAttachment: !!media,
                            imageMessage: media?.imageMessage
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: [{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Kembali ke Menu", id: pc }) }]
                        })
                    })
                }
            }
        }, { userJid: sock.user.id, quoted: target })

        return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
    }

    // Menu Per Kategori
    const validCategory = pluginManager.forMenu.category.get(text)
    if (!validCategory) return sendText(sock, jid, `Maaf kak ${tag(m.senderId)}... menu kategori *${text}* tidak tersedia.`)

    const footer = `\n\nGunakan perintah *-h* untuk fungsi detail.`
    
    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({ text: validCategory }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer }),
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: `KATEGORI: ${text.toUpperCase()}`,
                        hasMediaAttachment: !!media,
                        imageMessage: media?.imageMessage
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons: [{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Menu Utama", id: pc }) }]
                    })
                })
            }
        }
    }, { userJid: sock.user.id, quoted: target })

    return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

handler.pluginName = 'tampilkan menu'
handler.description = 'Tampilkan menu interaktif dengan carousel.'
handler.command = ['smenu']
handler.category = ['built-in']

handler.config = {
    systemPlugin: true,
    bypassPrefix: true
}

handler.meta = {
    fileName: 'menu.js',
    version: '2.0.0',
    author: botInfo.an,
    note: 'Upgrade ke Carousel Menu',
}

export default handler