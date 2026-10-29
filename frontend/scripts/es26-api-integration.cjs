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
  assert.ok(process.env.ES26_BACKEND_DIR, 'An isolated backend contract checkout is required');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES26_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es26-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es26-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es26_test', password, port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser;
  const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es26_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/career-context', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/careerContext'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions'); const tokenA = sessions.issueToken({ id: 101, role: 'user' }); const tokenB = sessions.issueToken({ id: 202, role: 'user' });
    function moduleUrl(file, replacements = []) {
      let code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
      for (const [from, to] of replacements) code = code.replaceAll(from, to);
      return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
    }
    const modelUrl = moduleUrl('src/compass/model.ts');
    const { compassApi } = await import(moduleUrl('src/compass/api.ts', [["'./model'", JSON.stringify(modelUrl)]]));
    const a = compassApi(apiUrl, tokenA); const b = compassApi(apiUrl, tokenB);
    assert.equal((await fetch(apiUrl + '/api/career-context')).status, 403);
    const fields = [{ key: 'interests', text: '  Synthetic professional context  ', origin: { type: 'direct' } }];
    const preview = await a.preview(fields, 'en');
    assert.deepEqual(preview.representation, [{ key: 'interests', text: 'Synthetic professional context' }]);
    assert.deepEqual(await a.read(), { active: null, versions: [] });
    check('real preview normalizes exact representation and persists no version');
    await assert.rejects(b.confirm({ fields, token: preview.token, requestId: 'synthetic-owner-b' }), { status: 409 });
    assert.deepEqual(await b.read(), { active: null, versions: [] });
    check('owner B cannot reuse A preview token or see A context');
    const body = { fields, token: preview.token, requestId: 'synthetic-owner-a' };
    const saved = await a.confirm(body); const repeated = await a.confirm(body);
    assert.deepEqual(saved, repeated); assert.equal((await a.read()).versions.length, 1);
    assert.deepEqual((await a.read()).active.fields, preview.representation);
    const engine = await fromBackend('./utils/careerContext').getApprovedContext(101, 'es26-test');
    assert.deepEqual(Object.keys(engine).sort(), ['approvedAt', 'fields', 'version']); assert.deepEqual(engine.fields, preview.representation);
    await assert.rejects(fromBackend('./utils/careerContext').getApprovedContext(202, 'es26-test'), { status: 404, code: 'no_context' });
    const encrypted = await fromBackend('./CareerContextVersion').findOne({ where: { UserId: 101, version: saved.version } });
    assert.match(encrypted.payload, /^v2:/); assert.doesNotMatch(encrypted.payload, /Synthetic professional context/);
    check('actual confirmation is idempotent; owner-scoped readback, encrypted storage and engine whitelist agree');
    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const frontend = process.env.ES26_PREVIEW_URL || 'http://127.0.0.1:4226'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    await page.addInitScript(token => { localStorage.setItem('elevation_token', token); localStorage.setItem('elv_lang', 'es'); }, tokenA);
    const methods = [];
    await page.route('**/api/career-context**', async route => {
      const url = new URL(route.request().url()); methods.push(route.request().method());
      const response = await route.fetch({ url: apiUrl + url.pathname }); await route.fulfill({ response });
    });
    await page.goto(frontend + '/app/compass');
    await page.getByLabel('Texto que quiero autorizar', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Texto que quiero autorizar', { exact: true }).inputValue(), '');
    await page.getByLabel('Selecciona una categoría', { exact: true }).selectOption('values');
    await page.getByLabel('Texto que quiero autorizar', { exact: true }).fill('  Synthetic work values  ');
    await page.getByLabel('Incluir en la autorización', { exact: true }).check();
    await page.getByRole('button', { name: 'Ver exactamente qué autorizo', exact: true }).click();
    await page.getByRole('heading', { name: 'Ver exactamente qué autorizo', exact: true }).waitFor();
    assert.ok(await page.getByText('Synthetic work values', { exact: true }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).isDisabled());
    await page.getByLabel('He revisado estos campos y autorizo su uso profesional.', { exact: true }).check();
    await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).click();
    await page.getByText('Autorización confirmada', { exact: true }).waitFor();
    const state = await a.read(); assert.equal(state.active.version, 2); assert.equal(state.versions[1].status, 'superseded');
    assert.deepEqual(state.active.fields, [{ key: 'values', text: 'Synthetic work values' }]);
    assert.deepEqual(await b.read(), { active: null, versions: [] });
    check('built React performs exact preview, explicit confirmation, complete replacement and real GET verification');
    await page.getByRole('button', { name: 'Retirar contexto vigente', exact: true }).click();
    await page.getByRole('button', { name: 'Retirar contexto', exact: true }).click();
    await page.getByText('Contexto retirado del uso profesional', { exact: true }).waitFor();
    assert.equal((await a.read()).active, null); assert.equal((await a.read()).versions[0].status, 'revoked');
    await assert.rejects(fromBackend('./utils/careerContext').getApprovedContext(101, 'es26-test'), { status: 404, code: 'no_context' });
    check('real UI withdrawal removes engine access, leaves history and does not expose another owner');
    await sessions.revokeToken(fromBackend('jsonwebtoken').decode(tokenA)); await page.reload();
    await page.getByText('Tu sesión venció. Inicia sesión para continuar.', { exact: true }).waitFor();
    assert.equal(await page.locator('textarea').count(), 0); assert.equal(await page.getByRole('heading', { name: 'Contexto actual', exact: true }).count(), 0);
    assert.ok(methods.every(method => ['GET', 'POST'].includes(method))); assert.deepEqual(errors, []);
    check('actual revoked JWT gets 401 and no private UI content; no other endpoints or methods');
    console.log(`ES-26 real API/browser: ${checks.length} checks passed. HTTP/JWT/ORM/crypto/PostgreSQL are real; no response mocks, model provider or production.`);
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop();
  }
})().catch(error => {
  console.error('ES-26 local integration failed:', error.name, error.message);
  // All resources were awaited in finally. Explicit status avoids the embedded
  // runtime's beforeExit hook replacing a natural exitCode with zero.
  process.exit(1);
});
