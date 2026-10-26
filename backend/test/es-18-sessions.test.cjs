const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models, record, startApp } = require('./support.cjs');

const now = () => Math.floor(Date.now() / 1000);
const token = (claims = {}, options = {}) => jwt.sign(
  { id: 101, role: 'user', name: 'Synthetic actor', jti: randomBytes(8).toString('hex'), ...claims },
  process.env.JWT_SECRET, { expiresIn: '1h', ...options },
);
const call = (request, method, url, bearer, body) => request(method, url, {
  headers: bearer ? { Authorization: 'Bearer ' + bearer } : {}, body,
});

// Almacén en memoria para RevokedToken / AuthRevocation con la misma forma que usa utils/sessions.js
function sessionStore() {
  const revoked = new Map();
  const cutoffs = new Map();
  models.RevokedToken.findByPk = async jti => revoked.get(jti) ?? null;
  models.RevokedToken.upsert = async row => { revoked.set(row.jti, row); };
  models.RevokedToken.destroy = async () => 0;
  models.AuthRevocation.findByPk = async id => cutoffs.get(id) ?? null;
  models.AuthRevocation.upsert = async row => { cutoffs.set(row.UserId, row); };
  return { revoked, cutoffs };
}

test('ES-18: el login emite tokens con jti único y vencimiento de 8 h', async t => {
  sessionStore();
  const password = randomBytes(24).toString('hex');
  const account = record({ id: 101, name: 'Synthetic', email: 'a@example.invalid', role: 'user', active: true,
    password: await bcrypt.hash(password, 4), loginAttempts: 0, lockedUntil: null });
  models.User.findOne = async () => account;
  const request = await startApp(t);
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const response = await request('POST', '/api/login', { body: { email: 'a@example.invalid', password } });
    assert.equal(response.status, 200);
    tokens.push(jwt.verify(response.body.token, process.env.JWT_SECRET));
  }
  for (const claims of tokens) {
    assert.match(claims.jti, /^[0-9a-f]{32}$/);
    assert.equal(claims.exp - claims.iat, 8 * 3600);
    assert.equal(claims.id, 101);
  }
  assert.notEqual(tokens[0].jti, tokens[1].jti);
});

test('ES-18: logout revoca solo el token actual y las demás sesiones siguen vivas', async t => {
  const { revoked } = sessionStore();
  models.message.findAll = async () => [];
  const request = await startApp(t);
  const first = token();
  const second = token();
  assert.equal((await call(request, 'GET', '/api/messages', first)).status, 200);
  assert.equal((await call(request, 'POST', '/api/logout', first)).status, 200);
  assert.equal(revoked.size, 1);
  const stored = [...revoked.values()][0];
  assert.equal(stored.UserId, 101);
  assert.equal(stored.jti, jwt.decode(first).jti);
  assert.equal(stored.expiresAt.getTime(), jwt.decode(first).exp * 1000);
  // El mismo token ya no sirve (ni para volver a cerrar sesión) y el otro sí.
  assert.equal((await call(request, 'GET', '/api/messages', first)).status, 401);
  assert.equal((await call(request, 'POST', '/api/logout', first)).status, 401);
  assert.equal((await call(request, 'GET', '/api/messages', second)).status, 200);
});

test('ES-18: logout-all corta todas las sesiones anteriores y permite una nueva', async t => {
  const { cutoffs } = sessionStore();
  models.message.findAll = async () => [];
  const request = await startApp(t);
  const old = token({ iat: now() - 120 });
  const other = token({ iat: now() - 60 });
  assert.equal((await call(request, 'POST', '/api/logout-all', old)).status, 200);
  assert.equal(cutoffs.get(101).UserId, 101);
  assert.equal((await call(request, 'GET', '/api/messages', old)).status, 401);
  assert.equal((await call(request, 'GET', '/api/messages', other)).status, 401);
  // Una sesión iniciada después del corte vale; otra persona no se ve afectada.
  assert.equal((await call(request, 'GET', '/api/messages', token({ iat: now() + 5 }))).status, 200);
  assert.equal((await call(request, 'GET', '/api/messages', token({ id: 202, iat: now() - 120 }))).status, 200);
});

