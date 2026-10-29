const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models, record, startApp } = require('./support.cjs');

test('QA-9-02: public input and legitimate authentication', async t => {
  let queries = 0;
  let writes = 0;
  models.User.findOne = async () => { queries++; return null; };
  models.User.create = async values => { writes++; return record(values); };
  const request = await startApp(t);
  const password = randomBytes(24).toString('hex');
  const valid = { email: 'synthetic@example.invalid', password };
  const invalid = [undefined, {}, [], { ...valid, email: {} },
    { ...valid, password: {} }, { ...valid, email: null },
    { ...valid, email: 123 }, { ...valid, password: ' ' }];
  for (const body of invalid) {
    assert.equal((await request('POST', '/api/login', { body })).status, 400);
    assert.equal(queries, 0);
  }
  for (const value of [undefined, null, {}, [], 123, false, '', ' ']) {
    for (const field of ['name', 'email', 'password']) {
      assert.equal((await request('POST', '/api/register', {
        body: { name: 'Synthetic', ...valid, [field]: value },
      })).status, 400);
      assert.equal(queries, 0);
      assert.equal(writes, 0);
    }
  }
  assert.equal((await request('POST', '/api/login', { body: valid })).status, 401);
  assert.equal((await request('POST', '/api/register', {
    body: { name: 'Synthetic', ...valid },
  })).status, 201);
  const user = record({ id: 101, name: 'Synthetic', role: 'user', active: true,
    password: await bcrypt.hash(password, 4), loginAttempts: 0 });
  models.User.findOne = async () => user;
  const login = await request('POST', '/api/login', { body: valid });
  assert.equal(login.status, 200);
  assert.equal(jwt.verify(login.body.token, process.env.JWT_SECRET).id, 101);
  assert.equal(writes, 1);
});

test('QA-9-02: body consumers reject invalid types before side effects', async t => {
  let calls = 0;
  // Session/tombstone reads are authorization, not side effects of the submitted body.
  for (const [name, model] of Object.entries(models)) {
    if (['RevokedToken', 'AuthRevocation', 'DeletionRequest'].includes(name)) continue;
    for (const method of ['findOne', 'findByPk', 'findAll', 'create', 'update', 'upsert']) {
      model[method] = async () => { calls++; throw new Error('Unexpected model call'); };
    }
  }
  const request = await startApp(t);
  const baseline = {
    name: 'Synthetic', email: 'synthetic@example.invalid', password: randomBytes(24).toString('hex'), role: 'user',
    message: 'Synthetic', mood: 3, rating: 3, answers: { area: 'synthetic' }, requestId: 7,
    therapistId: 303, planId: 7, adminNote: 'Synthetic', content: 'Synthetic '.repeat(8),
    key: 'synthetic', note: 'Synthetic', name_es: 'Sintético', name_en: 'Synthetic', slug: 'synthetic',
    features_es: [], patientId: 7, scheduledAt: '2099-01-01T12:00:00Z', duration: 50,
    therapistNote: 'Synthetic fixture', patientMoodAfter: 3, sessionDate: '2099-01-01',
  };
  const cases = [
    ['POST', '/api/chat', 'user', 'message'],
    ['POST', '/api/mood/checkin', 'user', 'mood'],
    ['POST', '/api/mood/checkout', 'user', 'mood'],
    ['POST', '/api/rating', 'user', 'rating'],
    ['PUT', '/api/user/onboarding-complete', 'user', 'motivation'],
    ['POST', '/api/matching/request', 'user', 'answers'],
    ['POST', '/api/matching/choose', 'user', 'requestId'],
    ['POST', '/api/plan-requests', 'user', 'planId'],
    ['PUT', '/api/plan-requests/admin/7/approve', 'admin', 'adminNote'],
    ['PUT', '/api/plan-requests/admin/7/reject', 'admin', 'adminNote'],
    ['POST', '/api/manifest/manifest', 'board', 'content'],
    ['POST', '/api/admin/usuarios', 'superadmin', 'name'],
    ['PUT', '/api/admin/usuarios/7', 'superadmin', 'active'],
    ['PUT', '/api/admin/usuarios/7/asignar-terapeuta', 'superadmin', 'therapistId'],
    ['PUT', '/api/admin/usuarios/7/plan', 'superadmin', 'planId'],
    ['PUT', '/api/admin/usuarios/7/reset-password', 'superadmin', 'newPassword'],
    ['POST', '/api/admin/prompt', 'admin', 'content'],
    ['POST', '/api/admin/prompt/propose', 'admin', 'content'],
    ['POST', '/api/superadmin/prompt/7/reject', 'superadmin', 'note'],
    ['POST', '/api/pricing', 'admin', 'name_es'],
    ['PUT', '/api/pricing/7', 'admin', 'features_es'],
    ['POST', '/api/therapist/validation/7/approve', 'superadmin', 'note'],
    ['POST', '/api/therapist/validation/7/reject', 'superadmin', 'note'],
    ['POST', '/api/therapist/prompt/propose', 'therapist', 'content'],
    ['POST', '/api/therapist/pacientes/7/notas', 'therapist', 'content'],
    ['PUT', '/api/therapist/notas/7', 'therapist', 'content'],
    ['POST', '/api/sessions/therapist', 'therapist', 'scheduledAt'],
    ['PUT', '/api/sessions/therapist/7', 'therapist', 'scheduledAt'],
    ['POST', '/api/sessions/therapist/7/notes', 'therapist', 'content'],
    ['POST', '/api/sessions/therapist/7/end', 'therapist', 'therapistNote'],
  ];
  for (const [method, path, role, field] of cases) await t.test(method + ' ' + path, async () => {
    for (const body of [undefined, [], { ...baseline, [field]: { $ne: null } }]) {
      assert.equal((await request(method, path, { role, body })).status, 400);
      assert.equal(calls, 0);
    }
  });

  let saved;
  models.MoodLog.upsert = async values => { saved = values; return [values]; };
  assert.equal((await request('POST', '/api/mood/checkin', {
    role: 'user', id: 101, body: { mood: 3, UserId: 999 },
  })).status, 200);
  assert.equal(saved.UserId, 101);
  models.User.findOne = async ({ where }) => {
    assert.equal(where.therapistId, 101);
    return null;
  };
  assert.equal((await request('POST', '/api/sessions/therapist', {
    role: 'therapist', body: { patientId: 999, scheduledAt: '2099-01-01T12:00:00Z', duration: 50 },
  })).status, 403);
  models.User.findOne = async () => record({ id: 7, therapistId: 101 });
  models.User.findAll = async () => []; // ES-101: lectura de autorización (cuentas inactivas), no un efecto del cuerpo enviado
  models.TherapySession.create = async values => { saved = values; return record({ id: 8, ...values }); };
  assert.equal((await request('POST', '/api/sessions/therapist', {
    role: 'therapist', body: { patientId: 7, scheduledAt: '2099-01-01T12:00:00Z', duration: 50, therapistId: 999 },
  })).status, 201);
  assert.equal(saved.therapistId, 101);
});
