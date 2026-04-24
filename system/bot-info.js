import { saveJson, allPath, loadJsonFallbackSync } from './helper.js'

const fallback = {
    "tm": "https://i.pinimg.com/736x/8e/29/53/8e29535aa9736adb61ec89d47f59ea5e.jpg",
    "stm": "https://i.pinimg.com/736x/8e/29/53/8e29535aa9736adb61ec89d47f59ea5e.jpg",
    "dn": "near bot",
    "st": "by akmal",
    "an": "akmal",
    "b1f": "⌞  *",
    "b1b": "*  ⌝",
    "b2f": "   ᯓ   ",
    "b2b": "",
    "b3f": "*📄 ",
    "b3b": "*"
}
const json = loadJsonFallbackSync(allPath.botInfo, fallback)

const botInfo = {
    tm: json.tm,
    stm: json.stm,
    dn: json.dn,
    st: json.st,
    an: json.an,
    b1f: json.b1f,
    b1b: json.b1b,
    b2f: json.b2f,
    b2b: json.b2b,
    b3f: json.b3f,
    b3b: json.b3b,
}

export { botInfo }

export function updateThumbnailMenu(url) {
    botInfo.tm = url
    saveJson(botInfo, allPath.botInfo)
}

export function updateSmallThumbnailMenu(url) {
    botInfo.stm = url
    saveJson(botInfo, allPath.botInfo)
}

export function updateDisplayName(name) {
    botInfo.dn = name
    saveJson(botInfo, allPath.botInfo)
}

export function updateSecondaryText(text) {
    botInfo.st = text
    saveJson(botInfo, allPath.botInfo)
}

export function updateBulletin1(front, back) {
    botInfo.b1f = front
    botInfo.b1b = back
    saveJson(botInfo, allPath.botInfo)
}

export function updateBulletin2(front, back) {
    botInfo.b2f = front
    botInfo.b2b = back
    saveJson(botInfo, allPath.botInfo)
}

export function updateBulletin3(front, back) {
    botInfo.b3f = front
    botInfo.b3b = back
    saveJson(botInfo, allPath.botInfo)
}