test('ES-18: expirado, alterado, otra firma, sin jti y sin cabecera se rechazan', async t => {
  sessionStore();
  models.message.findAll = async () => { throw new Error('No debe llegar a la ruta'); };
  const request = await startApp(t);
  const good = token();
  const tampered = good.slice(0, -2) + (good.endsWith('AA') ? 'BB' : 'AA');
  assert.equal((await call(request, 'GET', '/api/messages', token({ iat: now() - 7200 }, { expiresIn: 60 }))).status, 401);
  assert.equal((await call(request, 'GET', '/api/messages', tampered)).status, 401);
  assert.equal((await call(request, 'GET', '/api/messages', jwt.sign({ id: 101, role: 'user', jti: 'x' }, randomBytes(32).toString('hex')))).status, 401);
  // Token anterior a ES-18 (sin jti)
  assert.equal((await call(request, 'GET', '/api/messages', jwt.sign({ id: 101, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' }))).status, 401);
  assert.equal((await call(request, 'GET', '/api/messages')).status, 403);
  const forgedAlg = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    + '.' + Buffer.from(JSON.stringify({ id: 1, role: 'superadmin', jti: 'x' })).toString('base64url') + '.';
  assert.equal((await call(request, 'GET', '/api/admin/usuarios', forgedAlg)).status, 401);
});

test('ES-18: si no se puede comprobar la sesión se rechaza (cierra en falla)', async t => {
  sessionStore();
  models.RevokedToken.findByPk = async () => { throw new Error('base caída'); };
  let reached = 0;
  models.message.findAll = async () => { reached++; return []; };
  const request = await startApp(t);
  const response = await call(request, 'GET', '/api/messages', token());
  assert.equal(response.status, 503);
  assert.equal(reached, 0);
  assert.doesNotMatch(JSON.stringify(response.body), /base caída/);
});

test('ES-18: un administrador que cambia rol/estado, borra o restablece la contraseña corta las sesiones de esa cuenta', async t => {
  const { cutoffs } = sessionStore();
  const accounts = new Map();
  const make = (id, role = 'user') => {
    const row = record({ id, name: 'Synthetic ' + id, email: `u${id}@example.invalid`, role, active: true,
      async destroy() { accounts.delete(id); } });
    accounts.set(id, row);
    return row;
  };
  models.User.findByPk = async id => accounts.get(Number(id)) ?? null;
  const request = await startApp(t);
  const admin = token({ id: 1, role: 'admin' });
  const superadmin = token({ id: 2, role: 'superadmin' });
  make(7); make(8); make(9);

  // Sin campos de rol/estado no se corta nada.
  assert.equal((await call(request, 'PUT', '/api/admin/usuarios/7', admin, {})).status, 200);
  assert.equal(cutoffs.has(7), false);
  assert.equal((await call(request, 'PUT', '/api/admin/usuarios/7', admin, { active: false })).status, 200);
  assert.equal(cutoffs.get(7).UserId, 7);
  assert.equal((await call(request, 'PUT', '/api/admin/usuarios/8', superadmin, { role: 'therapist' })).status, 200);
  assert.equal(cutoffs.get(8).UserId, 8);
  assert.equal((await call(request, 'PUT', '/api/admin/usuarios/9/reset-password', superadmin, { newPassword: 'clave-temporal-1' })).status, 200);
  assert.equal(cutoffs.get(9).UserId, 9);
  assert.equal((await call(request, 'DELETE', '/api/admin/usuarios/8', superadmin)).status, 200);
  // El administrador sin permiso no corta nada.
  cutoffs.clear();
  assert.equal((await call(request, 'DELETE', '/api/admin/usuarios/9', admin)).status, 403);
  assert.equal((await call(request, 'PUT', '/api/admin/usuarios/9/reset-password', admin, { newPassword: 'clave-temporal-1' })).status, 403);
  assert.equal(cutoffs.size, 0);
});
