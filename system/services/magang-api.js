/**
 * Magang API Service — Near Bot
 * ESM port of absenbot/src/services/apiService.js
 * Axios-based client for MagangHub Kemnaker API.
 * Uses cookies/tokens from directLogin session.
 */

import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'

const SESSION_DIR = path.join(process.cwd(), 'user', 'data', 'magang-sessions')
const API_BASE_URL = 'https://monev.maganghub.kemnaker.go.id'
const API_EXCHANGE_BASE = 'https://monev-api.maganghub.kemnaker.go.id'
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours

const API_ENDPOINTS = {
    LOGIN_URL: 'https://account.kemnaker.go.id/auth/login',
    DAILY_LOGS: `${API_BASE_URL}/api/daily-logs`,
    SUBMIT_ATTENDANCE: `${API_BASE_URL}/api/attendances/with-daily-log`,
    MONTHLY_REPORTS: `${API_BASE_URL}/api/monthly-reports`,
    USER_ME: `${API_BASE_URL}/api/users/me`,
}

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true })

const sessionCache = new Map()
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// --- Session Management ---

export function loadSession(email) {
    if (sessionCache.has(email)) {
        const session = sessionCache.get(email)
        if (session.timestamp && Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
            sessionCache.delete(email)
            console.log(`[MAGANG-API] Session expired for ${email}`)
            return null
        }
        return session
    }
    const p = path.join(SESSION_DIR, `${email}.json`)
    if (!fs.existsSync(p)) return null
    try {
        const session = JSON.parse(fs.readFileSync(p, 'utf8'))
        if (!session.cookies?.length) return null
        if (session.timestamp && Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
            console.log(`[MAGANG-API] Session expired for ${email}`)
            return null
        }
        sessionCache.set(email, session)
        return session
    } catch { return null }
}

export function saveSession(email, cookies, csrfToken = null, accessToken = null, refreshToken = null, participantId = null) {
    const existing = loadSession(email) || {}
    const session = {
        cookies: cookies || existing.cookies,
        csrfToken: csrfToken || existing.csrfToken,
        accessToken: accessToken || existing.accessToken,
        refreshToken: refreshToken || existing.refreshToken,
        participantId: participantId || existing.participantId,
        timestamp: Date.now()
    }
    sessionCache.set(email, session)
    fs.writeFile(path.join(SESSION_DIR, `${email}.json`), JSON.stringify(session, null, 2), 'utf8', err => {
        if (err) console.error(`[MAGANG-API] Session write error for ${email}:`, err.message)
    })
    console.log(`[MAGANG-API] Session saved for ${email}`)
}

export function clearSession(email) {
    sessionCache.delete(email)
    const p = path.join(SESSION_DIR, `${email}.json`)
    if (fs.existsSync(p)) fs.unlinkSync(p)
}

// --- Axios Client ---

function createApiClient(session) {
    const jar = new CookieJar()
    if (session.cookies) {
        session.cookies.forEach(c => {
            try {
                const domain = c.domain.startsWith('.') ? c.domain.substring(1) : c.domain
                jar.setCookieSync(`${c.name}=${c.value}`, `https://${domain}`)
            } catch { }
        })
    }
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Origin': 'https://monev.maganghub.kemnaker.go.id',
        'Referer': 'https://monev.maganghub.kemnaker.go.id/dashboard',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': session.csrfToken || '',
        'X-Requested-With': 'XMLHttpRequest',
    }
    if (session.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`
    return wrapper(axios.create({ jar, withCredentials: true, headers, timeout: 30000 }))
}

async function ensureParticipantId(email, client, session) {
    if (session.participantId) return session.participantId
    const res = await client.get(API_ENDPOINTS.DAILY_LOGS)
    if (res.data?.data?.length > 0) {
        session.participantId = res.data.data[0].participant_id
        saveSession(email, session.cookies, session.csrfToken, session.accessToken, session.refreshToken, session.participantId)
        return session.participantId
    }
    throw new Error('Could not find participant_id')
}

// --- Direct Login (no Puppeteer) ---

export async function directLogin(email, password) {
    const jar = new CookieJar()
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Origin': 'https://account.kemnaker.go.id' }
    }))

    try {
        const loginPage = await client.get('https://account.kemnaker.go.id/auth/login')
        const csrfMatch = loginPage.data.match(/<meta name="csrf-token" content="([^"]+)"/)
        if (!csrfMatch) throw new Error('Could not find CSRF token')
        const csrfToken = csrfMatch[1]

        const loginRes = await client.post('https://account.kemnaker.go.id/auth/login', {
            username: email, password, remember: true
        }, { headers: { 'X-CSRF-TOKEN': csrfToken } })

        if (loginRes.status === 200 && loginRes.data.data?.authenticated) {
            let accessToken = null, refreshToken = null, monevSuccess = false

            try {
                const clientId = '79230891-cc02-43c8-964c-b525bce27857'
                const authUrl = `https://account.kemnaker.go.id/auth?client_id=${clientId}&redirect_uri=https%3A%2F%2Fmonev.maganghub.kemnaker.go.id%2Fsso%2Fcallback&response_type=code&scope=basic%20email`
                const authRes = await client.get(authUrl, { maxRedirects: 0, validateStatus: s => s === 302 })
                const codeMatch = authRes.headers.location?.match(/code=([^&]+)/)
                if (codeMatch) {
                    const exchangeRes = await client.get(`${API_EXCHANGE_BASE}/authenticate/login/callback?code=${codeMatch[1]}`, {
                        headers: { 'Origin': 'https://monev.maganghub.kemnaker.go.id', 'Referer': 'https://monev.maganghub.kemnaker.go.id/' }
                    })
                    if (exchangeRes.data?.access_token) {
                        accessToken = exchangeRes.data.access_token
                        refreshToken = exchangeRes.data.refresh_token
                        monevSuccess = true
                    }
                }
            } catch (e) {
                console.warn(`[MAGANG-API] SSO failed: ${e.message}`)
            }

            const allCookies = []
            const domains = ['account.kemnaker.go.id', 'monev.maganghub.kemnaker.go.id', 'kemnaker.go.id']
            for (const domain of domains) {
                const dc = await jar.getCookies('https://' + domain)
                dc.forEach(c => allCookies.push({ name: c.key, value: c.value, domain: c.domain || domain, path: c.path || '/', httpOnly: c.httpOnly, secure: c.secure }))
            }

            saveSession(email, allCookies, csrfToken, accessToken, refreshToken)
            return { success: true, sso_completed: monevSuccess, pesan: monevSuccess ? 'Login & SSO Berhasil' : 'Login Berhasil (SSO menyusul)' }
        } else {
            throw new Error(`Login failed. Status: ${loginRes.status}`)
        }
    } catch (error) {
        return { success: false, pesan: error.message }
    }
}

