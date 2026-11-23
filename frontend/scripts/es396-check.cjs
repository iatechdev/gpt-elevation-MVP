// ES-396: el mensaje propio se ve al enviarlo. Chromium, API simulada, DATOS SINTÉTICOS. 320/390/900/1360 px × ES/EN.
//  S1 envío normal: la burbuja propia («Enviando…») y el indicador están a la vista al instante; al llegar la respuesta queda UNA sola burbuja con ese texto.
//  S2 texto repetido: enviar un texto idéntico a uno ya existente muestra la burbuja provisional y termina con una sola burbuja nueva.
//  S3 error 500: «Sin confirmar» y el texto sigue en la caja; S4 sin red: «Sin confirmar», Reintentar el mismo envío → una sola burbuja y un solo mensaje en el servidor.
//  S5 doble envío (doble clic y Enter repetido) → una sola petición. S6 envío pendiente tras recargar → burbuja «Sin confirmar».
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es396-check.cjs   (EXPECT_FAIL=1 para documentar main)
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const axe = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(v => v.id + ' ' + v.nodes.length)) }
  const base12 = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? `Gracias por contarme eso (${i}). ¿Qué parte te gustaría mirar con más calma?` : `Esta semana me sentí con poca energía (${i}) y no sé por dónde empezar.` }))
  const results = []; const fails = []
  const run = async (name, fn) => { try { await fn(); results.push('PASS ' + name) } catch (e) { fails.push(name); results.push('FAIL ' + name + ' → ' + e.message.split('\n')[0]) } }
  const labels = { es: { sending: 'Enviando…', unconfirmed: 'Sin confirmar', retry: 'Reintentar el mismo envío' }, en: { sending: 'Sending…', unconfirmed: 'Unconfirmed', retry: 'Retry the same message' } }
  for (const lang of (process.env.LANGS || 'es,en').split(',')) for (const w of (process.env.WIDTHS || '320,390,900,1360').split(',').map(Number)) for (const kase of (process.env.KASES || 'S1,S2,S3,S4,S5,S6').split(',')) {
    const L = labels[lang]; const h = w >= 900 ? 800 : 700
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    const text = kase === 'S2' ? base12[0].text : `Quiero seguir con esto (${kase})`
    let thread = base12.slice(); let posts = 0; let mode = kase === 'S3' ? '500' : kase === 'S4' || kase === 'S6' ? 'abort' : 'ok'; const turns = []
    await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; const j = x => route.fulfill({ json: x })
      if (p === '/api/session') return j({ role: 'user', onboardingCompleted: true }); if (p === '/api/ai/usage') return j({ configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' })
      if (p === '/api/messages') return j(thread)
      if (p.startsWith('/api/chat/turns/')) return route.fulfill({ status: 404, json: { error: 'x' } })
      if (p === '/api/chat') { posts++; const body = route.request().postDataJSON(); await new Promise(r => setTimeout(r, 900))
        if (mode === '500') return route.fulfill({ status: 500, json: { error: 'x' } }); if (mode === 'abort') return route.abort('connectionfailed')
        thread = thread.concat([{ role: 'user', text: body.message }, { role: 'bot', text: 'Respuesta de prueba.' }]); turns.push(body.requestId); return j({ reply: 'Respuesta de prueba.', requestId: body.requestId }) }
      return j([]) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-limits').waitFor(); await page.getByText('Gracias por contarme eso (11)').waitFor(); await page.waitForTimeout(500)
    const tag = `${kase} ${lang} ${w}px`
    const bubbles = () => page.locator('.chat-msg--you .chat-msg-body', { hasText: text }).count()
    const initial = kase === 'S2' ? 1 : 0
    const visible = sel => page.evaluate(s => { const sc = document.querySelector('.chat-scroll').getBoundingClientRect(); const els = [...document.querySelectorAll(s)]; const e = els[els.length - 1]; if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= sc.top - 1 && r.bottom <= sc.bottom + 1 }, sel)
    await run(tag, async () => {
      if (kase === 'S6') { // el envío falla sin red y se recarga la página: la burbuja pendiente sigue ahí
        await page.locator('.space-message').fill(text); await page.locator('.chat-composer-row button').click(); await page.getByText(L.unconfirmed).first().waitFor(); await page.reload({ waitUntil: 'networkidle' }); await page.getByText(L.unconfirmed).first().waitFor()
        assert.equal(await bubbles(), 1, 'burbuja pendiente tras recargar'); return }
      await page.locator('.space-message').fill(text); await page.locator('.chat-composer-row button').click()
      if (kase === 'S5') { await page.locator('.chat-composer-row button').click({ force: true, timeout: 500 }).catch(() => {}); await page.locator('.space-message').press('Enter').catch(() => {}); await page.waitForTimeout(1500); assert.equal(posts, 1, 'una sola petición'); assert.equal(await bubbles(), 1, 'una sola burbuja'); return }
      await page.waitForTimeout(250)
      assert.equal(await bubbles(), initial + 1, 'la burbuja propia se ve al instante'); assert.ok(await visible('.chat-msg--you'), 'la burbuja propia queda a la vista')
      if (kase === 'S1') { assert.ok(await page.getByText(L.sending, { exact: true }).first().isVisible(), '«Enviando…»'); assert.deepEqual(await axe(page), [], 'axe 0 durante el envío') }
      if (kase === 'S3' || kase === 'S4') {
        await page.getByText(L.unconfirmed, { exact: true }).first().waitFor({ timeout: 4000 }); assert.equal(await bubbles(), initial + 1, 'sigue una sola burbuja'); assert.equal(await page.locator('.space-message').inputValue(), text, 'el texto sigue en la caja')
        assert.deepEqual(await axe(page), [], 'axe 0 con «Sin confirmar»')
        if (kase === 'S4') { mode = 'ok'; await page.getByRole('button', { name: L.retry }).click(); await page.locator('.chat-msg-text', { hasText: 'Respuesta de prueba.' }).last().waitFor(); await page.waitForTimeout(400); assert.equal(turns.length, 1, 'un solo mensaje en el servidor'); assert.equal(await bubbles(), 1, 'sin duplicados tras reintentar'); assert.equal(await page.getByText(L.unconfirmed, { exact: true }).count(), 0, 'sin «Sin confirmar»') }
        return }
      await page.locator('.chat-msg-text', { hasText: 'Respuesta de prueba.' }).last().waitFor(); await page.waitForTimeout(500)
      assert.equal(await bubbles(), initial + 1, 'tras la respuesta, una sola burbuja nueva con ese texto'); assert.equal(await page.getByText(L.sending, { exact: true }).count(), 0, 'sin «Enviando…» al terminar')
      assert.equal(await page.evaluate(() => document.querySelector('.cg-frame').scrollTop), 0, 'el marco no se desplaza')
    })
    await ctx.close()
  }
  console.log(results.join('\n')); console.log(`\n${results.length - fails.length}/${results.length} OK`)
  await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
