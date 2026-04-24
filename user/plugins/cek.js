/**
 * Plugin: Cek Absen (Carousel)
 * Menampilkan status absensi + approval dalam format carousel
 * Command: cek / cekapprove
 */

import { sendText } from '#helper'
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from 'baileys'
import {
    checkAttendanceStatus,
    getDashboardStats,
    getUserProfile
} from '../../system/services/magang-api.js'
import { findUser } from '../../system/services/user-registry.js'
import { botInfo } from '../../system/bot-info.js'

const capitalize = str =>
    str ? str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '-'

const formatLine = (count, dates) => {
    if (count <= 0) return '-'
    return dates?.length > 0 ? `${count} [${dates.join(', ')}]` : `${count}`
}

/** @param {import('../../system/types/plugin.js').HandlerParams} params */
async function handler({ sock, jid, m }) {
    const senderId = m.senderId
    const user = findUser(senderId)

    if (!user) {
        return sendText(sock, jid, '❌ Kamu belum terdaftar.\nKetik *.daftar [email] [password]*', m)
    }

    try {
        const [statusResult, statsResult, profileResult] = await Promise.all([
            checkAttendanceStatus(user.email, user.password),
            getDashboardStats(user.email, user.password),
            getUserProfile(user.email, user.password)
        ])

        const userName = capitalize(user.name || user.email.split('@')[0])
        const mentorName = capitalize(profileResult.data?.mentor?.name || '-')
        const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

        // Countdown gajian
        const calculateCountdown = (targetDay) => {
            const now = new Date()
            const todayDate = now.getDate()
            let target = new Date(now.getFullYear(), now.getMonth(), targetDay)
            if (todayDate > targetDay) target = new Date(now.getFullYear(), now.getMonth() + 1, targetDay)
            return Math.floor((target - new Date(now.getFullYear(), now.getMonth(), todayDate)) / (1000 * 60 * 60 * 24))
        }
        const days3 = calculateCountdown(15)
        const days2 = calculateCountdown(24)
        const payoutInfo = `\n\n*Info Gajian:* \n- Batch 3: ${days3} hari lagi\n- Batch 2: ${days2} hari lagi \n\nJangan lupa absen biar gaji aman!`

        // Card 1: Status Absen
        let card1Text = '', card1Buttons = []
        const thumbUrl = botInfo.tm

        if (!statusResult.success) {
            card1Text = `*ERROR*\nTerjadi kesalahan: ${statusResult.pesan || ''}${payoutInfo}`
        } else if (statusResult.sudahAbsen) {
            const log = statusResult.data
            const snip = log?.activity_log ? `\n\n*Log Hari Ini:*\n${log.activity_log.substring(0, 150)}${log.activity_log.length > 150 ? '...' : ''}` : ''
            card1Text = `*SUDAH ABSEN*\nAnda telah melakukan absensi hari ini.${snip}`
            card1Buttons = [
                {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                        display_text: "Cek Monev",
                        url: "https://monev.maganghub.kemnaker.go.id/dashboard"
                    })
                }
            ]
        } else {
            card1Text = `*BELUM ABSEN*\nAnda belum mengirim laporan hari ini.${payoutInfo}`
            card1Buttons = [
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: "Absen Sekarang",
                        id: ".absen"
                    })
                }
            ]
        }

        // --- Card 2: Laporan Dashboard ---
        let card2Text
        if (!statsResult.success) {
            card2Text = `*ERROR DASHBOARD*\n${statsResult.pesan || ''}`
        } else {
            const s = statsResult.data
            const cycleDay = user.cycle_day || 24
            const batchNum = cycleDay === 16 ? '3' : cycleDay === 24 ? '2' : '-'

            card2Text = `*LAPORAN DASHBOARD*\n`
            card2Text += `Batch: ${batchNum}\n`
            card2Text += `Nama: ${userName}\n`
            card2Text += `Mentor: ${mentorName}\n\n`
            card2Text += `*Ringkasan Per Bulan:*\n`
            card2Text += `Approve: ${s.totalApprove || '-'}\n`
            card2Text += `Belum di Approve: ${formatLine(s.totalPending, s.pendingDates)}\n`
            card2Text += `Revisi: ${formatLine(s.totalRevisi, s.revisiDates)}\n`
            card2Text += `Ditolak: ${formatLine(s.totalRejected, s.rejectedDates)}\n`
            card2Text += `Alpa: ${formatLine(s.totalAlpha, s.alphaDates)}\n\n`
            card2Text += `Rapor Bulanan: ${s.raporStatus}`
        }

        card1Text = card1Text.trim()
        card2Text = card2Text.trim()

        const [media1, media2] = await Promise.all([
            prepareWAMessageMedia({ image: { url: thumbUrl } }, { upload: sock.waUploadToServer }),
            prepareWAMessageMedia({ image: { url: thumbUrl } }, { upload: sock.waUploadToServer })
        ])

        const cards = [
            {
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: card1Text }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `📅 ${tanggal}` }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: '📅 Status Absen',
                    hasMediaAttachment: true,
                    imageMessage: media1.imageMessage
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons: card1Buttons })
            },
            {
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: card2Text }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: 'Near Bot' }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: '📊 Ringkasan Approval',
                    hasMediaAttachment: true,
                    imageMessage: media2.imageMessage
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons: [] })
            }
        ]

        const msg = generateWAMessageFromContent(
            jid,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({ text: `\`\`\`Absensi • ${userName}\`\`\`` }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: '\`\`\`Near Bot\`\`\`' }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false }),
                            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards })
                        })
                    }
                }
            },
            { userJid: sock.user.id, quoted: m }
        )

        await sock.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [
                                { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
                            ]
                        }
                    ]
                }
            ]
        })

    } catch (e) {
        console.error('[CEK] Error:', e)
        return sendText(sock, jid, `❌ Terjadi kesalahan: ${e.message}`, m)
    }
}

handler.pluginName = 'cek absen'
handler.command = ['cek', 'cekapprove']
handler.category = ['magang']
handler.description = 'Cek status absensi & approval dalam format carousel.'

handler.config = {
    systemPlugin: false,
    bypassPrefix: false
}

handler.meta = {
    fileName: 'cek.js',
    version: '2.2.0',
    author: 'Akmal'
}

export default handler
