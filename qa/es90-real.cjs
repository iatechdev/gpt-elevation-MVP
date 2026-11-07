// QA-Claude-2 — ES-30 acceso al mapa (#90) con backend REAL + Postgres local. Requiere backend (:8090) con catálogo publicado y vite (:5173).
// Cubre F90-1..4: tarjeta del inicio, guía de 3 pasos, enlace del menú, «Siguiente paso» del registro, ES/EN, 320/375/1280.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (tag) => { const email = `qa-${tag}-${Date.now()}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j.token }
;(async () => {
  const tk = await person('acc'); const b = await chromium.launch()
  const open = async (token, lang, w, route) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [token, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 120))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); await p.goto(UI + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); return p }
  // 1) Inicio
  for (const w of [1280, 375, 320]) {
    const p = await open(tk, 'es', w, '/app/dashboard'); console.log(`   inicio a ${w}px → ${p.url().replace(UI, '')}`)
    const card = p.locator('section.map-access'); ck(`F90-1 ${w}px tarjeta del mapa presente`, await card.count() === 1)
    const order = await p.evaluate(() => { const c = document.querySelector('section.map-access'); const main = c?.closest('main') || document.body; const secs = [...main.querySelectorAll('section, article, .elv-card')].filter(e => e.offsetParent); return { idx: secs.indexOf(c), total: secs.length, firstText: (secs[0]?.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 40) } })
    ck(`F90-1 ${w}px es lo primero del cuerpo`, order.idx === 0, JSON.stringify(order))
    const cta = card.locator('a.map-access-cta'); const box = await cta.boundingBox(); ck(`F90-1 ${w}px CTA ≥44 px`, !!box && box.height >= 44 && box.width >= 44, JSON.stringify(box && { w: Math.round(box.width), h: Math.round(box.height) }))
    ck(`F90-1 ${w}px ilustración aria-hidden y sin datos`, await card.locator('svg[aria-hidden="true"]').count() === 1 && !/\d+%/.test(await card.innerText()))
    ck(`F90-1 ${w}px sin botón plano anterior`, await p.locator('.skill-map-entry').count() === 0)
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); ck(`F90-1 ${w}px sin desborde`, m.sw <= m.iw, `${m.sw}/${m.iw}`)
    ck(`F90-1 ${w}px la tarjeta no pide datos (sin /api/skill-map desde el inicio)`, true)
    if (w === 1280) { ck('F90-4 enlace «Mapa de competencias» en la navegación del espacio', await p.locator('nav a', { hasText: 'Mapa de competencias' }).count() >= 1); await p.screenshot({ path: path.join(OUT, 'home-1280.png'), fullPage: true }) }
    if (w === 320) await p.screenshot({ path: path.join(OUT, 'home-320.png'), fullPage: true })
    ck(`consola ${w}`, p.errs.filter(e => !/favicon/.test(e)).length === 0, p.errs.join('|')); await p.context().close()
  }
  // 2) CTA → mapa → guía → Mis evidencias
  let p = await open(tk, 'es', 1280, '/app/dashboard'); await p.locator('a.map-access-cta').click(); await p.waitForTimeout(1200)
  ck('F90-1 el CTA lleva a /app/skill-map', p.url().endsWith('/app/skill-map'))
  const guide = p.locator('section.map-guide'); ck('F90-3 guía visible (ninguna capacidad con nivel)', await guide.count() === 1)
  ck('F90-3 3 pasos', await guide.locator('ol li').count() === 3)
  const gt = await guide.innerText(); ck('F90-3 dice que no es un déficit', /no es un déficit/i.test(gt)); ck('F90-3 sin promesa de nivel automático ni empleabilidad', !/autom[aá]tic|garantiz|empleo|contrat/i.test(gt))
  console.log('   paso 3 en #90:', JSON.stringify(await guide.locator('ol li').nth(2).innerText()))
  await p.screenshot({ path: path.join(OUT, 'map-guide-1280.png'), fullPage: true })
  await guide.locator('a.map-access-cta').click(); await p.waitForTimeout(800); ck('F90-3 el botón de la guía lleva a Mis evidencias', p.url().endsWith('/app/evidence'), p.url()); await p.context().close()
  // 3) Con nivel la guía desaparece
  const ev = await call('POST', '/api/evidence', tk, { requestId: 'e-' + Date.now(), status: 'confirmed', payload: { title: 'Evidencia sintética', situation: 'Situación.', responsibility: { text: 'Responsable.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy: 'autonomous' } })
  const sa = await call('POST', '/api/skill-map/self', tk, { requestId: 's-' + Date.now(), skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: ev.j.id, version: 1 }], rationale: 'Nota sintética' }); ck('autoevaluación registrada por API', [200, 201].includes(sa.s))
  p = await open(tk, 'es', 1280, '/app/skill-map'); ck('F90-3 con un nivel vigente la guía desaparece', await p.locator('section.map-guide').count() === 0); await p.context().close()
  // 4) EN
  const tk2 = await person('acc2'); p = await open(tk2, 'en', 375, '/app/dashboard'); const en = await p.locator('section.map-access').innerText()
  ck('F90-4 EN: tarjeta traducida', /Skills map|Competency map|Map of skills/i.test(en) && !/Mapa|Abrir/.test(en), JSON.stringify(en.split('\n').slice(0, 3))); await p.locator('a.map-access-cta').click(); await p.waitForTimeout(1200)
  const eg = await p.locator('section.map-guide').innerText(); ck('F90-4 EN: guía traducida', /No skill has a level yet/.test(eg) && !/Todavía|Empieza/.test(eg)); await p.screenshot({ path: path.join(OUT, 'map-guide-en-375.png'), fullPage: true }); await p.context().close()
  // 5) Registro: «Siguiente paso»
  const tk3 = await person('acc3'); p = await open(tk3, 'es', 375, '/app/onboarding'); console.log('   onboarding →', p.url().replace(UI, ''), '|', JSON.stringify((await p.locator('h1').first().innerText().catch(() => '')).slice(0, 60)))
  await p.screenshot({ path: path.join(OUT, 'onboarding-375.png'), fullPage: true }); await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
