// ES-16: real local PostgreSQL with this checkout. No use of an
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

(async () => {
  const backendDirectory = path.resolve(__dirname, '../..');
  const fromBackend = createRequire(path.join(backendDirectory, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es16-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es16-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es16_test', password, port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server;
  const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es16_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const databaseModuleId = fromBackend.resolve('./database'); require.cache[databaseModuleId] = { id: databaseModuleId, filename: databaseModuleId, loaded: true, exports: { sequelize } };
    const providerCalls = [];
    const providerId = fromBackend.resolve('./utils/anthropic');
    require.cache[providerId] = { id: providerId, filename: providerId, loaded: true, exports: { MODEL: 'synthetic-no-provider', messages: { create: async body => { providerCalls.push(body); throw new Error('Provider disabled in this test'); } } } };
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    fromBackend('./PricingPlan');
    app.use('/api', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/chat'));
    await sequelize.sync();
    const User = fromBackend('./User');
    for (const [id, role] of [[101, 'user'], [202, 'user'], [303, 'admin']]) await User.create({ id, role, name: `Synthetic actor ${id}`, email: `synthetic-${id}@example.invalid`, password: 'synthetic-no-login' });
    const sessions = fromBackend('./utils/sessions'); const tokenA = sessions.issueToken({ id: 101, role: 'user' }); const tokenB = sessions.issueToken({ id: 202, role: 'user' }); const tokenAdmin = sessions.issueToken({ id: 303, role: 'admin' });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const api = `http://127.0.0.1:${server.address().port}`;
    async function request(pathname, token, body) {
      const response = await fetch(api + pathname, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    }
    const Message = fromBackend('./message'); const Turn = fromBackend('./ChatTurn'); const Diary = fromBackend('./DiaryEntry'); const { encriptarV2, desencriptar } = fromBackend('./utils/crypto');
    const body = { message: 'quiero quedarme en silencio', requestId: 'es16-real-pause-001' };
    const first = await request('/api/chat', tokenA, body); const again = await request('/api/chat', tokenA, body);
    assert.equal(first.status, 200); assert.equal(first.body.reply, 'Está bien. Lo dejamos aquí.'); assert.equal(again.body.replayed, true);
    assert.equal(await Message.count({ where: { UserId: 101 } }), 2); assert.equal(await Turn.count({ where: { UserId: 101 } }), 1); assert.equal(providerCalls.length, 0);
    const encrypted = await Turn.findOne({ where: { UserId: 101, requestId: body.requestId } }); assert.match(encrypted.replyContent, /^v2:/); assert.equal(desencriptar(encrypted.replyContent), first.body.reply);
    check('real HTTP/JWT/PostgreSQL confirms and replays one encrypted pause pair with zero provider calls');
    for (const token of [tokenB, tokenAdmin]) assert.equal((await request('/api/chat/turns/' + body.requestId, token)).status, 404);
    assert.deepEqual((await request('/api/messages', tokenB)).body, []); assert.equal((await request('/api/messages', '')).status, 403);
    const foreign = await Diary.create({ UserId: 202, entryDate: new Date().toISOString().slice(0, 10), content: encriptarV2('Synthetic B private entry') });
    assert.equal((await request('/api/chat', tokenA, { message: 'silencio', contextEntryIds: [foreign.id] })).status, 404);
    check('foreign B/admin request IDs and foreign diary IDs remain inaccessible; no token is rejected');
    const en = await request('/api/chat', tokenB, { message: 'please let me be quiet', requestId: 'es16-real-pause-en-001' }); assert.equal(en.body.reply, 'That’s okay. We can stop here.'); assert.equal(providerCalls.length, 0);
    const high = await request('/api/chat', tokenB, { message: 'Quiero morir. Quiero quedarme en silencio', lang: 'es', requestId: 'es16-real-safety-001' }); assert.equal(high.body.interrupted, true); assert.notEqual(high.body.reply, first.body.reply); assert.equal(providerCalls.length, 0);
    check('EN pause is localized and high-risk safety keeps priority without calling the provider');
    const originalCreate = Message.create; let writes = 0;
    Message.create = function(...args) { if (++writes === 2) throw new Error('Synthetic persistence fault'); return originalCreate.apply(this, args); };
    const before = await Message.count({ where: { UserId: 101 } }); const retryBody = { message: 'silencio por favor', requestId: 'es16-real-rollback-001' };
    const failed = await request('/api/chat', tokenA, retryBody); Message.create = originalCreate;
    assert.equal(failed.status, 500); assert.equal(await Message.count({ where: { UserId: 101 } }), before); assert.equal((await request('/api/chat/turns/' + retryBody.requestId, tokenA)).body.status, 'failed');
    assert.equal((await request('/api/chat', tokenA, retryBody)).status, 200); assert.equal(await Message.count({ where: { UserId: 101 } }), before + 2);
    check('injected second-write failure rolls back actual DB transaction; retry confirms only one pair');
    await sessions.revokeToken(fromBackend('jsonwebtoken').decode(tokenA)); assert.equal((await request('/api/messages', tokenA)).status, 401); assert.equal(providerCalls.length, 0);
    assert.equal(await fromBackend('./AiUsage').count(), 0);
    check('revoked JWT is denied and pauses create no provider usage records');
    console.log(`ES-16 PostgreSQL: ${checks.length} checks passed; HTTP/JWT/ORM/crypto/DB real, provider replaced with a zero-call sentinel; one explicit storage fault. No production or real Claude.`);
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop();
  }
})().catch(error => { console.error('ES-16 PG integration failed:', error.name, error.message); process.exit(1); });
