import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'


// function try catch
export async function safeRunAsync(fn, ...params) {
    try {
        const result = await fn(...params)
        return { ok: true, data: result }
    } catch (error) {
        console.info('[safeRunAsync]', error.message)
        return { ok: false, data: error.message }
    }
}

export function safeRunSync(fn, ...params) {
    try {
        const result = fn(...params)
        return { ok: true, data: result }
    } catch (error) {
        console.info('[safeRunSync]', error.message)
        return { ok: false, data: error.message }
    }
}


// validator
export function vString(inputString, paramName = "param") {
    if (typeof (inputString) !== 'string' || !inputString.trim()) {
        throw Error(`${paramName} harus string dan gak boleh kosong.`)
    }
}


// other
export function getErrorLine(errorStack) {
    return errorStack.match(/t=\d+:(\d+):/)?.[1]
}

export function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)]
}

export function extractUrl(string) {
    const match = string.match(/https?:\/\/[^\s'`\\]+/g)
    const urls = []

    for (let i = 0; i < match?.length; i++) {
        const r = safeRunSync((u) => new URL(u), match[i])
        if (r.ok) urls.push(match[i])
    }

    return urls
}

export function getParam(text) {
    return text.match(/\S+/g)
}

export function dirPovCwd(path) {

    return '.' + path.replace(process.cwd(), '').replaceAll('\\', '/')
}

export function pluginSuccessInstallSerialize(module, dest) {
    const headers = `sukses!\n`
    const nCommand = `command: ${module.default.command.join(", ")}\n`
    const nCategory = `category: ${module.default.category.join(", ")}\n`
    const nAuthor = `author: ${module.default.meta.author}\n`
    const nAuthorNote = `author's note: ${module.default.meta.note}\n`
    const nVersion = `version: ${module.default.meta.version}\n`
    const nDir = `dir: ${dest}`

    const print = headers + nCommand + nCategory + nAuthor + nAuthorNote + nVersion + nDir
    return print
}


// [file io]
// async stream write
export async function writeFileStreamSafeAsync(destinationPath, sourceStream) {
    const dir = path.dirname(destinationPath)
    await fs.promises.mkdir(dir, { recursive: true })
    const destinationStream = fs.createWriteStream(destinationPath)
    await pipeline(sourceStream, destinationStream)
    console.log(`[writeFileStreamSafeAsync] ${destinationPath}`)
}
// async buffer write
export async function writeFileBufferSafeAsync(destinationPath, buffer) {
    const dir = path.dirname(destinationPath)
    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(destinationPath, buffer)
    console.log(`[writeFileBufferSafeAsync] ${destinationPath}`)
}

// async json safe with fallback
export async function readJsonWithFallbackAsync(path, fallbackValue = {}) {
    const res = await safeRunAsync(fs.promises.readFile, path)
    if (res.ok) {
        console.log('[readJsonWithFallback] loaded from valid path ' + path)
        return JSON.parse(res.data)
    } else {
        const data = JSON.stringify(fallbackValue, null, 2)
        await writeFileBufferSafeAsync(path, data)
        console.log('[readJsonWithFallback] loaded from fallback. saved to ' + path)
        return fallbackValue
    }
}

// sync json load
export function loadJson(path) {
    const jsonString = fs.readFileSync(path)
    console.log(`📤 load json: ${path}`)
    return JSON.parse(jsonString)
}
// sync json save
export function saveJson(json, path) {
    const jsonString = JSON.stringify(json, null, 2)
    fs.writeFileSync(path, jsonString)
    console.log(`💾 save json: ${path}`)
}

// sync json load with fallback
export function loadJsonFallbackSync(filePath, fallback = {}) {
    const res = safeRunSync(fs.readFileSync, filePath)
    if (res.ok) {
        console.log('[loadJsonFallbackSync] : found ' + filePath)
        return JSON.parse(res.data)
    } else {
        const dir = path.dirname(filePath)
        fs.mkdirSync(dir, { recursive: true })
        const data = JSON.stringify(fallback, null, 2)
        fs.writeFileSync(filePath, data)
        console.log('[loadJsonFallbackSync] : use fallback value. new saved in ' + filePath)
        return fallback
    }
}





// raw to readable
export function msToReadableTime(ms) {
    if (isNaN(parseInt(ms))) return 'invalid ms value'

    const MS = 1000
    const MM = 60 * MS
    const HH = 60 * MM
    const DD = 24 * HH

    const d = Math.floor(ms / DD); ms %= DD
    const h = Math.floor(ms / HH); ms %= HH
    const m = Math.floor(ms / MM); ms %= MM
    const s = Math.floor(ms / MS)

    let result = ''
    if (d) result += d + ' hari '
    if (h) result += h + ' jam '
    if (m) result += m + ' menit '
    if (s) result += s + ' detik '
    if (!result) result = '< 1 detik'
    return result.trim()
}

export function formatByte(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    if (!Number.isFinite(bytes)) return 'Invalid';

    const k = 1024; // dasar binary
    const dm = decimals < 0 ? 0 : decimals;

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}






