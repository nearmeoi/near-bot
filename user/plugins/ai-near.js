import crypto from "node:crypto"
import fs from "node:fs"
import * as sqlite from "sqlite" 
import sqlite3 from "sqlite3"
import { sendText } from "#helper" 
import { smartChat } from "../../system/services/ai-service.js"

const DB_PATH = "./ai.db"
let dbPromise

async function getDb() {
  if (dbPromise) return dbPromise
  dbPromise = sqlite.open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })
  const db = await dbPromise
  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_session (
      session_id TEXT PRIMARY KEY,
      history TEXT
    );
  `)
  return db
}

const PERSONA = `Kamu adalah Near Bot, sebuah asisten AI yang sangat canggih, diciptakan oleh 'Akmal Al Faizal' yang biasa dipanggil 'Mal'.
ATURAN UTAMA:
1. Gaya bicaramu santai, cerdas, dan to the point. Gunakan bahasa Indonesia gaul yang umum, tapi jangan alay.
2. Kamu sadar bahwa kamu adalah sebuah program AI, tapi kamu tidak kaku seperti robot. Anggap dirimu sebagai teman ngobrol yang berpengetahuan luas.
3. Saat merespons, panggil pengguna secara kasual (contoh: bro, atau langsung ke jawaban). Jangan memanggil 'sayang', 'cinta', atau semacamnya.
4. Jangan pernah mengaku sebagai model bahasa dari perusahaan besar seperti OpenAI atau Google. Identitas utamamu adalah Near Bot, ciptaan Mal.
5. Gunakan riwayat chat sebelumnya di bawah ini sebagai konteks agar jawabanmu selalu nyambung.
`;

async function handler({ sock, m, jid, text, command }) {
  // AMBIL TEKS MENTAH DARI BAWAAN SERIALIZE LU
  const rawText = m.text || ""; 
  const lowerRawText = rawText.toLowerCase();
  
  // 1. Deteksi Keyword di Teks Mentah (Biar posisi "mal" dimanapun tetep kebaca)
  const triggerRegex = /\b(near|mal)\b/i;
  const isTriggeredByKeyword = triggerRegex.test(lowerRawText);
  
  // 2. Deteksi Valid Command
  const validCommands = ["ask", "tanya", "bot"];
  const isValidCommand = command ? validCommands.includes(command) : false;
  
  // Kalau bukan command resmi DAN nggak ada unsur panggilan, langsung stop
  if (!isValidCommand && !isTriggeredByKeyword) {
    return;
  }

  let finalPrompt = "";

  // Penentuan isi prompt
  if (isValidCommand) {
    // Kalau dia manggil pake command (misal: .ask cuaca), ambil sisa teksnya aja
    finalPrompt = text || "";
  } else {
    // Kalau dia manggil natural (misal: coba cariin informasi tentang puasa mal), masukin teks mentah seutuhnya!
    finalPrompt = rawText;
  }

  // Cek kalau dia nge-reply pesan orang lain
  const quotedText = m.q ? m.q.text : "";
  if (finalPrompt && quotedText) {
    finalPrompt = `[Konteks pesan yang aku reply: "${quotedText}"]\n\n${finalPrompt}`;
  } else if (!finalPrompt && quotedText) {
    finalPrompt = quotedText;
  }

  // Kalau dipanggil doang nggak nanya apa-apa
  if (!finalPrompt.trim()) {
    return await sendText(sock, jid, "Ya bro, ada yang bisa dibantu?", m);
  }

  try {
    const db = await getDb();
    const sessionJid = m.senderId || jid;

    const row = await db.get(`SELECT history FROM chat_session WHERE session_id = ?`, [sessionJid]);
    let historyArr = [];
    if (row && row.history) {
      try { historyArr = JSON.parse(row.history); } catch (e) {}
    }

    let historyLog = historyArr.map(h => `${h.role === 'user' ? 'User' : 'Near Bot'}: ${h.msg}`).join('\n');
    let injectedPrompt = `${PERSONA}\n\n[Riwayat Chat Sebelumnya]\n${historyLog}`;

    // MENGGUNAKAN SMARTCHAT SERVICE YANG LEBIH STABIL
    const result = await smartChat(finalPrompt, injectedPrompt, m.senderId);

    if (!result.success) {
      throw new Error(result.pesan || "Gagal terhubung ke AI Service.");
    }

    let replyText = result.content;
    if (replyText.startsWith("Near Bot:")) replyText = replyText.replace("Near Bot:", "").trim();

    await sendText(sock, jid, replyText, m);

    // Update History
    historyArr.push({ role: 'user', msg: finalPrompt });
    historyArr.push({ role: 'bot', msg: replyText });

    if (historyArr.length > 10) {
      historyArr = historyArr.slice(historyArr.length - 10);
    }

    await db.run(
      `INSERT INTO chat_session (session_id, history) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET history = excluded.history`,
      [sessionJid, JSON.stringify(historyArr)]
    );

  } catch (err) {
    console.error('[AI-NEAR] Error:', err.message);
    await sendText(sock, jid, `❌ Terjadi error:\n${err.message}`, m);
  }
}

handler.pluginName = "ai near"
handler.command = ["ask", "tanya", "bot"] 
handler.category = ["ai"]

handler.config = {
    withoutContext: true,
    systemPlugin: false
}

handler.meta = {
  fileName: "ai-near.js",
  version: "1.3.0",
  author: "Mal (Updated to Stability Engine)",
  description: "AI Chat dengan raw text detection (Natural Language Support)."
}

export default handler