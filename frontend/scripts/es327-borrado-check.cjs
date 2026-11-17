// ES-327 (E304-1): borrar una versión de hoja de vida con la RESPUESTA PERDIDA. Chromium, API simulada (page.route), datos SINTÉTICOS.
// Casos: (A) el servidor borró y la respuesta se perdió -> se relee y se dice «Versión borrada»; (B) no borró -> la lista sigue y se dice que no se pudo;
// (C) tampoco se puede releer -> pantalla de error con «Reintentar», sin afirmar nada; (D) 5xx con borrado hecho; (E) 404 al reintentar tras borrado hecho;
// (F) rechazo definitivo (403): «No pudimos borrar» sin releer. Axe 0 tras cada caso.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4327 --strictPort   y luego
//   ES327_URL=http://127.0.0.1:4327 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es327-borrado-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES327_URL ?? 'http://127.0.0.1:4327'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch(); let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  const axe = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(v => v.id)) }
  const scenario = async (name, { deleteMode, serverDeletes, listAfterFails, lang = 'es' }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage()
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang])
    let rows = [{ id: 2, version: 2, size: 53248, createdAt: '2026-11-02T10:00:00Z' }, { id: 1, version: 1, size: 40960, createdAt: '2026-11-01T10:00:00Z' }]; let deleted = false; const calls = []
    await page.route('**/api/**', async route => { const req = route.request(); const p = new URL(req.url()).pathname; calls.push(req.method() + ' ' + p)
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] } })
      if (p === '/api/user/resumes') { if (deleted && listAfterFails) return route.fulfill({ status: 503, json: {} }); return route.fulfill({ json: { resumes: rows, maxVersions: 5 } }) }
      if (/^\/api\/user\/resumes\/\d+$/.test(p) && req.method() === 'DELETE') {
        if (serverDeletes) rows = rows.filter(r => String(r.id) !== p.split('/').pop()); deleted = true
        if (deleteMode === 'abort') return route.abort('connectionreset'); if (deleteMode === '503') return route.fulfill({ status: 503, json: {} })
        if (deleteMode === '404') return route.fulfill({ status: 404, json: {} }); if (deleteMode === '403') return route.fulfill({ status: 403, json: {} })
        return route.fulfill({ status: 200, json: { ok: true } }) }
      return route.fulfill({ json: [] }) })
    await page.goto(base + '/app/context/resumes', { waitUntil: 'domcontentloaded' }); await page.locator('#rs-versions').waitFor()
    await page.locator('.cg-items li').first().locator('button').nth(2).click(); await page.locator('dialog[open]').waitFor()
    await page.locator('dialog[open] .cg-btn--danger').click(); await page.waitForTimeout(700)
    return { page, context, calls, name }
  }
  const text = async page => (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  { // A: respuesta perdida, el servidor sí borró
    const s = await scenario('A', { deleteMode: 'abort', serverDeletes: true }); const body = await text(s.page)
    assert.match(body, /Versión borrada/); assert.doesNotMatch(body, /No pudimos borrar/); assert.equal(await s.page.locator('.cg-items li').count(), 1, 'la lista ya no tiene la versión')
    assert.equal(await s.page.locator('dialog[open]').count(), 0, 'diálogo cerrado'); assert.ok(s.calls.filter(c => c === 'GET /api/user/resumes').length >= 2, 'releyó la lista'); assert.deepEqual(await axe(s.page), []); await s.context.close()
    check('A: respuesta perdida con borrado hecho → se relee y dice «Versión borrada»')
  }
  { // B: respuesta perdida, el servidor NO borró
    const s = await scenario('B', { deleteMode: 'abort', serverDeletes: false }); const body = await text(s.page)
    assert.match(body, /No pudimos borrar la versión/); assert.doesNotMatch(body, /Versión borrada/); assert.equal(await s.page.locator('.cg-items li').count(), 2, 'la lista sigue con las dos versiones')
    assert.ok(s.calls.filter(c => c === 'GET /api/user/resumes').length >= 2, 'releyó la lista'); assert.deepEqual(await axe(s.page), []); await s.context.close()
    check('B: respuesta perdida sin borrado → se relee y dice que no se pudo; la versión sigue en la lista')
  }
  { // C: respuesta perdida y tampoco se puede releer
    const s = await scenario('C', { deleteMode: 'abort', serverDeletes: true, listAfterFails: true }); const body = await text(s.page)
    assert.match(body, /No pudimos cargar tus hojas de vida/); assert.doesNotMatch(body, /Versión borrada|No pudimos borrar la versión/); assert.ok(await s.page.getByRole('button', { name: 'Reintentar' }).count() >= 1)
    assert.deepEqual(await axe(s.page), []); await s.context.close()
    check('C: no se puede releer → error con «Reintentar», sin afirmar borrado ni fallo')
  }
  { const s = await scenario('D', { deleteMode: '503', serverDeletes: true }); assert.match(await text(s.page), /Versión borrada/); await s.context.close(); check('D: 5xx con borrado hecho → «Versión borrada»') }
  { const s = await scenario('E', { deleteMode: '404', serverDeletes: true }); assert.match(await text(s.page), /Versión borrada/); await s.context.close(); check('E: 404 (ya no existe) → se relee y dice «Versión borrada»') }
  { // F: rechazo definitivo: no se relee
    const s = await scenario('F', { deleteMode: '403', serverDeletes: false }); const body = await text(s.page)
    assert.match(body, /No pudimos borrar la versión/); assert.equal(s.calls.filter(c => c === 'GET /api/user/resumes').length, 1, 'no releyó: respuesta definitiva'); assert.equal(await s.page.locator('dialog[open]').count(), 1, 'el diálogo sigue abierto')
    await s.context.close(); check('F: rechazo definitivo (403) → «No pudimos borrar» sin releer, diálogo abierto')
  }
  { const s = await scenario('A-en', { deleteMode: 'abort', serverDeletes: true, lang: 'en' }); assert.match(await text(s.page), /Version deleted/); await s.context.close(); check('A en inglés: «Version deleted.»') }
  await browser.close(); console.log(`\nES-327: ${checks} comprobaciones OK`)
})().catch(error => { console.error(error); process.exit(1) })
