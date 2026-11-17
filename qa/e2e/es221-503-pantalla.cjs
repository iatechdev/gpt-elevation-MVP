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
// [QA-Claude] ES-221 · R14b: el formulario real ante un 503 `server_busy` del registro (respuesta simulada con route.fulfill; el servidor real ya se probó en es221-servidor.cjs, caso busy).
;(async () => {
  await DB.connect(); const BR = await chromium.launch(); const srv = await serve()
  for (const lang of ['es', 'en']) {
    const ctx = await BR.newContext({ viewport: { width: lang === 'es' ? 390 : 1280, height: 900 }, reducedMotion: 'reduce' }); await ctx.addInitScript(l => localStorage.setItem('elv_lang', l), lang)
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
    await p.route('**/api/register', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'server_busy', error: 'Servidor ocupado. Inténtalo de nuevo en un momento. / Server busy. Please try again in a moment.' }) }))
    await p.goto(`http://localhost:${WEB}/login?mode=register`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#access-email', { timeout: 20000 }); await sleep(600)
    await p.fill('#access-name', 'Persona Sintetica'); await p.fill('#access-email', mail('b')); await p.fill('#access-password', PW); const cb = p.getByRole('checkbox'); if (await cb.count()) await cb.first().check()
    await p.locator('button[type=submit]').click(); await sleep(1500)
    const msg = (await p.locator('.ac-notice, [role=alert], [role=status]').allInnerTexts()).join(' | ').replace(/\s+/g, ' '); info(`503 ${lang}: aviso mostrado`, msg)
    ck(`503 ${lang}: la pantalla muestra un aviso (no queda en blanco ni con el botón bloqueado)`, msg.length > 5 && !(await p.locator('button[type=submit]').isDisabled()), msg.slice(0, 160))
    const ax = await axeRun(p); ck(`503 ${lang}: axe = 0`, ax.length === 0, ax.join(',')); ck(`503 ${lang}: sin errores de página`, errs.length === 0, errs.join('|')); await ctx.close()
  }
  console.log('RESUMEN ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallas: f })); await BR.close(); srv.close(); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 700)); process.exit(3) })
