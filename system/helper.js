// numpang lewat

export * from './helper/general-helper.js'
export * from './helper/baileys-related.js'
export * from './helper/baileys-send.js'
export * from './helper/rate-limiter.js'

export * from './plugin-help-serialize.js'
export * from './all-path.js'
export * from './bot-info.js'

export { default as stateManager } from './manager-state.js'

// Re-export getters from shared-state for convenience
// Note: These are FUNCTIONS, not values. Use: getStore(), getUserManager(), etc.
export { getPluginManager, getPrefixManager, getUserManager, getStore, getBot } from './shared-state.js'

// Also export the proxy objects for direct property access (store.x, bot.y)
// These use getters under the hood
import { getPluginManager, getPrefixManager, getUserManager, getStore, getBot } from './shared-state.js'

function createGetterProxy(getFn) {
    return new Proxy({}, {
        get(_, prop) {
            const instance = getFn()
            return instance?.[prop]
        },
        set(_, prop, value) {
            const instance = getFn()
            if (instance) instance[prop] = value
        },
        has(_, prop) {
            const instance = getFn()
            return instance ? prop in instance : false
        }
    })
}

export const pluginManager = createGetterProxy(getPluginManager)
export const prefixManager = createGetterProxy(getPrefixManager)  
export const userManager = createGetterProxy(getUserManager)
export const store = createGetterProxy(getStore)
export const bot = createGetterProxy(getBot)
