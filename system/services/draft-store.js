/**
 * Draft Store Service — Near Bot
 * Shared in-memory report drafts accessible from any plugin or scheduler.
 * Replaces the per-plugin draft Map pattern.
 */

// In-memory draft storage
const drafts = new Map()

// TTL for auto-expiry (2 hours)
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000

// ========== CRUD ==========

/**
 * Get a user's draft
 * @param {string} senderId - WhatsApp JID
 * @returns {object|null} Draft data or null
 */
export function getDraft(senderId) {
    const entry = drafts.get(senderId)
    if (!entry) return null

    // check expiry
    if (Date.now() - entry.createdAt > DRAFT_TTL_MS) {
        drafts.delete(senderId)
        return null
    }
    return entry.data
}

/**
 * Set a user's draft
 * @param {string} senderId - WhatsApp JID
 * @param {object} data - { aktivitas, pembelajaran, kendala }
 * @param {object} meta - optional { source, type, generatedAt }
 */
export function setDraft(senderId, data, meta = {}) {
    drafts.set(senderId, {
        data: {
            aktivitas: data.aktivitas || '',
            pembelajaran: data.pembelajaran || '',
            kendala: data.kendala || 'Tidak ada kendala.'
        },
        meta: {
            source: meta.source || 'manual',
            type: meta.type || 'user-input',
            ...meta
        },
        createdAt: Date.now()
    })
}

/**
 * Delete a user's draft
 * @param {string} senderId
 */
export function deleteDraft(senderId) {
    drafts.delete(senderId)
}

/**
 * Check if user has an active draft
 * @param {string} senderId
 * @returns {boolean}
 */
export function hasDraft(senderId) {
    return getDraft(senderId) !== null
}

/**
 * Get draft with metadata
 * @param {string} senderId
 * @returns {object|null} { data, meta, createdAt }
 */
export function getDraftWithMeta(senderId) {
    const entry = drafts.get(senderId)
    if (!entry) return null
    if (Date.now() - entry.createdAt > DRAFT_TTL_MS) {
        drafts.delete(senderId)
        return null
    }
    return entry
}

/**
 * Get all active drafts (for scheduler use)
 * @returns {Map} Map of senderId -> { data, meta, createdAt }
 */
export function getAllDrafts() {
    // clean expired first
    const now = Date.now()
    for (const [key, entry] of drafts.entries()) {
        if (now - entry.createdAt > DRAFT_TTL_MS) {
            drafts.delete(key)
        }
    }
    return drafts
}

// ========== FORMATTING ==========

/**
 * Format a draft into WhatsApp preview text
 * @param {object} data - { aktivitas, pembelajaran, kendala }
 * @param {object} opts - { source, includeFooter }
 * @returns {string}
 */
export function formatPreview(data, opts = {}) {
    const { source = '', includeFooter = true } = opts

    let text = `📋 *DRAF LAPORAN ABSENSI*`
    if (source) text += ` (${source})`
    text += `\n\n`
    text += `*Aktivitas:*\n${data.aktivitas}\n\n`
    text += `*Pembelajaran:*\n${data.pembelajaran}\n\n`
    text += `*Kendala:*\n${data.kendala}`

    if (includeFooter) {
        text += `\n\n---\n_Ketik *ya* untuk mengirim, atau edit ulang dengan .absen [teks baru]_`
    }

    return text
}

/**
 * Format a draft for auto-submit notification
 * @param {object} data
 * @param {string} source
 * @returns {string}
 */
export function formatAutoSubmitMessage(data, source = 'Auto-AI') {
    return `✅ *Absen Otomatis Berhasil* (${source})\n\n` +
        `*Aktivitas:* ${data.aktivitas}\n` +
        `*Pembelajaran:* ${data.pembelajaran}\n` +
        `*Kendala:* ${data.kendala}`
}

// ========== STATS ==========

export function getDraftCount() {
    return drafts.size
}

export function clearAllDrafts() {
    drafts.clear()
}

export default {
    getDraft, setDraft, deleteDraft, hasDraft,
    getDraftWithMeta, getAllDrafts,
    formatPreview, formatAutoSubmitMessage,
    getDraftCount, clearAllDrafts
}
