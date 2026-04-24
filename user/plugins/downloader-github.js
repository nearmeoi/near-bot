import axios from 'axios'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import util from 'util'
import archiver from 'archiver'
import { sendText } from '#helper' // Sesuaikan dengan template Near Bot kamu

const execPromise = util.promisify(exec)
const githubRegex = /(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, jid, text, q, command, prefix }) {
    
    // Near Bot biasanya menggunakan 'text' untuk argumen setelah command
    if (!text && !q?.text) {
        return sendText(sock, jid, `❌ Format salah.\nContoh: *${prefix}${command} https://github.com/user/repo*`, m)
    }

    const noCaption = text?.includes('-c')
    const cleaned = text?.replace('-c', '').trim()
    
    let match = cleaned?.match(githubRegex) || q?.text?.match(githubRegex)

    if (!match) {
        return sendText(sock, jid, '❌ Link GitHub tidak valid!', m)
    }

    const owner = match[1]
    const repo = match[2].replace(/\.git$/, '')
    const repoUrl = `https://github.com/${owner}/${repo}`

    // Gunakan folder temp yang aman
    const tmpFolder = path.join(process.cwd(), 'temp_git')
    const repoPath = path.join(tmpFolder, `${repo}_${Date.now()}`)
    const zipPath = `${repoPath}.zip`

    try {
        if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true })

        await sock.sendMessage(jid, { react: { text: '🕓', key: m.key } })

        // Ambil info repo
        const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`).catch(() => ({ data: null }))

        // Clone repo
        await execPromise(`git clone --depth=1 ${repoUrl} "${repoPath}"`)

        // Proses Zipping
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        
        await new Promise((resolve, reject) => {
            output.on('close', resolve)
            archive.on('error', reject)
            archive.pipe(output)
            archive.directory(repoPath, false)
            archive.finalize()
        })

        const caption = data ? 
            `📦 *${data.full_name}*\n\n` +
            `👤 Owner: ${data.owner.login}\n` +
            `⭐ Stars: ${data.stargazers_count}\n` +
            `📝 Language: ${data.language}\n` +
            `🔗 ${data.html_url}` : `Berhasil mengunduh repo: ${repo}`

        await sock.sendMessage(jid, {
            document: fs.readFileSync(zipPath),
            fileName: `${repo}.zip`,
            mimetype: 'application/zip',
            caption: noCaption ? '' : caption
        }, { quoted: m })

        // Cleanup
        fs.rmSync(repoPath, { recursive: true, force: true })
        fs.rmSync(zipPath, { force: true })
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })

    } catch (err) {
        console.error(err)
        // cleanup on failure
        if (fs.existsSync(repoPath)) fs.rmSync(repoPath, { recursive: true, force: true })
        if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true })
        await sendText(sock, jid, '❌ Gagal memproses repository.', m)
    }
}

// ==========================================
// === METADATA PLUGIN (SESUAI TEMPLATE) ====
// ==========================================

handler.pluginName = 'downloader github'
handler.command = ['gitclone', 'gh']
handler.category = ['downloader']
handler.description = 'Clone repository GitHub dan kirim dalam bentuk file ZIP.'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'downloader-github.js',
    version: '2.0.0',
    author: 'Kado',
    note: 'Support regex & -c flag'
}

export default handler