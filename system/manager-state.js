const AFK_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const AFK_MAX_MESSAGES = 50

class StateManager {
    botLock = false
    afk = {}

    setAfk(chatId, senderId, data) {
        if (!this.afk[chatId]) this.afk[chatId] = {}
        this.afk[chatId][senderId] = data
    }

    getAfk(chatId, senderId) {
        return this.afk?.[chatId]?.[senderId]
    }

    getAfkByChat(chatId) {
        return this.afk[chatId]
    }

    deleteAfk(chatId) {
        delete this.afk[chatId]
    }

    pushAfkMessage(chatId, senderId, message) {
        const entry = this.getAfk(chatId, senderId)
        if (!entry) return
        entry.IMessage.push(message)
        if (entry.IMessage.length > AFK_MAX_MESSAGES) {
            entry.IMessage = entry.IMessage.slice(-AFK_MAX_MESSAGES)
        }
    }

    cleanupAfk() {
        const now = Date.now()
        let cleaned = 0
        for (const chatId of Object.keys(this.afk)) {
            for (const senderId of Object.keys(this.afk[chatId])) {
                if (now - this.afk[chatId][senderId].time > AFK_MAX_AGE_MS) {
                    delete this.afk[chatId][senderId]
                    cleaned++
                }
            }
            if (Object.keys(this.afk[chatId]).length === 0) {
                delete this.afk[chatId]
            }
        }
        if (cleaned > 0) console.log(`[StateManager] Cleaned ${cleaned} expired AFK entries`)
    }

    lock() {
        this.botLock = true
    }

    unlock() {
        this.botLock = false
    }

    isLocked() {
        return this.botLock
    }
}

const stateManager = new StateManager()

// cleanup expired AFK every 10 minutes
setInterval(() => stateManager.cleanupAfk(), 10 * 60 * 1000)

export default stateManager
