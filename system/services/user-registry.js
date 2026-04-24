/**
 * User Registry Service — Near Bot
 * Single source of truth for magang user data.
 * All plugins import from here instead of touching magang-users.json directly.
 */

import fs from 'node:fs'
import path from 'node:path'

const USERS_FILE = path.join(import.meta.dirname, '../../user/data/magang-users.json')

// In-memory cache
let cache = null
let dirty = false
let flushTimer = null

// Event listeners
const listeners = {
    added: [],
    updated: [],
    removed: []
}

// ========== FILE I/O ==========

function ensureFile() {
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, '[]', 'utf8')
        cache = []
    }
}

function load() {
    if (cache) return cache
    ensureFile()
    try {
        cache = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
    } catch (e) {
        console.error('[USER-REGISTRY] Failed to parse users file:', e.message)
        cache = []
    }
    return cache
}

function flush() {
    if (!dirty) return
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
        ensureFile()
        fs.promises.writeFile(USERS_FILE, JSON.stringify(cache, null, 2), 'utf8')
            .then(() => { dirty = false })
            .catch(e => console.error('[USER-REGISTRY] Async write failed:', e.message))
    }, 200)
}

// ========== NORMALIZATION ==========

function normalizePhone(phone) {
    if (!phone) return ''
    return phone.split('@')[0].split(':')[0].replace(/\D/g, '')
}

function matchesUser(user, senderId) {
    const stripped = normalizePhone(senderId)

    // direct phone match
    if (normalizePhone(user.phone) === stripped) return true
    // exact phone
    if (user.phone === senderId) return true
    // lid match
    if (user.lid && (normalizePhone(user.lid) === stripped || user.lid === senderId)) return true
    // identifiers
    if (Array.isArray(user.identifiers)) {
        return user.identifiers.some(id =>
            normalizePhone(id) === stripped || id === senderId
        )
    }
    return false
}

// ========== CRUD ==========

export function getUsers() {
    const users = load()
    // deduplicate by email
    const seen = new Set()
    const unique = []
    for (const u of users) {
        if (!u.email) continue
        const key = u.email.toLowerCase()
        if (!seen.has(key)) {
            seen.add(key)
            unique.push(u)
        }
    }
    return unique
}

export function findUser(senderId) {
    const users = load()
    return users.find(u => matchesUser(u, senderId)) || null
}

export function findUserByEmail(email) {
    if (!email) return null
    const users = load()
    return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null
}

export function addUser({ phone, email, password, name = null, slug = null, context = null, cycle_day = null }) {
    const users = load()

    // normalize phone
    if (phone && !phone.includes('@')) {
        phone = phone + '@s.whatsapp.net'
    }

    // check existing by email
    const existingByEmail = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (existingByEmail) {
        console.log(`[USER-REGISTRY] User already exists by email: ${email}`)
        return { user: existingByEmail, isNew: false }
    }

    // check existing by phone
    const existingByPhone = users.find(u => matchesUser(u, phone))
    if (existingByPhone) {
        console.log(`[USER-REGISTRY] User already exists by phone: ${phone}`)
        return { user: existingByPhone, isNew: false }
    }

    // generate slug from name or email if not provided
    if (!slug) {
        const source = name || email.split('@')[0]
        slug = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }

    const now = new Date().toISOString()
    const newUser = {
        phone,
        email,
        password,
        lid: null,
        identifiers: [phone],
        registeredAt: now,
        lastLogin: now,
        ...(name && { name }),
        ...(slug && { slug }),
        ...(context && { context }),
        ...(cycle_day && { cycle_day })
    }

    users.push(newUser)
    cache = users
    dirty = true
    flush()

    fire('added', newUser)
    console.log(`[USER-REGISTRY] Added user: ${email} (${phone})`)

    return { user: newUser, isNew: true }
}

export function updateUser(senderId, updates) {
    const users = load()
    const idx = users.findIndex(u => matchesUser(u, senderId))
    if (idx === -1) return null

    const prev = { ...users[idx] }
    users[idx] = { ...users[idx], ...updates }
    cache = users
    dirty = true
    flush()

    fire('updated', users[idx], updates)
    return users[idx]
}

