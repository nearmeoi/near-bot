import crypto from "node:crypto"
import fetch from "node-fetch"

class ChatGptDebug {
  constructor() {
    this.baseUrl = "https://chatgpt.com";
    this.user_agent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36";
    this.msgid = crypto.randomUUID();
    this.oai_did = crypto.randomUUID();
    this.build_number = "prod-2294c45e1eaa6a898633916fa7682b2e6b912617";
  }

  web_headers(extra = {}) { 
    return { 
        "OAI-Device-Id": this.oai_did, 
        "Accept": "*/*", 
        "User-Agent": this.user_agent, 
        "Accept-Language": "en-US,en;q=0.9", 
        "Content-Type": "application/json", 
        "Referer": "https://chatgpt.com", 
        ...extra 
    }; 
  }

  qh(t) { return Buffer.from(JSON.stringify(t)).toString("base64"); }
  
  nce(t) { 
    let e = 2166136261; 
    for (let n = 0; n < t.length; n++) { 
        e ^= t.charCodeAt(n); 
        e = Math.imul(e, 16777619) >>> 0; 
    } 
    e ^= e >>> 16; e = Math.imul(e, 2246822507) >>> 0; 
    e ^= e >>> 13; e = Math.imul(e, 3266489909) >>> 0; 
    e ^= e >>> 16; return (e >>> 0).toString(16).padStart(8, "0"); 
  }

  async generateTkn() {
    console.log("1. [SENTINEL] Memulai proses Prepare...");
    const config = [1920 + 1080, "" + new Date(), 2172649472, 1, this.user_agent, null, this.build_number, "en-US", "en-US,en", Math.random(), "contacts−[object ContactsManager]", "_reactListening6506zq7cxya", "Nazir", 100, this.msgid, "", 8, 0, 0, 0, 0, 0, 0, 0, 0];
    const pData = "gAAAAAC" + this.qh(config);

    try {
        const prepareRes = await fetch(`${this.baseUrl}/backend-anon/sentinel/chat-requirements/prepare`, { 
            method: "POST", 
            headers: this.web_headers(), 
            body: JSON.stringify({ p: pData }) 
        });
        
        console.log(`   - Status Prepare: ${prepareRes.status} ${prepareRes.statusText}`);
        if (!prepareRes.ok) {
            const errBody = await prepareRes.text();
            console.error("   - Error Body:", errBody);
            return null;
        }

        const json = await prepareRes.json();
        console.log("   - Prepare Data Berhasil Diterima.");

        let powToken = null;
        if (json.proofofwork?.required) {
            console.log("   - Proof of Work diperlukan. Sedang menghitung (ini biasanya memakan waktu)...");
            // Simplified PoW for debug
            powToken = "gAAAAAB" + this.qh(config) + "~S"; 
        }

        console.log("2. [SENTINEL] Memulai proses Finalize...");
        const finalizeRes = await fetch(`${this.baseUrl}/backend-anon/sentinel/chat-requirements/finalize`, { 
            method: "POST", 
            headers: this.web_headers(), 
            body: JSON.stringify({ 
                prepare_token: json.prepare_token || "",
                proofofwork: powToken,
                turnstile: { dx: "debug" } 
            }) 
        });

        console.log(`   - Status Finalize: ${finalizeRes.status} ${finalizeRes.statusText}`);
        const finalizeJson = await finalizeRes.json();
        return finalizeJson.token;
    } catch (e) {
        console.error("   - Exception di generateTkn:", e.message);
        return null;
    }
  }

  async testScrape() {
    console.log("=== DEBUG CHATGPT SCRAPE ===");
    const token = await this.generateTkn();
    
    if (!token) {
        console.error("\n❌ GAGAL: Tidak bisa mendapatkan Sentinel Token.");
        console.log("Analisis: OpenAI mendeteksi IP VPS ini sebagai bot atau algoritma PoW/Turnstile sudah berubah.");
        return;
    }

    console.log("\n✅ BERHASIL: Mendapatkan Sentinel Token.");
    console.log("Token:", token.substring(0, 50) + "...");
    
    console.log("\n3. [CONVERSATION] Mengetes hit ke endpoint utama...");
    const body = {
        action: "next",
        messages: [{
            id: crypto.randomUUID(),
            author: { role: "user" },
            content: { content_type: "text", parts: ["Halo, siapa namamu?"] }
        }],
        parent_message_id: crypto.randomUUID(),
        model: "auto",
        timezone_offset_min: -480,
        history_and_training_disabled: true
    };

    try {
        const res = await fetch(`${this.baseUrl}/backend-anon/f/conversation`, {
            method: "POST",
            headers: this.web_headers({
                "OpenAI-Sentinel-Chat-Requirements-Token": token,
                "Accept": "text/event-stream"
            }),
            body: JSON.stringify(body)
        });

        console.log(`   - Status Conversation: ${res.status} ${res.statusText}`);
        if (res.status === 403) {
            console.error("\n❌ GAGAL: Status 403 (Forbidden).");
            console.log("Analisis: Cloudflare mendeteksi fingerprint browser palsu atau memblokir akses VPS secara total.");
        } else if (res.status === 429) {
            console.error("\n❌ GAGAL: Status 429 (Too Many Requests).");
            console.log("Analisis: IP kamu terkena Rate Limit.");
        } else if (res.ok) {
            console.log("\n✨ SUKSES! Bot bisa menembus scraping.");
        } else {
            console.log("\n❓ GAGAL dengan status lain:", res.status);
        }
    } catch (e) {
        console.error("   - Exception di Conversation:", e.message);
    }
  }
}

const debug = new ChatGptDebug();
debug.testScrape();
