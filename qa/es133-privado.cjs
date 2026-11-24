// QA-Claude-2 — ES-133 F3/F4: ¿lo que la landing llama «Disponible» o «En preparación» existe en el área privada de STAGING (main)? Una persona sintética @example.test, 0 llamadas a IA, solo navega.
// Env: BASE (https://backend-staging-*), PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
;(async () => {
  const email = `qa2s-${tag}-l133@example.test`; await call('POST', '/api/register', null, { name: 'QA2 l133', email, password: PASS })
  const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; if (!tk) { console.log('sin sesión'); process.exit(1) }
  const b = await chromium.launch()
  for (const [label, route] of [['Conversación (Disponible)', '/app/chat'], ['Diario (Disponible)', '/app/diary'], ['Brújula (Disponible)', '/app/compass'], ['Skill Map (Disponible)', '/app/skill-map'], ['Ejercicios (En preparación)', '/app/exercises'], ['Rutas/próximo paso (depende de bandera)', '/app/next-step'], ['Datos: exportar/eliminar (En preparación)', '/app/bridge']]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, [tk])
    const p = await c.newPage(); await p.goto(BASE + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
    const url = new URL(p.url()).pathname, h = (await p.locator('h1,h2').first().innerText().catch(() => '')).slice(0, 70), body = (await p.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 160)
    console.log(`${label} → ${route} => ${url} | «${h}» | ${body}`); await c.close()
  }
  const ep = ['/api/data/export', '/api/me/export', '/api/account/export', '/api/export']; for (const e of ep) console.log('GET', e, (await call('GET', e, tk)).s)
  await b.close(); console.log(`Persona sintética nueva: qa2s-${tag}-l133@example.test`)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
