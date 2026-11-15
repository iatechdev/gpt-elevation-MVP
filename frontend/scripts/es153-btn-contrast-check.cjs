// ES-153 (regresión QA-2): dentro del marco de persona, los enlaces con aspecto de botón (a.elv-btn*) no heredan el azul de enlace del marco.
// Chromium, API simulada. Mide axe color-contrast en /app/context/resumes y el color calculado de variantes inyectadas, ES/EN × 1360/390/320 × claro/oscuro.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4153 --strictPort ; ES153_URL=... PLAYWRIGHT_MODULE=... AXE_PATH=... node scripts/es153-btn-contrast-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs');
(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES153_URL ?? 'http://127.0.0.1:4153'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const axeSrc = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const browser = await chromium.launch({ headless: true }); let n = 0;
  for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme }); const page = await context.newPage();
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (r) => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }); });
    await page.goto(base + '/app/context/resumes', { waitUntil: 'networkidle' });
    await page.evaluate(() => { const m = document.querySelector('main'); for (const v of ['primary', 'secondary', 'danger', 'ghost', 'outline']) { const a = document.createElement('a'); a.href = '/app/skill-map'; a.className = `elv-btn elv-btn-${v}`; a.textContent = `Variante ${v}`; a.setAttribute('data-probe', v); m.appendChild(a); } });
    const colors = await page.evaluate(() => { const mark = getComputedStyle(document.querySelector('.cg')).getPropertyValue('--cg-mark').trim(); const probe = document.createElement('i'); probe.style.color = mark; document.body.appendChild(probe); const markRgb = getComputedStyle(probe).color; probe.remove(); return { markRgb, probes: [...document.querySelectorAll('[data-probe]')].map(a => ({ v: a.dataset.probe, color: getComputedStyle(a).color })) }; });
    for (const p of colors.probes.filter(p => ['primary', 'danger'].includes(p.v))) assert.notEqual(p.color, colors.markRgb, `a.elv-btn-${p.v} no hereda el azul de enlace del marco (${lang} ${width} ${scheme})`);
    await page.evaluate(axeSrc); const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] })).violations.flatMap(v => v.nodes.map(x => x.html.slice(0, 80))));
    const mine = res.filter(h => !h.includes('data-probe'));
    assert.deepEqual(mine, [], `axe color-contrast en /app/context/resumes (${lang} ${width} ${scheme})`);
    await context.close(); n++;
  }
  console.log(`PASS ${n} combinaciones (ES/EN × 1360/390/320 × claro/oscuro): sin heredar el azul del marco y axe color-contrast = 0 en /app/context/resumes`); await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
