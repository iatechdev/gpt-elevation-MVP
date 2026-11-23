// ES-394: al enviar, la respuesta de la IA debe quedar a la vista. Chromium, API simulada, DATOS SINTÉTICOS.
// Casos (cada uno a 320, 390, 900 y 1360 px, ES y EN):
//  A) la persona está al final y recibe una respuesta CORTA → la respuesta queda entera a la vista.
//  B) la persona está al final y recibe una respuesta LARGA → se ve su INICIO (no se salta al final).
//  C) la persona subió a leer algo anterior → NO se le arrastra (scrollTop intacto) y aparece «Ir al último mensaje»; al pulsarlo baja al final y el control desaparece.
//  D) el envío falla (error) → el aviso queda a la vista (el hilo no oculta el estado).
//  E) con prefers-reduced-motion el desplazamiento no se anima.
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es394-check.cjs   (EXPECT_FAIL=1 para documentar el fallo en main)
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const axe = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(v => v.id + ' ' + v.nodes.length)) }
  const base12 = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? `Gracias por contarme eso (${i}). ¿Qué parte de lo que viviste esta semana te gustaría mirar con más calma?` : `Esta semana me sentí con poca energía (${i}) y no sé por dónde empezar.` }))
  const shortReply = 'Respuesta corta de prueba: gracias por compartirlo.'
  const longReply = Array.from({ length: 14 }, (_, i) => `Párrafo ${i + 1} de una respuesta larga y sintética. `.repeat(6)).join('\n\n')
  const results = []; const fails = []
  const run = async (name, fn) => { try { await fn(); results.push('PASS ' + name) } catch (e) { fails.push(name + ' → ' + e.message.split('\n')[0]); results.push('FAIL ' + name + ' → ' + e.message.split('\n')[0]) } }
  for (const lang of (process.env.LANGS || 'es,en').split(',')) for (const w of (process.env.WIDTHS || '320,390,900,1360').split(',').map(Number)) for (const kase of (process.env.KASES || 'A-corta,B-larga,C-subio,D-error,E-reducido').split(',')) {
    const h = w >= 900 ? 800 : 700
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: kase === 'E-reducido' ? 'reduce' : 'no-preference' }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    let thread = base12.slice(); let sent = null
    await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; const j = x => route.fulfill({ json: x })
      if (p === '/api/session') return j({ role: 'user', onboardingCompleted: true }); if (p === '/api/ai/usage') return j({ configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' })
      if (p === '/api/messages') return j(thread)
      if (p === '/api/chat') { const body = route.request().postDataJSON(); await new Promise(r => setTimeout(r, kase === 'C-subio' ? 1600 : 700)); if (kase === 'D-error') return route.fulfill({ status: 500, json: { error: 'x' } })
        const reply = kase === 'B-larga' ? longReply : shortReply; thread = thread.concat([{ role: 'user', text: body.message }, { role: 'bot', text: reply }]); sent = body; return j({ reply, requestId: body.requestId }) }
      return j([]) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-limits').waitFor(); await page.getByText('Gracias por contarme eso (11)').waitFor(); await page.waitForTimeout(700)
    if (process.env.DEBUG394) await page.evaluate(() => { const s = document.querySelector('.chat-scroll'); window.__log = []; s.addEventListener('scroll', () => window.__log.push([Math.round(performance.now()), Math.round(s.scrollTop), s.scrollHeight])) })
    const tag = `${kase} ${lang} ${w}px`
    await run(tag, async () => {
      const metrics = () => page.evaluate(() => { const s = document.querySelector('.chat-scroll'); const sr = s.getBoundingClientRect(); const bots = [...document.querySelectorAll('.chat-msg--bot')]; const last = bots[bots.length - 1].getBoundingClientRect(); const jump = document.querySelector('.chat-jump'); const frame = document.querySelector('.cg-frame')
        return { top: s.scrollTop, max: s.scrollHeight - s.clientHeight, viewTop: sr.top, viewBottom: sr.bottom, lastTop: last.top, lastBottom: last.bottom, jump: !!jump && jump.getBoundingClientRect().height > 0, frameTop: frame ? frame.scrollTop : 0, winY: scrollY } })
            await page.locator('.space-message').fill('Hola, quiero seguir con esto'); const before = await metrics()
      await page.locator('.chat-composer-row button').click()
      if (kase === 'C-subio') { await page.waitForTimeout(500); const box = await page.locator('.chat-scroll').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -20000); await page.waitForTimeout(400) } // la persona sube a leer algo anterior MIENTRAS espera
      if (kase === 'D-error') { await page.locator('.chat-status').waitFor(); await page.waitForTimeout(900); const m = await metrics(); const al = await page.evaluate(() => { const r = document.querySelector('.chat-status').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 }); assert.ok(al, 'el aviso de error queda a la vista'); assert.equal(m.frameTop, 0, 'el marco no se desplaza'); return }
      await page.getByText(kase === 'B-larga' ? 'Párrafo 14 de una respuesta' : 'Respuesta corta de prueba').first().waitFor({ state: 'attached' }); await page.waitForTimeout(kase === 'E-reducido' ? 120 : 1800)
      if (process.env.DEBUG394) console.log(JSON.stringify(await page.evaluate(() => window.__t)), JSON.stringify(await page.evaluate(() => window.__log.filter((_, i, a) => i % Math.ceil(a.length / 20) === 0 || i === a.length - 1))))
      const m = await metrics(); if (kase === 'C-subio') before.top = 0
      assert.equal(m.frameTop, 0, 'el marco no se desplaza'); assert.equal(m.winY, 0, 'la ventana no se desplaza')
      if (kase === 'A-corta' || kase === 'E-reducido') { assert.ok(m.lastTop >= m.viewTop - 1 && m.lastBottom <= m.viewBottom + 1, `la respuesta corta queda entera a la vista (${Math.round(m.lastTop)}–${Math.round(m.lastBottom)} dentro de ${Math.round(m.viewTop)}–${Math.round(m.viewBottom)})`); assert.equal(m.jump, false, 'sin control cuando se sigue la respuesta') }
      if (kase === 'B-larga') { assert.ok(m.lastTop >= m.viewTop - 1 && m.lastTop < m.viewBottom - 40, `se ve el INICIO de la respuesta larga (top ${Math.round(m.lastTop)}, vista ${Math.round(m.viewTop)}–${Math.round(m.viewBottom)}; scrollTop ${Math.round(m.top)} de ${Math.round(m.max)})`) }
      if (kase === 'C-subio') { assert.ok(Math.abs(m.top - before.top) <= 2, `no se arrastra a quien subió (scrollTop ${before.top} → ${m.top})`); assert.equal(m.jump, true, 'aparece «Ir al último mensaje»'); assert.deepEqual(await axe(page), [], 'axe 0 con el control visible'); const cb = await page.locator('.chat-jump').boundingBox(); assert.ok(cb.height >= 44 && cb.x >= 0 && cb.x + cb.width <= w, 'el control mide ≥ 44 px y cabe en el ancho'); await page.locator('.chat-scroll').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'chat-jump', 'el control se alcanza con Tab desde el hilo'); const ring = await page.evaluate(() => getComputedStyle(document.querySelector('.chat-jump')).outlineStyle); assert.notEqual(ring, 'none', 'foco visible'); const name = lang === 'es' ? 'Ir al último mensaje' : 'Jump to latest message'; assert.equal(await page.getByRole('button', { name }).count(), 1, 'nombre accesible'); await page.keyboard.press('Enter'); await page.waitForTimeout(1600); const after = await metrics(); assert.ok(after.max - after.top <= 2, 'el control baja al final'); assert.equal(after.jump, false, 'el control desaparece al llegar al final') }
      if (kase !== 'E-reducido' && kase !== 'C-subio') assert.deepEqual(await axe(page), [], 'axe 0')
    })
    await ctx.close()
  }
  console.log(results.join('\n')); console.log(`\n${results.length - fails.length}/${results.length} OK`)
  await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
