// Compiled Chromium checks. Every identity and API response here is synthetic.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), artifacts = path.join(root, 'node_modules/.es35-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const servers = [], writes = [], errors = [], bases = new Map(); let browser, lastPage;
async function serve(directory) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(directory, '.' + pathname);
    if (!file.startsWith(directory + path.sep) && file !== directory) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(directory, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server); return 'http://127.0.0.1:' + server.address().port;
}
async function build(mode) {
  if (bases.has(mode)) return bases.get(mode);
  const directory = path.resolve(root, 'node_modules', '.es35-build-' + mode);
  assert.equal(path.dirname(directory), path.join(root, 'node_modules')); assert.match(path.basename(directory), /^\.es35-build-[a-z-]+$/);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', directory, '--emptyOutDir'], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_FACILITATION_PREVIEW: mode === 'disabled' ? '' : 'true', VITE_FACILITATION_FIXTURE_SCENARIO: mode === 'disabled' ? 'normal' : mode, VITE_BACKEND_URL: '' } });
  assert.equal(result.status, 0, result.stderr || result.stdout); const base = await serve(directory); bases.set(mode, base); return base;
}
async function pageAt(base, pathname = '/facilitation', lang = 'es', session = true) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ lang, session }) => { if (session) localStorage.setItem('elevation_token', 'synthetic-session-a'); localStorage.setItem('elv_lang', lang); }, { lang, session });
  await context.route('**/api/**', route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().method()); return route.abort(); }
    const pathname = new URL(route.request().url()).pathname;
    const body = /recommendations|messages/.test(pathname) ? [] : /progress/.test(pathname) ? { moodLogs: [] } : /plan\/me/.test(pathname) ? { plan: null, limits: null } : { session: null, therapist: null };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + pathname); await page.waitForLoadState('networkidle'); return { page, context };
}
async function shot(page, name) { await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true }); }
async function test(name, run) { await run(); console.log('PASS ' + name); }
const reviewPath = '/facilitation/participants/synthetic-A/reviews/new?shareId=synthetic-share-A';
async function fillReview(page, en = false) {
  await page.getByRole('checkbox').check();
  await page.getByLabel(en ? 'Professional observation' : 'Observación profesional', { exact: true }).fill('Synthetic observation — three steps.');
  await page.getByLabel(en ? 'Limits of this review' : 'Límites de esta revisión', { exact: true }).fill('Synthetic limitation — no independent observation.');
  await page.getByRole('button', { name: en ? 'Preview' : 'Vista previa', exact: true }).click();
}
async function confirmed(page, en = false) { await page.getByRole('button', { name: en ? 'Confirm record' : 'Confirmar registro', exact: true }).click(); await page.getByRole('status').filter({ hasText: en ? 'Simulation completed.' : 'Simulación completada.' }).waitFor(); }
(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    const normal = await build('normal');
    await test('ES full review / objection / response; reload clears RAM', async () => {
      const { page, context } = await pageAt(normal);
      assert.equal(await page.getByRole('link', { name: /Ver progreso/ }).count(), 6);
      await shot(page, 'roster-es');
      await page.getByRole('link', { name: 'Ver progreso · A', exact: true }).click();
      await page.getByRole('button', { name: 'Ver material', exact: true }).click(); await page.getByText('Esquema de tres pasos preparado para una actividad ficticia.', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Registrar revisión', exact: true }).click();
      // QA-35 obs. 2: la lógica rechaza caracteres de control, textos demasiado largos y vacíos, cada uno con su mensaje.
      {
        const observation = page.getByLabel('Observación profesional', { exact: true }), limitsField = page.getByLabel('Límites de esta revisión', { exact: true });
        const preview = () => page.getByRole('button', { name: 'Vista previa', exact: true }).click();
        await page.getByRole('checkbox').check(); await limitsField.fill('Límites sintéticos');
        await observation.fill('texto\u0007oculto'); await preview();
        await page.getByText('El texto contiene caracteres no permitidos.', { exact: true }).waitFor(); assert.equal(await observation.getAttribute('aria-invalid'), 'true');
        await observation.evaluate(el => el.removeAttribute('maxlength')); // el navegador recortaría el texto: aquí se prueba la lógica, no el atributo
        await observation.fill('x'.repeat(4001)); await preview(); await page.getByText('El texto supera el máximo permitido.', { exact: true }).waitFor();
        await observation.fill('   '); await preview(); await page.getByText('Completa este campo.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Confirmar registro', exact: true }).count(), 0);
        await observation.fill(''); await limitsField.fill('');
      }
      await fillReview(page); assert.equal(await page.getByRole('heading', { name: 'Observación profesional', exact: true }).count(), 1);
      assert.equal(await page.getByRole('heading', { name: 'Revisión registrada.', exact: true }).count(), 0);
      await confirmed(page); await shot(page, 'review-recorded');
      await page.getByRole('link', { name: 'Mis revisiones profesionales', exact: true }).click();
      await page.getByRole('button', { name: 'Objetar revisión', exact: true }).click();
      await page.getByLabel('Motivo de la objeción', { exact: true }).fill('Synthetic objection — please reconsider.');
      await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar objeción', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Simulación completada.' }).waitFor();
      await page.getByText('Pendiente de respuesta', { exact: true }).waitFor(); await shot(page, 'objection');
      await page.getByRole('link', { name: 'Personas asignadas', exact: true }).click(); await page.getByRole('link', { name: 'Ver progreso · A', exact: true }).click();
      await page.getByRole('button', { name: 'Responder a la objeción', exact: true }).click();
      await page.getByLabel('Respuesta profesional', { exact: true }).fill('Synthetic response — limitation clarified.');
      await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar respuesta', exact: true }).click();
      await page.getByText('Respondida', { exact: true }).waitFor();
      assert.equal(await page.getByText('Synthetic observation — three steps.', { exact: true }).count(), 1);
      await shot(page, 'response');
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['elevation_token', 'elv_lang']);
      await page.reload(); await page.getByText('Todavía no hay revisiones.', { exact: true }).waitFor(); await context.close();
    });
    await test('EN / language preserves drafts / keyboard skip / dark mobile / zoom', async () => {
      const { page, context } = await pageAt(normal, reviewPath, 'en');
      await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
      await page.getByLabel('Professional observation', { exact: true }).fill('Synthetic draft');
      await page.getByRole('button', { name: 'ES', exact: true }).click();
      assert.equal(await page.getByLabel('Observación profesional', { exact: true }).inputValue(), 'Synthetic draft');
      await page.getByLabel('Límites de esta revisión', { exact: true }).fill('Synthetic limits retained in English.');
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
      await page.getByText('Idioma de autoría: EN', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
      await page.getByRole('button', { name: 'EN', exact: true }).click();
      const metrics = await page.evaluate(() => ({ font: parseFloat(getComputedStyle(document.querySelector('textarea')).fontSize), checkbox: document.querySelector('input[type=checkbox]').getBoundingClientRect().width, buttons: [...document.querySelectorAll('.elv-btn')].filter(e => e.getClientRects().length && !e.classList.contains('fac-skip')).map(e => e.getBoundingClientRect().height) }));
      assert.ok(metrics.font >= 16); assert.ok(metrics.checkbox >= 20); assert.ok(metrics.buttons.every(height => height >= 44));
      await fillReview(page, true); await confirmed(page, true);
      await page.getByRole('link', { name: 'My professional reviews', exact: true }).click();
      await shot(page, 'review-en');
      const text = await page.locator('main').innerText(); assert.doesNotMatch(text, /Personas asignadas|Guardar|Revisión registrada|Todavía no/);
      await page.getByRole('link', { name: 'Assigned participants', exact: true }).click();
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow at ' + width);
      }
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await page.setViewportSize({ width: 375, height: 1000 }); await shot(page, 'mobile-dark');
      await page.setViewportSize({ width: 768, height: 1000 }); await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await shot(page, 'zoom-200');
      await context.close();
    });
    await test('dirty Link and Back guard / Escape retains draft / session change clears', async () => {
      const { page, context } = await pageAt(normal);
      await page.getByRole('link', { name: 'Ver progreso · A', exact: true }).click(); await page.getByRole('link', { name: 'Registrar revisión', exact: true }).click();
      await page.getByLabel('Observación profesional', { exact: true }).fill('Synthetic private draft');
      await page.getByRole('link', { name: 'Personas asignadas', exact: true }).click(); await page.getByRole('dialog').waitFor();
      for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), true); }
      await page.keyboard.press('Escape'); assert.equal(await page.getByLabel('Observación profesional', { exact: true }).inputValue(), 'Synthetic private draft');
      assert.equal(await page.locator(':focus').innerText(), 'Personas asignadas');
      await page.evaluate(() => history.back()); await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
      assert.match(page.url(), /reviews\/new/);
      await page.evaluate(() => localStorage.setItem('elevation_token', 'synthetic-session-b'));
      await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
      await context.close();
    });
    await test('invitations / withdrawn and foreign materials; no aggregates', async () => {
      const { page, context } = await pageAt(normal, '/facilitation/participants/synthetic-E');
      await page.getByRole('button', { name: 'Solicitar invitación', exact: true }).click();
      await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar solicitud', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Simulación completada.' }).waitFor();
      await page.getByText('Invitación: Pendiente', { exact: true }).waitFor();
      await page.goto(normal + '/facilitation/participants/synthetic-C'); await page.getByText('Acceso retirado', { exact: true }).waitFor(); assert.equal(await page.getByRole('link', { name: 'Registrar revisión', exact: true }).count(), 0);
      await page.goto(normal + '/facilitation/participants/synthetic-A/reviews/new?shareId=synthetic-share-B'); await page.getByText('Tu acceso ya no está disponible.', { exact: true }).waitFor();
      assert.equal(await page.locator('textarea').count(), 0); await context.close();
    });
    for (const mode of ['save-error', 'lost-ack']) await test(mode + ' exact retry with no false success or duplicate', async () => {
      const base = await build(mode), { page, context } = await pageAt(base, reviewPath);
      await fillReview(page); await page.getByRole('button', { name: 'Confirmar registro', exact: true }).click();
      await page.getByText('No se confirmó el guardado. Conservamos el borrador para reintentar.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Todavía no hay revisiones.', { exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Simulación completada.' }).waitFor();
      assert.equal(await page.getByText('Synthetic observation — three steps.', { exact: true }).count(), 1); await context.close();
    });
    await test('conflict requires reloading material version; no overwrite', async () => {
      const base = await build('conflict'), { page, context } = await pageAt(base, reviewPath);
      await fillReview(page); await page.getByRole('button', { name: 'Confirmar registro', exact: true }).click();
      await page.getByText('El material cambió. Revisa la versión antes de continuar.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Confirmar registro', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByText('Explicar una tarea · Versión 2', { exact: true }).waitFor();
      await fillReview(page); await confirmed(page); await context.close();
    });
    for (const mode of ['empty', 'load-error', 'revoked', 'disabled']) await test(mode + ' fails closed / no controls', async () => {
      const base = await build(mode), { page, context } = await pageAt(base);
      const message = { empty: 'No tienes personas asignadas.', 'load-error': 'No se pudo cargar la información.', revoked: 'Tu acceso ya no está disponible.', disabled: 'La vista preliminar no está habilitada.' }[mode];
      await page.getByText(message, { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: /Ver progreso/ }).count(), 0); assert.equal(await page.locator('textarea').count(), 0);
      if (mode === 'load-error') { await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await page.getByRole('link', { name: 'Ver progreso · A', exact: true }).waitFor(); }
      await context.close();
    });
    await test('session-less URL redirects; existing dashboard unaffected when disabled', async () => {
      const { page, context } = await pageAt(normal, '/facilitation', 'es', false); await page.waitForURL(/\/login$/); await context.close();
      const disabled = await build('disabled'), on = await pageAt(normal, '/app/dashboard'), off = await pageAt(disabled, '/app/dashboard');
      assert.equal(await on.page.locator('body').innerText(), await off.page.locator('body').innerText());
      await shot(off.page, 'dashboard-disabled'); await shot(on.page, 'dashboard-enabled');
      const baseline = process.env.ES35_BASELINE_DIST;
      if (baseline) { const base = await serve(path.resolve(baseline)), before = await pageAt(base, '/app/dashboard'); assert.equal(await before.page.locator('body').innerText(), await off.page.locator('body').innerText()); await shot(before.page, 'dashboard-baseline'); await before.context.close(); }
      await on.context.close(); await off.context.close();
    });
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    console.log('PASS zero API writes / zero page exceptions; builds=' + bases.size);
  } catch (error) {
    if (lastPage && !lastPage.isClosed()) { await shot(lastPage, 'failure'); fs.writeFileSync(path.join(artifacts, 'failure.txt'), await lastPage.locator('body').innerText()); }
    console.error(error); process.exitCode = 1;
  } finally { if (browser) await browser.close(); for (const server of servers) await new Promise(resolve => server.close(resolve)); }
})();
