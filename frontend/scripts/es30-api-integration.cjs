// Optional integration with an isolated ES-29 backend checkout. No backend source
// edits, .env, existing DATABASE_URL or external provider. PostgreSQL is disposable.
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
  assert.ok(process.env.ES30_BACKEND_DIR, 'ES30_BACKEND_DIR must point at an isolated ES-29 contract checkout');
  const backend = path.resolve(process.env.ES30_BACKEND_DIR);
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  assert.ok(fs.existsSync(path.join(backend, 'routes/skillMap.js')), 'Skill Map backend contract required');
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'es30-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent);
  assert.ok(path.basename(directory).startsWith('es30-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); });
  });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es30_test', password, port,
    persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser;
  const checks = [];
  const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es30_test:${password}@127.0.0.1:${port}/postgres`, {
      logging: false, dialectOptions: { ssl: false },
    });
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database');
    require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'RevokedToken', 'AuthRevocation']) fromBackend('./' + name);
    await sequelize.sync();
    const catalog = fromBackend('./utils/skillCatalog');
    const evidence = fromBackend('./utils/evidence');
    const skillMap = fromBackend('./utils/skillMap');
    const sessions = fromBackend('./utils/sessions');
    const express = fromBackend('express');
    const app = express();
    app.use('/api/skill-map', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/skillMap'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const api = `http://127.0.0.1:${server.address().port}`;
    const tokenA = sessions.issueToken({ id: 101, role: 'user' });
    const tokenB = sessions.issueToken({ id: 202, role: 'user' });
    function moduleUrl(file, replacements = []) {
      let code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      }).outputText;
      for (const [from, to] of replacements) code = code.replaceAll(from, to);
      return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
    }
    const modelUrl = moduleUrl('src/skill-map/model.ts');
    const { readSkillMap } = await import(moduleUrl('src/skill-map/api.ts', [["'./model'", JSON.stringify(modelUrl)]]));
    await assert.rejects(readSkillMap({ baseUrl: api, token: tokenA }), { reason: 'catalog_unavailable' });
    check('actual GET without a published catalog returns the expected frontend state');
    const draft = await catalog.createDraft();
    await catalog.upsertSkill(draft.id, 'synthetic_skill', { type: 'transversal', labels: { es: 'Capacidad sintética local', en: 'Local synthetic skill' },
      rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `Criterio sintético ${n}`, en: `Synthetic criterion ${n}` }])),
        source: 'Synthetic test fixture — not a real verified source', verifiedBy: 'Synthetic local test', verifiedAt: '2026-10-01' } });
    await catalog.publish(draft.id, 101); // Only this disposable synthetic database.
    const evBody = (owner, autonomy, requestId) => ({ status: 'confirmed', requestId, payload: {
      title: `Synthetic ${owner}`, situation: 'Synthetic situation', responsibility: { text: 'Synthetic responsibility' },
      actions: [{ text: 'Synthetic action' }], delivered: { text: 'Synthetic delivery' }, observedEffect: { known: false }, autonomy,
    } });
    const ea = await evidence.create(101, evBody('A', 'autonomous', 'es30-evidence-a-0001'));
    const eb = await evidence.create(202, evBody('B', 'leads', 'es30-evidence-b-0001'));
    await skillMap.selfAssess(101, { skillKey: 'synthetic_skill', level: 2, evidenceRefs: [{ evidenceId: ea.id, version: 1 }], rationale: 'SYNTHETIC_A_ONLY', requestId: 'es30-assessment-a-0001' });
    await skillMap.selfAssess(202, { skillKey: 'synthetic_skill', level: 4, evidenceRefs: [{ evidenceId: eb.id, version: 1 }], rationale: 'SYNTHETIC_B_ONLY', requestId: 'es30-assessment-b-0001' });
    const mapA = await readSkillMap({ baseUrl: api, token: tokenA });
    const mapB = await readSkillMap({ baseUrl: api, token: tokenB });
    assert.equal(mapA.skills[0].self.level, 2); assert.equal(mapB.skills[0].self.level, 4);
    assert.doesNotMatch(JSON.stringify(mapA), /SYNTHETIC_B_ONLY/);
    check('actual frontend DTO validator/client accepts real HTTP/JWT/Sequelize/Postgres response and isolates A/B');
    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const exceptions = []; page.on('pageerror', error => exceptions.push(error.message));
    const preview = process.env.ES30_PREVIEW_URL ?? 'http://127.0.0.1:4230';
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(preview).hostname));
    await page.addInitScript(({ token }) => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); }, { token: tokenA });
    // Transparent local proxy only; the response comes from the actual backend.
    let reads = 0;
    await page.route('**/api/skill-map', async route => {
      assert.equal(route.request().method(), 'GET'); reads++;
      const response = await route.fetch({ url: api + '/api/skill-map' });
      await route.fulfill({ response });
    });
    await page.goto(preview + '/app/skill-map');
    await page.getByText('SYNTHETIC_A_ONLY', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('[data-testid="skill-level"]').allTextContents(), ['Nivel 2']);
    assert.equal(await page.getByText('SYNTHETIC_B_ONLY', { exact: true }).count(), 0);
    check('built React screen renders actual backend A response via transparent loopback proxy, without response mocks');
    await page.evaluate(token => localStorage.setItem('elevation_token', token), tokenB);
    await page.getByRole('button', { name: 'Actualizar mapa', exact: true }).click();
    await page.getByText('SYNTHETIC_B_ONLY', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('[data-testid="skill-level"]').allTextContents(), ['Nivel 4']);
    assert.equal(await page.getByText('SYNTHETIC_A_ONLY', { exact: true }).count(), 0);
    check('switching synthetic accounts replaces the map; no A content remains for B');
    await evidence.update(101, ea.id, { ...evBody('A', 'autonomous', 'es30-evidence-a-0002'), baseVersion: 1 });
    await page.evaluate(token => localStorage.setItem('elevation_token', token), tokenA);
    await page.getByRole('button', { name: 'Actualizar mapa', exact: true }).click();
    await page.getByText('Desactualizado', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('[data-testid="skill-level"]').allTextContents(), ['Sin evidencia vigente']);
    check('actual evidence edit produces stale/null in API and removes the current level in the screen');
    await sessions.revokeToken(fromBackend('jsonwebtoken').decode(tokenA));
    await page.getByRole('button', { name: 'Actualizar mapa', exact: true }).click();
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).waitFor();
    assert.equal(await page.getByRole('article').count(), 0);
    assert.deepEqual(exceptions, []); assert.equal(reads, 4);
    check('actual JWT revocation yields 401 and clears the screen; zero browser exceptions');
    console.log(`Real API/browser integration: ${checks.length} checks passed. PostgreSQL/JWT/ORM/crypto/GET are real; no provider or deployed environment verified.`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (started) await pg.stop();
  }
})().catch(error => { console.error('ES-30 local integration failed:', error.name, error.message); process.exitCode = 1; });
