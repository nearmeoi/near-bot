/**
 * Test Absen AI Generation and Parsing Logic
 * This script verifies that the AI (Groq) generates the report correctly
 * and that the bot can parse it without cutting off mid-sentence.
 */

import 'dotenv/config'
import { smartChat } from './system/services/ai-service.js'

// --- Copy of Parsing Logic from user/plugins/absen.js (v2.1.3) ---
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

async function test() {
    console.log('--- TEST ABSEN AI GENERATION ---')
    
    const inputCerita = 'hari ini saya melanjutkan pengerjaan backend untuk proyek SIGAP PKM, memperbaiki beberapa error di bagian admin panel dan integrasi API auth. proses berjalan lancar tanpa kendala.'
    
    const sysPrompt = `Kamu adalah Asisten Penulis Laporan Magang Profesional (Senior Level).
TUGAS: Ubah cerita user menjadi laporan formal 3 bagian: [AKTIVITAS], [PEMBELAJARAN], [KENDALA].

ATURAN WAJIB (MANDAT):
1. WAJIB menggunakan kata kerja berawalan 'Me-' (Melanjutkan, Mengerjakan, Menganalisis, Memperbaiki, Mengimplementasi).
2. DILARANG menggunakan bahasa kaku/bot-like: "Guna memastikan", "Demi meningkatkan", "Sebagai langkah", "Hal ini dilakukan untuk".
3. JANGAN pakai list, bullet point, atau angka. Gunakan 1 paragraf padat per bagian.
4. PANJANG: Setiap bagian WAJIB minimal 150-300 karakter. Jika cerita user pendek, kembangkan secara kreatif dan profesional.
5. KENDALA: Jika lancar, jelaskan secara mendalam tentang kelancaran koordinasi dan efisiensi alur kerja.
6. WAJIB SELESAIKAN KALIMAT. Jangan sampai terputus.
7. Output HANYA dengan format:
[AKTIVITAS]
(isi paragraf)

[PEMBELAJARAN]
(isi paragraf)

[KENDALA]
(isi paragraf)`

    const userPrompt = `CERITA USER: "${inputCerita}"\n\nBuat laporan magang sangat detail (min 150 karakter per section). Pastikan kalimat selesai sempurna.`

    console.log(`Input: "${inputCerita}"\n`)
    console.log('Waiting for AI (Groq)...')
    
    const start = Date.now()
    const res = await smartChat(userPrompt, sysPrompt)
    const end = Date.now()
    
    if (!res.success) {
        console.error('AI Failed:', res.pesan)
        return
    }
    
    console.log(`Response received in ${((end - start)/1000).toFixed(2)}s using ${res.model}\n`)
    console.log('--- RAW CONTENT ---')
    console.log(res.content)
    console.log('\n--- PARSED RESULT ---')
    
    const report = parseReport(res.content)
    
    console.log(`[AKTIVITAS] (${report.aktivitas.length} chars):`)
    console.log(report.aktivitas || 'EMPTY!')
    console.log(`\n[PEMBELAJARAN] (${report.pembelajaran.length} chars):`)
    console.log(report.pembelajaran || 'EMPTY!')
    console.log(`\n[KENDALA] (${report.kendala.length} chars):`)
    console.log(report.kendala || 'EMPTY!')
    
    // Check validation
    const isValid = report.aktivitas.length >= 140 && report.pembelajaran.length >= 140 && report.kendala.length >= 120
    console.log(`\nStatus Validation: ${isValid ? '✅ PASS' : '❌ FAIL'}`)
}

test().catch(err => console.error(err))
