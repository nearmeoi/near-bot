import fs from 'fs';
import path from 'path';
import { textOnlyMessage, sendText, botInfo } from '#helper';

// Format ukuran file agar lebih mudah dibaca (misal: 1024 bytes -> 1 KB)
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * @param {import('../types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, jid, text }) {
    if (!textOnlyMessage(m)) return;

    // Menentukan target path (jika tidak ada parameter, gunakan folder saat ini/tempat bot berjalan)
    const targetPath = text ? path.resolve(text.trim()) : process.cwd();

    try {
        // Cek apakah lokasi benar-benar ada
        if (!fs.existsSync(targetPath)) {
            return await sendText(sock, jid, `❌ *Error:*\nPath/Lokasi tidak ditemukan:\n\`${targetPath}\``, m);
        }

        // Cek apakah itu file atau folder
        const stats = fs.statSync(targetPath);
        if (!stats.isDirectory()) {
            return await sendText(sock, jid, `❌ *Error:*\n\`${targetPath}\` bukan sebuah direktori/folder.`, m);
        }

        // Baca isi direktori
        const items = fs.readdirSync(targetPath);

        let folders = [];
        let files = [];
        let totalSize = 0;

        // Membagi item yang folder dan file, lalu hitung sizenya
        for (const item of items) {
            const itemPath = path.join(targetPath, item);
            try {
                const itemStats = fs.statSync(itemPath);
                if (itemStats.isDirectory()) {
                    folders.push(item);
                } else {
                    files.push({
                        name: item,
                        size: itemStats.size
                    });
                    totalSize += itemStats.size;
                }
            } catch (err) {
                // Abaikan error permission dinied dll
            }
        }

        // Menyusun tampilan output yang rapi ala command 'ls'
        let output = `📂 *Directory Insight*\n`;
        output += `📍 *Path:* \`${targetPath}\`\n\n`;

        if (folders.length === 0 && files.length === 0) {
            output += `*(Folder ini kosong)*`;
        } else {
            if (folders.length > 0) {
                output += `*📁 Folders (${folders.length}):*\n`;
                folders.forEach(f => {
                    output += `  ├ 📁 ${f}\n`;
                });
            }

            if (files.length > 0) {
                output += `\n*📄 Files (${files.length}):*\n`;
                files.forEach(f => {
                    output += `  ├ 📄 ${f.name} _(${formatBytes(f.size)})_\n`;
                });
            }
        }

        output += `\n💾 *Total File Size:* ${formatBytes(totalSize)}`;

        // Mencegah error jika teksnya terlalu panjang untuk WhatsApp
        if (output.length > 4000) {
            output = output.substring(0, 4000) + '...\n\n[Output terlalu panjang, dipotong]';
        }

        await sendText(sock, jid, output, m);

    } catch (err) {
        console.error(err);
        await sendText(sock, jid, `❌ *Gagal mengeksekusi ls:*\n${err.message}`, m);
    }
}

handler.pluginName = 'list directory'
handler.command = ['ls', 'dir']
handler.category = ['owner']
handler.description = 'Melihat isi direktori / folder server (Developer Only)\nPenggunaan:\n ls [lokasi folder]'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'ls.js',
    version: '1.0.0',
    author: 'AI Assistant',
    note: 'Directory Listing Utility'
}

export default handler;