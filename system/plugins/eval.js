// external import
import * as b from 'baileys'

// local import
import { sendText, botInfo, userManager, store } from '../helper.js'
import * as wa from '../helper.js'

// node import
import fs from 'node:fs'
import crypto from 'node:crypto'
import util from 'node:util'
import vm from 'node:vm'


/**
 * @param {import('../types/plugin.js').HandlerParams} params
 */

async function handler({ sock, m, q, text, jid, command, prefix }) {

    const mese = q || m
    // return return hm
    if (!userManager.trustedJids.has(m.senderId)) return
    try {
        const sandbox = {
            sock, m, q, text, jid, command, prefix,
            b, wa, fs, crypto, util,
            console: {
                log: (...args) => console.log('[eval]', ...args),
                error: (...args) => console.error('[eval]', ...args),
            },
            setTimeout, setInterval, clearTimeout, clearInterval,
            Promise, JSON, Math, Date, Array, Object, String, Number,
            Boolean, Map, Set, Buffer, RegExp, Error, TypeError,
            RangeError, isNaN, parseInt, parseFloat,
            require: undefined,
            process: undefined,
        }
        const context = vm.createContext(sandbox)
        const script = new vm.Script(text, { filename: 'eval' })
        let result = script.runInContext(context, { timeout: 15000 })
        if (result instanceof Promise) result = await result
        if (typeof (result) !== 'string') result = util.inspect(result)
        return await sendText(sock, jid, result, mese)
    } catch (e) {
        console.log(e)
        return await sendText(sock, jid, e.message, mese)

    }
}

handler.pluginName = 'eval'
handler.description = 'eval biasa.. cuma kalau return nya promise otomatis di await. be careful'
handler.command = ['!']
handler.category = ['built-in']

handler.config = {
    systemPlugin: true,
    bypassPrefix: true,
}

handler.meta = {
    fileName: 'eval.js',
    version: '1',
    author: botInfo.an,
    note: 'debag debug',
}

export default handler