// QA-Claude-2 — #96 regresión: lo ya aprobado (registrar / retirar nivel, «Revocar todos», acceso aislado) sigue funcionando con el RADAR como vista inicial.
// Backend REAL (:8090) + vite (:5173). Datos sintéticos, solo local. Env: OUT, PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (tag) => { const email = `qa-${tag}-${Date.now()}${Math.floor(Math.random() * 1e3)}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j.token }
;(async () => {
  const t = await person('rgR'); const e = (await call('POST', '/api/evidence', t, { requestId: 'rg-' + Date.now(), status: 'confirmed', payload: { title: 'Evidencia regresión radar', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' } })).j
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 1000 } }); await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, t)
  const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', x => p.errs.push(x.message.slice(0, 140)))
  await p.goto(UI + '/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
  const wedgeLabel = (name) => p.locator('.radar-wedge').evaluateAll((ws, n) => ws.map(w => w.getAttribute('aria-label')).find(l => l.startsWith(n + ':')), name)
  ck('REG el mapa abre en Radar y Revocar todos está desactivado sin permiso concedido', (await p.locator('.skill-map-views button').first().getAttribute('aria-pressed')) === 'true' && await p.locator('.skill-map-tools button', { hasText: 'Revocar todos' }).isDisabled())
  await p.locator('.radar-row', { hasText: 'Adaptabilidad' }).click(); await p.waitForTimeout(500); await p.getByRole('button', { name: 'Registrar mi nivel' }).first().click(); await p.waitForTimeout(900)
  const save = p.getByRole('button', { name: 'Guardar mi nivel' }); ck('REG «Registrar mi nivel» desde el radar abre el formulario y Guardar está bloqueado sin evidencia ni nivel', await save.isDisabled())
  await p.locator('.skill-map-opt input[type=checkbox]').first().check(); await p.locator('input[name=skill-map-level]').nth(1).check(); await save.click(); await p.waitForTimeout(2200)
  ck('REG guardar: aviso «Nivel guardado.» y el radar muestra Nivel 2 sin recargar la página', /Nivel guardado\./.test(await p.locator('body').innerText()) && /Nivel 2 de 4/.test(await wedgeLabel('Adaptabilidad')), await wedgeLabel('Adaptabilidad'))
  ck('REG servidor: nivel 2 con 1 evidencia', (await call('GET', '/api/skill-map', t)).j.skills.find(s => s.skillKey === 'adaptabilidad').self?.level === 2)
  await p.getByRole('button', { name: 'Retirar mi nivel' }).click(); await p.waitForTimeout(400); ck('REG retirar: diálogo con foco en «Cancelar»', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.getByRole('button', { name: 'Sí, retirar' }).click(); await p.waitForTimeout(2200); ck('REG retirado: el radar vuelve a «Sin evaluar» y la evidencia sigue', /Sin evaluar/.test(await wedgeLabel('Adaptabilidad')) && (await call('GET', '/api/evidence', t)).j.evidence.length === 1)
  await call('PUT', '/api/consents/professional_bridge', t, { status: 'granted' }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800)
  const rev = p.locator('.skill-map-tools button', { hasText: 'Revocar todos' }); ck('REG con permiso concedido, «Revocar todos» está activo en la vista Radar', await rev.isEnabled())
  const gets = []; p.on('request', r => /\/api\/skill-map$/.test(new URL(r.url()).pathname) && r.method() === 'GET' && gets.push(1)); await rev.click(); await p.waitForTimeout(300); ck('REG diálogo con foco en «Cancelar»; Esc cancela', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); ck('REG Esc cierra y devuelve el foco al botón', await p.locator('dialog[open]').count() === 0 && (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Revocar todos')
  await rev.click(); await p.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await p.waitForTimeout(2500); ck('REG revocar: mensaje de éxito y el mapa se vuelve a leer', /Listo: ya no cruza nada/.test(await p.locator('.skill-map-revoke-status').innerText()) && gets.length >= 1)
  ck('REG servidor: professional_bridge revocado', (await call('GET', '/api/consents', t)).j.consents.find(x => x.purpose === 'professional_bridge')?.status === 'revoked')
  ck('REG consola sin errores', p.errs.filter(x => !/403|Failed to load resource/.test(x)).length === 0, p.errs.join('|')); await p.screenshot({ path: path.join(OUT, 'regress-radar.png'), fullPage: true })
  // Aislamiento: una persona nueva no ve nada de la anterior
  const t2 = await person('rgS'); const m = (await call('GET', '/api/skill-map', t2)).j.skills; ck('REG S otra persona: todas sus capacidades sin nivel (nada ajeno)', m.every(s => !s.self && !s.review))
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message, e.stack?.split('\n')[1]); process.exit(3) })
