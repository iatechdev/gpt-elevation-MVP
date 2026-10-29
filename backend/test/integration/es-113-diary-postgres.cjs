// ES-113: existing diary contract on disposable loopback PostgreSQL.
// Real router, auth/session helpers, ORM and crypto. No browser or external providers.
// Run explicitly: node --test test/integration/es-113-diary-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

test('ES-113 diary: real PostgreSQL ownership, encrypted CRUD, validation and session revocation', { timeout: 120000 }, async t => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const { Sequelize } = require('sequelize');
  const root = path.resolve(__dirname, '../../.pgdata');
  const directory = path.join(root, `es113-${randomBytes(8).toString('hex')}`);
  assert.equal(path.dirname(directory), root);
  assert.match(path.basename(directory), /^es113-[a-f0-9]{16}$/);
  fs.mkdirSync(root, { recursive: true });
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(selected));
    });
  });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es113_test', password, port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false;
  let sequelize;
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (started) await pg.stop();
  });
  await pg.initialise();
  await pg.start();
  started = true;
  sequelize = new Sequelize(`postgres://es113_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  // Only the database connection is injected. All models and auth/crypto code are real.
  const db = require.resolve('../../database');
  require.cache[db] = { id: db, filename: db, loaded: true, exports: { sequelize } };
  require('../../PricingPlan');
  const User = require('../../User');
  const sessions = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const Diary = require('../../DiaryEntry');
  const Invalidation = require('../../DerivedInvalidation');
  const { encriptarV2, desencriptar } = require('../../utils/crypto');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/diary', verificarToken, require('../../routes/diary'));
  await sequelize.sync();
  const actors = new Map();
  for (const [id, role] of [[101, 'user'], [202, 'user'], [303, 'admin'], [404, 'therapist'], [505, 'board'], [606, 'superadmin']]) {
    const user = await User.create({ id, role, name: 'Synthetic diary test', email: `es113-${id}@example.invalid`, password: 'synthetic-not-a-login' });
    actors.set(id, sessions.issueToken(user));
  }
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, endpoint, token = actors.get(101), body) => {
    const response = await fetch(origin + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const content = 'Synthetic only · español / English 🧭\nSecond line.';
  const created = await request('POST', '/api/diary', actors.get(101), { date: '2026-10-01', content });
  assert.equal(created.status, 201);
  const id = created.body.id;

  await t.test('owner reads the same Unicode text; stored content is authenticated ciphertext', async () => {
    const stored = await Diary.findByPk(id);
    assert.match(stored.content, /^v2:/);
    assert.ok(!stored.content.includes(content));
    assert.equal(desencriptar(stored.content), content);
    assert.equal((await request('GET', `/api/diary/${id}`)).body.content, content);
    assert.deepEqual(Object.keys(created.body).sort(), ['content', 'createdAt', 'date', 'id', 'updatedAt']);
  });
  await t.test('foreign IDs and elevated roles cannot read/edit/delete A; no side effects on the owner', async () => {
    for (const token of [...actors.entries()].filter(([userId]) => userId !== 101).map(([, token]) => token)) {
      for (const [method, body] of [['GET'], ['PUT', { content: 'Foreign synthetic edit' }], ['DELETE']]) {
        assert.equal((await request(method, `/api/diary/${id}`, token, body)).status, 404);
      }
      assert.deepEqual((await request('GET', '/api/diary', token)).body.entries, []);
    }
    assert.equal(desencriptar((await Diary.findByPk(id)).content), content);
    assert.equal(await Invalidation.count(), 0);
    assert.equal((await request('GET', '/api/diary', '')).status, 403);
    assert.equal((await request('GET', '/api/diary', 'invalid-synthetic-token')).status, 401);
  });
  await t.test('owner injection is ignored and invalid content/date/IDs do not write', async () => {
    const b = await request('POST', '/api/diary', actors.get(202), { date: '2026-10-01', content: 'Synthetic B', UserId: 101 });
    assert.equal(b.status, 201);
    assert.equal((await Diary.findByPk(b.body.id)).UserId, 202);
    const before = await Diary.count();
    for (const body of [{ date: '2026-02-30', content: 'x' }, { date: '2026-10-01', content: ' ' }, { date: '2026-10-01', content: 'x'.repeat(10001) }]) {
      assert.equal((await request('POST', '/api/diary', actors.get(101), body)).status, 400);
    }
    for (const bad of ['0', '-1', 'abc', '9999999999']) assert.equal((await request('GET', `/api/diary/${bad}`)).status, 404);
    assert.equal(await Diary.count(), before);
  });
  await t.test('edits and deletion retain real invalidation without storing diary text in events', async () => {
    const edited = await request('PUT', `/api/diary/${id}`, actors.get(101), { content: 'Synthetic edit ES/EN', date: '2026-10-02' });
    assert.equal(edited.status, 200);
    assert.equal((await request('GET', `/api/diary/${id}`)).body.content, 'Synthetic edit ES/EN');
    assert.equal((await request('DELETE', `/api/diary/${id}`)).status, 200);
    assert.equal((await request('GET', `/api/diary/${id}`)).status, 404);
    assert.equal((await request('DELETE', `/api/diary/${id}`)).status, 404);
    assert.equal(desencriptar((await Diary.findByPk(id)).content), '');
    assert.ok((await Diary.findByPk(id)).deletedAt);
    const events = await Invalidation.findAll({ where: { UserId: 101, sourceType: 'diary_entry', sourceId: id }, order: [['id', 'ASC']], raw: true });
    assert.deepEqual(events.map(event => event.reason), ['edited', 'deleted']);
    assert.ok(events.every(event => !Object.keys(event).some(key => /content|text/i.test(key))));
    assert.ok(!(await request('GET', '/api/diary')).body.entries.some(entry => entry.id === id));
    assert.equal((await request('GET', '/api/diary', actors.get(202))).body.entries.length, 1);
  });
  await t.test('limit 100 remains bounded and never includes another owner or a deleted entry', async () => {
    await Diary.bulkCreate(Array.from({ length: 101 }, () => ({ UserId: 101, entryDate: '2026-10-01', content: encriptarV2('Synthetic bounded list') })));
    const result = await request('GET', '/api/diary?limit=999');
    assert.equal(result.status, 200);
    assert.equal(result.body.entries.length, 100);
    assert.ok(result.body.entries.every(entry => entry.id !== id && entry.content === 'Synthetic bounded list'));
  });
  await t.test('server session revocation denies access; the other owner still has a working session', async () => {
    await sessions.revokeToken(require('jsonwebtoken').decode(actors.get(101)));
    assert.equal((await request('GET', '/api/diary')).status, 401);
    assert.equal((await request('GET', '/api/diary', actors.get(202))).status, 200);
  });
});
