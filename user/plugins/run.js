import { downloadContentFromMessage } from 'baileys'
import { sendText, tag, userManager } from '#helper'
import vm from 'node:vm'

async function handler({ sock, m, jid, text }) {
    const isOwner = userManager.trustedJids.has(m.senderId)

    if (!isOwner) {
        await sendText(sock, jid, `Maaf ${tag(m.senderId)}, perintah ini eksklusif cuma buat Owner.`, m)
        return
    }

    if (!m.q) {
        await sendText(sock, jid, 'Lu harus nge-reply file .js atau teks kode dulu bro, baru ketik .run', m)
        return
    }

    let codeToExecute = ''

    try {
        const docMsg = m.q.message?.documentMessage
        if (docMsg) {
            const stream = await downloadContentFromMessage(docMsg, 'document')
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            codeToExecute = buffer.toString('utf-8')
        } else if (m.q.text) {
            codeToExecute = m.q.text
        } else {
            return await sendText(sock, jid, 'Format yang lu reply nggak support. Harus file .js atau teks.', m)
        }

        codeToExecute = codeToExecute.replace(/^```(js|javascript)?|```$/gi, '').trim()

        const sandbox = {
            sock,
            jid,
            m,
            text,
            sendText,
            console: {
                log: (...args) => console.log('[run-sandbox]', ...args),
                error: (...args) => console.error('[run-sandbox]', ...args),
                warn: (...args) => console.warn('[run-sandbox]', ...args),
            },
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,
            Promise,
            JSON,
            Math,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            Map,
            Set,
            Buffer,
            RegExp,
            Error,
            TypeError,
            RangeError,
            isNaN,
            parseInt,
            parseFloat,
        }

        const context = vm.createContext(sandbox)
        const wrappedCode = `(async () => { \n${codeToExecute}\n })()`
        const script = new vm.Script(wrappedCode, { filename: 'run-plugin' })
        await script.runInContext(context, { timeout: 30000 })

    } catch (error) {
        console.error('[Error Run Script]:', error)
        await sendText(sock, jid, `❌ Error pas ngejalanin script lu bro:\n\n${error.message}`, m)
    }
}

handler.pluginName = 'Run Script Engine (CRM)'
handler.description = 'Mengeksekusi script JS dari file atau teks yang di-reply.'
handler.command = ['run', 'eval', 'exec']
handler.category = ['owner', 'tools']

handler.meta = {
    fileName: 'run.js',
    version: '1.0.0',
    author: 'near',
    note: 'Fitur dewa. Memungkinkan owner menyuntikkan payload relayMessage tanpa restart bot.',
}

export default handler