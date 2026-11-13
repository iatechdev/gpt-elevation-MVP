// QA-Claude-2 — ES-206 (PR #147): h1, objetivos táctiles, desborde y textos pendientes, por rol/idioma/ancho. Solo lectura con las 4 cuentas sintéticas de staging.
// APP_URL = front a probar (local del head, o staging como línea base); STAGING_URL = API. Env: CRED_FILE, PLAYWRIGHT_MODULE, LABEL.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const APP = process.env.APP_URL.replace(/\/$/, ''), BASE = process.env.STAGING_URL.replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
const ACC = { persona: ['qa.persona@example.test', 'user'], terapeuta: ['qa.terapeuta@example.test', 'therapist'], admin: ['qa.admin@example.test', 'admin'], superadmin: ['qa.superadmin@example.test', 'superadmin'] }
const PAGES = {
  persona: ['/app/dashboard', '/app/chat', '/app/checkin', '/app/diary', '/app/skill-map', '/app/compass', '/app/exercises', '/app/data', '/app/my-therapist', '/app/progress', '/app/evidence', '/app/route-catalog', '/app/bridge'],
  terapeuta: ['/therapist/dashboard', '/facilitation'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/admin/skill-catalog', '/admin/route-catalog'],
  superadmin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/board'],
}
const EN_IN_ES = /\b(plan requests?|matching pending|pending|Create prompt|assigned|Therapists?|Patients?|Users?|Save|Cancel|Loading)\b/g, ES_IN_EN = /\b(Crear prompt|Asignados?|pendientes?|Usuarios|Guardar|Cancelar|Cargando|solicitudes)\b/g
const same = APP === BASE
;(async () => {
  const tokens = {}
  for (const [k, [email, role]] of Object.entries(ACC)) { const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: sec(email) }) }); const j = await r.json().catch(() => ({})); if (r.status !== 200) { console.log('login', k, r.status); process.exit(1) } tokens[k] = j.token; await new Promise(s => setTimeout(s, 800)) }
  const b = await chromium.launch(); const out = { noH1: [], multiH1: [], small: [], overflow: [], textos: [] }; let screens = 0
  for (const role of Object.keys(PAGES)) for (const lang of ['es', 'en']) for (const w of [390, 1440]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, ro, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', l) }, [tokens[role], ACC[role][1], lang])
    if (!same) await c.route(BASE + '/api/**', async route => { const h = { 'access-control-allow-origin': APP, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' }; if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h }); const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), ...h } }) })
    const p = await c.newPage()
    for (const path of PAGES[role]) {
      await p.goto(APP + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(900); screens++; const tag = `${role}/${lang}/${w}${path}`
      const o = await p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, ov: document.documentElement.scrollWidth - innerWidth, txt: document.body.innerText,
        small: [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[aria-hidden="true"]') && (r.height < 24 || r.width < 24) }).map(e => ((e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 22)) + ` ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`) }))
      if (o.h1 === 0) out.noH1.push(tag); if (o.h1 > 1) out.multiH1.push(tag + ' h1=' + o.h1)
      if (o.ov > 1) out.overflow.push(`${tag} +${o.ov}px`); if (w < 500 && o.small.length) out.small.push(`${tag}: ${o.small.join(' | ')}`)
      const bad = lang === 'es' ? [...new Set(o.txt.match(EN_IN_ES) || [])] : [...new Set(o.txt.match(ES_IN_EN) || [])]; if (bad.length && !/\/app\/(chat|diary|evidence)/.test(path)) out.textos.push(`${tag}: ${bad.join(',')}`)
      if (/\/therapist\/dashboard/.test(path) && w === 1440) console.log(`INFO ${tag} encabezados: ${JSON.stringify(o.txt.match(/\d+ (persona|personas|person|people|Asignad\w+|assigned)[^\n]{0,20}/gi) || [])}`)
    }
    await c.close()
  }
  await b.close(); console.log(`${process.env.LABEL}: ${screens} pantallas`)
  for (const [k, v] of Object.entries(out)) { console.log(`${k}: ${v.length}`); v.slice(0, 14).forEach(x => console.log('   ' + x)) }
  process.exit(0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
