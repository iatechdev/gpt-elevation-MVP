// ES-153: axe color-contrast en todas las rutas /app/* sin parámetros × ES/EN × 1360/390/320 × claro/oscuro, en modo «vacío» (API devuelve []) y «error» (API 500 salvo la sesión).
// Imprime el total de violaciones por modo y las rutas con violaciones. Ejecutarlo contra la rama y contra main y comparar.
// Uso: ES153_URL=... PLAYWRIGHT_MODULE=... AXE_PATH=... node scripts/es153-axe-all.cjs
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('node:fs'); const base = process.env.ES153_URL; const axeSrc = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const browser = await chromium.launch();
  const routes = ['/app/bridge', '/app/chat', '/app/checkin', '/app/compass', '/app/context/resumes', '/app/dashboard', '/app/data', '/app/diary', '/app/diary/new', '/app/evidence', '/app/evidence/new', '/app/evidence/resume-skills', '/app/exercises', '/app/feedback', '/app/my-therapist', '/app/next-step', '/app/onboarding', '/app/plan', '/app/professional-reviews', '/app/progress', '/app/route-catalog', '/app/skill-map', '/app/space/tools'];
  for (const mode of ['vacio', 'error']) { const found = {}; let total = 0;
    for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme }); const page = await ctx.newPage();
      await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
      await page.route('**/api/**', (r) => { const p = new URL(r.request().url()).pathname; if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } }); return mode === 'error' ? r.fulfill({ status: 500, json: { error: 'x' } }) : r.fulfill({ json: [] }); });
      for (const route of routes) { try { await page.goto(base + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(150); await page.evaluate(axeSrc); const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] })).violations.flatMap((x) => x.nodes.map((n) => n.target.join(' ').slice(0, 60)))); if (v.length) { total += v.length; (found[route] ??= new Set()); v.forEach((t) => found[route].add(t)); } } catch (e) { (found[route] ??= new Set()).add('ERROR ' + e.message.slice(0, 40)); } }
      await ctx.close(); }
    console.log(`MODO ${mode}: ${total} violaciones`); for (const [r, s] of Object.entries(found)) console.log('  ', r, [...s].slice(0, 3).join(' | ')); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
