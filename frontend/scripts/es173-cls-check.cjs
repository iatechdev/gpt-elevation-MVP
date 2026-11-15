// ES-173 (E272-1): CLS de /app/progress y /app/feedback a 390 px con la CPU ×4 (CDP), N rondas, con el build real. Criterio de Infra: CLS ≤ 0,1 en las dos.
// API simulada con datos SINTÉTICOS (sin servidor real ni IA). Imprime cada salto con el elemento que se movió (para encontrar la causa).
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright> [ROUNDS=5] [LIMIT=0.1] node scripts/es173-cls-check.cjs
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http'); const os = require('node:os');
const { spawnSync } = require('node:child_process'); const { once } = require('node:events'); const assert = require('node:assert/strict');
const { fail } = require('./_exitOnFailure.cjs');
(async () => {
  const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es173cls-')); const servers = []; let browser;
  const ROUNDS = Number(process.env.ROUNDS || 5); const LIMIT = Number(process.env.LIMIT || 0.1);
  const build = (name, preview) => {
    const out = path.join(tmp, name);
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_PILOT_FEEDBACK_PREVIEW: preview ? 'true' : 'false', VITE_PILOT_FEEDBACK_SCENARIO: '' } });
    if (result.status !== 0) throw new Error('build ' + name + ': ' + result.stderr); return out;
  };
  const serve = async dist => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const target = path.resolve(dist, '.' + pathname);
      if (!target.startsWith(dist + path.sep) && target !== dist) { res.writeHead(404).end(); return; }
      const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
    }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return `http://127.0.0.1:${server.address().port}`;
  };
  const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const DATA = { stats: { totalSessions: 9, avgMood: 3.6, avgRating: 4, streak: 5 },
    moodLogs: [1, 2, 3, 4, 5].map(n => ({ id: n, date: day(n), checkin_mood: 2, checkout_mood: 4 })), ratings: [1, 2, 3].map(n => ({ id: n, date: day(n), rating: 4 })),
    recommendations: [{ id: 1, category: 'habit', content: 'Una pausa breve entre tareas.', generatedAt: day(0), seenByUser: false }] };
  try {
    const origins = { '/app/progress': await serve(build('progress', false)), '/app/feedback': await serve(build('feedback', true)) };
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    let bad = 0;
    for (const route of Object.keys(origins)) for (const lang of ['es', 'en']) {
      const values = [];
      for (let round = 0; round < ROUNDS; round++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const page = await context.newPage();
        const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await context.addInitScript(l => { localStorage.setItem('elevation_token', 'es173-cls'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l);
          window.__cls = 0; window.__shifts = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), n: (e.sources || []).map(s => (s.node && (s.node.nodeName + '.' + (s.node.className || ''))) || '?').slice(0, 3).join(' | ') }); } }).observe({ type: 'layout-shift', buffered: true }); }, lang);
        await page.route('**/api/**', r => r.fulfill({ json: {} }));
        await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
        await page.route('**/api/user/progress', async r => { await new Promise(res => setTimeout(res, 300)); return r.fulfill({ json: DATA }); });
        await page.goto(origins[route] + route); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(4000);
        const r = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts })); values.push(r); await context.close();
      }
      const worst = values.reduce((a, b) => (b.cls > a.cls ? b : a)); const max = Math.max(...values.map(v => v.cls));
      console.log(`${max <= LIMIT ? 'PASS' : 'FAIL'} CLS ${route} ${lang}: máx ${max.toFixed(3)} (rondas: ${values.map(v => v.cls.toFixed(3)).join(', ')})`);
      if (max > LIMIT) { bad++; console.log('   saltos de la peor ronda:', JSON.stringify(worst.shifts)); }
    }
    assert.equal(bad, 0, bad + ' medición(es) por encima de ' + LIMIT);
    console.log('CLS ≤ ' + LIMIT + ' en todas las pantallas y rondas');
  } catch (error) { console.error('ES-173 CLS falló:', error.message); fail(); }
  finally { await browser?.close(); for (const server of servers) server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})();
