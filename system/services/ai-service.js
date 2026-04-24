/**
 * AI Service — Near Bot
 * Ported from absenbot with ESM conversion.
 * Provides a waterfall AI engine for chat and reports.
 */

import axios from 'axios'
import { consumeRate } from '../../system/helper/rate-limiter.js'

// API Keys from Environment
const KEYS = {
    SCALEWAY: process.env.SCALEWAY_API_KEY,
    GROQ: process.env.GROQ_API_KEY,
    CEREBRAS: process.env.CEREBRAS_API_KEY,
    SAMBANOVA: process.env.SAMBANOVA_API_KEY,
    GEMINI: process.env.GEMINI_API_KEY,
    GITHUB: process.env.GITHUB_TOKEN,
    OPENROUTER: process.env.OPENROUTER_API_KEY
}

const MAX_TOKENS = 1500

const AI_CONFIG = {
    GROQ: {
        API_URL: 'https://api.groq.com/openai/v1/chat/completions',
        MODELS: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'],
        TIMEOUT: 15000,
    },
    OPENROUTER: {
        API_URL: 'https://openrouter.ai/api/v1/chat/completions',
        MODELS: ['arcee-ai/trinity-large-preview:free', 'google/gemini-2.0-flash-exp:free'],
        TIMEOUT: 20000,
    },
    SAMBANOVA: {
        API_URL: 'https://api.sambanova.ai/v1/chat/completions',
        MODELS: ['Meta-Llama-3.3-70B-Instruct'],
        TIMEOUT: 15000,
    }
}

/**
 * Generic OpenAI-Compatible Chat Completion Caller
 */
async function callOpenAICompatible(providerName, config, systemPrompt, userPrompt, apiKey) {
    if (!apiKey) return { success: false, pesan: `${providerName} API Key missing` }

    let model = config.MODEL
    if (config.MODELS && Array.isArray(config.MODELS)) {
        model = config.MODELS[Math.floor(Math.random() * config.MODELS.length)]
    }

    try {
        const response = await axios.post(config.API_URL, {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: MAX_TOKENS,
            top_p: 1
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: config.TIMEOUT || 20000
        })

        const content = response.data.choices[0]?.message?.content
        if (!content) throw new Error('Empty response content')

        console.log(`[AI] Response via ${providerName} (${model})`)
        return { success: true, content, model: `${providerName} (${model})` }
    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message
        console.warn(`[AI-${providerName}] failed (${model}): ${errMsg}`)
        return { success: false, pesan: errMsg }
    }
}

/**
 * Waterfall Engine - Priorities: GROQ -> SAMBANOVA -> OPENROUTER
 */
async function runMasterGeneration(systemPrompt, userPrompt) {
    // 1. Try GROQ (Fast & Reliable)
    if (KEYS.GROQ) {
        const res = await callOpenAICompatible('GROQ', AI_CONFIG.GROQ, systemPrompt, userPrompt, KEYS.GROQ)
        if (res.success) return res
    }

    // 2. Try SAMBANOVA (Good fallback for Llama 3.3)
    if (KEYS.SAMBANOVA) {
        const res = await callOpenAICompatible('SAMBANOVA', AI_CONFIG.SAMBANOVA, systemPrompt, userPrompt, KEYS.SAMBANOVA)
        if (res.success) return res
    }

    // 3. Try OPENROUTER (Free models)
    if (KEYS.OPENROUTER) {
        const res = await callOpenAICompatible('OPENROUTER', AI_CONFIG.OPENROUTER, systemPrompt, userPrompt, KEYS.OPENROUTER)
        if (res.success) return res
    }

    return { success: false, pesan: 'Semua provider AI sedang tidak tersedia.' }
}

/**
 * Smart Chat — Main exported function
 * @param {string} jid - Optional user JID for rate limiting
 */
export async function smartChat(userPrompt, systemPrompt = '', jid = null) {
    if (jid && !consumeRate(jid)) {
        return { success: false, pesan: 'Terlalu sering menggunakan AI, coba lagi nanti.' }
    }
    return await runMasterGeneration(systemPrompt || 'You are Near Bot, a helpful AI assistant.', userPrompt)
}

/**
 * Generate a free-form chat response
 */
export async function generateChatResponse(userPrompt, systemPrompt = '') {
    const res = await runMasterGeneration(systemPrompt, userPrompt)
    return res.success ? res.content : null
}

export { runMasterGeneration }
