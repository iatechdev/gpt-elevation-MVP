const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, database, transaction, record, startApp } = require('./support.cjs');

test('P1-3: only the active manifest is public, history and mutations require board', async t => {
  let calls = 0;
  const manifest = record({ id: 7, version: 'v1', content: 'Synthetic public manifest', isActive: true });
  models.EthicManifest.findOne = async () => { calls++; return manifest; };
  models.EthicManifest.findAll = async () => { calls++; return [manifest]; };
  models.EthicManifest.findByPk = async () => { calls++; return manifest; };
  models.EthicManifest.update = async () => { calls++; };
  models.EthicManifest.create = async values => { calls++; return record({ id: 8, ...values }); };
  database.sequelize.transaction = async () => { calls++; return transaction; };
  const request = await startApp(t);
  const publicRead = await request('GET', '/api/manifest/active');
  assert.equal(publicRead.status, 200);
  assert.deepEqual(publicRead.body, { version: 'v1', content: manifest.content });

  for (const [method, suffix, body, success] of [
    ['GET', '/manifest', undefined, 200],
    ['POST', '/manifest', { content: 'Synthetic manifest content for an authorization-only test. No personal data.' }, 201],
    ['PUT', '/manifest/7/activate', {}, 200],
  ]) await t.test(method + ' ' + suffix, async () => {
    for (const prefix of ['/api/manifest', '/api/board']) {
      for (const role of [undefined, 'user', 'therapist', 'admin']) {
        const before = calls;
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 403);
        assert.equal(calls, before, 'No database work or transaction on denial');
      }
      assert.equal((await request(method, prefix + suffix, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      for (const role of ['board', 'superadmin']) {
        assert.equal((await request(method, prefix + suffix, { role, body })).status, success);
      }
    }
  });
});
