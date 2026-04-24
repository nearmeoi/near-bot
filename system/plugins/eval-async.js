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
                log: (...args) => console.log('[eval-async]', ...args),
                error: (...args) => console.error('[eval-async]', ...args),
            },
            setTimeout, setInterval, clearTimeout, clearInterval,
            Promise, JSON, Math, Date, Array, Object, String, Number,
            Boolean, Map, Set, Buffer, RegExp, Error, TypeError,
            RangeError, isNaN, parseInt, parseFloat,
            require: undefined,
            process: undefined,
        }
        const context = vm.createContext(sandbox)
        const wrappedCode = `(async () => { ${text} })()`
        const script = new vm.Script(wrappedCode, { filename: 'eval-async' })
        let result = script.runInContext(context, { timeout: 15000 })
        if (result instanceof Promise) result = await result
        if (typeof (result) !== 'string') result = util.inspect(result)
        return await sendText(sock, jid, result, mese)
    } catch (e) {
        console.log(e)
        return await sendText(sock, jid, e.message, mese)
    }
}

handler.pluginName = 'eval async'
handler.description = 'eval yang udah di bungkus oleh async function. kalian bisa langsung pakai keyword await, tapi inget return ya. atau nanti hasil akan undefined karena di bungkus di dalam function.'
handler.command = ['!!']
handler.category = ['built-in']

handler.config = {
    systemPlugin: true,
    bypassPrefix: true,
}

handler.meta = {
    fileName: 'eval-async.js',
    version: '1',
    author: botInfo.an,
    note: 'pal pale pale',
}

export default handler