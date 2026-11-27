// ES-412 / D-15: /privacidad, /terminos y /admin/content deben quedar sin peticiones pendientes (Chromium) aunque la API responda 404 o 403 con Cache-Control: no-store, como la real.
// La API es SIMULADA (solo para esto; no hay base ni datos): reproduce los estados y cabeceras de server.js (no-store en /api) y de routes/legal.js (404 not_published).
// Uso: (1) VITE_BACKEND_URL=http://127.0.0.1:18401 npx vite build --outDir <dist> && npx vite preview --outDir <dist> --host 127.0.0.1 --port 14401 --strictPort
//       (2) PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:14401 MOCK_PORT=18401 node scripts/es412-d15-check.cjs
const http = require('http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:14401', PORT = Number(process.env.MOCK_PORT || 18401)
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)) }
const server = http.createServer((q, res) => {
  if (q.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, accept, cache-control', 'access-control-allow-methods': 'GET, POST, PUT' }); return res.end() }
  const path = q.url.split('?')[0]
  if (path === '/api/session') return json(res, 200, { role: 'admin', onboardingCompleted: true })
  if (path.startsWith('/api/legal/')) return json(res, 404, { code: 'not_published', error: 'x' })
  if (path === '/api/junta/pending') return json(res, 403, { code: 'forbidden', error: 'x' })
  if (path === '/api/admin/professional-applications') return json(res, 403, { code: 'forbidden', error: 'x' })
  return json(res, 404, { code: 'not_found', error: 'x' })
})
server.listen(PORT, '127.0.0.1', async () => {
  const browser = await chromium.launch(); let failed = 0
  for (const [path, auth] of [['/privacidad', false], ['/terminos', false], ['/admin/content', true]]) {
    const ctx = await browser.newContext()
    if (auth) await ctx.addInitScript(() => { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es') })
    const page = await ctx.newPage(), open = new Set(), seen = []
    page.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'OPTIONS') { open.add(r); seen.push(r.url().replace(/^https?:\/\/[^/]+/, '')) } })
    page.on('requestfinished', r => open.delete(r)); page.on('requestfailed', r => open.delete(r))
    let idle = 'ok'; try { await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 }) } catch { idle = 'AGOTADO' }
    await page.waitForTimeout(1500)
    const pending = [...open].map(r => r.url().replace(/^https?:\/\/[^/]+/, '')), h1 = await page.locator('h1').first().innerText().catch(() => '(sin h1)')
    const ok = idle === 'ok' && pending.length === 0; if (!ok) failed += 1
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${path}: networkidle=${idle} pendientes=${JSON.stringify(pending)} pedidas=${JSON.stringify([...new Set(seen)])} h1=${JSON.stringify(h1)}`)
    await ctx.close()
  }
  await browser.close(); server.close(); process.exit(failed ? 1 : 0)
})
