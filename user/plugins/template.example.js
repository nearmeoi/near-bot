import { sendText } from '#helper'

/**
 * Template Plugin Near Bot
 * Copy file ini ke folder user/plugins/nama-plugin.js untuk membuat plugin baru.
 * 
 * @param {import('../../system/types/plugin.js').HandlerParams} params 
 */
async function handler({ sock, m, q, text, jid, command, prefix }) {
    // === TULIS LOGIKA PROGRAM KAMU DI SINI ===
    
    // Contoh 1: Mengambil argumen/teks setelah command
    // Jika user ngetik: .contoh halo dunia
    // Maka nilai text = "halo dunia"
    if (!text) {
        return sendText(sock, jid, `Ketik format yang benar: ${prefix}${command} [teks]`, m)
    }

    // Contoh 2: Membalas pesan
    const balasan = `Berhasil! Kamu mengetik: ${text}`
    return sendText(sock, jid, balasan, m)
    
}

// ==========================================
// === METADATA PLUGIN (WAJIB DIISI) ========
// ==========================================

// Nama plugin untuk ditampilkan di console log (Gunakan huruf kecil semua)
handler.pluginName = 'template plugin' 

// Command / Perintah untuk memicu plugin ini (Bisa lebih dari 1, pisahkan dengan koma)
handler.command = ['contoh', 'test'] 

// Kategori plugin untuk ditampilkan di menu (Contoh: 'tools', 'game', 'islami', dll)
handler.category = ['kustom'] 

// Deskripsi singkat tentang fungsi plugin ini (Ditampilkan saat user cek menu detail)
handler.description = 'Ini adalah template dasar untuk membuat plugin baru.' 

// Konfigurasi sistem (Biarkan false untuk plugin buatan sendiri)
handler.config = {
    systemPlugin: false,  // Apakah ini bawaan sistem/core bot? (sebisa mungkin false)
    bypassPrefix: false   // Apakah command bisa dipanggil otomatis tanpa awalan titik/prefix?
}

// Info detail untuk credit/author
handler.meta = {
    fileName: 'namaplugin.js',  // Sesuaikan dengan nama file js kamu (opsional tapi disarankan)
    version: '1.0.0', 
    author: 'Nama Kamu', 
    note: 'Keterangan tambahan'
}

export default handler
