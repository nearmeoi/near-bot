/**
 * Plugin: Scheduler Admin
 * ESM, Near Bot format
 * Commands: addschedule, delschedule, listschedule, testschedule, scheduleron, scheduleroff
 */

import { sendText } from '#helper'
import {
    loadSchedules, addSchedule, updateSchedule, deleteSchedule, runTestScheduler, reloadScheduler
} from '../../system/services/scheduler.js'

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, command }) {
    switch (command) {

        case 'listschedule': {
            const schedules = loadSchedules()
            if (schedules.length === 0) {
                return sendText(sock, jid, '📋 Belum ada jadwal.', m)
            }
            const list = schedules.map((s, i) =>
                `${i + 1}. [${s.enabled ? '✅' : '❌'}] *${s.id}*\n   🕐 ${s.time} (${s.days || '1-5'})\n   📣 Type: ${s.type}`
            ).join('\n\n')
            return sendText(sock, jid, `📋 *Jadwal Terdaftar (${schedules.length}):*\n\n${list}`, m)
        }

        case 'addschedule': {
            // Format: .addschedule id|time|type|days|message
            // Example: .addschedule pagi|07:00|group_hidetag|1-5|Selamat pagi! 🌞
            if (!text) return sendText(sock, jid, '❌ Format:\n.addschedule id|jam|tipe|hari|pesan\n\nContoh:\n.addschedule pagi|07:00|group_hidetag|1-5|Selamat pagi semua! 🌞\n\nTipe: group_hidetag, group_tag_all\nHari: 1-5 (Senin-Jumat), * (semua)', m)

            const parts = text.split('|').map(p => p.trim())
            if (parts.length < 4) return sendText(sock, jid, '❌ Kurang parameter. Format: id|jam|tipe|hari|pesan', m)

            const [id, time, type, days, ...msgParts] = parts
            const message = msgParts.join('|').trim()

            if (!['group_hidetag', 'group_tag_all'].includes(type)) {
                return sendText(sock, jid, '❌ Tipe tidak valid. Pilihan: group_hidetag, group_tag_all', m)
            }

            if (!/^\d{2}:\d{2}$/.test(time)) {
                return sendText(sock, jid, '❌ Format jam salah. Contoh: 07:00', m)
            }

            const schedule = { id, time, type, days: days || '1-5', message, enabled: true }
            addSchedule(schedule)
            return sendText(sock, jid, `✅ Jadwal *${id}* ditambahkan!\n🕐 ${time} (Hari: ${days})\n📣 Type: ${type}`, m)
        }

        case 'delschedule': {
            if (!text) return sendText(sock, jid, '❌ Format: .delschedule [id]', m)
            const deleted = deleteSchedule(text.trim())
            return sendText(sock, jid, deleted ? `✅ Jadwal *${text.trim()}* dihapus.` : `❌ Jadwal tidak ditemukan.`, m)
        }

        case 'testschedule': {
            if (!text) return sendText(sock, jid, '❌ Format: .testschedule [id]', m)
            await sendText(sock, jid, `🔄 Menjalankan tes jadwal *${text.trim()}*...`, m)
            const result = await runTestScheduler(sock, text.trim())
            return sendText(sock, jid, result.success ? `✅ Jadwal *${text.trim()}* berhasil dijalankan!` : `❌ ${result.message}`, m)
        }

        case 'scheduleron': {
            const schedules = loadSchedules()
            const id = text?.trim()
            if (id) {
                updateSchedule(id, { enabled: true })
                return sendText(sock, jid, `✅ Jadwal *${id}* diaktifkan.`, m)
            }
            schedules.forEach(s => updateSchedule(s.id, { enabled: true }))
            return sendText(sock, jid, '✅ Semua jadwal diaktifkan.', m)
        }

        case 'scheduleroff': {
            const schedules = loadSchedules()
            const id = text?.trim()
            if (id) {
                updateSchedule(id, { enabled: false })
                return sendText(sock, jid, `✅ Jadwal *${id}* dinonaktifkan.`, m)
            }
            schedules.forEach(s => updateSchedule(s.id, { enabled: false }))
            return sendText(sock, jid, '✅ Semua jadwal dinonaktifkan.', m)
        }
    }
}

handler.pluginName = 'scheduler admin'
handler.command = ['addschedule', 'delschedule', 'listschedule', 'testschedule', 'scheduleron', 'scheduleroff']
handler.category = ['admin']
handler.description = 'Kelola jadwal broadcast otomatis.'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'scheduler-admin.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
