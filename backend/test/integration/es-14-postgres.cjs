// Explicit integration command, only a randomly named database on a disposable
// loopback cluster. No .env, existing DATABASE_URL, real participant or provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize, DataTypes } = require('sequelize');

test('ES-14 PostgreSQL: additive migration, encrypted ownership, concurrency and rollback', { timeout: 60000 }, async t => {
  assert.ok(process.env.ES14_TEST_DATABASE_URL, 'Explicit disposable loopback URL required');
  const target = new URL(process.env.ES14_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  const name = `es14_test_${randomBytes(8).toString('hex')}`;
  const admin = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    // name is generated here, not derived from the supplied database name.
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${name}"`); created = true; target.pathname = '/' + name;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const id = require.resolve('../../database');
  require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
  const qi = sequelize.getQueryInterface();
  const migration = require('../../migrations/001-participant-context.cjs');
  await qi.createTable('Users', { id: { type: DataTypes.INTEGER, primaryKey: true }, active: DataTypes.BOOLEAN, role: DataTypes.STRING });
  await sequelize.query(`INSERT INTO "Users" (id, active, role) VALUES (101, true, 'user'), (202, true, 'user')`);
  await t.test('migration rolls back cleanly, then applies to an existing schema without rewriting users', async () => {
    const transaction = await sequelize.transaction();
    await migration.up(qi, DataTypes, transaction); await transaction.rollback();
    assert.ok(!(await qi.showAllTables()).includes('ParticipantContexts'));
    await migration.up(qi, DataTypes);
    assert.equal((await sequelize.query('SELECT count(*)::int AS n FROM "Users"'))[0][0].n, 2);
    const table = await qi.describeTable('ParticipantContexts');
    for (const key of ['id', 'UserId', 'version', 'content', 'completedAt', 'createdAt', 'updatedAt']) assert.ok(table[key]);
  });
  const Context = require('../../ParticipantContext');
  await require('../../DerivedInvalidation').sync();
  await require('../../RevokedToken').sync(); await require('../../AuthRevocation').sync();
  await require('../../DeletionRequest').sync();
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use('/api/user/context', require('../../middlewares/auth').verificarToken, require('../../routes/participantContext'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const { issueToken, revokeToken } = require('../../utils/sessions');
  const tokens = { 101: issueToken({ id: 101, role: 'user' }), 202: issueToken({ id: 202, role: 'user' }) };
  const blank = { preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null, profession: null,
    interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null };
  async function request(owner, context, version = 0, action = 'save_draft') {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/user/context`, {
      method: context ? 'PUT' : 'GET', headers: { Authorization: `Bearer ${tokens[owner]}`, 'Content-Type': 'application/json' },
      ...(context ? { body: JSON.stringify({ schemaVersion: 1, expectedVersion: version, action, context: { ...blank, ...context } }) } : {}),
    });
    return { status: res.status, body: await res.json() };
  }
  await t.test('real HTTP, JWT, Sequelize and encryption isolate two owners and preserve unknown versus zero', async () => {
    assert.equal((await request(101)).body.context, null);
    assert.equal((await request(202, { profession: 'SYNTHETIC_B_PRIVATE', preferredLanguage: 'en' }, 0, 'continue')).status, 200);
    assert.equal((await request(101)).body.context, null);
    const saved = await request(101, { residenceCountry: 'CO', targetMarket: 'ES', timeZone: 'America/Bogota', availabilityMinutesPerWeek: 0 });
    assert.equal(saved.status, 200); assert.equal(saved.body.context.availabilityMinutesPerWeek, 0); assert.equal(saved.body.context.preferredLanguage, null);
    const row = await Context.findOne({ where: { UserId: 202 } });
    assert.match(row.content, /^v2:/); assert.doesNotMatch(row.content, /SYNTHETIC_B_PRIVATE/);
    assert.doesNotMatch(JSON.stringify((await request(101)).body), /SYNTHETIC_B_PRIVATE|UserId/);
  });
  await t.test('two concurrent updates produce one success and one conflict', async () => {
    const responses = await Promise.all([request(101, { profession: 'FIRST' }, 1), request(101, { profession: 'SECOND' }, 1)]);
    assert.deepEqual(responses.map(res => res.status).sort(), [200, 409]);
    const winner = responses.find(res => res.status === 200);
    assert.deepEqual((await request(101)).body, winner.body);
    assert.equal(await Context.count({ where: { UserId: 101 } }), 1);
  });
  await t.test('two concurrent first saves serialize on the owner, unique constraint prevents duplicates', async () => {
    await sequelize.query(`INSERT INTO "Users" (id, active, role) VALUES (303, true, 'user')`);
    tokens[303] = issueToken({ id: 303, role: 'user' });
    const results = await Promise.all([request(303, {}), request(303, {})]);
    assert.deepEqual(results.map(res => res.status).sort(), [200, 409]);
    assert.equal(await Context.count({ where: { UserId: 303 } }), 1);
  });
  await t.test('six wholly synthetic cases include non-digital occupations and unknown fields', async () => {
    const cases = [
      { preferredLanguage: 'es', profession: 'Docencia sintética', residenceCountry: 'CO', targetMarket: 'ES', availabilityMinutesPerWeek: 120 },
      { preferredLanguage: 'es', profession: 'Cocina sintética', residenceCountry: 'ES', targetMarket: 'CO', availabilityMinutesPerWeek: 0 },
      { preferredLanguage: 'es', profession: 'Oficio sintético', residenceCountry: 'MX', timeZone: 'America/Mexico_City' },
      { preferredLanguage: 'es', profession: null, targetMarket: null },
      { preferredLanguage: 'es', profession: 'Atención al público sintética', interests: 'Artesanía sintética' },
      { preferredLanguage: 'en', profession: 'Synthetic agriculture', residenceCountry: 'GB', targetMarket: 'IE' },
    ];
    for (const [index, context] of cases.entries()) {
      const owner = 401 + index;
      await sequelize.query('INSERT INTO "Users" (id, active, role) VALUES (:id, true, :role)', { replacements: { id: owner, role: 'user' } });
      tokens[owner] = issueToken({ id: owner, role: 'user' });
      const saved = await request(owner, context, 0, 'continue');
      assert.equal(saved.status, 200); assert.deepEqual(saved.body.context, { ...blank, ...context });
      assert.ok(saved.body.completedAt);
    }
  });
  await t.test('transaction failure rolls back the row and does not report success', async () => {
    const before = (await request(101)).body;
    Context.addHook('beforeUpdate', 'synthetic-failure', () => { throw new Error('Synthetic failure'); });
    try { assert.equal((await request(101, { profession: 'NOT_COMMITTED' }, 2)).status, 503); }
    finally { Context.removeHook('beforeUpdate', 'synthetic-failure'); }
    assert.deepEqual((await request(101)).body, before);
  });
  await t.test('revocation and inactive/current-role checks use existing identity contracts', async () => {
    await sequelize.query(`UPDATE "Users" SET active = false WHERE id = 101`);
    assert.equal((await request(101)).status, 403); assert.equal((await request(101, {}, 2)).status, 403);
    await sequelize.query(`UPDATE "Users" SET active = true, role = 'admin' WHERE id = 101`);
    assert.equal((await request(101)).status, 403);
    await revokeToken(require('jsonwebtoken').decode(tokens[202]));
    assert.equal((await request(202)).status, 401);
  });
  await t.test('deleting the owner cascades only its own context; FK rejects nonexistent owners', async () => {
    await assert.rejects(Context.create({ UserId: 999, version: 1, content: 'synthetic' }));
    await sequelize.query('DELETE FROM "Users" WHERE id = 101');
    assert.equal(await Context.count({ where: { UserId: 101 } }), 0);
    assert.equal(await Context.count({ where: { UserId: 202 } }), 1);
  });
});
