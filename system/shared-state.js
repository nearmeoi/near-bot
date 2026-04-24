let _pluginManager = null
let _prefixManager = null
let _userManager = null
let _store = null
let _bot = null

export function setSharedState({ pluginManager, prefixManager, userManager, store, bot }) {
    _pluginManager = pluginManager
    _prefixManager = prefixManager
    _userManager = userManager
    _store = store
    _bot = bot
}

export function getPluginManager() { return _pluginManager }
export function getPrefixManager() { return _prefixManager }
export function getUserManager() { return _userManager }
export function getStore() { return _store }
export function getBot() { return _bot }
