// QA-Claude-2 — barrido de UI/UX por rol en STAGING con las 4 cuentas sintéticas (solo lectura: inicia sesión y navega; no envía formularios ni crea datos).
// Autorizado por Mauricio en el chat (3-nov-2026). Lee el archivo local de claves DENTRO del proceso; nunca imprime claves ni tokens.
// Env: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT (carpeta de capturas). Un solo inicio de sesión por rol (el limitador permite 10/min).
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const BASE = (process.env.STAGING_URL || '').replace(/\/$/, ''), OUT = process.env.OUT || '.'
if (!/^https:\/\/backend-staging-/.test(BASE) || !process.env.CRED_FILE) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const secretFor = email => { const l = lines.find(x => x.toLowerCase().includes(email)); if (!l) return null; return l.slice(l.toLowerCase().indexOf(email) + email.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contrase(?:ñ|n)a|password|pass|pwd)\s*[:=]\s*/i, '').split(/\s+\|\s+|\s{2,}/)[0].trim() }
const ACC = { persona: ['qa.persona@example.test', 'user'], terapeuta: ['qa.terapeuta@example.test', 'therapist'], admin: ['qa.admin@example.test', 'admin'], superadmin: ['qa.superadmin@example.test', 'superadmin'] }
const PAGES = {
  persona: ['/app/dashboard', '/app/chat', '/app/diary', '/app/skill-map', '/app/compass', '/app/next-step', '/app/exercises', '/app/data', '/app/my-therapist', '/app/progress', '/app/evidence', '/app/route-catalog', '/app/bridge'],
  terapeuta: ['/therapist/dashboard', '/facilitation', '/app/professional-reviews'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/admin/skill-catalog', '/admin/route-catalog'],
  superadmin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/admin/skill-catalog'],
}
const ONLY = process.env.ONLY_ROLES ? process.env.ONLY_ROLES.split(',') : null; const ES_WORDS = /(Mi|Tu|Tus|Mis|Cerrar|sesión|Guardar|Cancelar|Volver|Nueva|Nuevo|Usuarios|Contenido|Métricas|Ingresar|Siguiente|Anterior|conversación|contraseña|Enviar|Buscar|Todos|Activo|Inactivo|para|con|del|los|las|una|por)/g
const findings = []; let checks = 0, bad = 0
const note = (sev, role, lang, w, path, msg) => { bad++; findings.push({ sev, role, lang, w, path, msg }); console.log(`${sev} ${role} ${lang} ${w}px ${path}: ${msg}`) }
;(async () => {
  const tokens = {}
  for (const [k, [email, role]] of Object.entries(ACC)) {
    const pw = secretFor(email); if (!pw) { console.log('sin clave para', k); process.exit(1) }
    const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw }) }); const j = await r.json().catch(() => ({}))
    if (r.status !== 200 || j.role !== role) { console.log(`login ${k}: HTTP ${r.status} (rol ${j.role})`); process.exit(1) }
    tokens[k] = j.token; await new Promise(s => setTimeout(s, 800))
  }
  console.log('Sesiones obtenidas para los 4 roles (sin imprimir claves ni tokens).')
  const b = await chromium.launch(); fs.mkdirSync(OUT, { recursive: true })
  for (const role of Object.keys(PAGES).filter(r => !ONLY || ONLY.includes(r))) for (const lang of ['es', 'en']) for (const w of [390, 1440]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 })
    await c.addInitScript(([t, ro, l]) => { try { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', l) } catch {} }, [tokens[role], ACC[role][1], lang])
    for (const path of PAGES[role]) {
      const p = await c.newPage(); const errs = [], api5 = []
      p.on('pageerror', e => errs.push(e.message.slice(0, 100))); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 100)))
      p.on('response', r => { if (r.status() >= 500 && /\/api\//.test(r.url())) api5.push(r.status() + ' ' + new URL(r.url()).pathname) })
      try { await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }) } catch (e) { note('Alto', role, lang, w, path, 'no cargó: ' + e.message.slice(0, 60)); await p.close(); continue }
      await p.waitForTimeout(900); checks++
      const url = new URL(p.url()).pathname
      const m = await p.evaluate(() => {
        const txt = document.body.innerText, vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
        const ctl = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')].filter(vis)
        const noName = ctl.filter(e => !((e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || (e.labels && e.labels[0] && e.labels[0].innerText) || '').trim()) && !e.getAttribute('aria-labelledby')).length
        const small = ctl.filter(e => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24 }).length
        return { s: document.documentElement.scrollWidth, i: innerWidth, h1: document.querySelectorAll('h1').length, len: txt.trim().length, raw: (txt.match(/\b(landing|space|admin|common|dashboard)\.[a-z_]+\.[a-z_]+/gi) || []).slice(0, 3), junk: /\bundefined\b|\[object |NaN\b|\bnull\b/.test(txt), imgNoAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length, noName, small, lang: document.documentElement.lang, title: document.title }
      })
      if (/\/login/.test(url) && !/login/.test(path)) note('Alto', role, lang, w, path, 'redirige a /login (¿sesión o permiso?): ' + url)
      else {
        if (m.s > m.i) note('Medio', role, lang, w, path, `desborde horizontal ${m.s}/${m.i}`)
        if (errs.length) note('Medio', role, lang, w, path, 'errores de página/consola: ' + errs.slice(0, 2).join(' | '))
        if (api5.length) note('Alto', role, lang, w, path, 'respuestas 5xx: ' + [...new Set(api5)].join(', '))
        if (m.len < 40) note('Medio', role, lang, w, path, 'pantalla casi vacía (' + m.len + ' caracteres)')
        if (m.raw.length) note('Medio', role, lang, w, path, 'claves de texto crudas visibles: ' + m.raw.join(', '))
        if (m.junk) note('Medio', role, lang, w, path, 'texto «undefined/null/NaN/[object]» visible')
        if (m.h1 !== 1) note('Bajo', role, lang, w, path, `h1 = ${m.h1} (se espera 1)`)
        if (m.noName) note('Medio', role, lang, w, path, `${m.noName} controles sin nombre accesible`)
        if (m.imgNoAlt) note('Bajo', role, lang, w, path, `${m.imgNoAlt} imágenes sin atributo alt`)
        if (m.small && w < 500) note('Bajo', role, lang, w, path, `${m.small} controles menores de 24 px`)
        if (lang === 'en') { const t = await p.evaluate(() => document.body.innerText); const hits = [...new Set((t.match(ES_WORDS) || []).map(x => x.toLowerCase()))]; if (hits.length >= 3) note('Medio', role, lang, w, path, 'posible texto en español en modo EN: ' + hits.slice(0, 8).join(', ')) }
        if (m.lang && m.lang.slice(0, 2) !== lang) note('Bajo', role, lang, w, path, `<html lang="${m.lang}" no coincide con el idioma activo`)
      }
      if ((w === 1440 && lang === 'es') || (w === 390 && lang === 'es')) await p.screenshot({ path: `${OUT}/${role}-${path.replace(/\W+/g, '_')}-${w}.png` }).catch(() => {})
      await p.close()
    }
    await c.close()
  }
  await b.close(); fs.writeFileSync(`${OUT}/hallazgos.json`, JSON.stringify(findings, null, 1)); console.log(`\nPantallas revisadas: ${checks} · observaciones: ${bad}`)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
