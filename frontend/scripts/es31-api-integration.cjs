// Optional integration with an isolated main/ES-27 checkout. No backend edits,
// existing DATABASE_URL, .env, production data or external model provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
(async () => {
  assert.ok(process.env.ES31_BACKEND_DIR, 'An isolated backend contract checkout is required');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES31_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es31-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es31-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es31_test', password, port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser;
  const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es31_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const databaseModuleId = fromBackend.resolve('./database'); require.cache[databaseModuleId] = { id: databaseModuleId, filename: databaseModuleId, loaded: true, exports: { sequelize } };
    for (const name of ['RouteCatalog', 'RouteCatalogItem', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/route-catalog', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/routeCatalog')); app.use('/api/admin/route-catalog', fromBackend('./middlewares/auth').verificarAdmin, fromBackend('./routes/routeCatalogAdmin'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions'); const adminToken = sessions.issueToken({ id: 101, role: 'admin' }); const userToken = sessions.issueToken({ id: 202, role: 'user' });
    function moduleUrl(file, replacements = []) {
      let code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
      for (const [from, to] of replacements) code = code.replaceAll(from, to);
      return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
    }
    const schemaUrl = moduleUrl('src/routeCatalog/schema.ts');
    const { catalogApi } = await import(moduleUrl('src/routeCatalog/api.ts', [["'./schema'", JSON.stringify(schemaUrl)]]));
    const { canonical } = await import(schemaUrl);
    const admin = catalogApi(apiUrl, adminToken); const user = catalogApi(apiUrl, userToken);
    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const frontend = process.env.ES31_PREVIEW_URL || 'http://127.0.0.1:4231'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    await page.addInitScript(token => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es'); }, adminToken);
    let fault = ''; const writes = [];
    await page.route('**/api/**', async route => {
      const request = route.request(); const url = new URL(request.url()); const method = request.method();
      assert.ok(url.pathname.includes('route-catalog'), 'UI must not request private APIs');
      if (method !== 'GET') writes.push({ method, path: url.pathname, body: request.postDataJSON() });
      if (fault === 'abortSave' && method === 'PUT') { fault = 'failRead'; return route.abort('failed'); }
      if (fault === 'failRead' && method === 'GET') { fault = ''; return route.fulfill({ status: 503, json: { code: 'catalog_failed' } }); }
      const response = await route.fetch({ url: apiUrl + url.pathname });
      if (fault === 'lostSave' && method === 'PUT') { fault = ''; return route.abort('failed'); }
      await route.fulfill({ response });
    });
    await page.goto(frontend + '/app/route-catalog'); await page.getByText('El catálogo aún no está disponible.', { exact: true }).waitFor();
    assert.equal((await fetch(apiUrl + '/api/admin/route-catalog')).status, 403);
    await assert.rejects(user.list(), { status: 403 }); await assert.rejects(user.create(), { status: 403 });
    check('empty published catalog is a real 503 state; anonymous/user cannot administer');
    await page.goto(frontend + '/admin/route-catalog'); await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
    await page.waitForURL(/\/admin\/route-catalog\/\d+$/); const id = Number(page.url().split('/').pop());
    assert.equal((await admin.get(id)).status, 'draft'); await assert.rejects(user.get(id), { status: 403 });
    for (const method of ['PUT', 'DELETE', 'POST']) {
      const endpoint = method === 'POST' ? `/${id}/publish` : `/${id}/contexts/ctx_foreign`;
      const response = await fetch(apiUrl + '/api/admin/route-catalog' + endpoint, { method, headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' }, ...(method === 'PUT' ? { body: '{}' } : {}) }); assert.equal(response.status, 403);
    }
    check('React creates actual draft; changing admin catalog ID grants no GET/PUT/DELETE/publish access to a user');
    await page.getByRole('button', { name: 'Añadir elemento · Contextos', exact: true }).click();
    await page.locator('#item-key').fill('new'); await page.locator('#item-labels-es').fill('Contexto sintético nuevo'); await page.locator('#item-labels-en').fill('New synthetic context');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.waitForURL(new RegExp(`/contexts/new$`));
    await page.getByRole('button', { name: 'Quitar elemento', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Quitar elemento', exact: true }).click();
    await page.waitForURL(new RegExp(`/route-catalog/${id}$`)); assert.equal((await admin.get(id)).items.contexts.length, 0);
    await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await page.getByText('Faltan datos para publicar.', { exact: true }).waitFor(); assert.equal((await admin.get(id)).status, 'draft');
    check('new item key literally new works; confirmed deletion is real and empty publication is rejected');
    const seed = fromBackend('./seeds/routeCatalogSynthetic.cjs').build();
    for (const [kind, items] of Object.entries(seed)) for (const [key, body] of Object.entries(items)) await admin.save(id, kind, key, body);
    const cases = [['contexts', 'ctx_educacion_formacion', '#item-labels-es'], ['sources', 'src_oficial_a', '#item-title'], ['roles', 'formador_corporativo', '#item-labels-es'], ['offers', 'oferta_formador_vigente', '#item-title'], ['resources', 'rec_comunicacion', '#item-title']];
    for (const [kind, key, selector] of cases) {
      const before = (await admin.get(id)).items[kind].find(row => row.itemKey === key);
      await page.goto(`${frontend}/admin/route-catalog/${id}/${kind}/${key}`); const input = page.locator(selector); await input.waitFor();
      const changed = (await input.inputValue()) + ' UI'; await input.fill(changed); await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('Guardado en el borrador', { exact: true }).waitFor();
      const after = (await admin.get(id)).items[kind].find(row => row.itemKey === key); const expected = structuredClone(before); if (selector.includes('labels')) expected.labels.es = changed; else expected.title = changed;
      assert.equal(canonical(after), canonical(expected)); assert.equal(after.synthetic, true);
      if (kind === 'roles') {
        await page.setViewportSize({ width: 375, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'role editor mobile');
        if (process.env.ES31_SCREENSHOT_DIR) { fs.mkdirSync(process.env.ES31_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.ES31_SCREENSHOT_DIR, 'catalog-role-editor-375.png'), fullPage: true }); }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
    check('all five structured editors save full existing bodies without dropping references, zero prices or synthetic flags');
    const contextUrl = `${frontend}/admin/route-catalog/${id}/contexts/ctx_educacion_formacion`;
    await page.goto(contextUrl); await page.locator('#item-labels-es').fill('Sintético tras ACK perdido'); fault = 'lostSave'; const beforeLost = writes.length;
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('No pudimos verificar el resultado. Consulta la versión guardada antes de repetir.', { exact: true }).waitFor();
    assert.equal(writes.length, beforeLost + 1); assert.equal(await page.locator('#item-labels-es').inputValue(), 'Sintético tras ACK perdido');
    assert.equal((await admin.get(id)).items.contexts.find(row => row.itemKey === 'ctx_educacion_formacion').labels.es, 'Sintético tras ACK perdido');
    check('lost save acknowledgment performs GET recovery with no repeated mutation or false saved status');
    await page.locator('#item-labels-es').fill('Sintético local no persistido'); fault = 'abortSave'; const beforeAbort = writes.length;
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('No pudimos verificar el resultado. Consulta la versión guardada antes de repetir.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await page.locator('#item-labels-es').waitFor();
    assert.equal(await page.locator('#item-labels-es').inputValue(), 'Sintético local no persistido'); assert.equal(writes.length, beforeAbort + 1);
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('Guardado en el borrador', { exact: true }).waitFor();
    check('failed write/readback blocks new writes until read recovery and keeps local unpersisted text');
    await page.locator('#item-labels-es').fill('Será reemplazado por la IA'); await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await page.getByText('Reformula el texto: el catálogo no admite porcentajes en descripciones ni afirmaciones de reemplazo por IA.', { exact: true }).waitFor();
    assert.equal(await page.locator('#item-labels-es').inputValue(), 'Será reemplazado por la IA');
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Volver a la versión', exact: true }).click();
    await page.waitForURL(new RegExp(`/route-catalog/${id}$`));
    await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await page.getByText('No se puede publicar contenido de prueba en este entorno.', { exact: true }).waitFor();
    assert.equal((await admin.get(id)).status, 'draft');
    check('actual 422 text policy preserves draft; server refuses synthetic publication without test flag');
    process.env.ALLOW_SYNTHETIC_CATALOG = 'true';
    await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await page.getByText('Versión publicada y comprobada.', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Revisar publicación', exact: true }).count(), 0);
    const open = await user.published(); assert.equal(open.version, 1); assert.ok(open.sources.some(source => source.stale)); assert.ok(open.offers.some(offer => offer.status === 'expired'));
    for (const source of open.sources) assert.equal(source.consultedBy, undefined); for (const role of open.roles) assert.equal(role.review, undefined); for (const offer of open.offers) assert.equal(offer.verification, undefined);
    check('confirmed publication is verified from published API, immutable and excludes reviewer names for participants');
    await page.goto(frontend + '/app/route-catalog'); await page.getByRole('link', { name: 'Ver ficha', exact: true }).first().waitFor();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow at ' + width);
      if (process.env.ES31_SCREENSHOT_DIR) { fs.mkdirSync(process.env.ES31_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.ES31_SCREENSHOT_DIR, `catalog-${width}.png`), fullPage: true }); }
    }
    await page.getByLabel('Mercado', { exact: true }).selectOption('DK'); assert.equal(await page.getByRole('link', { name: 'Ver ficha', exact: true }).count(), open.roles.filter(role => role.market === 'DK').length);
    await page.getByRole('button', { name: 'EN', exact: true }).click(); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.getByRole('heading', { name: 'Route catalog', exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.goto(frontend + '/app/route-catalog/roles/formador_corporativo'); await page.getByText('Salario no publicado', { exact: true }).waitFor(); await page.getByText('Precio: 0 COP', { exact: true }).waitFor();
    await page.getByText('Precio: Precio por confirmar', { exact: true }).waitFor();
    await page.goto(frontend + '/app/route-catalog/roles/exito_cliente'); await page.getByText('Verificación vencida', { exact: true }).waitFor();
    await page.goto(frontend + '/app/route-catalog/roles/no_such_role'); await page.getByText('Ficha no encontrada.', { exact: true }).waitFor();
    check('published profiles use real dates/statuses, missing salary/price and zero correctly; filters, ES/EN, responsive and zoom');
    await page.goto(`${frontend}/admin/route-catalog/${id}/roles/formador_corporativo`); await page.locator('#item-labels-es').waitFor(); assert.ok(await page.locator('#item-labels-es').isDisabled());
    assert.equal(await page.getByRole('button', { name: 'Guardar borrador', exact: true }).isEnabled(), false);
    check('published version editor is read-only');
    await page.goto(frontend + '/admin/route-catalog'); await page.getByRole('button', { name: 'Crear borrador', exact: true }).click(); await page.waitForURL(/\/admin\/route-catalog\/\d+$/); const secondId = Number(page.url().split('/').pop());
    assert.equal((await admin.get(secondId)).version, 2); assert.equal((await user.published()).version, 1);
    await page.getByRole('button', { name: 'Editar · ctx_educacion_formacion', exact: true }).click(); await page.locator('#item-labels-es').fill('Borrador local sin guardar');
    page.once('dialog', dialog => dialog.dismiss()); await page.goBack(); await page.waitForURL(/\/contexts\/ctx_educacion_formacion$/); assert.equal(await page.locator('#item-labels-es').inputValue(), 'Borrador local sin guardar');
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.waitForURL(new RegExp(`/route-catalog/${secondId}$`));
    await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.goto(frontend + '/app/route-catalog'); await page.getByRole('link', { name: 'Ver ficha', exact: true }).first().waitFor(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'catalog-skip'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-main');
    check('new draft copies published version without exposing it; canceled Back keeps draft, Escape and keyboard skip work');
    const impersonated = await browser.newPage(); await impersonated.addInitScript(token => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es'); }, userToken);
    await impersonated.route('**/api/**', async route => { const response = await route.fetch({ url: apiUrl + new URL(route.request().url()).pathname }); await route.fulfill({ response }); });
    await impersonated.goto(`${frontend}/admin/route-catalog/${id}`); await impersonated.getByText('No tienes permiso para administrar el catálogo.', { exact: true }).waitFor(); assert.equal(await impersonated.locator('input').count(), 0); await impersonated.close();
    await page.goto(`${frontend}/admin/route-catalog/${secondId}/contexts/ctx_educacion_formacion`); await page.locator('#item-labels-es').fill('Sintético no guardado al revocar sesión');
    await sessions.revokeToken(fromBackend('jsonwebtoken').decode(adminToken)); await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('Tu sesión venció. Inicia sesión para continuar.', { exact: true }).waitFor(); assert.equal(await page.locator('input').count(), 0);
    assert.deepEqual(errors, []); check('fake local admin role cannot bypass server authorization; revoked JWT removes editorial data');
    console.log(`ES-31 real API/browser: ${checks.length} checks passed. Real Express/JWT/ORM/PostgreSQL; only two intentional network/readback faults, no model provider or production.`);
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop();
  }
})().catch(error => {
  console.error('ES-31 local integration failed:', error.name, error.message);
  // All resources were awaited in finally. Explicit status avoids the embedded
  // runtime's beforeExit hook replacing a natural exitCode with zero.
  process.exit(1);
});
