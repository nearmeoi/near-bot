/**
 * Holiday Service — Near Bot
 * Centralized calendar awareness for scheduler and attendance logic.
 * Stores custom holidays in user/data/holidays.json.
 */

import fs from 'node:fs'
import path from 'node:path'

const HOLIDAYS_FILE = path.join(import.meta.dirname, '../../user/data/holidays.json')

// In-memory cache
let cache = null

// ========== FILE I/O ==========

function ensureFile() {
    const dir = path.dirname(HOLIDAYS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(HOLIDAYS_FILE)) {
        fs.writeFileSync(HOLIDAYS_FILE, '[]', 'utf8')
        cache = []
    }
}

function load() {
    if (cache) return cache
    ensureFile()
    try {
        cache = JSON.parse(fs.readFileSync(HOLIDAYS_FILE, 'utf8'))
    } catch (e) {
        console.error('[HOLIDAY-SERVICE] Failed to parse holidays file:', e.message)
        cache = []
    }
    return cache
}

function save() {
    ensureFile()
    fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(cache, null, 2), 'utf8')
}

// ========== CORE ==========

/**
 * Get all custom holidays
 * @returns {string[]} Array of YYYY-MM-DD strings
 */
export function getHolidays() {
    return load()
}

/**
 * Add a custom holiday
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {boolean} true if added, false if already exists
 */
export function addHoliday(dateStr) {
    const holidays = load()
    if (holidays.includes(dateStr)) return false
    holidays.push(dateStr)
    holidays.sort()
    cache = holidays
    save()
    console.log(`[HOLIDAY-SERVICE] Added: ${dateStr}`)
    return true
}

/**
 * Remove a custom holiday
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {boolean} true if removed
 */
export function removeHoliday(dateStr) {
    const holidays = load()
    const idx = holidays.indexOf(dateStr)
    if (idx === -1) return false
    holidays.splice(idx, 1)
    cache = holidays
    save()
    console.log(`[HOLIDAY-SERVICE] Removed: ${dateStr}`)
    return true
}

/**
 * Check if a specific date is a holiday (weekend OR custom holiday)
 * @param {string} dateStr - YYYY-MM-DD format (default: today in Asia/Makassar)
 * @returns {boolean}
 */
export function isHoliday(dateStr = null) {
    if (!dateStr) {
        dateStr = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Makassar' }).split(',')[0]
    }

    // check weekend
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const day = date.getDay()
    if (day === 0 || day === 6) return true

    // check custom holidays
    return load().includes(dateStr)
}

/**
 * Check if today is a weekend or holiday in given timezone
 * @param {string} timezone - IANA timezone string
 * @returns {boolean}
 */
export function isWeekendOrHoliday(timezone = 'Asia/Makassar') {
    const dateStr = new Date().toLocaleString('en-CA', { timeZone: timezone }).split(',')[0]
    return isHoliday(dateStr)
}

/**
 * Check if a date is a working day (not weekend, not holiday)
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {boolean}
 */
export function isWorkingDay(dateStr) {
    return !isHoliday(dateStr)
}

/**
 * Get the date string for today in a timezone
 * @param {string} timezone
 * @returns {string} YYYY-MM-DD
 */
export function todayInTimezone(timezone = 'Asia/Makassar') {
    return new Date().toLocaleString('en-CA', { timeZone: timezone }).split(',')[0]
}

/**
 * Clear all custom holidays
 */
export function clearHolidays() {
    cache = []
    save()
}

export function reload() {
    cache = null
    return load()
}

export default {
    getHolidays, addHoliday, removeHoliday, clearHolidays,
    isHoliday, isWeekendOrHoliday, isWorkingDay, todayInTimezone,
    reload
}
