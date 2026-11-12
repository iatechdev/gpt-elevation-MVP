// ES-197: la precarga baja el bloque de una ruta al pasar el cursor o enfocar su enlace, y en reposo las rutas más usadas; con saveData no baja nada.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4197 --strictPort   y luego
//   ES197_URL=http://127.0.0.1:4197 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/es197-check.cjs
const assert = require('node:assert/strict');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES197_URL ?? 'http://127.0.0.1:4197';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  async function open(connection) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await context.newPage(); const chunks = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { const m = new URL(r.url()).pathname.match(/\/assets\/([A-Za-z]+)-[^/]+\.js$/); if (m) chunks.push(m[1]); });
    await page.addInitScript(([c]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); if (c) Object.defineProperty(navigator, 'connection', { value: c, configurable: true }); }, [connection]);
    await page.route('**/api/**', (route) => { const p = new URL(route.request().url()).pathname; return route.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }); });
    await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' });
    return { context, page, chunks };
  }
  const seen = (chunks, name) => chunks.includes(name);

  { // cursor sobre «Mapa» → baja SkillMapPage antes de navegar
    const { context, page, chunks } = await open(null);
    assert.equal(seen(chunks, 'SkillMapPage'), false, 'antes de pasar el cursor no está');
    await page.locator('a[href="/app/skill-map"]:visible').first().hover();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /SkillMapPage-/.test(e.name)), null, { timeout: 4000 });
    assert.ok(seen(chunks, 'SkillMapPage'));
    await context.close();
  }
  check('cursor sobre un enlace del menú → se descarga el bloque de su ruta');

  { // foco con teclado
    const { context, page, chunks } = await open(null);
    await page.locator('a[href="/app/chat"]:visible').first().focus();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /ChatPage-/.test(e.name)), null, { timeout: 4000 });
    assert.ok(seen(chunks, 'ChatPage'));
    await context.close();
  }
  check('foco de teclado en un enlace → se descarga el bloque de su ruta');

  { // reposo: ~3 s después de la carga baja las rutas del área
    const { context, page, chunks } = await open(null);
    await page.waitForTimeout(4500);
    for (const name of ['SkillMapPage', 'ChatPage', 'EvidencePages']) assert.ok(seen(chunks, name), name + ' en reposo');
    await context.close();
  }
  check('en reposo se precargan las rutas más usadas del área de la persona');

  { // saveData: nada
    const { context, page, chunks } = await open({ saveData: true, effectiveType: '4g' });
    await page.locator('a[href="/app/skill-map"]:visible').first().hover(); await page.waitForTimeout(4500);
    for (const name of ['SkillMapPage', 'ChatPage', 'EvidencePages']) assert.equal(seen(chunks, name), false, name + ' con saveData');
    await context.close();
  }
  check('con saveData no se precarga nada (ni cursor ni reposo)');

  { // navegar después de precargar funciona
    const { context, page } = await open(null);
    await page.locator('a[href="/app/skill-map"]:visible').first().hover(); await page.waitForTimeout(500);
    await page.locator('a[href="/app/skill-map"]:visible').first().click(); await page.waitForURL('**/app/skill-map');
    await context.close();
  }
  check('la navegación tras la precarga funciona');

  assert.deepEqual(errors, [], 'errores de página: ' + errors.join(' | '));
  console.log(`\nES-197 (precarga): ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
