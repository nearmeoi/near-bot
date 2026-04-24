/**
 * Group Settings Service — Near Bot
 * Ported from absenbot with ESM conversion.
 * Manages per-group configurations stored in user/data/group-settings.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { allPath } from '../helper.js'

const SETTINGS_FILE = path.join(process.cwd(), 'user', 'data', 'group-settings.json')

const DEFAULT_SETTINGS = {
    name: '',
    schedulerEnabled: false,
    timezone: 'Asia/Makassar'
}

let cachedSettings = null

/**
 * Load all group settings (with in-memory cache)
 */
export function loadGroupSettings(forceReload = false) {
    if (cachedSettings && !forceReload) return cachedSettings

    if (!fs.existsSync(SETTINGS_FILE)) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2))
        cachedSettings = {}
        return {}
    }

    try {
        cachedSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
        return cachedSettings
    } catch (e) {
        console.error('[GROUP-SETTINGS] Error loading:', e.message)
        return {}
    }
}

export function saveGroupSettings(settings) {
    cachedSettings = settings
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

/**
 * Add or update a group
 * @param {string} groupId
 * @param {object} updates
 */
export function updateGroup(groupId, updates = {}) {
    const settings = loadGroupSettings()
    if (!settings[groupId]) {
        settings[groupId] = { ...DEFAULT_SETTINGS, ...updates }
        console.log(`[GROUP-SETTINGS] Added: ${groupId}`)
    } else {
        settings[groupId] = { ...settings[groupId], ...updates }
        console.log(`[GROUP-SETTINGS] Updated: ${groupId}`)
    }
    saveGroupSettings(settings)
    return settings[groupId]
}

/**
 * Remove a group
 */
export function removeGroup(groupId) {
    const settings = loadGroupSettings()
    if (settings[groupId]) {
        delete settings[groupId]
        saveGroupSettings(settings)
        console.log(`[GROUP-SETTINGS] Removed: ${groupId}`)
        return true
    }
    return false
}

/**
 * Get settings for one group
 */
export function getGroup(groupId) {
    return loadGroupSettings()[groupId] || null
}

/**
 * Check if a group exists in settings
 */
export function isGroupAllowed(groupId) {
    return !!loadGroupSettings()[groupId]
}

/**
 * Get all group IDs
 */
export function getAllGroupIds() {
    return Object.keys(loadGroupSettings())
}
