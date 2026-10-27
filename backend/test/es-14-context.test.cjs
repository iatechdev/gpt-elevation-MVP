const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, database, record, startApp } = require('./support.cjs');
const blank = () => ({ preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null,
  profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null });
const body = (context = {}, expectedVersion = 0, action = 'save_draft') => ({ schemaVersion: 1, expectedVersion, action, context: { ...blank(), ...context } });
function setup() {
  const rows = new Map();
  const users = new Map([101, 202].map(id => [id, { id, active: true, role: 'user' }]));
  const calls = [];
  const invalidations = [];
  models.DerivedInvalidation.create = async values => { invalidations.push(values); return values; };
  database.sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, async commit() {}, async rollback() {} });
  models.User.findOne = async options => {
    calls.push(options);
    const user = users.get(options.where.id);
    return user?.active && user.role === 'user' ? { id: user.id } : null;
  };
  models.ParticipantContext.findOne = async ({ where }) => rows.get(where.UserId) ?? null;
  models.ParticipantContext.create = async values => {
    const row = record({ ...values, id: rows.size + 1, updatedAt: new Date() }); rows.set(values.UserId, row); return row;
  };
  return { rows, users, calls, invalidations };
}
test('ES-14: empty, draft, confirmed, edit and language clearing use server metadata', async t => {
  const { calls, invalidations } = setup(); const request = await startApp(t);
  const as = { role: 'user' };
  assert.deepEqual((await request('GET', '/api/user/context', as)).body, { schemaVersion: 1, version: 0, context: null, savedAt: null, completedAt: null });
  const draft = await request('PUT', '/api/user/context', { ...as, body: body({ residenceCountry: 'CO', targetMarket: 'ES', availabilityMinutesPerWeek: 0 }) });
  assert.equal(draft.status, 200); assert.equal(draft.body.version, 1); assert.equal(draft.body.completedAt, null);
  assert.equal(draft.body.context.availabilityMinutesPerWeek, 0);
  const completed = await request('PUT', '/api/user/context', { ...as, body: body({ preferredLanguage: 'en', timeZone: 'America/Bogota' }, 1, 'continue') });
  assert.equal(completed.status, 200); assert.ok(completed.body.savedAt); assert.ok(completed.body.completedAt);
  assert.deepEqual((await request('GET', '/api/user/context', as)).body, completed.body);
  assert.equal((await request('PUT', '/api/user/context', { ...as, body: body({}, 2) })).body.completedAt, null);
  assert.ok(calls.every(call => call.where.id === 101 && call.where.active === true && call.where.role === 'user' && call.lock === 'UPDATE'));
  assert.deepEqual(invalidations.map(({ UserId, sourceType, reason }) => ({ UserId, sourceType, reason })), [1, 2].map(() => ({ UserId: 101, sourceType: 'participant_context', reason: 'edited' })));
});
test('ES-14 A/B: owner from JWT, body/query/path foreign IDs rejected, no admin bypass', async t => {
  setup(); const request = await startApp(t);
  const saved = await request('PUT', '/api/user/context', { role: 'user', id: 202, body: body({ profession: 'Synthetic teacher' }) });
  assert.equal(saved.status, 200);
  assert.equal((await request('GET', '/api/user/context', { role: 'user', id: 101 })).body.context, null);
  for (const url of ['/api/user/context?UserId=202', '/api/user/context?userId=202']) assert.equal((await request('GET', url, { role: 'user' })).status, 400);
  for (const method of ['GET', 'PUT']) assert.equal((await request(method, '/api/user/context/202', { role: 'user', body: method === 'PUT' ? body() : undefined })).status, 404);
  for (const key of ['id', 'UserId', 'userId', 'ownerId', 'role']) assert.equal((await request('PUT', '/api/user/context', { role: 'user', body: { ...body(), [key]: 202 } })).status, 400);
  for (const role of ['admin', 'superadmin', 'therapist', 'board']) for (const method of ['GET', 'PUT']) assert.equal((await request(method, '/api/user/context', { role, body: method === 'PUT' ? body() : undefined })).status, 403);
  assert.equal((await request('GET', '/api/user/context')).status, 403);
  assert.equal((await request('GET', '/api/user/context', { role: 'user', id: 202 })).body.context.profession, 'Synthetic teacher');
});
test('ES-14: inactive, missing and changed-role principals denied on reads and writes', async t => {
  const { users } = setup(); const request = await startApp(t);
  for (const user of [{ id: 101, active: false, role: 'user' }, { id: 101, active: true, role: 'admin' }, null]) {
    if (user) users.set(101, user); else users.delete(101);
    for (const method of ['GET', 'PUT']) assert.equal((await request(method, '/api/user/context', { role: 'user', body: method === 'PUT' ? body() : undefined })).status, 403);
  }
});
test('ES-14: strict contract rejects malformed data before persistence', async t => {
  const { rows } = setup(); const request = await startApp(t);
  const invalid = [body({ preferredLanguage: 'fr' }), body({ residenceCountry: 'ZZ' }), body({ targetMarket: 'World' }), body({ timeZone: 'EST' }),
    body({ timeZone: 'Invalid/Zone' }), body({ profession: 'x'.repeat(121) }), body({ interests: 'x'.repeat(501) }),
    ...[-1, 10081, 2.5, '5'].map(value => body({ availabilityMinutesPerWeek: value })), body({ userId: 202 }),
    body({ entry: 'personal' }), body({ crisis: true }), body({}, 0, 'continue'), { ...body(), expectedVersion: '0' },
    { ...body(), schemaVersion: 2 }, { ...body(), context: {} }, [], null];
  for (const input of invalid) assert.equal((await request('PUT', '/api/user/context', { role: 'user', body: input })).status, 400);
  assert.equal(rows.size, 0);
});
test('ES-14: stale versions return 409, preserve the current record and never echo content', async t => {
  setup(); const request = await startApp(t);
  const saved = await request('PUT', '/api/user/context', { role: 'user', body: body({ profession: 'Current version' }) });
  const conflict = await request('PUT', '/api/user/context', { role: 'user', body: body({ profession: 'Stale version' }) });
  assert.deepEqual({ status: conflict.status, body: conflict.body }, { status: 409, body: { error: 'context_conflict' } });
  assert.deepEqual((await request('GET', '/api/user/context', { role: 'user' })).body, saved.body);
});
test('ES-14: database and commit failures return 503 without private data or false success', async t => {
  setup(); const request = await startApp(t);
  models.ParticipantContext.findOne = async () => { throw new Error('PRIVATE DATABASE DETAIL'); };
  const failedGet = await request('GET', '/api/user/context', { role: 'user' });
  assert.deepEqual({ status: failedGet.status, body: failedGet.body }, { status: 503, body: { error: 'context_unavailable' } });
  models.ParticipantContext.findOne = async () => null;
  database.sequelize.transaction = async () => ({ async commit() { throw new Error('PRIVATE COMMIT'); }, async rollback() {} });
  const failedPut = await request('PUT', '/api/user/context', { role: 'user', body: body() });
  assert.deepEqual({ status: failedPut.status, body: failedPut.body }, { status: 503, body: { error: 'context_unavailable' } });
});
