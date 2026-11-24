// QA-Claude-2 — ES-143 (PR #152): barrido de texto de /admin/* en EN y ES con admin y superadmin. Backend local (:8090) + vite (:5173) del head. Datos sintéticos.
// Marca líneas visibles que parecen español en modo EN (o inglés en modo ES). Env: PLAYWRIGHT_MODULE, DATABASE_URL, BACKEND, OUT, LABEL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg'); const fs = require('fs')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const PASS = require('crypto').randomBytes(10).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const ES = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|para|con|sin|por|una|un|y|que|no|se|su|sus|más|esta|este|todo|todos|cargando|guardar|cancelar|usuarios|sesión|sesiones|métricas|versión|versiones|pendiente|pendientes|aprobar|rechazar|solicitudes|nombre|correo|rol|estado|fecha|acciones|buscar|error|conexión|cerrar|editar|eliminar|crear|activo|inactivo|ninguna|ninguno|aún|hay)\b/i
const EN = /\b(the|and|for|with|your|loading|save|cancel|users|session|sessions|metrics|version|pending|approve|reject|requests|name|email|role|status|date|actions|search|close|edit|delete|create|active|inactive|none|there|are|no)\b/i
const ROUTES = ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/admin/pilot-metrics']
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const T = {}
  for (const role of ['admin', 'superadmin']) { const email = `qa2-a143-${role}-${tag}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ' + role, email, password: PASS }); await db.query('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); await new Promise(r => setTimeout(r, 300)); T[role] = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; await new Promise(r => setTimeout(r, 700)) }
  // datos sintéticos para que los paneles tengan filas: una solicitud profesional pendiente no se crea (se ve el estado vacío); se cubre vacío + con usuarios
  const b = await chromium.launch(); let flagged = 0, screens = 0, errs = 0
  for (const role of ['admin', 'superadmin']) for (const lang of ['en', 'es']) for (const w of [1360, 390]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, ro, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', l) }, [T[role], role, lang])
    for (const path of ROUTES) {
      const p = await c.newPage(); const pe = []; p.on('pageerror', e => pe.push(e.message.slice(0, 80))); await p.goto(UI + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(1200); screens++
      const lines = (await p.evaluate(() => document.body.innerText)).split('\n').map(x => x.trim()).filter(x => x.length > 2)
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      const bad = [...new Set(lines.filter(l => lang === 'en' ? (ES.test(l) && !EN.test(l)) || /[áéíóúñ¿¡]/i.test(l) : (EN.test(l) && !ES.test(l) && l.split(' ').length > 2)))]
      if (pe.length) errs++
      console.log(`${role}/${lang}/${w}${path}: ${lines.length} líneas, ${bad.length} sospechosas, desborde=${sw > 0 ? sw : 0}${pe.length ? ' ERRORES JS: ' + pe.join('|') : ''}`)
      for (const l of bad.slice(0, 12)) { flagged++; console.log('    «' + l.slice(0, 110) + '»') }
      if (w === 1360 && role === 'admin') await p.screenshot({ path: `${OUT}/${(process.env.LABEL || 'x')}-${lang}-${path.replace(/\//g, '_')}.png` })
      await p.close() }
    await c.close() }
  await b.close(); await db.end(); console.log(`\n${screens} pantallas; ${flagged} líneas sospechosas; ${errs} pantallas con error de JS`)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })
