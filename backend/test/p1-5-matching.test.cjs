const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp } = require('./support.cjs');

test('P1-5: only admin can list or confirm matching; user can request and choose', async t => {
  let calls = 0;
  let assigned;
  const match = record({ id: 7, UserId: 101, chosenTherapistId: 303, status: 'pending' });
  models.MatchingRequest.findAll = async () => { calls++; return []; };
  models.MatchingRequest.findByPk = async () => { calls++; return match; };
  models.User.update = async (values, options) => { calls++; assigned = { values, options }; };
  models.User.findAll = async () => [record({ id: 303, name: 'Synthetic therapist' })];
  // ES-98 (ES93-M1): elegir y confirmar validan que el terapeuta esté activo y que la persona sea un participante activo.
  models.User.findOne = async ({ where }) => (where.role === 'therapist' ? record({ id: where.id, role: 'therapist', active: true })
    : where.role === 'user' ? record({ id: where.id, role: 'user', active: true }) : null);
  models.MoodLog.findAll = async () => [];
  models.MatchingRequest.create = async values => record({ id: 7, ...values });
  models.MatchingRequest.findOne = async ({ where }) => {
    assert.deepEqual(where, { id: 7, UserId: 101 });
    return match;
  };
  anthropic.messages.create = async () => ({ content: [{ text: JSON.stringify([
    { therapistId: 303, score: 1, reason: 'Synthetic fixture; not a real recommendation' },
  ]) }] });
  const request = await startApp(t);

  for (const [method, suffix, body] of [
    ['GET', '/pending', undefined], ['POST', '/7/confirm', {}],
  ]) await t.test(method + ' ' + suffix, async () => {
    for (const prefix of ['/api/matching', '/api/admin/matching']) {
      for (const role of [undefined, 'user', 'therapist', 'board']) {
        const before = calls;
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 403);
        assert.equal(calls, before);
      }
      assert.equal((await request(method, prefix + suffix, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      for (const role of ['admin', 'superadmin']) {
        match.status = 'pending'; // ES-98: una solicitud confirmada ya no se vuelve a confirmar (409); cada vuelta parte de una pendiente
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 200);
      }
    }
  });
  assert.deepEqual(assigned, { values: { therapistId: 303 }, options: { where: { id: 101 } } });
  assert.equal((await request('POST', '/api/matching/request', {
    role: 'user', body: { answers: { area: 'synthetic', style: 'synthetic', language: 'en' } },
  })).status, 200);
  match.status = 'pending';
  assert.equal((await request('POST', '/api/matching/choose', {
    role: 'user', body: { requestId: 7, therapistId: 303 },
  })).status, 200);
  assert.equal(match.chosenTherapistId, 303);
});
