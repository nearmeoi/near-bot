/**
 * Plugin: Absen Magang
 * Mengirim laporan absensi harian ke Kemnaker dengan bantuan AI.
 * 
 * Flow:
 * 1. User ketik .absen [cerita] -> AI generate draf -> Simpan di draft-store -> Kirim preview (Button)
 * 2. User klik "Ya" -> Ambil draf -> Submit ke Kemnaker via magang-api -> Selesai.
 * 3. User klik "Batal" -> Hapus draf.
 */

import { sendText } from '#helper'
import { checkAttendanceStatus, submitAttendance, getAttendanceHistory } from '../../system/services/magang-api.js'
import { smartChat } from '../../system/services/ai-service.js'
import { findUser } from '../../system/services/user-registry.js'
import { getDraft, setDraft, deleteDraft, formatPreview } from '../../system/services/draft-store.js'

const MIN_REPORT_LENGTH = 140
const MIN_REPORT_LENGTH_KENDALA = 120
const MAX_RETRIES = 3

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m, text, command }) {
    const senderId = m.senderId

    // === 1. Handle "cancel-absen" ===
    if (command === 'cancel-absen') {
        if (!getDraft(senderId)) return sendText(sock, jid, '❌ Tidak ada draf aktif untuk dibatalkan.', m)
        deleteDraft(senderId)
        return sendText(sock, jid, '🗑️ Draf absensi berhasil dibatalkan.', m)
    }

    // === 2. Handle "ya" (Konfirmasi & Submit) ===
    if (command === 'ya') {
        const draft = getDraft(senderId)
        if (!draft) return 

        const user = findUser(senderId)
        if (!user) return sendText(sock, jid, '❌ Data kamu tidak ditemukan. Silakan daftar ulang.', m)

        await sendText(sock, jid, '📤 Sedang mengirim laporan ke Kemnaker, mohon tunggu...', m)
        
        try {
            const result = await submitAttendance(user.email, user.password, draft)
            if (result.success) {
                deleteDraft(senderId)
                return sendText(sock, jid, `✅ *Absensi Berhasil Terkirim!*\n\nLaporan harian kamu sudah masuk ke sistem Kemnaker.\n_Jangan lupa cek status approval secara berkala._`, m)
            } else {
                return sendText(sock, jid, `❌ *Gagal Submit:* ${result.pesan}`, m)
            }
        } catch (err) {
            return sendText(sock, jid, `❌ *Terjadi Kesalahan:* ${err.message}`, m)
        }
    }

    // === 3. Handle ".absen" (Generate Laporan) ===
    if (command !== 'absen') return

    const user = findUser(senderId)
    if (!user) {
        return sendText(sock, jid, '❌ Kamu belum terdaftar di sistem bot.\nKetik *.daftar [email] [password]* untuk memulai.', m)
    }

    // Cek apakah sudah absen hari ini
    await sendText(sock, jid, '⏳ Mengecek status kehadiran hari ini...', m)
    const statusCheck = await checkAttendanceStatus(user.email, user.password)
    
    if (statusCheck.success && statusCheck.sudahAbsen) {
        return sendText(sock, jid, '✅ Kamu sudah melakukan absensi hari ini. Tidak perlu mengirim laporan lagi.', m)
    }

    // Siapkan input untuk AI
    let inputCerita = text || user.template || ''
    if (!inputCerita) {
        return sendText(sock, jid, `❌ *Cara Penggunaan:*\n\n*.absen [apa yang kamu kerjakan hari ini]*\nContoh: _.absen hari ini saya menyelesaikan slicing halaman login dan integrasi API auth._`, m)
    }

    if (text && user.template && text.length < 50) {
        inputCerita = `${text}. ${user.template}`
    }

    const history = await getAttendanceHistory(user.email, user.password, 2)
    const historyContext = (history.success && history.logs?.length > 0)
        ? '\nRIWAYAT SEBELUMNYA:\n' + history.logs.map(l => `- ${l.activity_log.substring(0, 100)}...`).join('\n')
        : ''

    const userProfile = user.context ? `PROFIL: ${user.context}\n` : ''

    // SYSTEM PROMPT - Mandat Ketat
    const sysPrompt = `Kamu adalah Asisten Penulis Laporan Magang Profesional (Senior Level).
TUGAS: Ubah cerita user menjadi laporan formal 3 bagian: [AKTIVITAS], [PEMBELAJARAN], [KENDALA].

ATURAN WAJIB (MANDAT):
1. WAJIB menggunakan kata kerja berawalan 'Me-' (Melanjutkan, Mengerjakan, Menganalisis, Memperbaiki, Mengimplementasi).
2. DILARANG menggunakan bahasa kaku/bot-like: "Guna memastikan", "Demi meningkatkan", "Sebagai langkah", "Hal ini dilakukan untuk".
3. DILARANG mengulang-ulang frasa pembuka yang sama (misal: "Hari ini saya melanjutkan..." di setiap bagian). Variasikan awal kalimat.
4. STRUKTUR KALIMAT: Gunakan titik (.) untuk memisahkan pikiran. Hindari satu paragraf yang hanya berisi satu kalimat panjang yang disambung-sambung dengan koma (run-on sentence).
5. PANJANG: Setiap bagian WAJIB minimal 150-300 karakter. Kembangkan cerita user dengan detail teknis yang logis dan profesional.
6. KENDALA: Jika lancar, jelaskan secara mendalam tentang efisiensi alur kerja, koordinasi tim yang baik, atau manajemen waktu yang efektif.
7. WAJIB SELESAIKAN KALIMAT. Jangan sampai terputus.
8. Output HANYA dengan format:
[AKTIVITAS]
(isi paragraf)

[PEMBELAJARAN]
(isi paragraf)

[KENDALA]
(isi paragraf)`

    const userPrompt = `${userProfile}${historyContext}\n\nCERITA USER: "${inputCerita}"\n\nBuat laporan magang sangat detail (min 150 karakter per section). Pastikan kalimat selesai sempurna.`

    await sendText(sock, jid, '🤖 AI sedang menyusun laporan detail (Groq Engine)...', m)

    // Robust parsing function
    const parseReport = (content) => {
        const sections = { aktivitas: '', pembelajaran: '', kendala: '' }
        const parts = content.split(/\[(AKTIVITAS|PEMBELAJARAN|KENDALA)\]/i)
        
        for (let i = 1; i < parts.length; i += 2) {
            const key = parts[i].toLowerCase()
            const value = parts[i + 1] ? parts[i + 1].trim() : ''
            if (sections.hasOwnProperty(key)) {
                sections[key] = value
                    .replace(/[*#]/g, '')
                    .replace(/\s+/g, ' ')
                    .replace(/^[:\s-]*/, '')
            }
        }
        return sections
    }

    // === Retry Logic (Internal Validation) ===
    let report = { aktivitas: '', pembelajaran: '', kendala: '' }
    let attempt = 0

    while (attempt < MAX_RETRIES) {
        attempt++
        const aiRes = await smartChat(attempt === 1 ? userPrompt : `${userPrompt}\n\n⚠️ PERINGATAN: Hasil sebelumnya terlalu pendek atau format salah. Pastikan setiap bagian [AKTIVITAS], [PEMBELAJARAN], [KENDALA] memiliki minimal 150 karakter.`, sysPrompt, m.senderId)
        
        if (!aiRes.success) break

        report = parseReport(aiRes.content)

        // Validasi Panjang
        if (report.aktivitas.length >= MIN_REPORT_LENGTH && report.pembelajaran.length >= MIN_REPORT_LENGTH && report.kendala.length >= MIN_REPORT_LENGTH_KENDALA) {
            break
        }
        
        if (attempt < MAX_RETRIES) {
            console.log(`[ABSEN] AI output too short (${report.aktivitas.length}/${report.pembelajaran.length}/${report.kendala.length}). Retrying ${attempt+1}...`)
        }
    }

    const { aktivitas, pembelajaran, kendala } = report

    if (!aktivitas || !pembelajaran) {
        return sendText(sock, jid, '❌ AI gagal menyusun laporan dengan format yang benar. Silakan coba berikan cerita yang lebih detail.', m)
    }

    const draftData = { aktivitas, pembelajaran, kendala }
    setDraft(senderId, draftData, { source: 'AI Engine v2.1.3' })

    const preview = formatPreview(draftData, { source: 'Draf AI Detail' })
    
    const interactiveMessage = {
        interactiveMessage: {
            body: { text: preview },
            footer: { text: 'Near Bot • Magang Automation' },
            nativeFlowMessage: {
                buttons: [
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Ya, Kirim Sekarang", id: ".ya" }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Batal / Hapus", id: ".cancel-absen" }) }
                ],
                messageParamsJson: JSON.stringify({ bottom_sheet: { list_title: "Konfirmasi Absen", button_title: "Opsi", in_thread_buttons_limit: 2 } })
            }
        }
    }

    await sock.relayMessage(jid, interactiveMessage, {
        additionalNodes: [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }]
    })
}

handler.pluginName = 'absen magang'
handler.command = ['absen', 'ya', 'cancel-absen']
handler.category = ['magang']
handler.description = 'Laporan absensi harian Kemnaker otomatis (Detail Mode).'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'absen.js',
    version: '2.1.4',
    author: 'Akmal'
}

export default handler