// --- Attendance API ---

export async function checkAttendanceStatus(email, password, retry = true) {
    const session = loadSession(email)
    if (!session) {
        const loginRes = await directLogin(email, password)
        if (!loginRes.success) return { success: false, pesan: 'Gagal login: ' + loginRes.pesan }
        return checkAttendanceStatus(email, password, retry)
    }
    try {
        const client = createApiClient(session)
        const response = await client.get(API_ENDPOINTS.DAILY_LOGS, { maxRedirects: 5, validateStatus: s => s >= 200 && s < 400 })
        const logs = response.data?.data
        if (!Array.isArray(logs)) {
            await directLogin(email, password)
            return { success: false, pesan: 'Session expired, silakan coba lagi' }
        }
        const today = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Makassar' }).split(',')[0]
        const todayLog = logs.find(l => l.date === today)
        if (todayLog) return { success: true, sudahAbsen: true, data: todayLog }
        return { success: true, sudahAbsen: false }
    } catch (e) {
        if (retry && e.response?.status === 401) {
            clearSession(email)
            const loginRes = await directLogin(email, password)
            if (loginRes.success) return checkAttendanceStatus(email, password, false)
        }
        return { success: false, pesan: e.message }
    }
}

export async function submitAttendance(email, password, reportData, retry = true) {
    let session = loadSession(email)
    if (!session) {
        const loginRes = await directLogin(email, password)
        if (!loginRes.success) return { success: false, pesan: 'Gagal login: ' + loginRes.pesan }
        session = loadSession(email)
    }
    try {
        const client = createApiClient(session)
        const today = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Makassar' }).split(',')[0]
        const payload = {
            date: today,
            status: 'PRESENT',
            activity_log: reportData.aktivitas,
            lesson_learned: reportData.pembelajaran,
            obstacles: reportData.kendala || 'Tidak ada kendala'
        }
        const response = await client.post(API_ENDPOINTS.SUBMIT_ATTENDANCE, payload)
        if (response.status === 200 || response.status === 201) {
            return { success: true, pesan: 'Berhasil submit' }
        }
        return { success: false, pesan: `Unexpected status: ${response.status}` }
    } catch (error) {
        if (error.response?.status === 400) {
            const msg = error.response.data?.message || 'Sudah absen atau input tidak valid'
            return { success: false, pesan: msg }
        }
        if (retry && error.response?.status === 401) {
            clearSession(email)
            const loginRes = await directLogin(email, password)
            if (loginRes.success) return submitAttendance(email, password, reportData, false)
        }
        return { success: false, pesan: error.message }
    }
}

