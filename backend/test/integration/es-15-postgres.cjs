// Disposable loopback PostgreSQL, real Express/JWT/ORM/crypto and built React.
// Anthropic alone is replaced. Browser fault cases explicitly intercept HTTP ACKs.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const net = require('node:net'); const { once } = require('node:events'); const { randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');
(async () => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(require.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es15-pg-'));
  assert.equal(path.dirname(directory), parent); assert.ok(path.basename(directory).startsWith('es15-pg-'));
  const probe = net.createServer();
  const port = await new Promise(resolve => probe.listen(0, '127.0.0.1', () => { const n = probe.address().port; probe.close(() => resolve(n)); }));
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es15_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser;
  const check = label => console.log('PASS ' + label);
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = require('sequelize');
    sequelize = new Sequelize(`postgres://es15_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    process.env.AI_BUDGET_TOKENS_PER_USER = '1000000'; delete process.env.AI_BUDGET_TOKENS_COHORT;
    const db = require.resolve('../../database'); require.cache[db] = { id: db, filename: db, loaded: true, exports: { sequelize } };
    const calls = []; let providerFail = false;
    const provider = require.resolve('../../utils/anthropic'); require.cache[provider] = { id: provider, filename: provider, loaded: true, exports: { MODEL: 'synthetic-model-no-network', messages: { create: async body => { calls.push(body); if (providerFail) throw new Error('Synthetic provider failure'); return { content: [{ type: 'text', text: 'Synthetic confirmed answer' }], usage: { input_tokens: 10, output_tokens: 10 } }; } } } };
    const express = require('express'); const app = express(); app.use(express.json()); require('../../PricingPlan');
    const auth = require('../../middlewares/auth').verificarToken;
    app.use('/api/diary', auth, require('../../routes/diary')); app.use('/api', auth, require('../../routes/chat'));
    // Unrelated dashboard/landing services are explicit fixture responses, not tested here.
    app.get('/api/{*path}', (req, res) => res.json({}));
    const dist = path.resolve(__dirname, '../../../frontend/dist'); assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Build frontend first');
    app.use(express.static(dist, { dotfiles: 'allow' })); app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html'), { dotfiles: 'allow' }));
    await sequelize.sync();
    const User = require('../../User'); const sessions = require('../../utils/sessions'); const tokens = [];
    for (const [id, role] of [[101, 'user'], [202, 'user'], [303, 'admin'], [404, 'therapist'], [505, 'board']]) {
      await User.create({ id, role, name: `Synthetic actor ${id}`, email: `synthetic-${id}@example.invalid`, password: 'synthetic-no-login' });
      tokens.push(sessions.issueToken({ id, role }));
    }
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const api = `http://127.0.0.1:${server.address().port}`;
    const req = async (method, route, token = tokens[0], body) => {
      const res = await fetch(api + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, body: await res.json() };
    };
    const Diary = require('../../DiaryEntry'); const Invalidation = require('../../DerivedInvalidation'); const Message = require('../../message');
    const { desencriptar } = require('../../utils/crypto');
    const create = await req('POST', '/api/diary', tokens[0], { date: '2026-10-01', content: 'Synthetic private α 🧭\nEnglish' });
    assert.equal(create.status, 201); const id = create.body.id;
    assert.match((await Diary.findByPk(id)).content, /^v2:/); assert.equal((await req('GET', `/api/diary/${id}`)).body.content, create.body.content);
    assert.equal((await req('GET', '/api/diary', '')).status, 403);
    for (const token of tokens.slice(1)) {
      for (const [method, body] of [['GET'], ['PUT', { content: 'foreign edit' }], ['DELETE']]) assert.equal((await req(method, `/api/diary/${id}`, token, body)).status, 404);
      assert.deepEqual((await req('GET', '/api/diary', token)).body.entries, []);
      assert.equal((await req('POST', '/api/chat', token, { message: 'Hello', requestId: `es15-foreign-${tokens.indexOf(token)}`, contextEntryIds: [id] })).status, 404);
    }
    assert.equal(calls.length, 0); check('real JWT owner A/B/admin/therapist/board: foreign read/edit/delete/chat references 404; anonymous 403; encrypted Unicode roundtrip');
    const updated = await req('PUT', `/api/diary/${id}`, tokens[0], { content: 'Synthetic selected marker ' + 'a'.repeat(2100) + ' OMITTED_TAIL' }); assert.equal(updated.status, 200);
    assert.equal(await Invalidation.count({ where: { sourceId: id, reason: 'edited' } }), 1);
    const unselected = await req('POST', '/api/diary', tokens[0], { date: '2026-10-02', content: 'UNSELECTED_DIARY_MARKER' });
    const noContext = { message: 'Hello no diary', lang: 'en', requestId: 'es15-no-context-001' };
    assert.equal((await req('POST', '/api/chat', tokens[0], noContext)).status, 200); assert.ok(!calls.at(-1).system.includes('Synthetic selected marker')); assert.ok(!calls.at(-1).system.includes('UNSELECTED_DIARY_MARKER'));
    const withContext = { message: 'Hello selected diary', lang: 'en', requestId: 'es15-with-context-001', contextEntryIds: [id] };
    assert.equal((await req('POST', '/api/chat', tokens[0], withContext)).status, 200); assert.match(calls.at(-1).system, /Synthetic selected marker/); assert.ok(!calls.at(-1).system.includes('OMITTED_TAIL')); assert.ok(!calls.at(-1).system.includes('UNSELECTED_DIARY_MARKER'));
    const before = calls.length; assert.equal((await req('POST', '/api/chat', tokens[0], withContext)).body.replayed, true); assert.equal(calls.length, before);
    assert.equal((await req('GET', '/api/chat/turns/' + withContext.requestId)).body.status, 'completed'); assert.equal((await req('GET', '/api/chat/turns/' + withContext.requestId, tokens[1])).status, 404);
    check('real chat: no implicit diary; only selected capped content; completed turn recovery/replay avoids provider duplicate');
    providerFail = true; const count = await Message.count(); const failed = await req('POST', '/api/chat', tokens[0], { message: 'Failure case', requestId: 'es15-failure-001' });
    assert.equal(failed.status, 502); assert.equal(await Message.count(), count); assert.equal((await req('GET', '/api/chat/turns/es15-failure-001')).body.status, 'failed'); providerFail = false;
    assert.equal((await req('DELETE', `/api/diary/${id}`)).status, 200); assert.equal((await req('GET', `/api/diary/${id}`)).status, 404); assert.equal((await req('DELETE', `/api/diary/${id}`)).status, 404);
    assert.equal(desencriptar((await Diary.findByPk(id)).content), ''); assert.equal(await Invalidation.count({ where: { sourceId: id, reason: 'deleted' } }), 1);
    check('provider failure leaves no orphan messages; delete clears encrypted content and adds real invalidation');

    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ token }) => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_checkin_date', new Date().toDateString()); if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', 'es'); }, { token: tokens[0] });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const artifacts = path.resolve(__dirname, '../../../frontend/node_modules/.es15-artifacts'); fs.mkdirSync(artifacts, { recursive: true });
    const screenshot = async name => { await page.evaluate(() => scrollTo(0, 0)); return page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled' }); };
    await page.goto(api + '/app/diary'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Saltar al contenido'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'space-main'); await page.getByRole('link', { name: 'Nueva entrada', exact: true }).click();
    await page.getByLabel('Fecha', { exact: true }).fill('2026-10-03'); await page.getByLabel('Contenido', { exact: true }).fill('Browser synthetic private entry 🧭');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.waitForURL(/\/app\/diary\/\d+$/); await page.getByText('Browser synthetic private entry 🧭', { exact: true }).waitFor();
    const browserId = Number(new URL(page.url()).pathname.split('/').at(-1)); assert.equal((await req('GET', '/api/diary/' + browserId)).body.content, 'Browser synthetic private entry 🧭');
    await screenshot('diary-mobile');
    await page.getByRole('button', { name: 'Editar', exact: true }).click(); await page.getByLabel('Contenido', { exact: true }).fill('Browser edited synthetic entry'); await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.getByText('Browser edited synthetic entry', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click(); assert.equal(await page.locator('dialog button').first().evaluate(e => document.activeElement === e), true); await page.keyboard.press('Escape'); assert.equal((await req('GET', '/api/diary/' + browserId)).status, 200);
    await page.getByRole('button', { name: 'Editar', exact: true }).click(); await page.getByLabel('Contenido', { exact: true }).fill('Synthetic local conflict draft');
    await req('PUT', '/api/diary/' + browserId, tokens[0], { content: 'Synthetic other-device update' });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.getByText('El contenido guardado cambió. Revisa antes de continuar.', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Contenido', { exact: true }).inputValue(), 'Synthetic local conflict draft');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Revisar versión guardada', exact: true }).click(); assert.equal(await page.getByLabel('Contenido', { exact: true }).inputValue(), 'Synthetic other-device update');
    await page.getByLabel('Contenido', { exact: true }).fill('Synthetic edit with lost ACK');
    await page.route('**/api/diary/' + browserId, async route => { if (route.request().method() === 'PUT') { await route.fetch(); await route.abort('failed'); } else await route.continue(); });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.getByRole('button', { name: 'Consultar mi diario', exact: true }).click(); await page.getByText('El contenido guardado coincide actualmente con tu borrador.', { exact: true }).waitFor(); await page.unroute('**/api/diary/' + browserId);
    check('built UI/real DB: CRUD readback, dialog focus/Escape, concurrent-update review and lost PUT ACK reconciled without repeat');
    await page.goto(api + '/app/diary/new'); let blockRead = true; let acknowledgedCreateId;
    await page.route('**/api/diary', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      const response = await route.fetch(); acknowledgedCreateId = (await response.json()).id; await route.fulfill({ response });
    });
    await page.route('**/api/diary/*', async route => {
      if (blockRead && route.request().method() === 'GET') { blockRead = false; await route.abort('failed'); } else await route.continue();
    });
    await page.getByLabel('Fecha', { exact: true }).fill('2026-10-03'); await page.getByLabel('Contenido', { exact: true }).fill('Synthetic known ID readback interruption'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Consultar mi diario', exact: true }).click(); await page.waitForURL(new RegExp('/app/diary/' + acknowledgedCreateId + '$')); await page.getByText('Synthetic known ID readback interruption', { exact: true }).waitFor();
    await page.unroute('**/api/diary'); await page.unroute('**/api/diary/*');
    // Fault injection: server commits POST but the browser never receives its ACK.
    let postCount = 0; await page.goto(api + '/app/diary/new');
    await page.route('**/api/diary', async route => { if (route.request().method() === 'POST') { postCount++; await route.fetch(); await route.abort('failed'); } else await route.continue(); });
    await page.getByLabel('Fecha', { exact: true }).fill('2026-10-04'); await page.getByLabel('Contenido', { exact: true }).fill('Synthetic lost creation ACK'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Consultar mi diario', exact: true }).waitFor(); assert.equal(postCount, 1); assert.equal(await page.getByLabel('Contenido', { exact: true }).inputValue(), 'Synthetic lost creation ACK');
    await page.getByRole('button', { name: 'Consultar mi diario', exact: true }).click(); await page.getByText('Synthetic lost creation ACK', { exact: true }).waitFor(); assert.equal(postCount, 1);
    await page.unroute('**/api/diary'); page.once('dialog', d => d.accept()); await page.goto(api + '/app/chat');
    for (let n = 0; n < 3; n++) await req('POST', '/api/diary', tokens[0], { date: '2026-10-02', content: 'Synthetic picker fixture ' + n });
    await page.getByRole('button', { name: 'Elegir entradas para este envío', exact: true }).click(); const boxes = page.getByRole('checkbox'); await boxes.first().waitFor(); assert.equal(await boxes.first().isChecked(), false);
    await boxes.nth(0).check(); await boxes.nth(1).check(); await boxes.nth(2).check(); assert.equal(await boxes.nth(3).isDisabled(), true); await page.getByRole('button', { name: 'Sin seleccionar diario', exact: true }).click(); await boxes.first().check();
    await page.getByLabel('Mensaje (hasta 4.000 caracteres)', { exact: true }).fill('Browser recovered chat intent');
    let sentBody; await page.route('**/api/chat', async route => { sentBody = route.request().postDataJSON(); await route.fetch(); await route.abort('failed'); });
    await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByRole('button', { name: 'Consultar estado', exact: true }).waitFor(); assert.equal(sentBody.contextEntryIds.length, 1); assert.ok(sentBody.requestId);
    await page.getByText('No pudimos confirmar este envío. Conservamos tu texto en esta pantalla.', { exact: true }).waitFor();
    await page.unroute('**/api/chat'); await page.getByRole('button', { name: 'Consultar estado', exact: true }).click(); await page.getByText('Envío confirmado', { exact: true }).waitFor(); assert.equal((await req('GET', '/api/messages')).body.filter(m => m.text === 'Browser recovered chat intent').length, 1);
    assert.equal(await page.getByRole('checkbox').count(), 0); assert.equal(await page.getByLabel('Mensaje (hasta 4.000 caracteres)', { exact: true }).inputValue(), '');
    await screenshot('chat-mobile');
    providerFail = true; const retryBodies = []; await page.route('**/api/chat', async route => { retryBodies.push(route.request().postDataJSON()); await route.continue(); });
    await page.getByLabel('Mensaje (hasta 4.000 caracteres)', { exact: true }).fill('Browser explicit retry after provider failure'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByRole('button', { name: 'Reintentar el mismo envío', exact: true }).waitFor();
    assert.equal((await req('GET', '/api/messages')).body.filter(m => m.text === 'Browser explicit retry after provider failure').length, 0); assert.equal(await page.locator('.space-pending').count(), 1); providerFail = false;
    await page.getByRole('button', { name: 'EN', exact: true }).click(); await page.getByRole('button', { name: 'Retry the same message', exact: true }).click(); await page.getByText('Message confirmed', { exact: true }).waitFor(); assert.equal(retryBodies.length, 2); assert.deepEqual(retryBodies[0], retryBodies[1]); await page.unroute('**/api/chat');
    check('POST ACK loss retains diary without repeat; chat recovers one pair; max three; explicit provider retry preserves exact ES body even after EN switch');
    await page.getByRole('link', { name: 'My next step', exact: true }).click(); await page.getByRole('heading', { name: 'My next step', exact: true }).waitFor(); assert.equal(await page.getByText('In preparation', { exact: true }).count(), 4);
    assert.equal(await page.locator('a[href="/app/skill-map"]').count(), 0);
    for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`); }
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '200% CSS zoom reflow'); await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await screenshot('next-step-desktop'); await page.goto(api + '/app/dashboard'); await page.getByLabel('Message (up to 4,000 characters)', { exact: true }).waitFor();
    await page.getByLabel('Message (up to 4,000 characters)', { exact: true }).fill('Dashboard confirmed intent'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByText('Message confirmed', { exact: true }).waitFor();
    assert.equal((await req('GET', '/api/messages')).body.filter(m => m.text === 'Dashboard confirmed intent').length, 1);
    for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `dashboard overflow ${width}`); }
    await page.setViewportSize({ width: 375, height: 900 }); await screenshot('dashboard-mobile');
    const privateStorage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })); assert.ok(!privateStorage.includes('Browser edited synthetic entry')); assert.ok(!privateStorage.includes('Dashboard confirmed intent'));
    check('EN, unavailable-route hub, 320/375/768/1440 overflow, dashboard uses same real chat, no private text in web storage');
    await page.goto(api + '/app/diary');
    await page.evaluate(token => { localStorage.setItem('elevation_token', token); window.dispatchEvent(new StorageEvent('storage', { key: 'elevation_token', newValue: token })); }, tokens[1]);
    await page.getByText('You do not have any saved entries yet.', { exact: true }).waitFor(); assert.equal(await page.getByText('Synthetic edit with lost ACK', { exact: true }).count(), 0);
    await page.getByRole('link', { name: 'New entry', exact: true }).click(); await page.getByLabel('Content', { exact: true }).fill('Synthetic B unsaved draft');
    page.once('dialog', d => d.dismiss()); await page.evaluate(() => history.back()); await page.waitForTimeout(250); assert.ok(page.url().endsWith('/app/diary/new')); assert.equal(await page.getByLabel('Content', { exact: true }).inputValue(), 'Synthetic B unsaved draft');
    page.once('dialog', d => d.accept()); await page.goto(api + '/app/diary/' + browserId);
    check('session switch clears private A entries; B empty state; cancelled Back retains RAM draft');
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); await page.locator('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); await page.getByText('The entry is no longer available.', { exact: true }).waitFor(); assert.equal((await req('GET', '/api/diary/' + browserId)).status, 404);
    await sessions.revokeToken(require('jsonwebtoken').decode(tokens[0])); assert.equal((await req('GET', '/api/diary')).status, 401);
    await page.goto(api + '/app/diary'); await page.getByText('Your session expired. Sign in to continue.', { exact: false }).waitFor();
    assert.deepEqual(errors, []); check('real UI deletion readback and revoked-token denial; zero browser runtime errors');
    console.log('ES-15 integration PASS. Real HTTP/JWT/ORM/crypto/PostgreSQL + built UI. Provider simulated; unrelated dashboard API fixtures; explicit ACK fault injection. No production or real Claude.');
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop();
  }
})().catch(error => { console.error('ES-15 integration failed:', error.name, error.message); process.exit(1); });