export function updateByEmail(email, updates) {
    const users = load()
    const idx = users.findIndex(u => u.email?.toLowerCase() === email.toLowerCase())
    if (idx === -1) return null

    users[idx] = { ...users[idx], ...updates }
    cache = users
    dirty = true
    flush()

    fire('updated', users[idx], updates)
    return users[idx]
}

export function deleteUser(senderId) {
    const users = load()
    const idx = users.findIndex(u => matchesUser(u, senderId))
    if (idx === -1) return false

    const removed = users.splice(idx, 1)[0]
    cache = users
    dirty = true
    flush()

    fire('removed', removed)
    console.log(`[USER-REGISTRY] Deleted user: ${removed.email}`)
    return true
}

export function deleteByEmail(email) {
    const users = load()
    const idx = users.findIndex(u => u.email?.toLowerCase() === email.toLowerCase())
    if (idx === -1) return false

    const removed = users.splice(idx, 1)[0]
    cache = users
    dirty = true
    flush()

    fire('removed', removed)
    return true
}

// ========== LINKING ==========

export function linkIdentifier(senderId, newIdentifier) {
    const users = load()
    const idx = users.findIndex(u => matchesUser(u, senderId))
    if (idx === -1) return false

    if (!users[idx].identifiers) users[idx].identifiers = []
    const normalNew = normalizePhone(newIdentifier)
    const alreadyLinked = users[idx].identifiers.some(id => normalizePhone(id) === normalNew)

    if (!alreadyLinked) {
        users[idx].identifiers.push(newIdentifier)
        cache = users
        dirty = true
        flush()
        console.log(`[USER-REGISTRY] Linked ${newIdentifier} to ${users[idx].email}`)
    }
    return true
}

// ========== DOMAIN HELPERS ==========

export function getUserCredentials(senderId) {
    const user = findUser(senderId)
    if (!user) return null
    return { email: user.email, password: user.password }
}

export function hasTemplate(senderId) {
    const user = findUser(senderId)
    return user?.template ? true : false
}

export function getContext(senderId) {
    const user = findUser(senderId)
    return user?.context || null
}

export function getUserCount() {
    return load().length
}

// ========== BULK / IMPORT ==========

export function importUsers(usersArray, { overwrite = false } = {}) {
    const users = load()
    let added = 0
    let skipped = 0

    for (const incoming of usersArray) {
        if (!incoming.email) {
            skipped++
            continue
        }

        const existingIdx = users.findIndex(u => u.email?.toLowerCase() === incoming.email.toLowerCase())

        if (existingIdx !== -1) {
            if (overwrite) {
                // merge: keep existing fields if incoming doesn't have them
                users[existingIdx] = { ...users[existingIdx], ...incoming }
                added++
            } else {
                skipped++
            }
        } else {
            users.push(incoming)
            added++
        }
    }

    cache = users
    dirty = true
    flush()
    console.log(`[USER-REGISTRY] Imported: ${added} added, ${skipped} skipped`)
    return { added, skipped }
}

// ========== EVENTS ==========

function on(event, callback) {
    if (listeners[event]) listeners[event].push(callback)
}

function fire(event, ...args) {
    for (const cb of listeners[event] || []) {
        try { cb(...args) } catch (e) { console.error(`[USER-REGISTRY] Event ${event} error:`, e.message) }
    }
}

export function onUserAdded(cb) { on('added', cb) }
export function onUserUpdated(cb) { on('updated', cb) }
export function onUserRemoved(cb) { on('removed', cb) }

// ========== CACHE CONTROL ==========

export function reload() {
    cache = null
    dirty = false
    return load()
}

// ========== DEFAULT EXPORT (for convenience) ==========
export default {
    getUsers, findUser, findUserByEmail,
    addUser, updateUser, updateByEmail,
    deleteUser, deleteByEmail,
    linkIdentifier,
    getUserCredentials, hasTemplate, getContext, getUserCount,
    importUsers,
    onUserAdded, onUserUpdated, onUserRemoved,
    reload
}
