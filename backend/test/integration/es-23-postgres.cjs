// Explicit integration command. Creates/drops ONLY its own random database on a loopback test server.
// Never loads .env, never uses DATABASE_URL, and never calls an external provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('ES-23 PostgreSQL: migration, ownership, concurrent publication/deletion, rollback and restore replay', { timeout: 60000 }, async t => {
  const source = process.env.ES23_TEST_DATABASE_URL;
  assert.ok(source, 'ES23_TEST_DATABASE_URL must explicitly identify a disposable local PostgreSQL server.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Only loopback PostgreSQL is allowed.');
  const dbName = `es23_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es23_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize;
  let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    // dbName is generated above, never supplied or derived from a user's database name.
    if (created) await admin.query(`DROP DATABASE "${dbName}"`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const { up } = require('../../migrations/20261026-es23-data-rights.cjs');
  await up(sequelize);
  await up(sequelize); // repeat application is additive/idempotent
  require('../../associations')();
  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation',
    'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'AiUsage', 'AiBudgetCounter']) require('../../' + name);
  await sequelize.sync();
  const rights = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const { withConsent, hasConsent } = require('../../utils/consent');
  const { sessionProblem } = require('../../utils/sessions');
  const { encriptarV2 } = require('../../utils/crypto');
  const User = require('../../User');
  const Message = require('../../message');
  const Consent = require('../../Consent');
  const DiaryEntry = require('../../DiaryEntry');
  const DeletionRequest = require('../../DeletionRequest');
  const AiUsage = require('../../AiUsage');
  const AiBudgetCounter = require('../../AiBudgetCounter');
  const addUser = () => User.create({ name: 'Synthetic', email: `${randomBytes(6).toString('hex')}@example.invalid`,
    password: 'synthetic-not-a-real-password', active: true, role: 'user' });
  const grant = user => Consent.create({ UserId: user.id, purpose: 'professional_bridge', scope: 'default', status: 'granted', version: 1, decidedAt: new Date() });
  async function waitForLock(table) {
    const deadline = Date.now() + 5000;
    do {
      const [rows] = await sequelize.query(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE :table
      ) AS waiting`, { replacements: { table: `%"${table}"%` } });
      if (rows[0].waiting) return;
      await wait(20);
    } while (Date.now() < deadline);
    assert.fail(`No observed PostgreSQL lock wait on ${table}`);
  }

  await t.test('real migration matches ORM; preview/download are exact and owner-scoped', async () => {
    const a = await addUser(); const b = await addUser();
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('A private synthetic') });
    await Message.create({ UserId: b.id, role: 'user', content: encriptarV2('B PRIVATE CANARY') });
    const p = await rights.preview(a.id, { type: 'personal', locale: 'en' });
    assert.equal(p.data.messages[0].content, 'A private synthetic');
    assert.doesNotMatch(JSON.stringify(p), /B PRIVATE CANARY|synthetic-not-a-real-password/);
    assert.deepEqual(await rights.download(a.id, p.id, data => data), p.data);
    await assert.rejects(rights.download(b.id, p.id, () => assert.fail('foreign publication')), { code: 'export_not_found' });
    await Message.create({ UserId: a.id, role: 'assistant', content: encriptarV2('new reply') });
    await assert.rejects(rights.download(a.id, p.id, () => assert.fail('outdated publication')), { code: 'export_outdated' });
  });

  await t.test('deletion waits for an authorized download to publish; accepted deletion prevents every subsequent download', async () => {
    const a = await addUser();
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    const entered = deferred(); const release = deferred(); const events = [];
    const downloading = rights.download(a.id, p.id, async () => {
      entered.resolve(); await release.promise; events.push('published');
    });
    await entered.promise;
    const deleting = rights.requestDeletion(a.id).then(r => { events.push('accepted'); return r; });
    try { await waitForLock('Users'); } finally { release.resolve(); }
    await downloading;
    await deleting;
    assert.deepEqual(events, ['published', 'accepted']);
    await assert.rejects(rights.download(a.id, p.id, () => assert.fail('revoked publication')), { code: 'deletion_pending' });
  });

  await t.test('existing consent consumers finish before acceptance; repeated concurrent requests have one durable receipt', async () => {
    const a = await addUser(); await grant(a);
    const entered = deferred(); const release = deferred();
    const consumer = withConsent(a.id, 'professional_bridge', async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    const deleting = rights.requestDeletion(a.id);
    try { await waitForLock('Consents'); } finally { release.resolve(); }
    await consumer;
    const initial = await deleting;
    const repeats = await Promise.all([rights.requestDeletion(a.id), rights.requestDeletion(a.id)]);
    assert.ok(repeats.every(r => r.id === initial.id && r.repeated));
    assert.equal(await DeletionRequest.count({ where: { UserId: a.id } }), 1);
    assert.equal(await hasConsent(a.id, 'professional_bridge'), false);
    await assert.rejects(withConsent(a.id, 'professional_bridge', () => assert.fail('deleted owner')));
  });

  await t.test('SQL failure rolls back purge; retry preserves the other owner; restored records are purged again', async () => {
    const a = await addUser(); const b = await addUser();
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('A synthetic') });
    await Message.create({ UserId: b.id, role: 'user', content: encriptarV2('B synthetic') });
    await DiaryEntry.create({ UserId: a.id, entryDate: '2026-10-01', content: encriptarV2('diary') });
    await AiUsage.create({ UserId: a.id, kind: 'chat', model: 'm', periodKey: '2026-10', status: 'completed', reservedTokens: 10 });
    await AiUsage.create({ UserId: b.id, kind: 'chat', model: 'm', periodKey: '2026-10', status: 'completed', reservedTokens: 10 });
    await AiBudgetCounter.create({ UserId: a.id, periodKey: '2026-10', used: 10 });
    await AiBudgetCounter.create({ UserId: 0, periodKey: '2026-10', used: 20 });
    const request = await rights.requestDeletion(a.id);
    await sequelize.query(`CREATE FUNCTION es23_inject_failure() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'synthetic purge failure'; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es23_inject_failure BEFORE DELETE ON "DiaryEntries"
      FOR EACH ROW EXECUTE FUNCTION es23_inject_failure()`);
    await assert.rejects(processDeletion(request.id, { quiescent: true }), /can be retried/);
    assert.equal(await Message.count({ where: { UserId: a.id } }), 1);
    assert.equal((await DeletionRequest.findByPk(request.id)).status, 'failed');
    await sequelize.query('DROP TRIGGER es23_inject_failure ON "DiaryEntries"');
    const result = await processDeletion(request.id, { quiescent: true });
    assert.equal(result.status, 'awaiting_verification');
    assert.equal(await Message.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Message.count({ where: { UserId: b.id } }), 1);
    assert.equal(await AiUsage.count({ where: { UserId: a.id } }), 0); // QA-H1
    assert.equal(await AiUsage.count({ where: { UserId: b.id } }), 1);
    assert.equal(await AiBudgetCounter.count({ where: { UserId: a.id } }), 0);
    assert.equal((await AiBudgetCounter.findOne({ where: { UserId: 0, periodKey: '2026-10' } })).used, 20); // la cohorte no se purga
    await User.update({ active: true, email: 'restored@example.invalid' }, { where: { id: a.id } });
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('RESTORED PRIVATE') });
    assert.equal(await sessionProblem({ id: a.id, jti: 'synthetic-fresh', iat: Date.now() / 1000 }), 'deletion_pending');
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await Message.count({ where: { UserId: a.id } }), 0);
    assert.equal((await User.findByPk(a.id)).active, false);
  });
});
