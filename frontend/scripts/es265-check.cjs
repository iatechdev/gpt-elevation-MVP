// ES-265: panel profesional con 401 (sesión vencida) → se invalida la sesión y la compuerta lleva a /login; 403 → mensaje propio SIN «Reintentar»; 500 sigue con «Reintentar».
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4265 --strictPort   y luego
//   ES265_URL=http://127.0.0.1:4265 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es265-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES265_URL ?? 'http://127.0.0.1:4265';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const emptyPrompt = { hasPrompt: false, content: null, active: null, pending: null, rejected: null };

  // status por endpoint: {endpoint: 401|403|500}; el resto responde bien
  async function open(width, lang, status = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { if (!localStorage.getItem('elevation_token') && !sessionStorage.getItem('es265_seeded')) { sessionStorage.setItem('es265_seeded', '1'); localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); } localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (status[p]) return route.fulfill({ status: status[p], json: { error: 'x' } });
      const body = { '/api/therapist/pacientes': [], '/api/sessions/therapist/upcoming': [], '/api/therapist/alerts': { inactivePatients: [], notableProgress: [] }, '/api/therapist/prompt': emptyPrompt, '/api/therapist/validation/status': [] }[p];
      return route.fulfill({ json: body ?? [] });
    });
    await page.goto(base + '/therapist/dashboard', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`;
    const retry = lang === 'es' ? 'Reintentar' : 'Try again';

    // 401 en cualquier bloque → sesión invalidada y pantalla de «entrar»
    for (const endpoint of ['/api/therapist/pacientes', '/api/sessions/therapist/upcoming', '/api/therapist/alerts']) {
      const { context, page } = await open(width, lang, { [endpoint]: 401 });
      await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await page.evaluate(() => localStorage.getItem('elevation_token')), null, `el token vencido se borra (${tag}, ${endpoint})`);
      assert.equal(await page.getByRole('button', { name: retry }).count(), 0, `sin «Reintentar» inútil (${tag})`);
      if (endpoint === '/api/therapist/alerts') assert.deepEqual(await axe(page), [], `axe en /login (${tag})`);
      await context.close();
    }
    check(`401 en resumen/personas, sesiones y avisos (${tag}): token borrado y llega a /login, sin «Reintentar»`);

    // 403 → mensaje propio sin reintentar, la sesión se conserva y los demás bloques siguen
    {
      const { context, page } = await open(width, lang, { '/api/therapist/alerts': 403 });
      const box = page.locator('section[aria-labelledby="panel-alerts-title"]');
      await box.getByRole('alert').waitFor();
      const want = lang === 'es' ? 'No tienes permiso para ver este bloque.' : "You don't have permission to see this block.";
      assert.equal((await box.getByRole('alert').innerText()).trim(), want, `texto de 403 (${tag})`);
      assert.equal(await box.getByRole('button', { name: new RegExp('^' + retry) }).count(), 0, `403 sin «Reintentar» (${tag})`);
      assert.ok(await page.evaluate(() => localStorage.getItem('elevation_token') === 't'), `403 no cierra la sesión (${tag})`);
      assert.equal(await page.locator('section[aria-labelledby="panel-upcoming-title"]').getByRole('alert').count(), 0, 'los demás bloques siguen');
      assert.deepEqual(await axe(page), [], `axe (${tag})`);
      await context.close();
    }
    check(`403 (${tag}): mensaje propio sin «Reintentar», sesión intacta, otros bloques sin cambio, axe 0`);

    // 500 sigue igual: error genérico con «Reintentar»
    {
      const { context, page } = await open(width, lang, { '/api/therapist/alerts': 500 });
      const box = page.locator('section[aria-labelledby="panel-alerts-title"]');
      await box.getByRole('alert').waitFor();
      assert.ok(await box.getByRole('button', { name: new RegExp('^' + retry) }).isVisible(), `500 conserva «Reintentar» (${tag})`);
      await context.close();
    }
    check(`500 (${tag}): sin cambio, «Reintentar» visible`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-265: ${count} comprobaciones (ES/EN × 390/1360) OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
