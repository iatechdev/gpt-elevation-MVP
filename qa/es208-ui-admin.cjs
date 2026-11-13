// QA-Claude-2 — ES-187 (PR #208) regresion de la pantalla ACTUAL del administrador (CatalogManager, que aun NO manda expectedUpdatedAt): abrir un borrador, abrir una fuente, guardar un cambio y ver que se guarda sin error con el servidor del PR.
// Servidor estatico propio en :5173 con DIST (build del arbol mergeado), backend REAL :8090. Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, DIST, TOKEN (admin), SHOTS.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE), fs = require('fs'), http = require('http'), path = require('path'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg'); const API = 'http://localhost:8090'
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
;(async () => {
  const srv = await new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(process.env.DIST, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(process.env.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(5173, () => res(s)) })
  const DB = new Client({ connectionString: process.env.DATABASE_URL }); await DB.connect()
  const B = await chromium.launch(); const c = await B.newContext({ viewport: { width: 1360, height: 900 } }); await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_lang', 'es') }, process.env.TOKEN); const p = await c.newPage()
  const net = []; p.on('response', async r => { if (r.url().includes('/api/admin/route-catalog') && r.request().method() !== 'GET') net.push([r.request().method(), r.status(), r.url().replace(API, '').slice(0, 70)]) }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 100)))
  await p.goto('http://localhost:5173/admin/route-catalog', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1', { timeout: 30000 })
  const row = (await DB.query('SELECT c.id, count(i.*)::int n FROM "RouteCatalogs" c LEFT JOIN "RouteCatalogItems" i ON i."catalogId"=c.id WHERE c.status=$1 GROUP BY c.id ORDER BY c.id LIMIT 1', ['draft'])).rows[0]
  await p.goto(`http://localhost:5173/admin/route-catalog/${row.id}`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); await p.waitForTimeout(1500)
  const txt0 = (await p.locator('body').innerText()).replace(/\s+/g, ' '); console.log('INFO pantalla del borrador:', txt0.slice(0, 260))
  ck('la pantalla del borrador carga con el servidor del PR (GET /:id trae updatedAt extra) sin error de página', errs.length === 0 && !/error|No pudimos/i.test(txt0.slice(0, 400)), errs.join('|'))
  await DB.query('UPDATE "RouteCatalogItems" SET "itemKey"="itemKey" WHERE false')
  const key = 'qa_src_base'; await p.goto(`http://localhost:5173/admin/route-catalog/${row.id}/sources/${key}`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); await p.waitForTimeout(1500)
  const inputs = await p.locator('input[type=text], input:not([type]), textarea').count(); console.log('INFO campos en la ficha de la fuente:', inputs)
  const title = p.locator('input').filter({ has: p.locator('xpath=self::*') }).first()
  const lab = p.getByLabel(/título|title/i).first(); const hasLab = await lab.count()
  ck('la ficha de una fuente abre y tiene un campo de título', hasLab > 0, `campos=${inputs}`)
  if (hasLab) { const NEW = '[SINTÉTICO] Editado desde la pantalla ' + Date.now().toString(36); await lab.fill(NEW); await p.getByRole('button', { name: /^(guardar|save)/i }).first().click(); await p.waitForTimeout(2500)
    const put = net.filter(x => x[0] === 'PUT'); ck('guardar desde la pantalla actual (sin expectedUpdatedAt) = PUT 200 con el servidor del PR', put.length >= 1 && put.every(x => x[1] === 200), JSON.stringify(put))
    const db = (await DB.query('SELECT data FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND "itemKey"=$2', [row.id, key])).rows[0]; ck('el cambio quedó en la base y data NO trae updatedAt', db.data.title === NEW && !('updatedAt' in db.data), db.data.title)
    const txt = (await p.locator('body').innerText()).replace(/\s+/g, ' '); ck('la pantalla no muestra error ni conflicto tras guardar', !/No pudimos|error|conflicto|item_changed/i.test(txt), txt.slice(0, 160)); fs.mkdirSync(process.env.SHOTS || '.', { recursive: true }); await p.screenshot({ path: path.join(process.env.SHOTS || '.', 'admin-guardar.png') }) }
  ck('sin errores de página', errs.length === 0, errs.join('|')); await B.close(); srv.close(); await DB.end(); console.log(`\nRESUMEN: ${total - f}/${total} OK, ${f} FALLA`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('ERROR', e); process.exit(2) })
