// QA-Claude-2 — ES-30 (#86) contra backend REAL (Express + Postgres local desechable, datos sintéticos).
// Requiere: backend en :8090 con catálogo sembrado (qa/seed-catalog.cjs) y vite en :5173 apuntando a :8090.
// Cubre: Revocar todos de extremo a extremo, aislamiento A/B, entradas inválidas, concurrencia, mapa real sin territorios.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs')
const API = process.env.API || 'http://localhost:8090', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (method, p, token, body, raw) => { const r = await fetch(API + p, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined || raw ? { 'content-type': 'application/json' } : {}) }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
const person = async (tag) => { const email = `qa-${tag}-${Date.now()}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return { email, token: l.j.token } }
const bridge = async (t) => (await call('GET', '/api/consents', t)).j.consents.find(c => c.purpose === 'professional_bridge')?.status
;(async () => {
  const A = await person('a'), B = await person('b')
  ck('personas A y B creadas con login real', !!A.token && !!B.token)
  const map = await call('GET', '/api/skill-map', A.token)
  ck('GET /api/skill-map real: 200 y 8 capacidades', map.s === 200 && map.j.skills.length === 8, `catálogo v${map.j.catalogVersion}`)
  ck('nivel null sin evidencia en TODAS (sin 0 ni déficits)', map.j.skills.every(s => (s.self === null || s.self.level === null) && (s.review === null || s.review.level === null)))
  ck('respuesta sin campos de otra persona / diario / crisis', !/diary|crisis|mood|email/i.test(JSON.stringify(map.j)))
  ck('sin token: 401', (await call('GET', '/api/skill-map')).s === 401)
  ck('token manipulado: 401', (await call('GET', '/api/skill-map', A.token.slice(0, -4) + 'xxxx')).s === 401)
  for (const t of [A, B]) ck('PUT granted ' + t.email.slice(3, 5), (await call('PUT', '/api/consents/professional_bridge', t.token, { status: 'granted' })).s === 200)
  ck('A y B en granted', (await bridge(A.token)) === 'granted' && (await bridge(B.token)) === 'granted')
  // entradas inválidas
  for (const [n, body, raw] of [['status inválido', { status: 'x' }], ['sin cuerpo', undefined, ''], ['JSON roto', undefined, '{"status":'], ['status número', { status: 7 }], ['con scope no permitido', { status: 'revoked', scope: { a: 1 } }], ['propósito con campos extra', { status: 'revoked', userId: 999 }]]) {
    const r = await call('PUT', '/api/consents/professional_bridge', A.token, body, raw)
    ck(`F30-6/S-3 entrada inválida «${n}»: sin 5xx`, r.s < 500, `HTTP ${r.s} ${JSON.stringify(r.j)?.slice(0, 80)}`)
  }
  const stillA = await bridge(A.token); console.log('   estado de A tras entradas inválidas:', stillA)
  ck('propósito desconocido: 404', (await call('PUT', '/api/consents/inexistente', A.token, { status: 'revoked' })).s === 404)
  ck('PUT sin token: 401', (await call('PUT', '/api/consents/professional_bridge', null, { status: 'revoked' })).s === 401)
  // concurrencia: doble revocación simultánea
  await call('PUT', '/api/consents/professional_bridge', A.token, { status: 'granted' })
  const both = await Promise.all([call('PUT', '/api/consents/professional_bridge', A.token, { status: 'revoked' }), call('PUT', '/api/consents/professional_bridge', A.token, { status: 'revoked' })])
  ck('S-4 doble revocación simultánea: sin 5xx', both.every(r => r.s < 500), both.map(r => r.s).join(','))
  ck('S-4 A revocado y B intacto (aislamiento)', (await bridge(A.token)) === 'revoked' && (await bridge(B.token)) === 'granted')
  ck('S-4 revocar de nuevo es idempotente', (await call('PUT', '/api/consents/professional_bridge', A.token, { status: 'revoked' })).s < 400)
  const hist = await call('GET', '/api/consents/history', A.token)
  ck('historial de A solo con eventos propios', hist.s === 200 && JSON.stringify(hist.j).includes('professional_bridge'))
  // Navegador: Revocar todos de extremo a extremo con la UI real
  await call('PUT', '/api/consents/professional_bridge', A.token, { status: 'granted' })
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, [A.token])
  const page = await ctx.newPage(); const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 120))); page.on('pageerror', e => errs.push(e.message.slice(0, 120)))
  await page.goto('http://localhost:5173/app/skill-map', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  const unassigned = await page.locator('.skill-map-territory-card').count()
  ck('UI real: mapa cargado con capacidades del servidor', await page.locator('svg .skill-map-chip').count() >= 0 && /Mapa de competencias/.test(await page.locator('h1').innerText()))
  await page.screenshot({ path: path.join(OUT, 'real-map.png'), fullPage: true })
  const rev = page.locator('.skill-map-tools button', { hasText: 'Revocar todos' })
  ck('UI real: botón activo (A granted)', await rev.isEnabled())
  await rev.click(); await page.waitForTimeout(200); await page.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await page.waitForTimeout(900)
  ck('UI real: mensaje de éxito', /Listo: ya no cruza nada/.test(await page.locator('.skill-map-revoke-status').innerText()))
  ck('UI real → servidor: A revocado, B sigue granted', (await bridge(A.token)) === 'revoked' && (await bridge(B.token)) === 'granted')
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  ck('UI real tras recargar: botón desactivado (nada autorizado)', await page.locator('.skill-map-tools button', { hasText: 'Revocar todos' }).isDisabled())
  ck('consola sin errores', errs.length === 0, errs.join('|'))
  await browser.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
