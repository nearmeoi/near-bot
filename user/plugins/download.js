// 1. IMPORT MODULE
import { sendText, consumeRate } from '#helper'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const execAsync = promisify(exec)

// Full path yt-dlp
const YT_DLP = process.env.YT_DLP_PATH || 'yt-dlp'

// Cleanup stale temp_dl_* directories on load
const TEMP_DIR_PATTERN = /^temp_dl_/
try {
    const entries = fs.readdirSync(process.cwd())
    for (const entry of entries) {
        if (TEMP_DIR_PATTERN.test(entry)) {
            const fullPath = path.join(process.cwd(), entry)
            const stat = fs.statSync(fullPath)
            // Remove if older than 1 hour
            if (Date.now() - stat.mtimeMs > 3600000) {
                fs.rmSync(fullPath, { recursive: true, force: true })
                console.log(`[AIO] Cleaned stale temp dir: ${entry}`)
            }
        }
    }
} catch (e) {
    console.error('[AIO] Temp cleanup error:', e.message)
}

// DATA COOKIES INSTAGRAM
const IG_COOKIES_DATA = process.env.IG_COOKIES_DATA || ''

const COOKIE_HEADER = "# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\n"

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles
    const files = fs.readdirSync(dirPath)
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file)
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
        } else {
            arrayOfFiles.push(fullPath)
        }
    })
    return arrayOfFiles
}

// Convert video ke format WhatsApp-compatible TAPI TETAP HD
async function convertToWAFormat(inputFile) {
    const outputFile = inputFile.replace(/\.(mp4|webm|mov|mkv)$/, '_wa.mp4')
    try {
        // MANTAP: Tetap HD, cuma fix codec doang
        await execAsync(
            `ffmpeg -i "${inputFile}" -c:v libx264 -crf 23 -preset fast -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${outputFile}"`,
            { maxBuffer: 10485760 }
        )
        fs.unlinkSync(inputFile)
        return outputFile
    } catch (e) {
        console.error('[AIO] Convert error:', e.message)
        return inputFile
    }
}

async function handler({ sock, m, text, jid, command, prefix }) {
    if (!consumeRate(m.senderId)) return await sendText(sock, jid, '⏳ Terlalu sering, coba lagi nanti.', m)

    if (!text) return await sendText(sock, jid, `Cara pake:\n*${prefix}${command} [link]*`, m)

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/g)
    if (!urlMatch) return await sendText(sock, jid, `⚠️ Link valid mana bro?`, m)
    
    let url = urlMatch[0].split('?')[0]
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } })

    const sessionId = crypto.randomBytes(6).toString('hex')
    const dlDir = path.resolve(`./temp_dl_${sessionId}`)
    const cookiePath = path.join(dlDir, 'cookies.txt')

    if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir, { recursive: true })

    const isInstagram = url.includes('instagram.com')
    const isTiktok = url.includes('tiktok.com')

    try {
        // INSTAGRAM: yt-dlp + cookies
        if (isInstagram) {
            fs.writeFileSync(cookiePath, COOKIE_HEADER + IG_COOKIES_DATA)
            await execAsync(`${YT_DLP} --cookies "${cookiePath}" -P "${dlDir}" "${url}"`, { maxBuffer: 10485760 })
        }
        // TIKTOK: yt-dlp dulu, fallback gallery-dl
        else if (isTiktok) {
            try {
                await execAsync(`${YT_DLP} -P "${dlDir}" "${url}"`, { maxBuffer: 10485760 })
            } catch (err) {
                console.log('[AIO] TikTok photos, using gallery-dl...')
                await execAsync(`gallery-dl -d "${dlDir}" "${url}"`, { maxBuffer: 10485760 })
            }
        }
        // OTHERS: yt-dlp langsung
        else {
            await execAsync(`${YT_DLP} -P "${dlDir}" "${url}"`, { maxBuffer: 10485760 })
        }

    } catch (e) {
        console.error('[AIO] Error:', e.message)
        if (fs.existsSync(dlDir)) fs.rmSync(dlDir, { recursive: true, force: true })
        return await sendText(sock, jid, `❌ Gagal download`, m)
    }

    // KIRIM FILE
    try {
        let allFiles = getAllFiles(dlDir).filter(f => !f.endsWith('cookies.txt'))
        if (allFiles.length === 0) throw new Error("Empty")

        const isCarousel = allFiles.length > 1
        const sendOpt = isCarousel ? {} : { quoted: m }

        for (let f of allFiles) {
            const ext = path.extname(f).toLowerCase()

            if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) {
                // Convert dulu ke format WA (tetap HD)
                console.log('[AIO] Converting to WA-compatible format (HD maintained)...')
                f = await convertToWAFormat(f)
                
                await sock.sendMessage(jid, { 
                    video: { url: f }, 
                    caption: isCarousel ? '' : 'Done Bang' 
                }, sendOpt)
            } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                await sock.sendMessage(jid, { image: { url: f } }, sendOpt)
            } else if (['.mp3', '.m4a', '.opus'].includes(ext)) {
                await sock.sendMessage(jid, { audio: { url: f }, mimetype: 'audio/mp4' }, sendOpt)
            } else {
                await sock.sendMessage(jid, { document: { url: f }, fileName: path.basename(f) }, sendOpt)
            }
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })

    } catch (err) {
        await sendText(sock, jid, `❌ Gagal kirim: ${err.message}`, m)
    } finally {
        if (fs.existsSync(dlDir)) fs.rmSync(dlDir, { recursive: true, force: true })
    }
}

handler.pluginName = 'AIO Downloader'
handler.command = ['dl', 'yt', 'ig', 'tt', 'fb', 'download']
handler.category = ['downloader']
handler.meta = {
    fileName: "download.js",
    version: "3.5.0",
    author: "near",
    note: "HD quality maintained with WA mobile compatibility"
}

export default handler