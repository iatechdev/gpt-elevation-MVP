// QA-Claude-2 — ES-67 rendimiento de la landing en STAGING (L-P03 a L-P07). Solo GET públicos. Env: BASE, PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const zlib = require('zlib')
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }, med = a => pct(a, .5)
const t = async (url, headers = {}) => { const t0 = performance.now(); const r = await fetch(url, { headers }); const t1 = performance.now(); const buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, ttfb: t1 - t0, total: performance.now() - t0, len: buf.length, enc: r.headers.get('content-encoding') } }
;(async () => {
  // L-P07 TTFB del HTML (20 cargas secuenciales). fetch devuelve al recibir cabeceras: ttfb ≈ tiempo hasta cabeceras.
  const ttfb = []; for (let i = 0; i < 20; i++) ttfb.push((await t(BASE + '/', { 'accept-encoding': 'gzip' })).ttfb)
  console.log(`L-P07 TTFB HTML (20 cargas, desde esta máquina en Colombia hacia ${BASE.replace('https://', '')}, borde Railway gru1 [São Paulo]): mediana ${med(ttfb).toFixed(0)} ms, p95 ${pct(ttfb, .95).toFixed(0)} ms, mín ${Math.min(...ttfb).toFixed(0)} ms, máx ${Math.max(...ttfb).toFixed(0)} ms`)
  // línea base de latencia de red: /api/health (sin lógica)
  const h = []; for (let i = 0; i < 20; i++) h.push((await t(BASE + '/api/health')).ttfb); console.log(`      referencia /api/health: mediana ${med(h).toFixed(0)} ms, p95 ${pct(h, .95).toFixed(0)} ms`)
  // pesos comprimidos
  const html = await (await fetch(BASE + '/')).text(); const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
  for (const a of assets) { const raw = await t(BASE + a, { 'accept-encoding': 'identity' }); const gz = await t(BASE + a, { 'accept-encoding': 'gzip, br' }); console.log(`L-P01/02 ${a.split('/').pop()}: sin comprimir ${raw.len} B; descargado con compresión ${gz.len} B (content-encoding: ${gz.enc || 'ninguno'})`) }
  // L-P06 /api/plans: 20 secuenciales y 6 concurrentes ×4 rondas
  const seq = []; let codes = {}; for (let i = 0; i < 20; i++) { const r = await t(BASE + '/api/plans'); seq.push(r.total); codes[r.s] = (codes[r.s] || 0) + 1 }
  console.log(`L-P06 GET /api/plans secuencial x20: mediana ${med(seq).toFixed(0)} ms, p95 ${pct(seq, .95).toFixed(0)} ms, códigos ${JSON.stringify(codes)}`)
  const con = []; codes = {}; for (let r = 0; r < 4; r++) { const rs = await Promise.all(Array.from({ length: 6 }, () => t(BASE + '/api/plans'))); rs.forEach(x => { con.push(x.total); codes[x.s] = (codes[x.s] || 0) + 1 }) }
  console.log(`L-P06 GET /api/plans 6 concurrentes x4 rondas (24): mediana ${med(con).toFixed(0)} ms, p95 ${pct(con, .95).toFixed(0)} ms, códigos ${JSON.stringify(codes)} (429 = interviene el limitador)`)
  // L-P04/L-P05 LCP, CLS, TBT con red tipo 4G (CDP), 5 cargas en frío (contexto nuevo cada una)
  const b = await chromium.launch(); const rows = []
  for (const lang of ['es', 'en']) for (let i = 0; i < 5; i++) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }); await c.addInitScript(l => localStorage.setItem('elv_lang', l), lang); const p = await c.newPage(); const cdp = await c.newCDPSession(p)
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await p.addInitScript(() => { window.__m = { lcp: 0, cls: 0, longs: [], fcp: 0 }; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.longs.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime }).observe({ type: 'paint', buffered: true }) })
    let bytes = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength }); const t0 = Date.now(); await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500)
    const m = await p.evaluate(() => { const x = window.__m; const tbt = x.longs.filter(([s]) => s >= x.fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0); return { lcp: x.lcp, cls: x.cls, tbt, fcp: x.fcp } }); rows.push({ lang, ...m, kb: bytes / 1024, load: Date.now() - t0 }); await c.close()
  }
  for (const lang of ['es', 'en']) { const r = rows.filter(x => x.lang === lang); const f = k => med(r.map(x => x[k])); console.log(`L-P04 ${lang} (móvil 390 px, 4G ~9 Mbps/70 ms RTT, CPU x4, 5 cargas en frío): LCP mediana ${f('lcp').toFixed(0)} ms (máx ${Math.max(...r.map(x => x.lcp)).toFixed(0)}), FCP ${f('fcp').toFixed(0)} ms, CLS mediana ${f('cls').toFixed(3)} (máx ${Math.max(...r.map(x => x.cls)).toFixed(3)}), TBT mediana ${f('tbt').toFixed(0)} ms (máx ${Math.max(...r.map(x => x.tbt)).toFixed(0)}), transferido ${f('kb').toFixed(0)} KB`) }
  // L-P05 CLS con la carga de planes simulada lenta (esqueleto → datos)
  const sh = []; for (let i = 0; i < 3; i++) { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await p.route('**/api/plans', async r => { await new Promise(s => setTimeout(s, 1500)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([1, 2, 3, 4].map(id => ({ id, slug: null, order: id, name_es: 'Plan ' + id, name_en: 'Plan ' + id, description_es: 'Descripción del plan', description_en: 'Plan description', price: '0.00', currency: 'COP', period: 'month', features_es: ['Uno', 'Dos', 'Tres'], features_en: ['One', 'Two', 'Three'], isHighlighted: id === 2 }))) }) })
    await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }); await p.goto(BASE + '/#planes', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); sh.push(await p.evaluate(() => window.__cls)); await c.close() }
  console.log(`L-P05 CLS cuando los planes (4 simulados) reemplazan al esqueleto, 3 cargas a 390 px: ${sh.map(x => x.toFixed(3)).join(', ')} (umbral ≤ 0,1)`)
  // L-P03 imágenes y recursos de la landing
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); const res = []; p.on('response', async r => { res.push({ u: r.url(), ct: r.headers()['content-type'] || '', len: +(r.headers()['content-length'] || 0) }) }); await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
  const img = res.filter(x => /image\//.test(x.ct)), ext = [...new Set(res.map(x => new URL(x.u).origin).filter(o => o !== BASE))]
  console.log(`L-P03 imágenes de la landing: ${img.length} (${img.reduce((a, x) => a + x.len, 0)} B); orígenes externos: ${ext.join(', ') || 'ninguno'}; tipos: ${[...new Set(res.map(x => x.ct.split(';')[0]))].join(', ')}`)
  res.filter(x => new URL(x.u).origin !== BASE).forEach(x => console.log('      externo:', x.u.slice(0, 110), x.ct.split(';')[0], x.len)); await b.close()
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
