// Correcciones de la revisión de QA sobre ES-18: QA-18-01 (rol en /api/therapist/*), QA-18-02 (promedios con pocas
// entradas) y QA-18-05 (login inmediatamente posterior a logout-all).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models, record, startApp } = require('./support.cjs');

const as = (id, role = 'user') => ({ role, id });
const stamped = (claims = {}) => jwt.sign(
  { id: 101, role: 'user', name: 'Synthetic', jti: randomBytes(8).toString('hex'), ...claims },
  process.env.JWT_SECRET, { expiresIn: '1h' },
);

function sessionStore() {
  const revoked = new Map();
  const cutoffs = new Map();
  models.RevokedToken.findByPk = async jti => revoked.get(jti) ?? null;
  models.RevokedToken.upsert = async row => { revoked.set(row.jti, row); };
  models.AuthRevocation.findByPk = async id => cutoffs.get(id) ?? null;
  models.AuthRevocation.upsert = async row => { cutoffs.set(row.UserId, row); };
  return { cutoffs };
}

test('QA-18-01: solo el rol terapeuta entra a /api/therapist/*; la validación documental conserva sus roles', async t => {
  sessionStore();
  models.User.findAll = async () => [];
  models.MoodLog.findAll = async () => [];
  models.SessionRating.findAll = async () => [];
  models.TherapistValidation.findAll = async () => [];
  const request = await startApp(t);
  const routes = ['/api/therapist/pacientes', '/api/therapist/alerts', '/api/therapist/prompt', '/api/therapist/pacientes/7/historial',
    '/api/therapist/pacientes/7/resumen-ia'];
  for (const role of ['user', 'admin', 'superadmin', 'board']) {
    for (const url of routes) {
      const response = await request('GET', url, as(50, role));
      assert.equal(response.status, 403, `${role} ${url}`);
      assert.match(response.body.error, /Solo terapeutas/);
    }
  }
  assert.equal((await request('GET', '/api/therapist/pacientes')).status, 403); // sin sesión
  const allowed = await request('GET', '/api/therapist/pacientes', as(301, 'therapist'));
  assert.notEqual(allowed.status, 403);
  // Montaje anterior a las rutas de terapeuta: el superadmin sigue revisando documentos y el usuario no.
  assert.equal((await request('GET', '/api/therapist/validation/pending', as(2, 'superadmin'))).status, 200);
  const notSuper = await request('GET', '/api/therapist/validation/pending', as(301, 'therapist'));
  assert.equal(notSuper.status, 403);
  assert.doesNotMatch(notSuper.body.error, /Solo terapeutas/); // lo rechaza su propio control, no el de terapeutas
});

test('QA-18-02: promedios de ánimo y valoración solo con suficientes entradas (lista y estadísticas)', async t => {
  sessionStore();
  const rows = new Map([[7, [1, 2, 3, 4]], [8, [5, 5, 5, 5, 5]], [9, [4]]]); // entradas de ánimo por persona
  const mine = id => rows.get(Number(id)) ?? [];
  models.User.findAll = async () => [...rows.keys()].map(id => record({ id, name: `U${id}`, email: `${id}@example.invalid`, role: 'user', active: true }));
  models.User.findByPk = async id => record({ id: Number(id), name: `U${id}`, email: `${id}@example.invalid`, role: 'user', active: true });
  models.MoodLog.count = async ({ where }) => mine(where.UserId).length;
  models.MoodLog.findAll = async ({ where }) => mine(where.UserId).map(value => ({ checkin_mood: value, checkout_mood: null }));
  models.SessionRating.findAll = async ({ where }) => mine(where.UserId).map(rating => ({ rating }));
  const request = await startApp(t);
  const admin = as(1, 'admin');

  const list = (await request('GET', '/api/admin/usuarios', admin)).body;
  const byId = Object.fromEntries(list.map(u => [u.id, u]));
  assert.equal(byId[7].moodPromedio, null);   // 4 entradas: no se promedia
  assert.equal(byId[7].ratingPromedio, null);
  assert.equal(byId[9].moodPromedio, null);   // una sola entrada: no revela el valor individual
  assert.equal(byId[9].ratingPromedio, null);
  assert.equal(byId[8].moodPromedio, 5);      // 5 entradas: se promedia
  assert.equal(byId[8].ratingPromedio, 5);
  assert.equal(byId[9].sesiones, 1);

  for (const [id, expected] of [[7, null], [8, 5], [9, null]]) {
    const stats = (await request('GET', `/api/admin/usuarios/${id}/stats`, admin)).body.stats;
    assert.equal(stats.moodPromedio, expected, `stats ${id}`);
    assert.equal(stats.ratingPromedio, expected, `stats ${id}`);
  }
  assert.doesNotMatch(JSON.stringify(list), /"moodPromedio":4(\.0)?[,}]/); // el único valor (4) de la persona 9 no aparece
});

test('QA-18-05: un login inmediatamente posterior a logout-all vale; los tokens anteriores, aunque sean del mismo segundo, no', async t => {
  const { cutoffs } = sessionStore();
  models.message.findAll = async () => [];
  const password = randomBytes(24).toString('hex');
  const account = record({ id: 101, name: 'Synthetic', email: 'a@example.invalid', role: 'user', active: true,
    password: await bcrypt.hash(password, 4), loginAttempts: 0, lockedUntil: null });
  models.User.findOne = async () => account;
  const request = await startApp(t);
  const login = async () => (await request('POST', '/api/login', { body: { email: 'a@example.invalid', password } })).body.token;
  const read = token => request('GET', '/api/messages', { headers: { Authorization: 'Bearer ' + token } });

  const before = await login();
  assert.equal(typeof jwt.decode(before).iatMs, 'number');
  assert.equal((await read(before)).status, 200);
  assert.equal((await request('POST', '/api/logout-all', { headers: { Authorization: 'Bearer ' + before } })).status, 200);
  const after = await login(); // dentro del mismo segundo del corte
  assert.ok(jwt.decode(after).iatMs > cutoffs.get(101).revokedBefore.getTime());
  assert.equal((await read(after)).status, 200);
  assert.equal((await read(before)).status, 401);

  // Tokens con iatMs exacto alrededor del corte.
  const cut = cutoffs.get(101).revokedBefore.getTime();
  assert.equal((await read(stamped({ iatMs: cut }))).status, 401);
  assert.equal((await read(stamped({ iatMs: cut - 1 }))).status, 401);
  assert.equal((await read(stamped({ iatMs: cut + 1 }))).status, 200);
  // Sin iatMs se usa el segundo de iat de forma conservadora.
  assert.equal((await read(stamped({ iat: Math.floor(cut / 1000) }))).status, 401);
  assert.equal((await read(stamped({ iat: Math.floor(cut / 1000) + 2 }))).status, 200);
});
