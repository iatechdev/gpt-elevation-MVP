// ES-346: tras «eliminar mi cuenta» el navegador no conserva elevation_token, nombre, rol ni ruta de retorno, y el aviso sigue visible. Chromium, API simulada, DATOS SINTÉTICOS.
// Comprueba además: la marca de despedida no abre otras rutas (ir a /app/dashboard sin sesión lleva a /login) y un fallo del servidor NO cierra la sesión.
// Uso: ES346_URL=http://127.0.0.1:4346 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es346-eliminar-sesion.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES346_URL; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); let n = 0
  const WORD = { es: 'ELIMINAR', en: 'DELETE' }, START = { es: /Quiero eliminar mi cuenta/, en: /I want to delete my account/ }, CONFIRM = { es: 'Eliminar mi cuenta', en: 'Delete my account' }, DONE = { es: /Recibimos tu solicitud/, en: /We received your request/ }
  // 'hostile': tras aceptarse la eliminación, TODA otra llamada (sesión, uso de IA…) responde 401 como un servidor real con el token revocado; el aviso debe seguir visible.
  for (const lang of ['es', 'en']) for (const mode of ['ok', 'fails', 'hostile', 'hang']) {
    const fails = mode === 'fails'; let accepted = false
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const tag = `${lang}${fails ? ' (el servidor falla)' : mode === 'hostile' ? ' (401 en todo lo demás)' : mode === 'hang' ? ' (el cierre de sesión no responde)' : ''}`
    await page.addInitScript(l => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('elevation_token', 'tok-sintetico'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elevation_checkin_date', '2026-11-18'); sessionStorage.setItem('elevation_return_to', JSON.stringify({ path: '/app/dashboard', at: Date.now() })); sessionStorage.setItem('seeded', '1') } localStorage.setItem('elv_lang', l) }, lang)
    let logout = 0
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/logout') { logout++; if (mode === 'hang') return; return route.fulfill({ status: 401, json: { error: 'x' } }) } // 'hang': el servidor no responde al cierre de sesión
      if (p === '/api/account/deletion-requests') { if (!fails) accepted = true; return fails ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.fulfill({ status: 202, json: { id: 'rec-1' } }) }
      if (mode === 'hostile' && accepted) return route.fulfill({ status: 401, json: { error: 'Sesión inválida' } })
      return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: false } : [] }) })
    await page.goto(base + '/app/data', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: START[lang] }).click(); await page.getByRole('textbox').fill(WORD[lang]); await page.getByRole('button', { name: CONFIRM[lang], exact: true }).click()
    if (fails) {
      await page.waitForTimeout(800); const keep = await page.evaluate(() => localStorage.getItem('elevation_token'))
      assert.equal(keep, 'tok-sintetico', `un fallo del servidor NO cierra la sesión (${tag})`); assert.equal(logout, 0, `sin cierre de sesión si falla (${tag})`); console.log(`PASS ${tag}: la sesión se conserva`); await ctx.close(); n++; continue
    }
    const t0 = Date.now()
    await page.getByText(DONE[lang]).waitFor({ timeout: 9000 })
    if (mode === 'hang') { const waited = Date.now() - t0; assert.ok(waited < 7500, `el diálogo no queda colgado: el aviso llegó en ${waited} ms (tope de signOut 5000 ms) (${tag})`); console.log(`  espera con el servidor colgado: ${waited} ms`) }
    if (mode === 'hostile') await page.waitForTimeout(2500) // da tiempo a que cualquier 401 pendiente (sesión, uso de IA, verificación) llegue y se maneje
    const stored = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage).filter(([k]) => /^elevation_/.test(k))), session: Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => /^elevation_/.test(k))) }))
    assert.deepEqual(stored.local, {}, `localStorage sin token, nombre, rol ni check-in (${tag}): ${JSON.stringify(stored.local)}`)
    assert.deepEqual(stored.session, {}, `sessionStorage sin ruta de retorno (${tag}): ${JSON.stringify(stored.session)}`)
    assert.equal(logout, 1, `se ejecuta el mismo cierre de sesión (POST /api/logout) (${tag})`)
    assert.ok(await page.getByText(DONE[lang]).isVisible(), `el aviso sigue visible (${tag})`); assert.equal(new URL(page.url()).pathname, '/app/data', `no redirige a /login mientras se ve el aviso (${tag})`)
    await page.addScriptTag({ content: axeSource }); const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id)); assert.deepEqual(found, [], `axe 0 en el aviso (${tag})`)
    // La marca no abre otras rutas: sin sesión, /app/dashboard lleva a /login
    await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' }); assert.equal(new URL(page.url()).pathname, '/login', `sin sesión, otras rutas llevan a /login (${tag})`)
    // Recargar /app/data sin sesión también lleva a /login (la marca no se persiste)
    await page.goto(base + '/app/data', { waitUntil: 'networkidle' }); assert.equal(new URL(page.url()).pathname, '/login', `recargar /app/data sin sesión lleva a /login (${tag})`)
    console.log(`PASS ${tag}: storage limpio, aviso visible, 1 cierre de sesión, axe 0, otras rutas a /login`); await ctx.close(); n++
  }
  console.log(`\nES-346: ${n} escenarios OK`); await browser.close()
})().catch(e => { console.error(e.message); process.exit(1) })
