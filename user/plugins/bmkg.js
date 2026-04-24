import { bmkgApi } from '../../system/services/bmkg-api.js'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'baileys'
import { sendText, consumeRate } from '#helper'

/**
 * Handler for BMKG commands (Earthquake, Weather, Info)
 */
async function handler({ sock, m, text, jid, command }) {
    if (!consumeRate(m.senderId)) return await sendText(sock, jid, '⏳ Terlalu sering, coba lagi nanti.', m)

    const target = m.q || m

    // --- GEMPA COMMAND ---
    if (command === 'gempa') {
        const res = await bmkgApi.getLatestGempa()
        if (!res.success) return await sendText(sock, jid, `❌ Gagal ambil data gempa: ${res.pesan}`, target)

        const g = res.data
        const shakemapUrl = `https://static.bmkg.go.id/${g.Shakemap}`

        let caption = `*INFO GEMPA TERKINI (M > 5.0)*\n\n`
        caption += `📅 *Waktu:* ${g.Tanggal} | ${g.Jam}\n`
        caption += `📏 *Magnitudo:* ${g.Magnitude}\n`
        caption += `📉 *Kedalaman:* ${g.Kedalaman}\n`
        caption += `📍 *Lokasi:* ${g.Wilayah}\n`
        caption += `🗺️ *Koordinat:* ${g.Coordinates}\n`
        caption += `⚠️ *Potensi:* ${g.Potensi}\n`
        if (g.Dirasakan) caption += `🔔 *Dirasakan:* ${g.Dirasakan}\n`
        caption += `\n_Hati-hati terhadap gempabumi susulan._`

        try {
            const media = await prepareWAMessageMedia({ image: { url: shakemapUrl } }, { upload: sock.waUploadToServer })

            const msg = generateWAMessageFromContent(jid, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({ text: caption }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: 'Near Bot - Sumber: BMKG' }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                hasMediaAttachment: true,
                                imageMessage: media.imageMessage
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: [
                                    {
                                        name: "cta_url",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "Peta BMKG",
                                            url: "https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg"
                                        })
                                    }
                                ]
                            })
                        })
                    }
                }
            }, { userJid: sock.user.id, quoted: target })

            return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
        } catch (e) {
            return await sock.sendMessage(jid, { image: { url: shakemapUrl }, caption }, { quoted: target })
        }
    }

    // --- CUACA COMMAND ---
    if (command === 'cuaca') {
        const city = text?.trim() || 'Jakarta'
        const code = bmkgApi.getCityCode(city)

        if (!code && text) return await sendText(sock, jid, `❌ Maaf, kode wilayah untuk "${city}" belum tersedia. Coba: Jakarta, Bandung, Surabaya, Medan, Makassar.`, target)

        const res = await bmkgApi.getWeather(code || '31.71.01.1001')
        if (!res.success) return await sendText(sock, jid, `❌ Gagal ambil data cuaca: ${res.pesan}`, target)

        const w = res.data
        // BMKG API returns prakiraan as an array of arrays (grouped by day)
        const cur = w.prakiraan?.[0]?.[0]

        if (!cur) return await sendText(sock, jid, `❌ Data prakiraan tidak tersedia untuk ${city}.`, target)

        let txt = `*PRAKIRAAN CUACA - ${w.lokasi.kota.toUpperCase()}*\n\n`
        txt += `📅 *Waktu:* ${cur.local_datetime}\n`
        txt += `🌡️ *Suhu:* ${cur.t} °C\n`
        txt += `💧 *Kelembapan:* ${cur.hu}%\n`
        txt += `☁️ *Kondisi:* ${cur.weather_desc}\n`
        txt += `💨 *Angin:* ${cur.ws} km/jam (${cur.wd})\n`
        txt += `🌥️ *Awan:* ${cur.tcc}%\n`
        txt += `👁️ *Jarak Pandang:* ${cur.vs_text}\n\n`
        txt += `_Sumber: API BMKG_`

        return await sendText(sock, jid, txt, target)
    }

    // --- BMKG SUMMARY COMMAND ---
    if (command === 'bmkg') {
        const scrape = await bmkgApi.scrapeMainPage()

        if (!scrape.success) {
            return await sendText(sock, jid, `❌ Gagal scrape data BMKG: ${scrape.pesan}`, target)
        }

        let summary = `*RINGKASAN BMKG - REALTIME*\n\n`

        // Gempa from scraper
        const g = scrape.gempa
        summary += `🚩 *Gempa Terkini:* ${g.magnitude} | ${g.time}\n`
        summary += `📍 ${g.desc} (${g.koordinat})\n\n`

        summary += `☁️ *Cuaca Saat Ini:*\n`

        // Priority for Makassar if it exists in scraper
        const makassar = scrape.weather.find(w => w.city.toLowerCase().includes('makassar'))
        if (makassar) {
            summary += `➡️ *${makassar.city}:* ${makassar.temp} - ${makassar.desc}\n`
        }

        // Show a few others
        scrape.weather.slice(0, 5).forEach(w => {
            if (!w.city.toLowerCase().includes('makassar')) {
                summary += `• *${w.city}:* ${w.temp} - ${w.desc}\n`
            }
        })

        summary += `\nKetik *.gempa* untuk detail peta atau *.cuaca [kota]* untuk prakiraan 3 hari.`
        return await sendText(sock, jid, summary, target)
    }
}

handler.command = ['bmkg', 'gempa', 'cuaca']
handler.help = ['bmkg', 'gempa', 'cuaca [kota]']
handler.category = ['info']
handler.pluginName = 'BMKG Info'
handler.meta = {
    fileName: 'bmkg.js',
    author: 'akmal'
}

export default handler
