// ES-401: «Mis datos» → «Preparar mi archivo» muestra etiquetas legibles (sin claves internas) en ES y EN; una clave desconocida sale como «Otros datos». Chromium, API simulada, DATOS SINTÉTICOS.
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es401-check.cjs   (EXPECT_FAIL=1 para documentar main)
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const NINE = ['passwordResets', 'therapistOrdinals', 'reviewResponses', 'reviewObjections', 'professionalReviews', 'reviewShares', 'pilotFeedbacks', 'invitations', 'reviewerInvitesRedeemed']
  const data = { schemaVersion: 1, type: 'personal', locale: 'es', profile: {}, diary: [1, 2], ...Object.fromEntries(NINE.map((k, i) => [k, Array.from({ length: i + 1 }, (_, n) => n)])), claveNuevaDelServidor: [1, 2, 3], otraClaveNueva: [1] }
  const expected = { es: { first: 'Solicitudes de recuperación de contraseña (1)', other: 'Otros datos (4)' }, en: { first: 'Password reset requests (1)', other: 'Other data (4)' } }
  const results = []; const fails = []
  for (const lang of ['es', 'en']) for (const w of [320, 390, 1360]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
      if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/exports/preview') return r.fulfill({ json: { id: '3f2b8c1e-5d4a-4b6c-9e7f-0a1b2c3d4e5f', expiresAt: new Date(Date.now() + 36e5).toISOString(), data } })
      return r.fulfill({ json: [] }) })
    const tag = `${lang} ${w}px`
    try {
      await page.goto(base + '/app/data', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: lang === 'es' ? 'Preparar mi archivo' : 'Prepare my file' }).click()
      const list = page.locator('#data-sections, [id^="data-"]', { hasText: expected[lang].first }).first(); await page.getByText(expected[lang].first, { exact: false }).first().waitFor()
      const text = await page.locator('main').innerText()
      for (const key of [...NINE, 'claveNuevaDelServidor', 'otraClaveNueva']) assert.ok(!new RegExp('(^|\\s)' + key + '(\\s\\(\\d|\\s·|$)', 'm').test(text), `la clave ${key} no se ve`)
      assert.ok(text.includes(expected[lang].other), `«${expected[lang].other}» presente`); assert.ok(text.includes(expected[lang].first), 'etiqueta traducida presente')
      await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(x => x.id + ' ' + x.nodes.length)); assert.deepEqual(v, [], 'axe 0')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desborde horizontal'); void list
      results.push('PASS ' + tag)
    } catch (e) { fails.push(tag); results.push('FAIL ' + tag + ' → ' + e.message.split('\n')[0]) }
    await ctx.close()
  }
  console.log(results.join('\n')); console.log(`\n${results.length - fails.length}/${results.length} OK`); await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
