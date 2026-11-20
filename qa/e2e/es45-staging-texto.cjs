// [QA-Claude] ES-45 · staging, SOLO LECTURA: texto completo de una pantalla en ES y EN con la cuenta sintética existente (sin pulsar nada). STG_SECRETS=<archivo> PAGES=/app/data,/terminos node qa/e2e/es45-staging-texto.cjs
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const fs = require('fs')
const STG = 'https://backend-staging-e3a6.up.railway.app'; const secrets = JSON.parse(fs.readFileSync(process.env.STG_SECRETS, 'utf8'))
;(async () => {
  const lr = await fetch(STG + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: secrets.a.email, password: secrets.a.password }) }); const lj = await lr.json()
  const BR = await chromium.launch()
  for (const url of process.env.PAGES.split(',')) for (const lang of ['es', 'en']) {
    const ctx = await BR.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l) }, [lj.token, lang])
    const p = await ctx.newPage(); await p.goto(STG + url, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main, h1', { timeout: 15000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 2500))
    const t = (await p.locator('main').first().innerText().catch(async () => p.locator('body').innerText())).replace(/\s+/g, ' ')
    const btns = await p.$$eval('button, a[role=button]', (bs) => bs.map((b) => b.innerText.trim()).filter(Boolean).slice(0, 25))
    console.log(`## ${lang} ${url}\n${t.slice(0, Number(process.env.MAX || 2500))}\nBOTONES: ${JSON.stringify(btns)}\n`); await ctx.close()
  }
  await BR.close()
})()
