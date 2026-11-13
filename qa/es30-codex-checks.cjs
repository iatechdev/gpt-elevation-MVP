// QA-Claude-2 — ES-30 (#86): verifica de forma independiente 3 observaciones del revisor automático (Codex) sobre el head probado.
// Requiere vite (:5173) con backend real en :8090 (las respuestas se interceptan donde se indica). Datos sintéticos.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const mk = (key, n) => ({ skillKey: key, type: 'domain', labels: { es: n, en: n }, rubric: { levels: { 1: { es: 'a', en: 'a' }, 2: { es: 'b', en: 'b' }, 3: { es: 'c', en: 'c' }, 4: { es: 'd', en: 'd' } }, source: 's', verifiedAt: '2026-10-01T00:00:00Z' }, state: 'no_evidence', self: null, review: null })
const CORS = { 'access-control-allow-origin': '*' }
;(async () => {
  const b = await chromium.launch()
  const mkctx = async (w, lang = 'es') => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(l => { localStorage.setItem('elevation_token', 's'); localStorage.setItem('elv_lang', l) }, lang); return c }
  // (1) producción hoy: ninguna capacidad con territorio. ¿Se ven las capacidades en escritorio sin pulsar nada?
  for (const w of [1280, 375]) {
    const c = await mkctx(w); const p = await c.newPage()
    await p.route('**/api/skill-map', r => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ catalogVersion: 1, skills: [mk('zz1', 'Capacidad uno'), mk('zz2', 'Capacidad dos')] }) }))
    await p.goto('http://localhost:5173/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
    const visible = await p.getByText('Capacidad uno').first().isVisible().catch(() => false)
    console.log(`(1) ancho ${w}: capacidades sin territorio visibles sin pulsar nada = ${visible}; mapa visible = ${await p.locator('svg.skill-map-svg').isVisible()}; botón lista visible = ${await p.locator('.skill-map-view-toggle').isVisible()}`)
    if (w === 1280) await p.screenshot({ path: process.env.OUT + '/unassigned-1280-initial.png', fullPage: true })
    await c.close()
  }
  // (2) tras revocar, ¿se vuelve a pedir el mapa?
  { const c = await mkctx(1280); const p = await c.newPage(); let gets = 0
    await p.route('**/api/skill-map', r => { gets++; r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ catalogVersion: 1, skills: [mk('zz1', 'Capacidad uno')] }) }) })
    await p.route('**/api/consents**', r => { const m = r.request().method(); r.fulfill({ status: 200, contentType: 'application/json', headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: m === 'GET' ? JSON.stringify({ consents: [{ purpose: 'professional_bridge', status: 'granted' }] }) : '{}' }) })
    await p.goto('http://localhost:5173/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(500); const before = gets
    await p.locator('.skill-map-tools button', { hasText: 'Revocar todos' }).click(); await p.waitForTimeout(200); await p.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await p.waitForTimeout(1000)
    console.log(`(2) peticiones GET /api/skill-map antes de revocar: ${before}; después de revocar: ${gets} (${gets > before ? 'recarga el mapa' : 'NO recarga el mapa'})`); await c.close() }
  // (3) roles de territorio por idioma
  for (const lang of ['es', 'en']) { const c = await mkctx(1280, lang); const p = await c.newPage(); await p.route('**/api/skill-map', r => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ catalogVersion: 1, skills: [mk('zz1', 'Capacidad uno')] }) })); await p.goto('http://localhost:5173/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
    console.log(`(3) idioma ${lang}: roles =`, JSON.stringify(await p.locator('svg .skill-map-territory-roles').allTextContents())); await c.close() }
  await b.close()
})()
