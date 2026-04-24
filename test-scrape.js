import { bmkgApi } from './system/services/bmkg-api.js'

async function test() {
    console.log('--- Testing Scraper ---')
    const scrape = await bmkgApi.scrapeMainPage()
    console.log(JSON.stringify(scrape, null, 2))
}
test()
