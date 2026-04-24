
/**
 * @param {import ('baileys').WASocket} sock
 * @param {import('baileys').BaileysEventMap['presence.update']} bem
 */

import { sendText, tag, msToReadableTime, stateManager } from '../helper.js'

export default async function presenceUpdate(sock, bem) {
    const { id, presences } = bem
    const userLid = Object.keys(presences || {})?.[0]
    const afk = stateManager.getAfk(id, userLid)
    if (afk) {
        const now = Date.now()
        const content = afk.IMessage.map(m => `✉️ dari: ${tag(m.senderId)} - ${msToReadableTime(now - (m.timestamp * 1000))} yang lalu. \n${m.text}`).join('\n\n')
        const header1 = `${tag(userLid)} kembali dari ${afk.reason} selama ${msToReadableTime(now - afk.time)}`
        const header2 = `welcome back ${tag(userLid)} udah selesai ${afk.reason}nya? selama kamu pergi.. ada yang tag kamu.`
        const print = content ? `${header2}\n\n${content}` : `${header1}`
        stateManager.deleteAfk(id)
        await sendText(sock, id, print)
    }
}