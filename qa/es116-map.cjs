// QA-Claude-2 — ES-116 (#88): el mapa lee los territorios de la API (sin asignación de ejemplo) con backend REAL.
// Requiere haber publicado un catálogo con territorios (es116-api.cjs lo deja en la versión 2/3) y vite SIN VITE_SKILL_MAP_SAMPLE_TERRITORIES.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) } }
;(async () => {
  const email = `qa-map-${Date.now()}@example.test`; await call('POST', '/api/register', null, { name: 'QA map', email, password: PASS }); const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j.token
  const ev = await call('POST', '/api/evidence', tk, { requestId: 'm-' + Date.now(), status: 'confirmed', payload: { title: 'Evidencia sintética', situation: 'Situación.', responsibility: { text: 'Responsable.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy: 'autonomous' } })
  await call('POST', '/api/skill-map/self', tk, { requestId: 's-' + Date.now(), skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: ev.j.id, version: 1 }], rationale: 'Nota sintética' })
  const map = (await call('GET', '/api/skill-map', tk)).j; const withT = map.skills.filter(s => s.territories?.length)
  console.log(`   API: catálogo v${map.catalogVersion}; ${withT.length} de ${map.skills.length} capacidades con territorios`)
  const b = await chromium.launch()
  for (const w of [1280, 375]) { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(t => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, tk); const p = await c.newPage(); const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 100)))
    await p.goto(UI + '/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
    if (w >= 1024) { ck(`F116-6 ${w}px mapa con nodos reales`, await p.locator('svg .skill-map-chip').count() === withT.length, `${await p.locator('svg .skill-map-chip').count()} nodos / ${withT.length} con territorio`); ck('F116-6 líneas = suma de territorios', await p.locator('svg .skill-map-link').count() === withT.reduce((a, s) => a + s.territories.length, 0)) }
    else { ck(`F116-6 ${w}px tarjetas por territorio`, await p.locator('.skill-map-territory-card').count() >= 5) }
    ck(`sin nota de «asignación de ejemplo» (producción)`, !/ejemplo/i.test(await p.locator('body').innerText()))
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); ck(`${w}px sin desborde`, m.sw <= m.iw)
    await p.screenshot({ path: path.join(OUT, `real-map-territories-${w}.png`), fullPage: true }); ck(`consola ${w}`, errs.length === 0, errs.join('|')); await c.close() }
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
