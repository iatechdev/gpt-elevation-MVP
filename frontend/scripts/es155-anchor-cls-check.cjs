// ES-155 C (E282-1): CLS al llegar por ancla (/#planes, /#privacidad, /) a 390 px con la CPU x4, N rondas, sobre un build servido de dist/. API simulada.
// WITH_PLANS=1 simula un catálogo de 3 planes (datos sintéticos) en vez de vacío.
// Uso: PLAYWRIGHT_MODULE=<ruta> BASE=http://127.0.0.1:4155 [ROUNDS=10] [LIMIT=0.1] node scripts/es155-anchor-cls-check.cjs
const { fail } = require('./_exitOnFailure.cjs');
(async () => {
  const BASE = process.env.BASE; const ROUNDS = Number(process.env.ROUNDS || 10); const LIMIT = Number(process.env.LIMIT || 0.1);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const browser = await chromium.launch({ headless: true }); let bad = 0;
  try {
    for (const hash of ['', '#planes', '#privacidad']) for (const lang of ['es', 'en']) {
      const values = []; let shifts = [];
      for (let round = 0; round < ROUNDS; round++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const page = await context.newPage();
        const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await context.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__cls = 0; window.__shifts = [];
          new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), n: (e.sources || []).map(s => (s.node && (s.node.nodeName + '.' + (s.node.className || ''))) || '?').slice(0, 3).join(' | ') }); } }).observe({ type: 'layout-shift', buffered: true }); }, lang);
        if (process.env.WITH_PLANS) await page.route('**/api/plans', r => r.fulfill({ json: [1, 2, 3].map(n => ({ id: n, slug: 'p' + n, name_es: 'Plan ' + n, name_en: 'Plan ' + n, description_es: 'Descripción sintética del plan.', description_en: 'Synthetic plan description.', features_es: ['Uno', 'Dos', 'Tres'], features_en: ['One', 'Two', 'Three'], price: n === 1 ? '0' : String(n * 10), currency: 'USD', period: 'month', isHighlighted: n === 2, order: n })) }));
        await page.route('**/api/**', r => r.fulfill({ json: new URL(r.request().url()).pathname === '/api/landing-content' ? {} : [] }));
        await page.goto(BASE + '/' + hash); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(3500);
        const r = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts })); values.push(r.cls); if (r.cls >= Math.max(...values)) shifts = r.shifts; await context.close();
      }
      const max = Math.max(...values); const sorted = [...values].sort((a, b) => a - b); const median = sorted[Math.floor(sorted.length / 2)];
      console.log(`${max <= LIMIT ? 'PASS' : 'FAIL'} CLS /${hash} ${lang}: máx ${max.toFixed(3)} mediana ${median.toFixed(3)} (${values.map(v => v.toFixed(3)).join(', ')})`);
      if (max > LIMIT) { bad++; console.log('   saltos de la peor ronda:', JSON.stringify(shifts)); }
    }
    if (bad) { console.error(bad + ' medición(es) por encima de ' + LIMIT); fail(); } else console.log('CLS ≤ ' + LIMIT + ' en todas las anclas');
  } finally { await browser.close(); }
})();
