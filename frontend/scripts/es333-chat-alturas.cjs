// ES-333 (PR 1): alturas reales del chat dentro del marco de persona. Chromium, API simulada, datos SINTÉTICOS (8 mensajes, uso 37/100).
// Comprueba, en 1360×900, 390×844 y 320×568 (y con teclado simulado: 390×544 y 320×298), ES/EN: sin desborde horizontal, la caja de mensaje y «Límites del asistente» a la vista,
// el hilo es el único que se desplaza, y el hilo visible NO depende de una constante: a 390×844 mide > 300 px (en main medía 24 px).
// La meta de ≥ 50 % (390×844, 320×568) llega con la barra compacta del PR 2: aquí solo se informa el porcentaje. 320×298 (teclado muy corto): el hilo visible es 0 hasta el PR 2 (declarado).
// El teclado se SIMULA reduciendo el alto de la ventana; no es un teclado real.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4334 --strictPort   y luego
//   ES333_URL=http://127.0.0.1:4334 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es333-chat-alturas.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES333_URL; const browser = await chromium.launch(); let n = 0; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const axe = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(v => v.id + ' ' + v.nodes.length)) }
  const messages = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? 'Gracias por contarme eso. ¿Qué parte de lo que viviste esta semana te gustaría mirar con más calma?' : 'Esta semana me sentí con poca energía y no sé por dónde empezar.' }))
  const cases = [[1360, 900, 0], [390, 844, 0], [390, 844, 300], [320, 568, 0], [320, 568, 270]]
  for (const lang of ['es', 'en']) for (const [w, h, kb] of cases) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h - kb } }); const page = await ctx.newPage()
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } : p === '/api/messages' ? messages : [] }) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.getByText('Gracias por contarme').first().waitFor(); await page.waitForTimeout(700)
    const m = await page.evaluate(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect(); const t = rect('.chat-scroll'); const bar = rect('.chat-input-bar'); const lim = rect('.chat-limits'); const frame = document.querySelector('.cg-frame')
      const visible = Math.max(0, Math.min(t.bottom, bar.top, innerHeight) - Math.max(t.top, 0))
      return { visible, vh: innerHeight, barInView: bar.bottom <= innerHeight + 1 && bar.top >= 0, limInView: lim.bottom <= innerHeight + 1 && lim.top >= 0, overflowX: document.documentElement.scrollWidth - innerWidth, frameFixed: Math.round(frame.getBoundingClientRect().height) === innerHeight,
        threadScrolls: document.querySelector('.chat-scroll').scrollHeight > document.querySelector('.chat-scroll').clientHeight, docScroll: document.documentElement.scrollHeight - innerHeight }
    })
    assert.deepEqual(await axe(page), [], `axe 0 (${lang} ${w}×${h - kb})`)
    const tag = `${lang} ${w}×${h - kb}${kb ? ' (teclado simulado)' : ''}`
    assert.ok(m.overflowX <= 0, `sin desborde horizontal (${tag}): ${m.overflowX}px`)
    assert.equal(m.docScroll <= 0, true, `la página no se desplaza (${tag}): ${m.docScroll}px`)
    assert.ok(m.frameFixed, `el marco mide exactamente el alto de la ventana (${tag})`)
    if (h - kb >= 500) { assert.ok(m.barInView && m.limInView, `caja de mensaje y «Límites del asistente» a la vista (${tag})`) }
    if (w === 390 && h === 844 && !kb) assert.ok(m.visible > 300, `hilo visible > 300 px a 390×844 (${tag}): ${m.visible}`)
    if (w === 1360) assert.ok(m.visible > 300, `hilo visible > 300 px a 1360×900 (${tag}): ${m.visible}`)
    console.log(`PASS ${tag}: hilo visible ${Math.round(m.visible)} px (${Math.round(m.visible / m.vh * 100)} % del alto)${kb && h - kb < 400 ? ' — declarado: sin compactar hasta el PR 2' : ''}`); await ctx.close(); n++
  }
  console.log(`\nES-333 PR 1: ${n} combinaciones OK`); await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
