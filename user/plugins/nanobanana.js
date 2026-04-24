import axios from 'axios'
import { sendText, consumeRate } from '#helper'

// Fungsi jeda biar bot nggak ngebom request ke server API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, text, jid, prefix, command }) {
    if (!consumeRate(m.senderId)) return await sendText(sock, jid, '⏳ Terlalu sering, coba lagi nanti.', m)

    if (!text) {
        const p = prefix || '.'
        return await sendText(sock, jid, `Kasih prompt gambarnya !\nContoh: *${p}${command} makima chainsaw man in a cyberpunk city, neon lights, 4k*`, m)
    }

    // Kasih tau user kalau ini bakal makan waktu
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } })
    await sendText(sock, jid, 'Tunggu bentar, AI lagi prosess...', m)

    try {
        // TAHAP 1: Request Pembuatan Task
        const createRes = await axios.post(
            'https://nanobanana-unlimited.p.rapidapi.com/v1/images/generations',
            { prompt: text },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': 'nanobanana-unlimited.p.rapidapi.com',
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY
                }
            }
        )

        const taskData = createRes.data

        if (!taskData.success || !taskData.url) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } })
            return await sendText(sock, jid, 'Maaf, Gagal bikin task di server API.', m)
        }

        const pollUrl = taskData.url
        let isCompleted = false
        let finalImageUrl = null
        let attempts = 0
        const maxAttempts = 30 // Maksimal 30 kali ngecek (sekitar 2.5 menit)

        // TAHAP 2: Long Polling (Ngecek status tiap 5 detik)
        while (!isCompleted && attempts < maxAttempts) {
            await delay(5000) // Jeda 5 detik tiap ngecek
            attempts++

            try {
                const checkRes = await axios.get(pollUrl)
                const checkData = checkRes.data

                if (checkData.status === 'completed' && checkData.result?.url) {
                    isCompleted = true
                    finalImageUrl = checkData.result.url
                } else if (checkData.status === 'failed') {
                    throw new Error('Server API gagal menggenerate gambar.')
                }
                // Kalau masih 'pending', loop bakal muter lagi
            } catch (pollErr) {
                console.log(`[Polling info] Attempt ${attempts} failed/pending...`)
                // Tetap lanjut looping walaupun gagal fetch sesekali
            }
        }

        // TAHAP 3: Kirim Hasil
        if (isCompleted && finalImageUrl) {
            await sock.sendMessage(jid, {
                image: { url: finalImageUrl },
                caption: `*Done bang!*`
            }, { quoted: m })
            
            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })
        } else {
            // Kalau udah nyentuh maxAttempts tapi belum kelar juga
            await sock.sendMessage(jid, { react: { text: '⚠️', key: m.key } })
            await sendText(sock, jid, '⚠️ Waduh, API-nya lagi lemot bang.', m)
        }

    } catch (err) {
        console.error('[Error NanoBanana]:', err)
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } })
        await sendText(sock, jid, `❌ Ada error pas nge-hit API: ${err.message}`, m)
    }
}

handler.pluginName = 'Nano Banana Image Generator'
handler.description = 'Generate gambar AI dari text prompt (dengan sistem long polling).'
handler.command = ['txt2img', 'nano', 'imagine']
handler.category = ['ai']

handler.meta = {
    fileName: 'nanobanana.js',
    version: '1.0.0',
    author: 'near',
    note: 'Menggunakan API dengan mekanisme polling 5 detik.'
}

export default handler