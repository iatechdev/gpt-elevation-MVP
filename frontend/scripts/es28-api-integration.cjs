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
  assert.ok(process.env.ES28_BACKEND_DIR, 'An isolated backend contract checkout is required');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES28_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es28-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es28-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es28_test', password, port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser;
  const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es28_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/evidence', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/evidence'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions'); const tokenA = sessions.issueToken({ id: 101, role: 'user' }); const tokenB = sessions.issueToken({ id: 202, role: 'user' });
    function moduleUrl(file, replacements = []) {
      let code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
      for (const [from, to] of replacements) code = code.replaceAll(from, to);
      return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
    }
    const modelUrl = moduleUrl('src/evidence/model.ts');
    const { evidenceApi } = await import(moduleUrl('src/evidence/api.ts', [["'./model'", JSON.stringify(modelUrl)]]));
    const a = evidenceApi(apiUrl, tokenA); const b = evidenceApi(apiUrl, tokenB);
    const body = { payload: { title: 'Synthetic draft', situation: 'Synthetic context' }, status: 'draft', requestId: 'es28-local-draft-0001' };
    const saved = await a.create(body); const repeated = await a.create(body);
    assert.deepEqual(saved, repeated); assert.equal((await a.list()).length, 1);
    check('real frontend serializer/client POST retry is idempotent in PostgreSQL');
    const detail = await a.detail(saved.id); assert.equal(detail.versions[0].status, 'draft');
    assert.deepEqual(await fromBackend('./utils/evidence').getConfirmedEvidence(101, 'es28-test'), []);
    check('saved draft is recovered by actual GET and is not consumed by the professional engine');
    await assert.rejects(b.detail(saved.id), { status: 404 }); assert.deepEqual(await b.list(), []);
    check('real owner B cannot read A by changing an evidence ID');
    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    const preview = process.env.ES28_PREVIEW_URL ?? 'http://127.0.0.1:4228'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(preview).hostname));
    await page.addInitScript(token => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); }, tokenA);
    const methods = [];
    await page.route('**/api/evidence**', async route => {
      const url = new URL(route.request().url()); methods.push(route.request().method());
      const response = await route.fetch({ url: apiUrl + url.pathname }); await route.fulfill({ response });
    });
    await page.goto(preview + '/app/evidence/new'); await page.locator('#title').fill('Synthetic confirmed');
    await page.locator('#situation').fill('Synthetic situation'); await page.locator('#responsibility').fill('Synthetic personal contribution');
    await page.locator('#actions-0').fill('Synthetic action'); await page.locator('#goal').fill('The goal was 10,000'); await page.locator('#delivered').fill('A synthetic prototype');
    await page.getByRole('radio', { name: 'No lo conozco', exact: true }).check(); await page.getByRole('button', { name: 'Revisar para confirmar', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Confirmar evidencia', exact: true }).isDisabled());
    await page.getByRole('checkbox', { name: 'He revisado esta evidencia.' }).check(); await page.getByRole('button', { name: 'Confirmar evidencia', exact: true }).click();
    await page.getByRole('heading', { name: 'Evidencia confirmada', exact: true }).waitFor();
    const confirmed = (await a.list()).find(row => row.status === 'confirmed'); assert.ok(confirmed);
    assert.equal(confirmed.payload.goal, 'The goal was 10,000'); assert.equal(confirmed.payload.delivered.text, 'A synthetic prototype'); assert.deepEqual(confirmed.payload.observedEffect, { known: false });
    check('built React preview/explicit confirmation uses real POST and readback; goal, delivery and unknown effect remain separate');
    const engine = await fromBackend('./utils/evidence').getConfirmedEvidence(101, 'es28-test'); assert.equal(engine.length, 1); assert.equal(engine[0].evidenceId, confirmed.id);
    const encrypted = await fromBackend('./EvidenceVersion').findOne({ where: { EvidenceId: confirmed.id, version: 1 } });
    assert.match(encrypted.payload, /^v2:/); assert.doesNotMatch(encrypted.payload, /Synthetic confirmed/);
    await b.create({ payload: { title: 'SYNTHETIC_B_ONLY', situation: 'B synthetic context' }, status: 'draft', requestId: 'es28-local-draft-b-001' });
    assert.doesNotMatch(JSON.stringify(await a.list()), /SYNTHETIC_B_ONLY/);
    check('only confirmed version enters the engine; encrypted storage and real A/B lists are isolated');
    await sessions.revokeToken(fromBackend('jsonwebtoken').decode(tokenA)); await page.getByRole('link', { name: 'Volver a mis evidencias', exact: true }).click();
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).waitFor(); assert.equal(await page.getByRole('article').count(), 0);
    assert.ok(methods.every(method => ['GET', 'POST'].includes(method))); assert.deepEqual(errors, []);
    check('actual session revocation yields 401 with no private records; UI sends no PUT/DELETE');
    console.log(`Real API/browser integration: ${checks.length} checks passed. JWT/HTTP/ORM/crypto/Postgres are real; all data are synthetic; no provider or production verified.`);
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop();
  }
})().catch(error => {
  console.error('ES-28 local integration failed:', error.name, error.message);
  // All resources were awaited in finally. Explicit status avoids the embedded
  // runtime's beforeExit hook replacing a natural exitCode with zero.
  process.exit(1);
});
