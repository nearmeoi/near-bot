/**
 * Scheduler Service — Near Bot
 * Ported from absenbot (absensi-related parts removed).
 * Handles timed group broadcasts using node-cron.
 */

import fs from 'node:fs'
import path from 'node:path'
import cron from 'node-cron'
import { loadGroupSettings } from './group-settings.js'

const SCHEDULE_CONFIG_FILE = path.join(process.cwd(), 'user', 'data', 'scheduler-config.json')

// Global state
let botSocket = null
const activeCrons = new Map()

// Plugin-registered task handlers (type -> handler function)
const taskHandlers = new Map()

// Plugin-registered tasks (in-memory, not persisted to file)
const registeredTasks = []

/**
 * Register a custom task handler from a plugin.
 * @param {object} task - { id, type, time, days?, enabled?, timezone?, handler }
 */
export function registerTask(task) {
    if (!task.id || !task.type || !task.time || typeof task.handler !== 'function') {
        console.error(`[SCHEDULER] Invalid registered task: missing id/type/time/handler`)
        return
    }

    // store handler separately
    taskHandlers.set(task.type, task.handler)

    // check for duplicate registration
    const existingIdx = registeredTasks.findIndex(t => t.id === task.id)
    if (existingIdx !== -1) {
        registeredTasks[existingIdx] = task
    } else {
        registeredTasks.push(task)
    }

    console.log(`[SCHEDULER] Registered task: ${task.id} (${task.type} @ ${task.time})`)
}

export function setBotSocket(sock) {
    botSocket = sock
}

// --- CONFIG MANAGEMENT ---

export function loadSchedules() {
    if (!fs.existsSync(SCHEDULE_CONFIG_FILE)) return []
    try {
        return JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_FILE, 'utf8'))
    } catch (e) {
        console.error('[SCHEDULER] Error loading config:', e.message)
        return []
    }
}

export function saveSchedules(schedules) {
    const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time))
    fs.writeFileSync(SCHEDULE_CONFIG_FILE, JSON.stringify(sorted, null, 2))
}

export function addSchedule(schedule) {
    const schedules = loadSchedules()
    schedules.push(schedule)
    saveSchedules(schedules)
    reloadScheduler()
    return schedule
}

export function updateSchedule(id, updates) {
    const schedules = loadSchedules()
    const idx = schedules.findIndex(s => s.id === id)
    if (idx !== -1) {
        schedules[idx] = { ...schedules[idx], ...updates }
        saveSchedules(schedules)
        reloadScheduler()
        return schedules[idx]
    }
    return null
}

export function deleteSchedule(id) {
    const schedules = loadSchedules()
    const newSchedules = schedules.filter(s => s.id !== id)
    if (newSchedules.length !== schedules.length) {
        saveSchedules(newSchedules)
        reloadScheduler()
        return true
    }
    return false
}

// --- HELPERS ---

function isWeekendOrHoliday(timezone) {
    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const day = tzDate.getDay()
    return day === 0 || day === 6
}

function shouldSkipGroup(config, timezone) {
    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const day = tzDate.getDay()
    const isWeekend = day === 0 || day === 6
    return isWeekend && (config.skipWeekends !== false)
}

// --- TASK EXECUTORS ---

/**
 * Broadcast a message to a group with all member mentions hidden (hidetag)
 */
async function broadcastHidetag(sock, groupId, text) {
    try {
        const metadata = await sock.groupMetadata(groupId).catch(() => null)
        const mentions = metadata ? metadata.participants.map(p => p.id) : []
        await sock.sendMessage(groupId, { text, mentions })
    } catch (e) {
        console.error(`[SCHEDULER] Failed hidetag to ${groupId}:`, e.message)
    }
}

/**
 * Task: Broadcast hidetag message to all enabled groups
 */
async function runGroupHidetag(sock, task, timezone) {
    console.log(`[SCHEDULER] Running Group Hidetag: ${task.id} (${timezone})`)
    if (isWeekendOrHoliday(timezone) && !task.includeWeekends) return

    const settings = loadGroupSettings()
    const enabledGroups = Object.entries(settings).filter(([_, c]) => {
        const groupTz = c.timezone || 'Asia/Makassar'
        return c.schedulerEnabled && groupTz === timezone && !shouldSkipGroup(c, timezone)
    })

    const msgText = task.message || `📢 *Reminder*\n\nPesan terjadwal dari Near Bot.`

    for (const [groupId] of enabledGroups) {
        await broadcastHidetag(sock, groupId, msgText)
        await new Promise(r => setTimeout(r, 2000))
    }
}

/**
 * Task: Tag all members in enabled groups
 */
