// QA-Claude-2 — staging con la cadena del mapa desplegada (main e6e1935): pantallas de acceso al mapa, mapa, registrar nivel y «Revocar todos».
// SOLO staging aprobado, solo 2 personas sintéticas @example.test (el login de staging limita por IP). No imprime tokens.
// Env: BASE, OUT, PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b), signal: AbortSignal.timeout(30000) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (i) => { const email = `qa2s-${tag}-ui${i}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ui' + i, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return l.j?.token }
const ev = (n) => ({ requestId: `ui-${tag}-${n}`, status: 'confirmed', payload: { title: 'Evidencia sintética UI ' + n, situation: 'Situación.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy: 'assisted' } })
;(async () => {
  const t1 = await person(1), t2 = await person(2); ck('2 personas sintéticas con sesión', !!t1 && !!t2); if (!t1 || !t2) process.exit(1)
  const map0 = await call('GET', '/api/skill-map', t1); const skills = map0.j?.skills || []; const withT = skills.filter(s => s.territories?.length).length
  console.log(`   catálogo de staging: v${map0.j?.catalogVersion}, ${skills.length} capacidades, ${withT} con territorio; territories en la API: ${skills.every(s => Array.isArray(s.territories)) ? 'sí (#88 desplegado)' : 'NO'}`)
  ck('#88 desplegado: la API devuelve `territories` en cada capacidad', skills.length > 0 && skills.every(s => Array.isArray(s.territories)))
  const e1 = await call('POST', '/api/evidence', t1, ev('1')); ck('evidencia confirmada de P1', e1.s === 201, `HTTP ${e1.s}`)
  const b = await chromium.launch()
  const open = async (tk, route, { lang = 'es', w = 375 } = {}) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [tk, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); await p.goto(BASE + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); return p }
  const sw = (p) => p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }))
  // P2 sin evidencia: acceso, guía, formulario bloqueado
  let p = await open(t2, '/app/dashboard'); ck('#90 tarjeta «Mapa de competencias» en el inicio', await p.locator('section.map-access').count() === 1)
  ck('#90 enlace del menú del espacio', await p.locator('nav a', { hasText: 'Mapa de competencias' }).count() >= 1); let m = await sw(p); ck('inicio 375 px sin desborde', m.s <= m.i); await p.screenshot({ path: path.join(OUT, 'stg-home-375.png'), fullPage: true })
  await p.locator('a.map-access-cta').click(); await p.waitForTimeout(1500); ck('el CTA lleva al mapa', p.url().endsWith('/app/skill-map'))
  const g = p.locator('section.map-guide'); ck('#90 guía de 3 pasos visible (ninguna capacidad con nivel)', await g.count() === 1 && await g.locator('ol li').count() === 3)
  ck('#90 los pasos salen numerados (list-style ≠ none)', (await g.locator('ol').evaluate(e => getComputedStyle(e).listStyleType)) !== 'none')
  ck('#90 paso 3 menciona «Registrar mi nivel»', /Registrar mi nivel/.test(await g.locator('ol li').nth(2).innerText()))
  ck('#86 aviso o territorios coherentes: capacidades visibles sin pulsar nada', await p.locator('.skill-map-pick').count() > 0)
  await p.locator('.skill-map-pick').first().click(); await p.waitForTimeout(500); await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(1200)
  ck('#93 sin evidencia confirmada: aviso y sin formulario', /Primero necesitas una evidencia confirmada/.test(await p.locator('.skill-map-self').innerText()) && await p.getByRole('button', { name: 'Guardar mi nivel' }).count() === 0)
  m = await sw(p); ck('mapa 375 px sin desborde', m.s <= m.i); ck('consola P2', p.errs.filter(x => !/403|Failed to load resource/.test(x)).length === 0, p.errs.join('|')); await p.screenshot({ path: path.join(OUT, 'stg-map-noevidence-375.png'), fullPage: true }); await p.context().close()
  // P1 con evidencia: registrar, cambiar, retirar
  p = await open(t1, '/app/skill-map'); await p.locator('.skill-map-pick').first().click(); await p.waitForTimeout(500); const skillName = await p.locator('#skill-detail-title').innerText()
  ck('#93 detalle: «Sin evaluar» antes de registrar', /Sin evaluar/.test(await p.locator('.skill-map-detail').innerText()))
  await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(1200); const save = p.getByRole('button', { name: 'Guardar mi nivel' })
  ck('#93 Guardar deshabilitado sin evidencia ni nivel', await save.isDisabled()); await p.locator('.skill-map-opt input[type=checkbox]').first().check(); await p.locator('input[name=skill-map-level]').nth(1).check(); ck('#93 con evidencia y nivel: Guardar activo', await save.isEnabled())
  m = await sw(p); ck('formulario 375 px sin desborde', m.s <= m.i); await p.screenshot({ path: path.join(OUT, 'stg-form-375.png'), fullPage: true })
  await p.locator('#skill-map-note').fill('Nota <b>sintética</b>'); await save.click(); await p.waitForTimeout(2500)
  ck('#93 «Nivel guardado.»', /Nivel guardado\./.test(await p.locator('body').innerText()))
  const sk = (await call('GET', '/api/skill-map', t1)).j.skills.find(s => s.labels.es === skillName); ck('#93 servidor: nivel 2 con 1 evidencia', sk?.self?.level === 2 && sk.self.evidenceCount === 1, JSON.stringify({ l: sk?.self?.level, c: sk?.self?.evidenceCount }))
  const det = await p.locator('.skill-map-detail').innerText(); ck('#93 detalle: «Validado» y «Fuente: Evidencia aportada»', /Validado/.test(det) && /Evidencia aportada/.test(det)); ck('nota con HTML se muestra como texto', await p.locator('.skill-map-detail b').count() === 0)
  ck('#90 la guía desaparece al haber un nivel', await p.locator('section.map-guide').count() === 0)
  await p.getByRole('button', { name: 'Retirar mi nivel' }).click(); await p.waitForTimeout(400); ck('#93 retirar: diálogo con foco en «Cancelar»', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.getByRole('button', { name: 'Sí, retirar' }).click(); await p.waitForTimeout(2200); const sk2 = (await call('GET', '/api/skill-map', t1)).j.skills.find(s => s.labels.es === skillName); ck('#93 retirado: sin nivel y la evidencia sigue', (sk2.self === null || sk2.self.level === null) && (await call('GET', '/api/evidence', t1)).j.evidence.length === 1)
  ck('consola P1', p.errs.filter(x => !/403|Failed to load resource/.test(x)).length === 0, p.errs.join('|')); await p.context().close()
  // Escritorio y EN; Revocar todos
  await call('PUT', '/api/consents/professional_bridge', t1, { status: 'granted' })
  p = await open(t1, '/app/skill-map', { lang: 'en', w: 1280 }); const en = await p.locator('body').innerText(); ck('EN: pantalla del mapa traducida', /Skills map|Competency map/i.test(en) && !/Revocar|Mapa de competencias|Todavía/.test(en), en.split('\n').filter(Boolean).slice(2, 4).join(' / '))
  m = await sw(p); ck('mapa 1280 px sin desborde', m.s <= m.i); ck('#86 sin roles de ejemplo de Figma en pantalla', !/Strategy Consultant|Director General|Portavoz/.test(en)); await p.screenshot({ path: path.join(OUT, 'stg-map-en-1280.png'), fullPage: true })
  await p.context().close(); p = await open(t1, '/app/skill-map', { lang: 'es', w: 1280 }); const rev = p.locator('.skill-map-tools button', { hasText: 'Revocar todos' }); ck('#86 «Revocar todos» activo con permiso concedido', await rev.isEnabled())
  const gets0 = []; p.on('request', r => /\/api\/skill-map$/.test(new URL(r.url()).pathname) && r.method() === 'GET' && gets0.push(1)); await rev.click(); await p.waitForTimeout(300); ck('#86 diálogo con foco en «Cancelar»', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await p.waitForTimeout(2500); ck('#86 mensaje de éxito', /Listo: ya no cruza nada/.test(await p.locator('.skill-map-revoke-status').innerText())); ck('#86 el mapa se vuelve a leer tras revocar', gets0.length >= 1, `${gets0.length} lecturas`)
  const st = (await call('GET', '/api/consents', t1)).j.consents.find(c => c.purpose === 'professional_bridge')?.status; ck('#86 servidor: professional_bridge revocado', st === 'revoked', st)
  ck('consola escritorio', p.errs.filter(x => !/403|Failed to load resource/.test(x)).length === 0, p.errs.join('|')); await p.context().close(); await b.close()
  console.log(`\nPersonas sintéticas nuevas en staging: 2 (qa2s-${tag}-ui1/ui2@example.test).`); console.log(fails ? `FALLAS: ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
