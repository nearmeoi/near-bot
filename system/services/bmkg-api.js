import axios from 'axios'
import * as cheerio from 'cheerio'

const DATA_BASE_URL = 'https://data.bmkg.go.id/DataMKG/TEWS'
const API_BASE_URL = 'https://api.bmkg.go.id/publik'
const WEB_BASE_URL = 'https://www.bmkg.go.id'

/**
 * Service to interact with BMKG Open Data and Website Scraper
 */
export const bmkgApi = {
    /**
     * Scrape the BMKG homepage for current weather and earthquake info
     */
    async scrapeMainPage() {
        try {
            const response = await axios.get(WEB_BASE_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
            const $ = cheerio.load(response.data)

            // Scrape Weather (Cuaca Saat Ini)
            const weatherData = []
            $('.px-6.py-5.rounded-2xl').each((i, el) => {
                const city = $(el).find('p.text-xl').text().trim()
                const time = $(el).find('p.text-sm.text-gray-primary').text().trim()
                const temp = $(el).find('p.text-\\[32px\\]').text().trim() || $(el).find('p:contains("°C")').text().trim()
                const desc = $(el).find('p.text-sm.font-medium').last().text().trim()
                if (city) weatherData.push({ city, time, temp, desc })
            })

            // Scrape Earthquake (Gempa Bumi Terkini)
            const magEl = $('p:contains("Magnitudo:")')
            const gempa = {
                time: $('p:contains("WIB")').first().text().trim() || $('span:contains("WIB")').first().text().trim(),
                desc: magEl.closest('div').parent().find('h3').text().trim() || $('h3:contains("Pusat gempa")').text().trim(),
                magnitude: magEl.parent().find('span').text().trim(),
                kedalaman: $('p:contains("Kedalaman:")').parent().find('span').text().trim(),
                koordinat: $('p:contains("Koordinat:")').parent().find('span').text().trim(),
            }

            return { success: true, weather: weatherData, gempa }
        } catch (error) {
            return { success: false, pesan: error.message }
        }
    },

    /**
     * Get the latest earthquake (Magnitude > 5.0)
     */
    async getLatestGempa() {
        try {
            const response = await axios.get(`${DATA_BASE_URL}/autogempa.json`)
            if (response.data?.Infogempa?.gempa) {
                return { success: true, data: response.data.Infogempa.gempa }
            }
            return { success: false, pesan: 'Data gempa tidak ditemukan.' }
        } catch (error) {
            return { success: false, pesan: error.message }
        }
    },

    /**
     * Get the 15 latest earthquakes
     */
    async getRecentGempa() {
        try {
            const response = await axios.get(`${DATA_BASE_URL}/gempaterkini.json`)
            if (response.data?.Infogempa?.gempa) {
                return { success: true, data: response.data.Infogempa.gempa }
            }
            return { success: false, pesan: 'Data gempa terkini tidak ditemukan.' }
        } catch (error) {
            return { success: false, pesan: error.message }
        }
    },

    /**
     * Get weather forecast for a specific ADM4 (Kelurahan/Desa) code
     * Default: 73.71.01.1001 (Mariso, Makassar)
     */
    async getWeather(adm4 = '73.71.01.1001') {
        try {
            const response = await axios.get(`${API_BASE_URL}/prakiraan-cuaca`, {
                params: { adm4 }
            })
            if (response.data?.data?.[0]) {
                return { success: true, data: response.data.data[0] }
            }
            return { success: false, pesan: 'Data cuaca tidak ditemukan.' }
        } catch (error) {
            return { success: false, pesan: error.message }
        }
    },

    /**
     * Simple mapping for common cities to ADM4 codes
     */
    getCityCode(cityName) {
        const cityMap = {
            'jakarta': '31.71.01.1001', // Gambir
            'bandung': '32.73.08.1001', // Coblong
            'surabaya': '35.78.14.1001', // Genteng
            'medan': '12.71.01.1001', // Medan Kota
            'makassar': '73.71.01.1001', // Mariso
            'semarang': '33.74.08.1001', // Semarang Tengah
            'yogyakarta': '34.71.01.1001', // Danurejan
            'palembang': '16.71.01.1001', // Ilir Timur I
            'denpasar': '51.71.01.1001', // Denpasar Barat
        }
        return cityMap[cityName.toLowerCase()] || null
    }
}