export async function getAttendanceHistory(email, password, days = 1, retry = true) {
    let session = loadSession(email)
    if (!session) {
        const loginRes = await directLogin(email, password)
        if (!loginRes.success) return { success: false, logs: [], pesan: loginRes.pesan }
        session = loadSession(email)
    }
    try {
        const client = createApiClient(session)
        const res = await client.get(API_ENDPOINTS.DAILY_LOGS)
        if (res.status !== 200) return { success: false, logs: [], pesan: 'Error fetching logs' }
        const allLogs = res.data?.data
        if (!Array.isArray(allLogs)) {
            await directLogin(email, password)
            return { success: false, logs: [], pesan: 'Session expired, coba lagi' }
        }
        return { success: true, logs: allLogs.slice(0, days) }
    } catch (e) {
        if (retry && e.response?.status === 401) {
            clearSession(email)
            const loginRes = await directLogin(email, password)
            if (loginRes.success) return getAttendanceHistory(email, password, days, false)
        }
        return { success: false, logs: [], pesan: e.message }
    }
}

export async function getDashboardStats(email, password, retry = true) {
    let session = loadSession(email)
    if (!session) {
        const loginRes = await directLogin(email, password)
        if (!loginRes.success) return { success: false, pesan: loginRes.pesan }
        session = loadSession(email)
    }
    try {
        const client = createApiClient(session)
        const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }))
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

        await ensureParticipantId(email, client, session)
        const attUrl = `${API_BASE_URL}/api/attendances?participant_id=${session.participantId}&start_date=${startOfMonth}&end_date=${endOfMonth}`
        const monthlyUrl = `${API_ENDPOINTS.MONTHLY_REPORTS}?participant_id=${session.participantId}`

        const [logsRes, attRes, monthlyRes] = await Promise.all([
            client.get(API_ENDPOINTS.DAILY_LOGS),
            client.get(attUrl),
            client.get(monthlyUrl).catch(() => ({ data: null }))
        ])

        const dailyLogs = logsRes.data?.data || []
        const attendances = attRes.data?.data || []
        const today_str = today.toISOString().split('T')[0]

        let totalApprove = 0, totalPending = 0, totalRevisi = 0, totalRejected = 0, totalIzin = 0
        const pendingDates = [], revisiDates = [], rejectedDates = [], izinDates = []
        const attendanceDates = new Set()

        attendances.forEach(item => {
            const s = (item.approval_status || '').toUpperCase()
            const attS = (item.status || '').toUpperCase()
            const day = item.date?.split('-')[2]
            attendanceDates.add(item.date)
            if (['ON_LEAVE', 'SICK', 'PERMIT'].includes(attS)) { totalIzin++; izinDates.push(day) }
            else if (s === 'APPROVED') totalApprove++
            else if (s === 'REJECTED') { totalRejected++; rejectedDates.push(day) }
            else if (s === 'REVISION') { totalRevisi++; revisiDates.push(day) }
            else if (dailyLogs.some(l => l.date === item.date)) { totalPending++; pendingDates.push(day) }
        })

        // Calculate alpa: weekdays without any attendance up to (but not including) today
        const isWeekend = d => { const day = d.getDay(); return day === 0 || day === 6 }
        let totalAlpha = 0
        const alphaDates = []
        const iter = new Date(startOfMonth)
        while (iter < today) {
            const dStr = iter.toISOString().split('T')[0]
            if (!isWeekend(iter) && !attendanceDates.has(dStr)) {
                totalAlpha++
                alphaDates.push(iter.getDate().toString())
            }
            iter.setDate(iter.getDate() + 1)
        }

        // Rapor bulanan
        let raporStatus = 'Belum ada'
        if (monthlyRes.data?.data?.length > 0) {
            const targetDate = new Date(today)
            if (today.getDate() > 24) targetDate.setMonth(targetDate.getMonth() + 1)
            const targetYearMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`
            if (monthlyRes.data.data.some(r => r.year_month === targetYearMonth)) raporStatus = 'Sudah ada'
        }

        const todayLog = dailyLogs.find(l => l.date === today_str)
        const statusHariIni = todayLog ? 'Sudah Absen ✅' : 'Belum Absen ❌'

        return {
            success: true,
            data: {
                totalApprove, totalPending, totalRevisi, totalRejected, totalIzin, totalAlpha,
                pendingDates, revisiDates, rejectedDates, izinDates, alphaDates,
                statusHariIni, raporStatus
            }
        }
    } catch (e) {
        if (retry && e.response?.status === 401) {
            clearSession(email)
            const loginRes = await directLogin(email, password)
            if (loginRes.success) return getDashboardStats(email, password, false)
        }
        return { success: false, pesan: e.message }
    }
}


export async function getUserProfile(email, password, retry = true) {
    let session = loadSession(email)
    if (!session) {
        const loginRes = await directLogin(email, password)
        if (!loginRes.success) return { success: false, pesan: loginRes.pesan }
        session = loadSession(email)
    }
    try {
        const client = createApiClient(session)
        const res = await client.get(API_ENDPOINTS.USER_ME)
        if (res.status === 200 && res.data?.data) return { success: true, data: res.data.data }
        return { success: false, pesan: 'Gagal mengambil profil' }
    } catch (e) {
        if (retry && e.response?.status === 401) {
            clearSession(email)
            const loginRes = await directLogin(email, password)
            if (loginRes.success) return getUserProfile(email, password, false)
        }
        return { success: false, pesan: e.message }
    }
}
