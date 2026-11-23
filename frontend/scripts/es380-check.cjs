// ES-380: CLS de /privacidad y /terminos entre 320 y 679 px, A/B INTERCALADO contra main, CPU ×4, con la API legal simulada como 404 (solo el texto del repo).
// Mide: CLS por ancho × página × idioma × tema (máximo y mediana de RUNS corridas), que el texto legal es idéntico entre las dos compilaciones, axe (wcag2a/2aa/21a/21aa/22aa) y sin desborde horizontal.
// No corre en CI. Uso: PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> PR=http://127.0.0.1:4511 MAIN=http://127.0.0.1:4512 [RUNS=3] [DELAYS=0,600] node scripts/es380-check.cjs
//   DELAYS: milisegundos de retraso de las fuentes .woff2 (0 = llegan enseguida; 600 = tarde, el caso que daba el salto).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const PR = process.env.PR, MAIN = process.env.MAIN, RUNS = Number(process.env.RUNS || 3)
const DELAYS = (process.env.DELAYS || '0,600').split(',').map(Number)
const WIDTHS = [320, 390, 420, 480, 600, 679]
const COMBOS = [['/privacidad', 'es', 'light'], ['/privacidad', 'es', 'dark'], ['/privacidad', 'en', 'light'], ['/privacidad', 'en', 'dark'], ['/terminos', 'es', 'light'], ['/terminos', 'en', 'light']]
for (const base of [PR, MAIN]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }

async function load(browser, base, route, lang, scheme, width, delay, wantAxe) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__c = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
  await page.route('**/api/**', r => r.fulfill({ status: 404, json: {} }))
  if (delay) await page.route('**/*.woff2', async r => { await new Promise(s => setTimeout(s, delay)); r.continue() })
  await page.goto(base + route, { waitUntil: 'domcontentloaded' }); await page.locator('h1').first().waitFor(); await page.waitForTimeout(2500)
  const out = { cls: await page.evaluate(() => window.__c), text: await page.locator('.lg').innerText(), overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) }
  if (wantAxe) { await page.evaluate(axeSource); out.axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length)) }
  await ctx.close(); return out
}

;(async () => {
  const browser = await chromium.launch(); let worst = 0; const failures = []
  for (const delay of DELAYS) for (const width of WIDTHS) for (const [route, lang, scheme] of COMBOS) {
    const pr = [], mn = []; let sample
    for (let i = 0; i < RUNS; i++) {
      const a = await load(browser, PR, route, lang, scheme, width, delay, i === 0 && delay === 0); const b = await load(browser, MAIN, route, lang, scheme, width, delay, false)
      pr.push(a.cls); mn.push(b.cls); if (i === 0) sample = [a, b]
    }
    const [a, b] = sample
    assert.equal(a.text, b.text, `el texto legal es idéntico (${route} ${lang} ${width})`)
    assert.equal(a.overflow, 0, `sin desborde (${route} ${lang} ${scheme} ${width})`)
    if (a.axe) assert.deepEqual(a.axe, [], `axe 0 (${route} ${lang} ${scheme} ${width})`)
    worst = Math.max(worst, ...pr)
    const flag = Math.max(...pr) > 0.1 ? '  <<< PR > 0,1' : ''
    console.log(`retraso ${String(delay).padStart(3)} ms · ${String(width).padStart(3)} px · ${route} ${lang} ${scheme}: PR máx ${Math.max(...pr).toFixed(4)} med ${med(pr).toFixed(4)} | main máx ${Math.max(...mn).toFixed(4)} med ${med(mn).toFixed(4)}${flag}`)
    if (Math.max(...pr) > 0.1) failures.push(`${delay} ${width} ${route} ${lang} ${scheme}`)
  }
  await browser.close()
  console.log(`\nPeor CLS del PR: ${worst.toFixed(4)}; combinaciones sobre 0,1: ${failures.length}`)
  assert.deepEqual(failures, [])
})().catch(e => { console.error(e); process.exit(1) })
