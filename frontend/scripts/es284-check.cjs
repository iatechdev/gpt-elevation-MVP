// ES-284: marco del profesional sin label-content-name-mismatch (WCAG 2.5.3). Comprueba el nombre accesible del enlace de la marca y corre axe (incluye la regla, que es de wcag21a).
// Nota: label-content-name-mismatch es una regla «experimental» de axe (apagada por defecto): se enciende explícitamente.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4284 --strictPort   y luego
//   ES284_URL=http://127.0.0.1:4284 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es284-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES284_URL ?? 'http://127.0.0.1:4284';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  for (const [width, lang, name] of [[390, 'es', 'Elevation. Profesional'], [390, 'en', 'Elevation. Professional'], [1360, 'es', 'Elevation. Profesional'], [1360, 'en', 'Elevation. Professional']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (p === '/api/therapist/alerts') return route.fulfill({ json: { inactivePatients: [], notableProgress: [] } });
      if (p === '/api/therapist/prompt') return route.fulfill({ json: { hasPrompt: false, content: null, active: null, pending: null, rejected: null } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/therapist/dashboard', { waitUntil: 'networkidle' });
    const brand = page.locator('a.cg-brand');
    assert.equal(await brand.getAttribute('aria-label'), name, `nombre accesible (${width}px ${lang})`);
    const visible = (await brand.textContent()).replace(/\s+/g, ' ').trim();
    assert.equal(visible, name, `el texto visible es el mismo (${width}px ${lang})`);
    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'label-content-name-mismatch': { enabled: true } } })).violations.map((v) => v.id + ':' + v.nodes.length));
    assert.deepEqual(violations, [], `axe (${width}px ${lang})`);
    count++; console.log(`PASS marco del profesional (${width}px ${lang}): nombre «${name}» = texto visible, axe 0`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'errores de página: ' + errors.join(' | '));
  console.log(`\nES-284: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
