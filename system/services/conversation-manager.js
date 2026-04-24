/**
 * Conversation Memory Engine — Near Bot
 * Ported from absenbot with ESM conversion.
 * Manages per-chat context and short-term history for AI conversations.
 */

// Storage: Key = remoteJid, Value = Session Object
const sessions = new Map()

const MAX_SHORT_TERM = 12           // Keep last 12 messages
const SESSION_TTL_MS = 24 * 60 * 60 * 1000   // 24 Hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000   // Cleanup every 1 hour

/**
 * Get or Create Session
 * @param {string} remoteJid
 * @returns {object}
 */
export function getSession(remoteJid) {
    if (!sessions.has(remoteJid)) {
        sessions.set(remoteJid, {
            shortTerm: [],
            coreMemory: [],
            topic: '',
            lastActive: Date.now()
        })
    }
    return sessions.get(remoteJid)
}

/**
 * Add Message to Memory
 * @param {string} remoteJid
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
export function addMessage(remoteJid, role, content) {
    const session = getSession(remoteJid)
    session.lastActive = Date.now()
    session.shortTerm.push({ role, content })
    if (session.shortTerm.length > MAX_SHORT_TERM) {
        session.shortTerm = session.shortTerm.slice(-MAX_SHORT_TERM)
    }
}

/**
 * Build Context String for AI Prompt
 * Combines Core Memory + Topic + Short Term History
 * @param {string} remoteJid
 * @returns {string}
 */
export function buildContext(remoteJid) {
    const session = getSession(remoteJid)
    let ctx = ''

    if (session.coreMemory.length > 0) {
        ctx += '[IMPORTANT USER FACTS]:\n'
        session.coreMemory.forEach(f => ctx += `- ${f}\n`)
        ctx += '\n'
    }

    if (session.topic) {
        ctx += `[CURRENT TOPIC]: ${session.topic}\n\n`
    }

    if (session.shortTerm.length > 0) {
        ctx += '[CONVERSATION HISTORY]:\n'
        session.shortTerm.forEach(msg => {
            const name = msg.role === 'user' ? 'User' : 'Near Bot'
            ctx += `${name}: ${msg.content}\n`
        })
        ctx += '\n(Reply to the last user message based on the context above)\n'
    }

    return ctx
}

/**
 * Reset a session
 * @param {string} remoteJid
 * @returns {boolean}
 */
export function resetSession(remoteJid) {
    if (sessions.has(remoteJid)) {
        sessions.delete(remoteJid)
        console.log(`[MEMORY] Session reset for ${remoteJid}`)
        return true
    }
    return false
}

/**
 * Set active topic for a session
 */
export function setTopic(remoteJid, topic) {
    const session = getSession(remoteJid)
    session.topic = topic
    session.lastActive = Date.now()
}

// Auto-cleanup stale sessions every hour
setInterval(() => {
    const now = Date.now()
    let deletedCount = 0
    for (const [jid, session] of sessions.entries()) {
        if (now - session.lastActive > SESSION_TTL_MS) {
            sessions.delete(jid)
            deletedCount++
        }
    }
    if (deletedCount > 0) {
        console.log(`[MEMORY] Cleanup: removed ${deletedCount} stale sessions.`)
    }
}, CLEANUP_INTERVAL_MS)
