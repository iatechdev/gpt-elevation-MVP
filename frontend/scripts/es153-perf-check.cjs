// ES-153 (E280-2/E280-3): CLS y «contenido útil» (primer h1 de la pantalla visible dentro de main, sin esqueleto) a 390 px con CPU×4, API simulada con 80 ms de latencia. Mediana de N corridas por ruta.
// Uso: ES153_URL=http://127.0.0.1:4153 [RUNS=7] PLAYWRIGHT_MODULE=... node scripts/es153-perf-check.cjs   (compara con otra URL ejecutándolo dos veces)
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES153_URL; const runs = Number(process.env.RUNS ?? 7);
  const routes = process.env.ROUTES ? process.env.ROUTES.split(',').map(r => '/' + r) : ['/app/evidence', '/app/exercises', '/app/space/tools', '/app/progress', '/app/skill-map', '/app/chat', '/app/diary', '/app/dashboard'];
  const EX = { key: 'respira_tres', minutes: [3, 5], reviewStatus: 'reviewed', version: 1, es: { title: 'Respirar tres veces', purpose: 'Parar.', question: '¿Qué notas?', help: 'Escribe.' }, en: { title: 'Breathe', purpose: 'Pause.', question: 'What?', help: 'Write.' } };
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]; const browser = await chromium.launch(); const out = {};
  for (const route of routes) { const cls = [], useful = [];
    for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await page.route('**/api/**', async (r) => { const p = new URL(r.request().url()).pathname; await new Promise((s) => setTimeout(s, 80)); return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/exercises' ? [EX] : [] }); });
      const t0 = Date.now(); await page.goto(base + route, { waitUntil: 'commit' });
      await page.waitForFunction(() => { const m = document.querySelector('main'); return m && m.querySelector('h1') && !m.querySelector('.cg-screen-loading') && !document.querySelector('[role=status].cg-screen-loading'); }, null, { timeout: 30000 }); useful.push(Date.now() - t0);
      await page.waitForTimeout(1500); cls.push(await page.evaluate(() => window.__cls)); await ctx.close();
    }
    out[route] = { util_ms: med(useful), cls: Number(med(cls).toFixed(3)) }; console.log(route.padEnd(18), JSON.stringify(out[route]));
  } await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
