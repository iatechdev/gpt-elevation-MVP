// [QA-Claude] ES-221 · PR #305 · R13: el formulario REAL de registro (sin cambios en el PR) muestra el aviso de límite (429) en ES y EN, y un correo de cuenta inactiva muestra el mismo aviso que «ya registrado».
// Servidor real con REGISTER_RATE_LIMIT_MAX=3 (solo local) + build del frontend de main (el PR no toca frontend/). Env: DIST, QA_SUT, DATABASE_URL, MODE, OUT. 0 IA.
process.env.DB_SSL = 'false'
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const E = process.env; const { chromium } = require(E.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/tools/playwright/node_modules/playwright'); const fs = require('fs'), http = require('http'), path = require('path'), { createRequire } = require('module')
const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg')
const WEB = Number(E.WEB_PORT || 5273), MODE = E.MODE || 'pr', AXE = fs.readFileSync(E.AXE || 'C:/Users/Usuario/Documents/Central/node_modules/axe-core/axe.min.js', 'utf8')
const results = []; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 600) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${MODE}] ` + n, String(x).slice(0, 300)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 900) }); console.log('INFO', `[${MODE}]`, n, String(x).slice(0, 400)) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const stamp = Date.now().toString(36); let seq = 0
const DB = new Client({ connectionString: E.DATABASE_URL, ssl: false }); const q = async (s, a = []) => (await DB.query(s, a)).rows
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((qq, r) => { let p = path.join(E.DIST, decodeURIComponent(qq.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(E.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length)) }
const mail = tag => `es221-ui-${tag}-${stamp}-${++seq}@example.invalid`
const PW = 'Sintetica-Clave-2026!'
const apiReg = async email => (await fetch('http://localhost:8190/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Persona Sintetica', email, password: PW, acceptedTerms: true, termsVersion: '2026-11-v1' }) })).status
const MSG = { es: { rate: /Demasiados intentos/i, dup: /ya (est[áa]|tiene|existe)|registrad/i }, en: { rate: /Too many attempts/i, dup: /already|registered|exists/i } }
;(async () => {
  await DB.connect(); const BR = await chromium.launch(); const srv = await serve()
  const submit = async (p, lang, email) => {
    await p.fill('#access-name', 'Persona Sintetica'); await p.fill('#access-email', email); await p.fill('#access-password', PW)
    const cb = p.getByRole('checkbox'); if (await cb.count()) await cb.first().check()
    await p.locator('button[type=submit]').click(); await sleep(1500)
    const msgs = (await p.locator('.ac-notice, [role=alert], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ')
    info('estado tras enviar', 'checkbox=' + (await cb.count()) + ' marcado=' + (await cb.first().isChecked().catch(() => 'n/a')) + ' url=' + p.url().slice(-40) + ' avisos=' + msgs.slice(0, 200))
    return msgs
  }
  // inactiva: crea y desactiva por API (cuenta 1 del límite de 3), luego la UI debe mostrar el mismo aviso que «ya registrado»
  const ina = mail('ina'); ck('preparación: cuenta creada por API (201)', (await apiReg(ina)) === 201); await q('update "Users" set active=false where lower(email)=lower($1)', [ina])
  for (const lang of (E.LANGS || 'es,en').split(',')) {
    const ctx = await BR.newContext({ viewport: { width: lang === 'es' ? 390 : 1280, height: 900 }, reducedMotion: 'reduce' }); await ctx.addInitScript(l => localStorage.setItem('elv_lang', l), lang)
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 140)) })
    await p.goto(`http://localhost:${WEB}/login?mode=register`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#access-email', { timeout: 20000 }); await sleep(800)
    const t1 = await submit(p, lang, ina); info(`R13 ${lang}: cuenta INACTIVA en el formulario`, t1.slice(0, 220)); ck(`R13 ${lang}: la cuenta inactiva muestra el aviso de «ya registrado» (no «cuenta inactiva»)`, MSG[lang].dup.test(t1) && !/inactiv|inactive/i.test(t1), t1.slice(0, 200))
    // llevar el contador al tope: ya van 1 (API) + 1 (UI es o en) → siguientes
    let last = t1; for (let k = 0; k < 4 && !MSG[lang].rate.test(last); k++) { await p.goto(`http://localhost:${WEB}/login?mode=register`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#access-email', { timeout: 20000 }); await sleep(500); last = await submit(p, lang, mail('x' + k)) }
    ck(`R13 ${lang}: con el límite agotado el formulario muestra el aviso de límite`, MSG[lang].rate.test(last), last.slice(0, 220))
    const ax = await axeRun(p); ck(`R13 ${lang}: axe = 0 con el aviso visible`, ax.length === 0, ax.join(',')); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`R13 ${lang}: sin desborde horizontal`, ov <= 0, ov); ck(`R13 ${lang}: sin errores de consola (salvo la respuesta 4xx)`, errs.length === 0, errs.join('|'))
    if (lang === 'es') await p.screenshot({ path: path.join(E.OUT || '.', 'es221-limite-es-390.png') }); else await p.screenshot({ path: path.join(E.OUT || '.', 'es221-limite-en-1280.png') })
    await ctx.close()
    if (lang === 'es') { /* reiniciar el contador no es posible sin reiniciar el servidor: el guion de EN usa el mismo tope ya agotado */ }
  }
  console.log('RESUMEN ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallas: f })); fs.writeFileSync(path.join(E.OUT || '.', 'ES-221-pantalla.json'), JSON.stringify(results, null, 1)); await BR.close(); srv.close(); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 700)); process.exit(3) })
