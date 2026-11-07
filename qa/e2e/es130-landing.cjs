// [QA-Claude] ES-130 · PR #129 (head 0482528f): fuentes autoalojadas y CLS de la landing. Compara el build del PR con el de main (385f9b9), servidos estáticos, /api vacío.
// Mide por idioma × ancho × retraso del woff2 (0 / 2,5 / 5 s): CLS, peticiones a hosts externos, MIME/estado de las fuentes, desborde y fuentes realmente cargadas.
// Uso: node qa/e2e/es130-landing.cjs   (peticiones externas se abortan: el entorno de QA no sale a internet)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const Q = 'C:/Users/Usuario/Documents/qa13'; const OUT = 'C:/Users/Usuario/Documents/qa-e2e-evidencia/ES-130-pr129'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const serve = (dist, delay) => new Promise(r => { const s = http.createServer((q, res) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.startsWith('/api/')) { res.statusCode = 503; return res.end('{}'); } let f = path.join(dist, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); const send = () => { res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); }; if (/\.woff2$/.test(f) && delay.ms) setTimeout(send, delay.ms); else send(); }); s.listen(0, '127.0.0.1', () => r({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 320) })); };
(async () => {
  const b = await chromium.launch(); const rows = [];
  for (const [label, dist] of [['main', Q + '/lot-m385'], ['pr129', Q + '/lot-p129']]) {
    for (const delayMs of [0, 2500, 5000]) {
      const delay = { ms: delayMs }; const { s, base } = await serve(dist, delay);
      for (const lang of ['es', 'en']) for (const w of [320, 375, 390, 768, 1440]) {
        const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); } catch { /* */ } window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); }, lang);
        const page = await ctx.newPage(); const ext = new Set(), fonts = []; page.on('request', rq => { const u = new URL(rq.url()); if (u.hostname !== '127.0.0.1') ext.add(u.hostname); }); await page.route(u => new URL(u.toString()).hostname !== '127.0.0.1', r => r.abort()); page.on('response', rs => { if (/\.woff2/.test(rs.url())) fonts.push({ s: rs.status(), t: rs.headers()['content-type'] }); });
        await page.goto(base + '/', { waitUntil: 'load' }); await page.waitForTimeout(delayMs + 2500);
        const info = await page.evaluate(() => ({ cls: window.__cls, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '') + ' ' + f.weight + ' ' + f.style), bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 80) }));
        rows.push({ label, delayMs, lang, w, cls: Number(info.cls.toFixed(4)), ov: info.ov, ext: [...ext], fonts, loaded: info.loaded }); if (w === 390 && delayMs === 2500) await page.screenshot({ path: `${OUT}/${label}-${lang}-390.png` }); await ctx.close();
      }
      s.close();
    }
  }
  await b.close(); fs.writeFileSync(`${OUT}/filas.json`, JSON.stringify(rows, null, 1));
  const pr = rows.filter(r => r.label === 'pr129'), mn = rows.filter(r => r.label === 'main'); const max = a => Math.max(...a.map(r => r.cls)), maxBy = (a, f) => Math.max(...a.filter(f).map(r => r.cls));
  R('F1 sin hosts externos: la landing del PR no pide nada a terceros (en main sí: Google Fonts)', pr.every(r => r.ext.length === 0) && mn.some(r => r.ext.length), `PR=${[...new Set(pr.flatMap(r => r.ext))].join(',') || 'ninguno'} · main=${[...new Set(mn.flatMap(r => r.ext))].join(',')}`);
  R('F3 las fuentes del PR se sirven 200 con MIME font/woff2', pr.flatMap(r => r.fonts).length > 0 && pr.flatMap(r => r.fonts).every(f => f.s === 200 && f.t === 'font/woff2'), `peticiones woff2=${pr.flatMap(r => r.fonts).length}`);
  R('F4 Inter se carga realmente en la landing del PR (document.fonts)', pr.every(r => r.loaded.some(x => /Inter/.test(x))), [...new Set(pr.flatMap(r => r.loaded))].slice(0, 6).join('; '));
  R('P1 CLS de la landing del PR ≤ 0,1 en ES y EN, 320–1440 px y con woff2 retrasado 0/2,5/5 s', max(pr) <= 0.1, `máx PR=${max(pr)} (ES ${maxBy(pr, r => r.lang === 'es')} · EN ${maxBy(pr, r => r.lang === 'en')}) · máx main=${max(mn)} (ES ${maxBy(mn, r => r.lang === 'es')} · EN ${maxBy(mn, r => r.lang === 'en')})`);
  const worst = pr.filter(r => r.cls > 0.05).map(r => `${r.lang}${r.w}/${r.delayMs}ms=${r.cls}`).slice(0, 6); R('INFO P1 casos del PR con CLS > 0,05', true, worst.join(' ') || 'ninguno');
  R('F2 sin desborde horizontal en ningún caso del PR', pr.every(r => r.ov <= 0), `máx desborde=${Math.max(...pr.map(r => r.ov))}`);
  console.log('RESUMEN-ES130 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-130-pr129-landing-resultados.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });
