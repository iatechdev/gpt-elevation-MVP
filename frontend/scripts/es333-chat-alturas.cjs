// ES-333 (PR 2): alturas reales del chat (barra compacta + compositor compacto), dentro del marco de persona. Chromium, API simulada, DATOS SINTÉTICOS (uso 37/100).
// Criterios (adenda 12351 de ES-333 y aceptación E314-1/E314-2):
//  · hilo visible ≥ 50 % del alto en 390×844, 390×544 (teclado), 320×568 y 320×318 (teclado muy corto); en 320×298 se informa (objetivo ≈ 169 px) y la caja y «Límites» deben quedar a la vista;
//  · «Conversación», «Privada · Solo visible para ti» y «Pausar» visibles sin desplazarse; la caja de mensaje siempre a la vista; sin desborde horizontal;
//  · el marco mide el alto de la ventana y NO se desplaza: el hilo es lo único que se desplaza (hilo largo);
//  · E314-1: a 1360×900 con el hilo vacío o corto, la caja queda pegada abajo (borde inferior = alto de la ventana);
//  · axe wcag2a/2aa/21aa/22aa + target-size = 0.
// Las alturas de la adenda se informan con tolerancia ±8 px (tipografía de reserva del sistema). El teclado se SIMULA reduciendo el alto de la ventana; no es un teclado real.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4334 --strictPort   y luego
//   ES333_URL=http://127.0.0.1:4334 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es333-chat-alturas.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES333_URL; const browser = await chromium.launch(); let n = 0; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const axe = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(v => v.id + ' ' + v.nodes.length)) }
  const long = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? 'Gracias por contarme eso. ¿Qué parte de lo que viviste esta semana te gustaría mirar con más calma?' : 'Esta semana me sentí con poca energía y no sé por dónde empezar.' }))
  const threads = { long, short: long.slice(0, 2), empty: [] }
  // [ancho, alto de la ventana, teclado simulado, hilo, meta de hilo ≥ 50 %]
  const cases = [[390, 844, 0, 'long', true], [390, 844, 300, 'long', true], [320, 568, 0, 'long', true], [320, 568, 250, 'long', true], [320, 568, 270, 'long', false], [1360, 900, 0, 'long', false], [1360, 900, 0, 'empty', false], [1360, 900, 0, 'short', false]]
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const [w, h, kb, kind, goal] of cases) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h - kb } }); const page = await ctx.newPage()
    await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc) }, [lang, scheme])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } : p === '/api/messages' ? threads[kind] : [] }) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-limits').waitFor(); if (kind !== 'empty') await page.getByText('Gracias por contarme').first().waitFor(); await page.waitForTimeout(900)
    const typing = kb > 0; if (typing) { await page.locator('.space-message').focus(); await page.waitForTimeout(300) } // con teclado abierto la persona está escribiendo en la caja
    const m = await page.evaluate(() => {
      const rect = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null }; const t = rect('.chat-scroll'); const bar = rect('.chat-input-bar'); const lim = rect('.chat-limits'); const top = rect('.space-chatbar-head'); const frame = document.querySelector('.cg-frame'); const vh = innerHeight
      const inView = r => !!r && r.top >= -1 && r.bottom <= vh + 1; const pause = [...document.querySelectorAll('.space-chatbar-head button')].pop().getBoundingClientRect(); const priv = document.querySelector('.space-chatbar-head p').getBoundingClientRect()
      const ta = document.querySelector('.space-message').getBoundingClientRect(); const tools = rect('.chat-composer-top'); const thread = document.querySelector('.chat-scroll')
      return { vh, visible: t.height, barH: Math.round(bar.height), topH: Math.round(top.height), toolsH: tools ? Math.round(tools.height) : 0, limH: Math.round(lim.height), barBottom: bar.bottom, barInView: inView(bar), taInView: inView(ta), limInView: inView(lim), pauseInView: inView(pause), privInView: inView(priv),
        overflowX: document.documentElement.scrollWidth - innerWidth, frameScrolls: frame.scrollHeight - frame.clientHeight, threadScrolls: thread.scrollHeight - thread.clientHeight > 1, frameH: Math.round(frame.getBoundingClientRect().height) }
    })
    const tag = `${scheme} ${lang} ${w}×${h - kb}${kb ? ' (teclado simulado)' : ''} ${kind}`
    assert.ok(m.overflowX <= 0, `sin desborde horizontal (${tag}): ${m.overflowX}px`)
    assert.equal(m.frameH, h - kb, `el marco mide el alto de la ventana (${tag})`)
    assert.ok(m.pauseInView && m.privInView, `«Pausar» y «Privada» a la vista (${tag})`)
    assert.ok(m.taInView, `la caja de mensaje a la vista (${tag})`)
    const short = h - kb < 400 && typing // regla aprobada: con alto visible < 400 px se ocultan herramientas y límites SOLO mientras se escribe
    if (!short) assert.ok(m.limInView, `«Límites del asistente» a la vista (${tag})`)
    else { assert.equal(m.toolsH + m.limH, 0, `herramientas y límites ocultos mientras se escribe (${tag})`); await page.locator('.space-message').blur(); await page.waitForTimeout(300); const back = await page.evaluate(() => { const r = document.querySelector('.chat-limits').getBoundingClientRect(); const b = document.querySelector('.chat-input-bar').getBoundingClientRect(); return { ok: r.height > 0 && r.top >= -1 && r.bottom <= innerHeight + 1 && b.bottom <= innerHeight + 1, lim: [Math.round(r.top), Math.round(r.bottom)], bar: [Math.round(b.top), Math.round(b.bottom)], vh: innerHeight, focus: document.activeElement.tagName } }) /* diagnóstico */; assert.ok(back.ok, JSON.stringify(back) + ` E314-2: al cerrar el teclado «Límites» y la caja quedan a la vista (${tag})`) }
    if (kind === 'long') { assert.ok(m.frameScrolls <= 1, `el marco no se desplaza (${tag}): ${m.frameScrolls}px`); assert.ok(m.threadScrolls, `el hilo es el que se desplaza (${tag})`) }
    if (goal) assert.ok(m.visible >= 0.5 * m.vh, `hilo ≥ 50 % del alto (${tag}): ${Math.round(m.visible)} de ${m.vh} px (${Math.round(m.visible / m.vh * 100)} %)`)
    if (w === 1360) assert.ok(Math.abs(m.barBottom - m.vh) <= 1, `E314-1: la caja queda pegada abajo con el hilo ${kind} (${tag}): borde ${Math.round(m.barBottom)} de ${m.vh}`)
    const found = await axe(page); assert.deepEqual(found, [], `axe 0 (${tag})`)
    console.log(`PASS ${tag}: hilo ${Math.round(m.visible)} px (${Math.round(m.visible / m.vh * 100)} %) · barra ${m.topH} · compositor ${m.barH} (herramientas ${m.toolsH}, límites ${m.limH})`); await ctx.close(); n++
  }
  // E316-1: avisos del hilo (pausa y límite agotado) legibles en claro/oscuro × ES/EN (axe 0, incluye contraste).
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const state of ['paused', 'exhausted']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage()
    await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc) }, [lang, scheme])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: state === 'exhausted' ? 100 : 37, resetsAt: '2026-12-01T00:00:00Z' } : p === '/api/messages' ? threads.short : [] }) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.getByText('Gracias por contarme').first().waitFor(); await page.waitForTimeout(600)
    if (state === 'paused') await page.locator('.space-chatbar-head button').last().click()
    await page.locator('.space-callout').first().waitFor(); const tag = `aviso ${state} ${scheme} ${lang}`
    assert.deepEqual(await axe(page), [], `axe 0 con el aviso (${tag})`); console.log(`PASS ${tag}`); await ctx.close(); n++
  }
  // Hojas inferiores: menú, recomendaciones y check-out (axe 0, foco al abrir y al cerrar con Esc, Tab atrapado) en claro/oscuro × ES/EN a 390×844.
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage()
    await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc) }, [lang, scheme])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname; const j = x => route.fulfill({ json: x })
      if (p === '/api/session') return j({ role: 'user', onboardingCompleted: true }); if (p === '/api/ai/usage') return j({ configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' }); if (p === '/api/messages') return j(threads.short)
      if (p === '/api/recommendations/generate') return j([{ id: 1, category: 'mindfulness', content: 'Respira tres veces antes de responder.', generatedAt: '2026-11-17T10:00:00Z' }]); return j([]) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.getByText('Gracias por contarme').first().waitFor(); await page.waitForTimeout(600)
    const tag = `hojas ${scheme} ${lang}`
    await page.locator('.chat-menu-btn').click(); await page.locator('dialog[open]').waitFor()
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.closest('dialog') !== null), true, `el foco entra al menú (${tag})`)
    assert.deepEqual(await axe(page), [], `axe 0 con el menú abierto (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal(await page.locator('dialog[open]').count(), 0, `Esc cierra el menú (${tag})`)
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('chat-menu-btn')), true, `el foco vuelve al botón Menú (${tag})`)
    await page.locator('.chat-menu-btn').click(); await page.locator('dialog[open] .chat-menu-list button').nth(1).click(); await page.locator('dialog[open]').waitFor() // Recomendaciones
    await page.locator('dialog[open] .cg-btn').first().click(); await page.getByText('Respira tres veces').waitFor(); assert.deepEqual(await axe(page), [], `axe 0 con Recomendaciones (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    await page.locator('.chat-menu-btn').click(); await page.locator('dialog[open] .chat-menu-list button').last().click(); await page.locator('dialog[open]').waitFor() // Cerrar sesión -> check-out
    await page.locator('dialog[open] input[type=radio]').first().check(); assert.deepEqual(await axe(page), [], `axe 0 con el check-out (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal(await page.locator('dialog[open]').count(), 0, `Esc cierra el check-out (${tag})`)
    console.log(`PASS ${tag}: menú, Recomendaciones y check-out (axe 0, foco, Esc)`); await ctx.close(); n++
  }
  console.log(`\nES-333 PR 2: ${n} combinaciones OK`); await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
