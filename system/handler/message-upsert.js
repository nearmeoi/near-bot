// local import
import { getErrorLine, sendText, pluginHelpSerialize, prefixManager, pluginManager, allPath, dirPovCwd, stateManager, userManager, getUserManager, getStore, getBot } from '../helper.js'
import serialize from "../serialize.js";
import consoleMessage from '../console-message.js';
import { Permission } from '../manager-user.js'

// node import
import { fileURLToPath } from "node:url";
import { isJidGroup, isLidUser, isPnUser } from 'baileys';
const lockText = 'bot locked 🔒'
const unlockText = 'bot unlock 🔓✨\nlet\'s play!'
const WITHOUT_CONTEXT_COOLDOWN_MS = 5000
const withoutContextCooldownMap = new Map()

/**
 * @param {import ('baileys').WASocket} sock
 * @param {import('baileys').BaileysEventMap['messages.upsert']} bem
 */



export default async function messageUpsertHandler(sock, bem) {

    const { messages, type } = bem;
    // NOTIFY
    if (type === "notify") {
        // NOTIFY
        for (let i = 0; i < messages.length; i++) {
            const IWMI = messages[i];
            try {

                // message stubtype
                if (IWMI.messageStubType) {
                    console.log('unhandle messageStubType')
                    continue
                }

                // protocol message
                else if (IWMI.message?.protocolMessage) {
                    const protocolType = IWMI.message?.protocolMessage?.type

                    // protocol delete
                    if (protocolType === 0) {
                        console.log(`[protocol] hapus, di hapus oleh ${IWMI.pushName}`)
                        continue
                    }

                    // protocol edit
                    else if (protocolType === 14) {
                        console.log('[protocol] edit todo')
                        continue
                    }

                    // fallback for future notifi protocol handling
                    console.log("[protocol] unhandle");
                    continue
                }

                // empty message
                if (!IWMI.message) {
                    console.log("[empty message]");
                    continue
                }

                // no pushname message
                else if (!IWMI?.pushName) {
                    console.log("[message without pushname]");
                    continue
                }

                // actual notification message

                // [READ USER PERMISSION]
                const user = getUserManager().isAuth(IWMI.key)

                // [BLOCKED JID] return
                if (user.permission === Permission.BLOCKED) {
                    console.log(user.message, userManager.blockedJids.get(user.jid) + ' at ' + (getStore().groupMetadata.get(IWMI.key?.remoteJid)?.subject || IWMI.key.remoteJid) + '\n')
                    continue
                }

                // [SERIALIZE]
                const m = serialize(IWMI)

                const q = m.q
                const mPrint = consoleMessage(m, q, getStore())

                // [PUT YOUR ADDITIONAL MIDDLEWARE HERE (IF ANY)]
                // IN GROUP
                if (isJidGroup(m.chatId)) {
                    const mentionedJid = m.message?.[m.type]?.contextInfo?.mentionedJid
                    const botMentioned = mentionedJid?.some(lid => lid === getBot().lid)

                    // BOT LOCK / UNLOCK 

                    if (/^lock/.test(m.text)) {
                        if (!getUserManager().trustedJids.has(m.senderId)) continue
                        if (!botMentioned) continue
                        if (stateManager.isLocked()) continue
                        stateManager.lock()
                        await sendText(sock, m.chatId, lockText)
                        continue
                    }

                    else if (/^unlock/.test(m.text)) {
                        if (!getUserManager().trustedJids.has(m.senderId)) continue
                        if (!botMentioned) continue
                        if (!stateManager.isLocked()) continue
                        stateManager.unlock()
                        await sendText(sock, m.chatId, unlockText)
                        continue
                    }

                    // AFK
                    else if (mentionedJid?.length) {
                        let afkTriggered = false
                        for (const jid of mentionedJid) {
                            const afkEntry = stateManager.getAfk(m.chatId, jid)
                            if (afkEntry) {
                                await sendText(sock, m.chatId, `lagi afk dia.. katanya lagi ${afkEntry.reason}`, m)
                                stateManager.pushAfkMessage(m.chatId, jid, m)
                                afkTriggered = true
                            }
                        }
                        if (afkTriggered) continue
                    }




                }

                // IN PRIVATE CHAT
                else if (isLidUser(m.chatId)) {
                    // BOT LOCK / UNLOCK 
                    if (/^lock/.test(m.text)) {
                        if (!getUserManager().trustedJids.has(m.senderId)) continue
                        if (stateManager.isLocked()) continue
                        stateManager.lock()
                        await sendText(sock, m.chatId, lockText)
                        continue
                    }

                    else if (/^unlock/.test(m.text)) {
                        if (!getUserManager().trustedJids.has(m.senderId)) continue
                        if (!stateManager.isLocked()) continue
                        stateManager.unlock()
                        await sendText(sock, m.chatId, unlockText)
                        continue
                    }
                }
                // [END OF PUT YOUR ADDITIONAL MIDDLEWARE HERE IF ANY]


                // [USER NOT ALLOWED] return
                if (user.permission === Permission.NOT_ALLOWED) {
                    console.log(`[not allowed] [save db]\n` + mPrint)
                    continue
                }

                // [BUTTON CLICK] — handle button responses (quick_reply buttons)
                if (m.buttonId && !stateManager.isLocked()) {
                    const buttonText = m.buttonId.trim()
                    const { valid, prefix } = prefixManager.isMatchPrefix(buttonText)
                    const textNoPrefix = prefix ? buttonText.slice(prefix.length).trim() : buttonText.trim()
                    const btnCommand = textNoPrefix.split(/\s+/g)?.[0]
                    const btnHandler = pluginManager.plugins.get(btnCommand)

                    if (btnHandler && (valid || btnHandler.config?.bypassPrefix)) {
                        const jid = m.key.remoteJid
                        const text = textNoPrefix.slice(btnCommand.length + 1)
                        try {
                            await btnHandler({ sock, jid, text, m, q, prefix, command: btnCommand, IWMI });
                        } catch (e) {
                            console.error(`[button] plugin fail: ${btnCommand}`, e.message)
                        }
                    } else {
                        console.log(`[button] no handler for: ${buttonText}`)
                    }
                    continue
                }

                if (!m.text) {
                    console.log(`[empty text] [save db]\n` + mPrint)
                    continue
                }

                let handler = null
                let command = null
                try {

                    const { valid, prefix } = prefixManager.isMatchPrefix(m.text)
                    const textNoPrefix = prefix ? m.text.slice(prefix.length).trim() : m.text.trim()
                    command = textNoPrefix.split(/\s+/g)?.[0]


                    handler = pluginManager.plugins.get(command)

                    // Execute command handler first
                    if (handler && !stateManager.isLocked()) {
                        if (valid || handler.config?.bypassPrefix) {
                            const jid = m.key.remoteJid
                            const text = textNoPrefix.slice(command.length + 1)
                            if (text === '-h') {
                                await sendText(sock, m.chatId, pluginHelpSerialize(handler))
                            } else {
                                await handler({ sock, jid, text, m, q, prefix, command, IWMI });
                            }
                            continue // skip withoutContext plugins when command matched
                        }
                    }

                    // Execute withoutContext plugins only if no command matched
                    const uniquePlugins = pluginManager.uniquePlugins
                    const senderJid = m.senderId
                    const now = Date.now()
                    if (!stateManager.isLocked()) {
                        for (const wp of uniquePlugins) {
                            if (wp.config?.withoutContext) {
                                const lastRun = withoutContextCooldownMap.get(senderJid) || 0
                                if (now - lastRun < WITHOUT_CONTEXT_COOLDOWN_MS) {
                                    continue
                                }
                                try {
                                    await wp({ sock, jid: m.key.remoteJid, text: m.text, m, q, prefix, command, IWMI });
                                    withoutContextCooldownMap.set(senderJid, now)
                                } catch (e) {
                                    console.error(`🤯 *[withoutContext plugin fail]* ${wp.pluginName}:`, e.message);
                                }
                            }
                        }
                    }

                } catch (e) {
                    console.error(e.stack)
                    const errorLine = getErrorLine(e.stack) || 'gak tauu..'
                    const print = `🤯 *plugin fail*\n✏️ used command: ${command}\n📄 dir: ${dirPovCwd(handler.dir)}\n🐞 line: ${errorLine}\n✉️ error message:\n${e.message}`
                    await sendText(sock, m.chatId, print, m)
                    continue
                }


                console.log(`[lookup command] [save db]\n` + mPrint)
                continue


            } catch (e) {
                console.error(e);
                console.log(JSON.stringify(IWMI, null, 2));
            } finally {
            }

        }
    }

    // APPEND
    else {
        for (let i = 0; i < messages.length; i++) {
            const IMessage = messages[i];
            try {

                // message stubtype
                if (IMessage.messageStubType) {
                    console.log('[append] unhandle messageStubType')
                    continue
                }

                // protocol message
                else if (IMessage.message?.protocolMessage) {
                    const type = IMessage.message?.protocolMessage?.type

                    // protocol delete
                    if (type === 0) {
                        console.log(`[append] protocol hapus, di hapus oleh ${IMessage.pushName}`)
                        continue
                    }

                    // protocol edit
                    else if (type === 14) {
                        console.log('[append] protocol edit todo')
                        continue
                    }

                    // fallback for future notifi protocol handling
                    console.log("[append] unhandle protocolMessage");
                    continue
                }

                // no pushname message
                else if (!IMessage?.pushName) {
                    console.log("[append] objek tanpa pushname");
                    continue
                }

                // empty message
                if (!IMessage.message) {
                    console.log("[append] objek tanpa message");
                    continue
                }

                // actual notification message

                // filter jid, blocked
                const v = getUserManager().isAuth(IMessage.key)

                if (v.permission === Permission.BLOCKED) {
                    console.log('[append] ' + v.message, userManager.blockedJids.get(v.jid) + ' at ' + (getStore().groupMetadata.get(IMessage.key?.remoteJid)?.subject || IMessage.key.remoteJid) + '\n')
                    continue
                }

                // serialize
                const m = serialize(IMessage)
                const q = m.q
                const mPrint = consoleMessage(m, q, getStore())

                if (v.permission === Permission.NOT_ALLOWED) {

                    console.log(`[append] [not allowed] [save db]\n` + mPrint)
                    continue
                }

                if (!m.text) {

                    console.log(`[append] [empty text] [save db]\n` + mPrint)
                    continue
                }

                console.log(`[append] [lookup command] [save db]\n` + mPrint)
                continue


            } catch (e) {
                console.error(e);
                console.log(JSON.stringify(IMessage, null, 2));
            }
        }
    }

}
