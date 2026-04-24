/**
 * Plugin: Scheduler Magang
 * Registers absen-specific background tasks into the scheduler.
 * Tasks: draft push, emergency warning, emergency submit, targeted reminder.
 *
 * This plugin doesn't add commands — it runs on load and registers tasks.
 */

import { registerTask, reloadScheduler } from '../../system/services/scheduler.js'
import { isHoliday, todayInTimezone } from '../../system/services/holiday-service.js'
import { getUsers } from '../../system/services/user-registry.js'
import { setDraft, getDraft, formatPreview, deleteDraft } from '../../system/services/draft-store.js'
import { checkAttendanceStatus, submitAttendance, getAttendanceHistory } from '../../system/services/magang-api.js'
import { smartChat } from '../../system/services/ai-service.js'
import { sendText } from '#helper'

// ========== TASK HANDLERS ==========

/**
 * Draft Push — auto-generate report drafts for users who haven't attended yet.
 * Runs at 15:00 WITA, sends draft to user via DM or group mention.
 */
async function runDraftPush(sock) {
    const today = todayInTimezone()
    if (isHoliday(today)) {
        console.log('[DRAFT-PUSH] Today is holiday, skipping.')
        return
    }

    const users = getUsers()
    console.log(`[DRAFT-PUSH] Checking ${users.length} users...`)
    let pushed = 0

    for (const user of users) {
        if (!user.phone || !user.email || !user.password) continue

        try {
            const status = await checkAttendanceStatus(user.email, user.password)
            if (!status.success || status.sudahAbsen) continue // already attended or error

            // generate draft from template or context
            const contentBase = user.template || user.context || ''
            if (!contentBase) continue // nothing to generate from

            const history = await getAttendanceHistory(user.email, user.password, 2)
            const historyContext = (history.success && history.logs?.length > 0)
                ? 'RIWAYAT TERAKHIR:\n' + history.logs.slice(0, 2).map(l => `- ${(l.activity_log || '').substring(0, 80)}`).join('\n')
                : ''

            const userContext = user.context ? `PROFIL: ${user.context}\n\n` : ''

            const sysPrompt = `Kamu adalah Asisten Penulis Laporan Magang Profesional.
ATURAN WAJIB:
1. JANGAN pakai angka/list/bullet
2. Gunakan kata kerja berawalan 'Me-'
3. Output HANYA dengan format: AKTIVITAS, PEMBELAJARAN, KENDALA
4. Setiap bagian MINIMAL 110 karakter, MAKSIMAL 300 karakter
5. KENDALA: jika tidak ada, tulis kalimat profesional tentang kelancaran kerja
6. JANGAN tulis intro, penutup, tanda *** atau emoji`

            const userPrompt = `${userContext}${historyContext}\n\nCERITA/TEMPLATE HARI INI: "${contentBase}"\n\nBuatkan laporan magang. Output HANYA: AKTIVITAS, PEMBELAJARAN, KENDALA.`

            const aiResult = await smartChat(userPrompt, sysPrompt)
            if (!aiResult.success) continue

            const content = aiResult.content
            const parseSection = (label, text) => {
                const regex = new RegExp(`${label}[*:\\s]*([\\s\\S]*?)(?=AKTIVITAS|PEMBELAJARAN|KENDALA|$)`, 'i')
                const match = text.match(regex)
                return match ? match[1].trim().replace(/[*#]/g, '').replace(/\s+/g, ' ') : ''
            }

            const aktivitas = parseSection('AKTIVITAS', content)
            const pembelajaran = parseSection('PEMBELAJARAN', content)
            const kendala = parseSection('KENDALA', content) || 'Tidak ada kendala.'

            if (!aktivitas || !pembelajaran) continue

            const draft = { aktivitas, pembelajaran, kendala }
            setDraft(user.phone, draft, { source: 'auto-draft' })

            // send draft to user
            const jid = user.phone.includes('@') ? user.phone : `${user.phone}@s.whatsapp.net`
            await sendText(sock, jid, formatPreview(draft, { source: 'Auto-AI' }))
            pushed++
            await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
            console.error(`[DRAFT-PUSH] Failed for ${user.email}:`, e.message)
        }
    }
    console.log(`[DRAFT-PUSH] Pushed ${pushed} drafts.`)
}

/**
 * Emergency Warning — warn users who still haven't attended at 15:30 WITA.
 */
async function runEmergencyWarning(sock) {
    const today = todayInTimezone()
    if (isHoliday(today)) return

    const users = getUsers()
    console.log(`[EMERGENCY-WARN] Checking ${users.length} users...`)

    for (const user of users) {
        if (!user.phone || !user.email || !user.password) continue

        try {
            const status = await checkAttendanceStatus(user.email, user.password)
            if (!status.success || status.sudahAbsen) continue

            const jid = user.phone.includes('@') ? user.phone : `${user.phone}@s.whatsapp.net`
            const name = user.name || user.email.split('@')[0]

            const hasDraft = getDraft(user.phone)
            const msg = hasDraft
                ? `⚠️ *Peringatan ${name}!*\n\nKamu belum absen hari ini! Draf sudah siap, ketik *ya* untuk kirim sekarang.\n\n⏰ Deadline absen segera tiba!`
                : `⚠️ *Peringatan ${name}!*\n\nKamu belum absen hari ini! Segera ketik *.absen [cerita kegiatan]* untuk submit sebelum deadline.\n\n⏰ Jangan sampai alpha!`

            await sendText(sock, jid, msg)
            await new Promise(r => setTimeout(r, 1000))
        } catch (e) {
            console.error(`[EMERGENCY-WARN] Failed for ${user.email}:`, e.message)
        }
    }
}

/**
 * Emergency Submit — auto-submit drafts for users who still haven't attended at 16:30 WITA.
 */
async function runEmergencySubmit(sock) {
    const today = todayInTimezone()
    if (isHoliday(today)) return

    const users = getUsers()
    console.log(`[EMERGENCY-SUBMIT] Checking ${users.length} users...`)
    let submitted = 0

    for (const user of users) {
        if (!user.phone || !user.email || !user.password) continue

        try {
            const status = await checkAttendanceStatus(user.email, user.password)
            if (!status.success || status.sudahAbsen) continue

            const draft = getDraft(user.phone)
            if (!draft) continue // no draft to submit

            const result = await submitAttendance(user.email, user.password, draft)
            if (result.success) {
                deleteDraft(user.phone)
                const jid = user.phone.includes('@') ? user.phone : `${user.phone}@s.whatsapp.net`
                const name = user.name || user.email.split('@')[0]
                await sendText(sock, jid, `🚨 *Absen Darurat!* ${name}\n\nDraf kamu otomatis ter-submit untuk menghindari alpha.\n\n_Kamu masih bisa mengedit jika ada kesalahan._`)
                submitted++
            }
            await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
            console.error(`[EMERGENCY-SUBMIT] Failed for ${user.email}:`, e.message)
        }
    }
    console.log(`[EMERGENCY-SUBMIT] Submitted ${submitted} users.`)
}

// ========== REGISTER TASKS ==========

function registerMagangTasks() {
    registerTask({
        id: 'magang_draft_push',
        type: 'magang_draft_push',
        time: '15:00',
        days: '1-5',
        timezone: 'Asia/Makassar',
        enabled: true,
        handler: runDraftPush
    })

    registerTask({
        id: 'magang_emergency_warning',
        type: 'magang_emergency_warning',
        time: '15:30',
        days: '1-5',
        timezone: 'Asia/Makassar',
        enabled: true,
        handler: runEmergencyWarning
    })

    registerTask({
        id: 'magang_emergency_submit',
        type: 'magang_emergency_submit',
        time: '16:30',
        days: '1-5',
        timezone: 'Asia/Makassar',
        enabled: true,
        handler: runEmergencySubmit
    })
}

// Register on plugin load
registerMagangTasks()
reloadScheduler()

console.log('[SCHEDULER-MAGANG] Tasks registered: draft_push, emergency_warning, emergency_submit')

// Handler — shows magang scheduler status when called
async function handler({ sock, jid, m, command }) {
    if (command !== 'magang-status') return
    const tasks = [
        { id: 'magang_draft_push', time: '15:00', desc: 'Auto-generate & kirim draft ke user' },
        { id: 'magang_emergency_warning', time: '15:30', desc: 'Peringatan ke user yang belum absen' },
        { id: 'magang_emergency_submit', time: '16:30', desc: 'Auto-submit draft untuk hindari alpha' },
    ]
    const list = tasks.map(t => `• *${t.id}*\n  ⏰ ${t.time} WITA | ${t.desc}`).join('\n\n')
    await sendText(sock, jid, `📋 *Magang Scheduler Tasks*\n\n${list}\n\n_Scheduler otomatis aktif saat bot restart._`, m)
}

handler.pluginName = 'scheduler magang'
handler.command = ['magang-status']
handler.category = ['magang']
handler.description = 'Cek status scheduler absen magang.'

handler.config = {
    systemPlugin: true,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'scheduler-magang.js',
    version: '1.0.0',
    author: 'Akmal'
}

export default handler
