// ES-342 (PARTE A): verifica en Chromium los defectos del chat corregidos. API simulada, DATOS SINTÉTICOS.
//  A1 el aviso de «Pausa» queda dentro del área visible del hilo (no bajo el compositor) · A2 ningún globo se desborda con URLs largas
//  A3 «Enviar» vacío: sin opacidad, sin terracota (fondo = panel del sistema), legible (≥ 4,5:1) · A4 hilo ≥ 50 % a 390×844, 320×568 y 1024×768 · axe 0 · CLS ≤ 0,1 (390 px, CPU×4)
// Uso: npx vite build --outDir dist && npx vite preview --host 127.0.0.1 --port 4342 --strictPort   y luego
//   ES342_URL=http://127.0.0.1:4342 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> [SHOTS=<carpeta> TAG=antes|despues] node scripts/es342-chat-defectos.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
const LONG = 'https://ejemplo.org/una/ruta/muy/larga/que/no/tiene/ningun/espacio/para/cortar/y/sigue/y/sigue/y/sigue?parametro=valorinterminablesinespacios1234567890'
const thread = [{ role: 'user', text: LONG }, { role: 'bot', text: 'Mira este enlace: ' + LONG }, { role: 'user', text: 'Otra cosa' }, { role: 'bot', text: 'Cuéntame más.' }]
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mock = page => page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
  return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } : p === '/api/messages' ? thread : [] }) })
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES342_URL; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); let n = 0
  if (process.env.SHOTS) fs.mkdirSync(process.env.SHOTS, { recursive: true })
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const [w, h] of [[390, 844], [320, 568], [1024, 768]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const page = await ctx.newPage()
    await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc) }, [lang, scheme])
    await mock(page)
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-limits').waitFor(); await page.waitForTimeout(800)
    const tag = `${scheme} ${lang} ${w}×${h}`
    const m0 = await page.evaluate(() => ({ pct: document.querySelector('.chat-scroll').getBoundingClientRect().height / innerHeight }))
    await page.locator('.space-chatbar-head button').last().click(); await page.locator('.space-callout').waitFor(); await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const sc = document.querySelector('.chat-scroll').getBoundingClientRect(), cal = document.querySelector('.space-callout').getBoundingClientRect(), bar = document.querySelector('.chat-input-bar').getBoundingClientRect()
      const cs = getComputedStyle(document.querySelector('.chat-composer-row button'))
      const over = [...document.querySelectorAll('.chat-msg-body, .chat-msg-text')].filter(e => e.scrollWidth > e.clientWidth + 1).length
      return { calTop: cal.top, calBottom: cal.bottom, scTop: sc.top, scBottom: sc.bottom, barTop: bar.top, over, bg: cs.backgroundColor, color: cs.color, op: cs.opacity, overX: document.documentElement.scrollWidth - innerWidth }
    })
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG || 'despues'}-${tag.replace(/[ ×]/g, '-')}.png` })
    assert.ok(m0.pct >= 0.5, `A4 hilo ≥ 50 % (${tag}): ${Math.round(m0.pct * 100)} %`)
    assert.ok(m.calTop >= m.scTop - 1 && m.calBottom <= m.scBottom + 1, `A1 aviso de pausa dentro del hilo visible (${tag}): aviso ${Math.round(m.calTop)}-${Math.round(m.calBottom)}, hilo ${Math.round(m.scTop)}-${Math.round(m.scBottom)}`)
    assert.ok(m.calBottom <= m.barTop + 1, `A1 el compositor no tapa el aviso (${tag})`)
    assert.equal(m.over, 0, `A2 ningún globo desborda (${tag})`); assert.ok(m.overX <= 0, `sin desborde horizontal (${tag}): ${m.overX}px`)
    assert.equal(m.op, '1', `A3 «Enviar» sin opacidad (${tag})`)
    assert.ok(ratio(m.color, m.bg) >= 4.5, `A3 «Enviar» deshabilitado legible (${tag}): ${ratio(m.color, m.bg).toFixed(2)}:1`)
    assert.ok(!/^rgb\(143, 90, 51\)$|^rgb\(201, 151, 106\)$/.test(m.bg), `A3 «Enviar» no usa el terracota de acción (${tag}): ${m.bg}`)
    await page.addScriptTag({ content: axeSource })
    const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id))
    assert.deepEqual(found, [], `axe 0 (${tag})`)
    console.log(`PASS ${tag}: hilo ${Math.round(m0.pct * 100)} % · aviso visible · sin desborde · Enviar ${ratio(m.color, m.bg).toFixed(1)}:1 · axe 0`); await ctx.close(); n++
  }
  // CLS a 390 px con CPU×4 al cargar el hilo con URLs largas y pausar.
  for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
    await mock(page)
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await page.locator('.space-chatbar-head button').last().click(); await page.waitForTimeout(500)
    const cls = await page.evaluate(() => window.__cls); assert.ok(cls <= 0.1, `CLS ≤ 0,1 (${lang}): ${cls}`); console.log(`PASS CLS ${lang}: ${cls.toFixed(4)}`); await ctx.close(); n++
  }
  console.log(`\nES-342 A: ${n} comprobaciones OK`); await browser.close()
})().catch(e => { console.error(e.message); process.exit(1) })
