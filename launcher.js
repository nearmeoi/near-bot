import { fork } from 'node:child_process';

const RESTART_EXIT_CODE = 69
const BASE_DELAY_MS = 2000
const MAX_DELAY_MS = 60000

let a = async function () {
    let run = function () {
        return new Promise((resolve, reject) => {
            const child = fork('./index.js', [], {
                execArgv: ['--expose-gc']
            });


            child.on('message', (message) => {
                if (message.type === 'uptime') {
                    child.send({
                        type: 'uptime',
                        data: {
                            ...message.data,
                            uptime: process.uptime()
                        }
                    })
                }

            })

            child.on('exit', (code) => {
                console.log('child exit', code)
                if (code === RESTART_EXIT_CODE) {
                    resolve('restart')
                } else {
                    resolve('exit')
                }
            })

            child.on('error', (error) => {
                console.error('child error:', error)
                try { child.kill() } catch {}
                resolve('restart')
            })
        })
    }

    let flag = 'restart'
    let delay = BASE_DELAY_MS

    while (flag === 'restart') {
        flag = await run()
        if (flag === 'restart') {
            console.log(`[launcher] restarting in ${delay / 1000}s...`)
            await new Promise(r => setTimeout(r, delay))
            delay = Math.min(delay * 2, MAX_DELAY_MS)
        }
    }
}

a()