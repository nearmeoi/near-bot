import { sendText } from '#helper'

/**
 * Plugin Mengunduh & Mengirim Ulang Gambar (Anti View Once / Resend)
 * * @param {import('../../system/types/plugin.js').HandlerParams} params 
 */
async function handler({ sock, m, q, text, jid, command, prefix }) {
    try {
        const { downloadContentFromMessage } = await import('baileys')

        // Mengecek apakah gambar dikirim langsung atau dengan me-reply gambar
        const isImage = m.message?.imageMessage || m.message?.viewOnceMessageV2?.message?.imageMessage
        const isQuotedImage = q?.message?.imageMessage || q?.message?.viewOnceMessageV2?.message?.imageMessage

        if (!isImage && !isQuotedImage) {
            return sendText(sock, jid, `Kirim/Balas gambar dengan perintah *${prefix || '.'}${command}* untuk mengunduhnya ✨`, m)
        }

        // Ambil payload image message-nya
        const imgMsg = isQuotedImage || isImage
        
        // Proses download stream dari server WhatsApp
        const stream = await downloadContentFromMessage(imgMsg, 'image')
        let buffer = Buffer.from([])
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        // Kirim kembali hasilnya
        await sock.sendMessage(jid, { 
            image: buffer, 
            caption: text || 'Ini fotonya ✨' 
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        return sendText(sock, jid, `Gagal mengunduh gambar.`, m)
    }
}

// ==========================================
// === METADATA PLUGIN (WAJIB DIISI) ========
// ==========================================

handler.pluginName = 'download image' 

handler.command = ['getimg', 'rvo', 'ambil', 'nono', 'apatuh'] 

handler.category = ['tools'] 

handler.description = 'Mengunduh dan mengirim ulang gambar (Bisa untuk Anti View Once).' 

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'download-image.js',
    version: '1.0.1', 
    author: 'Near Bot User', 
    note: 'Gunakan dengan cara reply gambar'
}

export default handler