async function runGroupTagAll(sock, task, timezone) {
    console.log(`[SCHEDULER] Running Tag All: ${task.id} (${timezone})`)
    if (isWeekendOrHoliday(timezone) && !task.includeWeekends) return

    const settings = loadGroupSettings()
    const enabledGroups = Object.entries(settings).filter(([_, c]) => {
        const groupTz = c.timezone || 'Asia/Makassar'
        return c.schedulerEnabled && groupTz === timezone && !shouldSkipGroup(c, timezone)
    })

    const msgText = task.message || `📢 *Pengumuman*\n\nPesan terjadwal dari Near Bot.`

    for (const [groupId] of enabledGroups) {
        try {
            const gm = await sock.groupMetadata(groupId)
            const participants = gm.participants.map(p => p.id)
            await sock.sendMessage(groupId, { text: msgText, mentions: participants })
            await new Promise(r => setTimeout(r, 2000))
        } catch (e) {
            console.error(`[SCHEDULER] Failed tag all to ${groupId}:`, e.message)
        }
    }
}

// --- CORE SCHEDULER ---

function scheduleTask(task, timezone) {
    const [hour, minute] = task.time.split(':')
    const days = task.days || '1-5'
    const cronExp = `${minute} ${hour} * * ${days}`

    if (!cron.validate(cronExp)) {
        console.error(`[SCHEDULER] Invalid cron expression for task ${task.id}: ${cronExp}`)
        return
    }

    const job = cron.schedule(cronExp, async () => {
        const sock = botSocket
        if (!sock) return

        // check plugin-registered handlers first
        const pluginHandler = taskHandlers.get(task.type)
        if (pluginHandler) {
            try {
                await pluginHandler(sock, task, timezone)
            } catch (e) {
                console.error(`[SCHEDULER] Plugin task ${task.id} failed:`, e.message)
            }
            return
        }

        // built-in handlers
        try {
            if (task.type === 'group_hidetag') await runGroupHidetag(sock, task, timezone)
            else if (task.type === 'group_tag_all') await runGroupTagAll(sock, task, timezone)
        } catch (e) {
            console.error(`[SCHEDULER] Built-in task ${task.id} failed:`, e.message)
        }
    }, { timezone })

    activeCrons.set(`${task.id}_${timezone}`, job)
}

export function reloadScheduler() {
    for (const [key, job] of activeCrons.entries()) {
        job.stop()
        activeCrons.delete(key)
    }

    const standardTimezones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']
    const settings = loadGroupSettings()
    const customTimezones = Object.values(settings).map(s => s.timezone).filter(tz => tz && !standardTimezones.includes(tz))
    const timezones = [...new Set([...standardTimezones, ...customTimezones])]

    const fileSchedules = loadSchedules()

    // merge: file schedules + plugin-registered tasks (plugin tasks run in their timezone)
    const allTimezones = [...timezones]
    for (const task of registeredTasks) {
        if (task.timezone && !allTimezones.includes(task.timezone)) {
            allTimezones.push(task.timezone)
        }
    }

    allTimezones.forEach(tz => {
        // file-based schedules
        fileSchedules.forEach(task => {
            if (task.enabled) scheduleTask(task, tz)
        })

        // plugin-registered tasks (only in their declared timezone, or Asia/Makassar)
        registeredTasks.forEach(task => {
            const taskTz = task.timezone || 'Asia/Makassar'
            if (task.enabled !== false && taskTz === tz) {
                scheduleTask(task, taskTz)
            }
        })
    })

    console.log(`[SCHEDULER] Loaded ${fileSchedules.filter(s => s.enabled).length} file schedules + ${registeredTasks.length} plugin tasks across ${allTimezones.length} timezones.`)
}

export function initScheduler(sock) {
    setBotSocket(sock)
    reloadScheduler()
    console.log('[SCHEDULER] Initialized.')
}

export async function runTestScheduler(sock, taskId) {
    const tz = 'Asia/Makassar'

    // check registered tasks first
    const regTask = registeredTasks.find(t => t.id === taskId)
    if (regTask) {
        const handler = taskHandlers.get(regTask.type)
        if (handler) {
            await handler(sock, regTask, tz)
            return { success: true }
        }
    }

    // check file schedules
    const schedules = loadSchedules()
    const task = schedules.find(s => s.id === taskId)
    if (!task) return { success: false, pesan: 'Task tidak ditemukan' }
    if (task.type === 'group_hidetag') await runGroupHidetag(sock, task, tz)
    else if (task.type === 'group_tag_all') await runGroupTagAll(sock, task, tz)
    return { success: true }
}
