// ES-200: el panel de la persona (/app/dashboard) lanza sus cinco lecturas a la vez, y al salir de la pantalla las cancela. API simulada con page.route (respuestas retrasadas para ver la cancelación).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4200 --strictPort   y luego
//   ES200_URL=http://127.0.0.1:4200 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/es200-check.cjs
const assert = require('node:assert/strict');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES200_URL ?? 'http://127.0.0.1:4200';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const READS = ['/api/user/progress', '/api/sessions/user/upcoming', '/api/sessions/user/my-therapist', '/api/recommendations', '/api/user/plan/me'];

  async function open(delay) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_ABORTED|net::/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); });
    const started = {}; const finished = {}; const failed = [];
    page.on('requestfailed', (r) => { const p = new URL(r.url()).pathname; if (READS.includes(p)) failed.push(p); });
    await page.route('**/api/**', async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (READS.includes(p)) started[p] = Date.now();
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (READS.includes(p)) { await new Promise((r) => setTimeout(r, delay)); finished[p] = Date.now(); }
      const body = { '/api/user/progress': { moodLogs: [] }, '/api/sessions/user/upcoming': { session: null }, '/api/sessions/user/my-therapist': { therapist: null }, '/api/recommendations': [], '/api/user/plan/me': { plan: null, limits: null } }[p];
      return route.fulfill({ json: body ?? [] }).catch(() => undefined);
    });
    return { context, page, started, finished, failed };
  }

  { // Las cinco lecturas salen juntas (ninguna espera a otra)
    const { context, page, started } = await open(300);
    await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' });
    const times = READS.map((p) => started[p]);
    assert.ok(times.every(Boolean), 'las cinco lecturas se pidieron');
    const spread = Math.max(...times) - Math.min(...times);
    assert.ok(spread < 150, `las cinco lecturas empiezan a la vez (dispersión ${spread} ms, con 300 ms de latencia: una cascada daría ≥ 300)`);
    await context.close();
  }
  check('las cinco lecturas del panel empiezan a la vez (sin cascada)');

  { // Al salir de la pantalla se cancelan las lecturas en vuelo
    const { context, page, failed } = await open(1500);
    await page.goto(base + '/app/dashboard', { waitUntil: 'commit' });
    await page.waitForFunction(() => true);
    await new Promise((r) => setTimeout(r, 900)); // las lecturas ya salieron y siguen esperando respuesta
    await page.evaluate(() => { history.pushState({}, '', '/pricing'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(failed.length >= 1, `al salir se cancelan lecturas en vuelo (canceladas: ${failed.length})`);
    await context.close();
  }
  check('al salir de la pantalla se cancelan las lecturas en vuelo y no hay errores');

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-200: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
