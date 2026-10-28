// Navegador real sobre builds compilados. Datos sintéticos; ninguna escritura API está autorizada por este arnés.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const http = require('node:http'); const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), artifacts = path.join(root, 'node_modules/.es34-artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const servers = [], failures = [], writes = []; let browser, lastPage;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const date = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
async function serve(directory) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(directory, '.' + pathname);
    if (file !== directory && !file.startsWith(directory + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(directory, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
async function build(mode) {
  const directory = path.resolve(root, 'node_modules', '.es34-build-' + mode);
  assert.equal(path.dirname(directory), path.join(root, 'node_modules')); assert.match(path.basename(directory), /^\.es34-build-[a-z-]+$/);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', directory, '--emptyOutDir'], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_CAREER_PREVIEW: mode === 'disabled' ? 'false' : 'true', VITE_CAREER_FIXTURE_SCENARIO: mode === 'disabled' ? 'normal' : mode, VITE_BACKEND_URL: '' } });
  assert.equal(result.status, 0, result.stderr || result.stdout); return serve(directory);
}
async function pageAt(base, pathname = '/app/next-step', locale = 'es') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ locale }) => { localStorage.setItem('elevation_token', 'synthetic-session-a'); localStorage.setItem('elv_lang', locale); }, { locale });
  await context.route('**/api/**', route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() !== 'GET') { writes.push({ method: request.method(), pathname }); return route.abort(); }
    const body = pathname === '/api/recommendations' || pathname === '/api/messages' ? [] : pathname === '/api/user/progress' ? { moodLogs: [] } : pathname === '/api/user/plan/me' ? { plan: null, limits: null } : { session: null, therapist: null };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(8000); page.on('pageerror', error => failures.push(error.message)); await page.goto(base + pathname); await page.waitForLoadState('networkidle'); return { context, page };
}
async function constraints(page) {
  await page.getByRole('checkbox', { name: 'Colombia', exact: true }).check(); await page.getByRole('checkbox', { name: 'Dinamarca', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Español', exact: true }).check(); await page.getByRole('checkbox', { name: 'Inglés', exact: true }).check();
  await page.getByLabel('Contexto de origen (opcional)').selectOption('education');
  await page.getByRole('group', { name: 'Contextos de interés', exact: true }).getByRole('checkbox', { name: 'Análisis', exact: true }).check();
  await page.getByRole('button', { name: 'Guardar restricciones', exact: true }).click();
}
async function reasonOf(button, text) {
  assert.equal(await button.isDisabled(), true);
  const id = await button.getAttribute('aria-describedby'); assert.ok(id, 'el botón deshabilitado no enlaza su motivo');
  assert.equal((await button.page().locator('[id="' + id + '"]').textContent()).trim(), text);
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true }); }
async function test(name, fn) { await fn(); console.log('PASS ' + name); }
async function main() {
  browser = await chromium.launch({ headless: true });
  const disabled = await build('disabled');
  await test('defecto apagado: entrada ausente y URL sin datos/controles', async () => {
    const { context, page } = await pageAt(disabled, '/app/dashboard'); assert.equal(await page.locator('.career-entry').count(), 0);
    await screenshot(page, 'dashboard-disabled');
    await page.goto(disabled + '/app/next-step'); await page.getByText('Este recorrido aún no está disponible.', { exact: true }).waitFor(); assert.equal(await page.locator('.career-grid').count(), 0);
    // QA-34 obs. 4: sin bandera no se muestran las pestañas del recorrido antes del aviso.
    assert.equal(await page.locator('.career-scope nav').count(), 0); await context.close();
  });
  const normal = await build('normal');
  await test('dashboard: una tarjeta nueva; dimensiones de widgets existentes preservadas', async () => {
    const { context, page } = await pageAt(normal, '/app/dashboard'); await page.locator('.career-entry').waitFor(); assert.equal(await page.locator('.career-entry').count(), 1); await screenshot(page, 'dashboard-preview');
    if (process.env.ES34_BASELINE_DIST) {
      const baseline = await serve(path.resolve(process.env.ES34_BASELINE_DIST)); const old = await pageAt(baseline, '/app/dashboard');
      const dimensions = p => p.locator('div[style*="grid-template-columns"]').first().evaluate(el => [...el.children].filter(child => !child.classList.contains('career-entry')).map(child => ({ width: Math.round(child.getBoundingClientRect().width), text: child.textContent })));
      assert.deepEqual(await dimensions(page), await dimensions(old.page)); await screenshot(old.page, 'dashboard-baseline'); await old.context.close();
    }
    await page.locator('.career-entry a').click(); await page.getByText('Tus restricciones', { exact: true }).waitFor(); await context.close();
  });
  await test('recorrido ES completo: restricciones, elección, entrega, reflexión, solicitud y plan', async () => {
    const { context, page } = await pageAt(normal); await constraints(page); await page.waitForFunction(() => document.querySelectorAll('.career-grid article').length === 3);
    await screenshot(page, 'routes-desktop');
    const first = page.locator('.career-grid article').first(); await first.getByRole('button', { name: 'Elegir esta ruta', exact: true }).click();
    await first.getByRole('button', { name: 'Revisar y aceptar experimento', exact: true }).click(); await page.waitForURL(/\/experiments\/\d+$/);
    await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
    // QA-34 obs. 2: el envío vacío muestra el aviso de la aplicación (sin validación nativa que lo oculte).
    await page.getByRole('button', { name: 'Guardar entrega', exact: true }).click(); await page.getByText('Revisa los campos obligatorios y la selección.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reintentar lectura', exact: true }).count(), 0, 'un error de validación no ofrece reintentar la lectura');
    await page.getByLabel('Muestra escrita', { exact: true }).fill('SYNTHETIC SAMPLE — no personal data'); await page.getByLabel('Ayuda utilizada', { exact: true }).selectOption('drafting');
    await page.getByRole('button', { name: 'Guardar entrega', exact: true }).click(); await page.getByLabel('Observación', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: /Seleccionar esta muestra/ }).check(); await page.getByRole('button', { name: 'Solicitar revisión', exact: true }).click(); await page.getByText('Solicitud pendiente de autorización; material aún no compartido.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retirar solicitud', exact: true }).click();
    await page.getByLabel('Observación', { exact: true }).fill('Synthetic observation'); await page.getByLabel('Interpretación', { exact: true }).fill('Synthetic interpretation');
    await page.getByRole('button', { name: 'Guardar mi reflexión', exact: true }).click();
    await page.getByLabel('Decisión', { exact: true }).selectOption('continue'); await page.getByLabel('Razón de tu decisión', { exact: true }).fill('Synthetic reason');
    await page.getByRole('button', { name: 'Guardar decisión', exact: true }).click(); await screenshot(page, 'experiment');
    await page.getByRole('button', { name: 'Proponer plan', exact: true }).click(); await page.waitForURL(/\/plan$/);
    // QA-34 obs. 2: el botón deshabilitado enlaza su motivo con aria-describedby.
    // Se espera a la pantalla del plan: justo tras el cambio de URL sigue montado, un instante, el «Proponer plan» (habilitado) de la pantalla anterior.
    await page.getByLabel('Experimento', { exact: true }).waitFor();
    await reasonOf(page.getByRole('button', { name: 'Proponer plan', exact: true }), 'Elige un experimento para proponer un plan.');
    await page.getByLabel('Experimento', { exact: true }).selectOption({ index: 1 }); await page.getByRole('button', { name: 'Proponer plan', exact: true }).click();
    for (const [i, horizon] of [7, 30, 90].entries()) {
      const group = page.getByRole('group', { name: `${horizon} días`, exact: true }); await group.getByRole('checkbox', { name: 'Aceptar acción', exact: true }).check(); await group.getByLabel('Fecha elegida', { exact: true }).fill(date([3, 20, 70][i]));
    }
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar plan', exact: true }).click();
    await page.getByRole('heading', { name: /Plan aceptado · Versión/ }).waitFor(); await screenshot(page, 'plan-accepted');
    // Cancela una edición de entrega sin mutar el plan; los recordatorios requieren dos intenciones separadas.
    await page.getByRole('checkbox', { name: 'Permitir notificaciones en esta simulación', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('label')].some(label => label.textContent.includes('Permitir notificaciones en esta simulación') && label.querySelector('input')?.checked));
    const reminder = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Recordatorio dentro de la app', exact: true }) });
    await reminder.getByLabel('Aceptar acción', { exact: true }).selectOption('7'); await reminder.getByLabel('Hora local elegida', { exact: true }).fill(date(3) + 'T09:00');
    await reminder.getByRole('checkbox', { name: 'Aceptar recordatorio', exact: true }).check(); await reminder.getByRole('button', { name: 'Aceptar recordatorio', exact: true }).click();
    await page.getByText(date(3) + 'T09:00 · America/Bogota', { exact: true }).waitFor();
    const pending = page.locator('section').filter({ has: page.getByText(date(3) + 'T09:00 · America/Bogota', { exact: true }) }).last();
    assert.equal(await pending.getByRole('button', { name: 'Acusar recibo', exact: true }).isDisabled(), true);
    await reasonOf(pending.getByRole('button', { name: 'Acusar recibo', exact: true }), 'Disponible desde la hora elegida.');
    await page.clock.setFixedTime(new Date(Date.now() + 4 * 86400000));
    await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByRole('button', { name: 'Español', exact: true }).click();
    await pending.getByRole('button', { name: 'Acusar recibo', exact: true }).click(); await page.getByText('No hay recordatorios pendientes.', { exact: true }).waitFor();
    const progress = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Registrar finalización', exact: true }) });
    await progress.getByLabel('Aceptar acción', { exact: true }).selectOption('7'); await progress.getByLabel('Evidencia de finalización', { exact: true }).fill('Synthetic completion');
    await progress.getByRole('button', { name: 'Registrar finalización', exact: true }).click(); await page.getByText('Finalización declarada:', { exact: false }).first().waitFor();
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['elevation_token', 'elv_lang']);
    await page.reload(); await page.getByText('No hay un plan aceptado. Guarda una decisión para proponerlo.', { exact: true }).waitFor(); await context.close();
  });
  await test('responsive, tema oscuro, zoom, foco visible, ES/EN y cancelación de salida/Atrás', async () => {
    const { context, page } = await pageAt(normal); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Saltar al contenido'); assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth), '3px'); await page.keyboard.press('Enter');
    for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.locator('.career-scope').evaluate(el => el.scrollWidth <= window.innerWidth + 1)); }
    await page.setViewportSize({ width: 375, height: 1000 }); await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await screenshot(page, 'mobile-dark');
    assert.ok(await page.locator('.career-scope label').evaluateAll(labels => labels.every(label => label.getBoundingClientRect().height >= 44 && parseFloat(getComputedStyle(label).fontSize) >= 16)));
    assert.ok(await page.locator('.career-scope input[type=checkbox]').evaluateAll(inputs => inputs.every(input => input.getBoundingClientRect().width >= 20)));
    assert.ok(await page.locator('.career-scope button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44 && getComputedStyle(button).animationName === 'none')));
    assert.equal(await page.locator('.career-scope').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(24, 28, 23)');
    await page.getByRole('checkbox', { name: 'Colombia', exact: true }).check(); await page.getByRole('button', { name: 'English', exact: true }).click(); assert.equal(await page.getByRole('checkbox', { name: 'Colombia', exact: true }).isChecked(), true);
    await page.getByRole('link', { name: 'Experiments', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); await page.keyboard.press('Escape'); assert.equal(await page.getByRole('checkbox', { name: 'Colombia', exact: true }).isChecked(), true);
    await page.getByRole('link', { name: 'Experiments', exact: true }).click(); await dialog.getByRole('button', { name: 'Leave without saving', exact: true }).click(); await page.waitForURL(/\/experiments$/);
    await page.getByRole('link', { name: 'Routes', exact: true }).click(); await page.getByRole('checkbox', { name: 'Colombia', exact: true }).check();
    await page.goBack(); await dialog.waitFor(); await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click(); assert.match(page.url(), /\/next-step$/);
    await page.setViewportSize({ width: 768, height: 1000 }); await page.locator('body').evaluate(el => el.style.zoom = '2'); assert.ok(await page.locator('.career-scope').evaluate(el => el.scrollWidth <= window.innerWidth / 2 + 1)); await screenshot(page, 'zoom-200'); await page.locator('body').evaluate(el => el.style.zoom = '');
    await page.evaluate(() => { localStorage.setItem('elevation_token', 'synthetic-session-b'); window.dispatchEvent(new Event('storage')); }); await sleep(100);
    assert.equal(await page.getByRole('checkbox', { name: 'Colombia', exact: true }).isChecked(), false); await context.close();
  });
  await test('recorrido EN hasta plan aceptado sin textos residuales de controles ES', async () => {
    const { context, page } = await pageAt(normal, '/app/next-step', 'en');
    for (const name of ['Colombia', 'Denmark', 'Spanish', 'English']) await page.getByRole('checkbox', { name, exact: true }).check();
    await page.getByLabel('Starting context (optional)', { exact: true }).selectOption('education'); await page.getByRole('group', { name: 'Contexts of interest', exact: true }).getByRole('checkbox', { name: 'Analysis', exact: true }).check();
    await page.getByRole('button', { name: 'Save constraints', exact: true }).click(); const card = page.locator('.career-grid article').first(); await card.getByRole('button', { name: 'Choose this route', exact: true }).click(); await card.getByRole('button', { name: 'Review and accept experiment', exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click(); await page.getByLabel('Written sample', { exact: true }).fill('SYNTHETIC EN sample'); await page.getByLabel('Assistance used', { exact: true }).selectOption('none'); await page.getByRole('button', { name: 'Save submission', exact: true }).click();
    await page.getByLabel('Observation', { exact: true }).fill('Synthetic EN observation'); await page.getByLabel('Interpretation', { exact: true }).fill('Synthetic EN interpretation'); await page.getByRole('button', { name: 'Save my reflection', exact: true }).click();
    await page.getByLabel('Decision', { exact: true }).selectOption('adjust'); await page.getByLabel('Reason for your decision', { exact: true }).fill('Synthetic EN reason'); await page.getByRole('button', { name: 'Save decision', exact: true }).click(); await page.getByRole('button', { name: 'Propose plan', exact: true }).click();
    await page.getByLabel('Experiment', { exact: true }).selectOption({ index: 1 }); await page.getByRole('button', { name: 'Propose plan', exact: true }).click();
    for (const [i, horizon] of [7, 30, 90].entries()) { const group = page.getByRole('group', { name: `${horizon} days`, exact: true }); await group.getByRole('checkbox', { name: 'Accept action', exact: true }).check(); await group.getByLabel('Chosen date', { exact: true }).fill(date([3, 20, 70][i])); }
    await page.getByRole('button', { name: 'Review selection', exact: true }).click(); await page.getByRole('button', { name: 'Confirm plan', exact: true }).click(); await page.getByRole('heading', { name: /Accepted plan · Version/ }).waitFor();
    const text = await page.locator('.career-scope').innerText(); assert.ok(!/Guardar|Por confirmar|Interpretación|Proponer plan/.test(text)); await screenshot(page, 'plan-en'); await context.close();
  });
  for (const mode of ['save-error', 'lost-ack', 'conflict', 'pending', 'load-error']) {
    const base = await build(mode);
    await test('escenario compilado ' + mode, async () => {
      const { context, page } = await pageAt(base);
      if (mode === 'pending') await page.getByText('El contrato del servicio está pendiente. No hay un resultado confirmado.', { exact: true }).waitFor();
      else if (mode === 'load-error') await page.getByText('No pudimos cargar los datos. No hay un resultado confirmado.', { exact: true }).waitFor();
      else {
        await constraints(page);
        if (mode === 'lost-ack') { await page.getByText('No pudimos comprobar si se guardó. Recupera el estado antes de repetir.', { exact: true }).waitFor(); assert.equal(await page.locator('.career-grid').count(), 0); await page.getByRole('button', { name: 'Recuperar estado de la simulación', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.career-grid article').length === 3); }
        else { await page.getByText(mode === 'conflict' ? 'La versión o el fundamento cambió. Recupera y revisa el estado.' : 'No se confirmó el guardado. Tu borrador sigue aquí.', { exact: true }).waitFor(); assert.equal(await page.getByRole('checkbox', { name: 'Colombia', exact: true }).isChecked(), true); assert.equal(await page.locator('.career-grid').count(), 0); }
      }
      await context.close();
    });
  }
  assert.deepEqual(writes, []); assert.deepEqual(failures, []); console.log('PASS cero escrituras API y cero excepciones JavaScript');
}
main().catch(async error => { console.error(error); if (lastPage && !lastPage.isClosed()) { await screenshot(lastPage, 'failure'); fs.writeFileSync(path.join(artifacts, 'failure.txt'), await lastPage.locator('body').innerText()); } process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }))); });
