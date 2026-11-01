process.env.PASSWORD_RESET_IP_LIMIT = '1000';
process.env.PASSWORD_RESET_CONFIRM_LIMIT = '1000';
process.env.MAIL_PROVIDER = 'test';
process.env.MAIL_FROM = 'no-reply@example.invalid';
process.env.APP_BASE_URL = 'https://app.example.invalid/';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { models, record, startApp } = require('./support.cjs');
const mailer = require('../utils/mailer');
const resetRouter = require('../routes/passwordReset');

// --- Dobles: tabla PasswordResets en memoria con la semántica atómica que la ruta necesita ---
let rows; let sent; let users; let revoked; let logs; let nextId;
const matches = (row, where) => Object.entries(where).every(([key, expected]) => {
  const value = row[key];
  if (expected === null) return value === null || value === undefined;
  if (expected && typeof expected === 'object' && expected[Op.gt] !== undefined) return value > expected[Op.gt];
  return value === expected;
});
const originalConsole = { error: console.error, log: console.log, warn: console.warn };

beforeEach(() => {
  rows = []; sent = []; revoked = []; logs = []; nextId = 1;
  users = new Map();
  models.PasswordReset.count = async ({ where }) => rows.filter(row => matches(row, where)).length;
  models.PasswordReset.create = async values => { const row = { id: nextId++, usedAt: null, createdAt: new Date(), ...values }; rows.push(row); return row; };
  models.PasswordReset.findOne = async ({ where }) => rows.find(row => matches(row, where)) ?? null;
  models.PasswordReset.update = async (values, { where }) => { const hit = rows.filter(row => matches(row, where)); hit.forEach(row => Object.assign(row, values)); return [hit.length]; };
  models.User.findOne = async ({ where }) => users.get(where.email) ?? null;
  models.User.findByPk = async id => [...users.values()].find(user => user.id === id) ?? null;
  models.AuthRevocation.upsert = async values => { revoked.push(values.UserId); };
  mailer.providers.test = async message => { sent.push(message); };
  for (const level of ['error', 'log', 'warn']) console[level] = (...args) => { logs.push(args.join(' ')); };
});
const restoreConsole = () => Object.assign(console, originalConsole);
const tokenFrom = message => new URL(message.text.match(/https:\/\/\S+/)[0]).hash.replace('#token=', '');
const addUser = async (email, extra = {}) => {
  const user = record({ id: 7 + users.size, email, name: 'Synthetic', role: 'user', active: true, password: await bcrypt.hash('Old-password-1', 4), loginAttempts: 2, lockedUntil: new Date(Date.now() + 1000), ...extra });
  users.set(email, user); return user;
};
const STRONG = 'Nueva-clave-9';

test('ES-132: la solicitud responde igual exista o no el correo y solo envía a cuentas activas', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid'); await addUser('off@example.invalid', { active: false });
  models.DeletionRequest.findOne = async ({ where }) => where.UserId === 9 ? { id: 1 } : null;
  await addUser('deleting@example.invalid');
  const answers = [];
  for (const email of ['known@example.invalid', 'unknown@example.invalid', 'off@example.invalid', 'deleting@example.invalid']) {
    const response = await request('POST', '/api/password-reset/request', { body: { email } });
    answers.push([response.status, JSON.stringify(response.body)]);
  }
  await resetRouter.idle();
  assert.equal(new Set(answers.map(String)).size, 1); assert.equal(answers[0][0], 202);
  assert.equal(sent.length, 1); assert.equal(sent[0].to, 'known@example.invalid'); assert.equal(rows.length, 1);
  models.DeletionRequest.findOne = async () => null;
});

test('ES-132: correo ES/EN con enlace en el fragmento, vencimiento y sin token guardado en claro', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid');
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid', locale: 'en' } });
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid', locale: 'xx' } });
  await resetRouter.idle();
  assert.equal(sent.length, 2); assert.equal(sent[0].from, 'no-reply@example.invalid');
  assert.match(sent[0].subject, /new password/i); assert.match(sent[0].text, /ignore this message/); assert.match(sent[0].text, /30 minutes/);
  assert.match(sent[1].subject, /contraseña nueva/); assert.match(sent[1].text, /Si no fuiste tú/); assert.match(sent[1].text, /30 minutos/);
  const link = sent[1].text.match(/https:\/\/\S+/)[0];
  assert.match(link, /^https:\/\/app\.example\.invalid\/reset-password#token=[A-Za-z0-9_-]{43}$/);
  const token = tokenFrom(sent[1]);
  assert.ok(rows.every(row => row.tokenHash !== token && /^[0-9a-f]{64}$/.test(row.tokenHash)));
  assert.equal(rows.at(-1).tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(rows.at(-1).expiresAt - Date.now() <= 30 * 60 * 1000 + 1000);
});

test('ES-132: una solicitud nueva invalida el enlace anterior y hay un máximo de enlaces por cuenta y hora', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid');
  for (let i = 0; i < 5; i++) { await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle(); }
  assert.equal(sent.length, 3); assert.equal(rows.length, 3);
  assert.equal(rows.filter(row => row.usedAt === null).length, 1);
  const first = await request('POST', '/api/password-reset/confirm', { body: { token: tokenFrom(sent[0]), password: STRONG } });
  assert.equal(first.status, 400); assert.equal(first.body.code, 'reset_invalid');
  const last = await request('POST', '/api/password-reset/confirm', { body: { token: tokenFrom(sent[2]), password: STRONG } });
  assert.equal(last.status, 200);
});

test('ES-132: el enlace sirve una sola vez, cambia la contraseña, revoca sesiones y desbloquea la cuenta', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  const user = await addUser('known@example.invalid'); const oldHash = user.password;
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  const token = tokenFrom(sent[0]);
  const done = await request('POST', '/api/password-reset/confirm', { body: { token, password: STRONG } });
  assert.equal(done.status, 200);
  assert.notEqual(user.password, oldHash); assert.equal(await bcrypt.compare(STRONG, user.password), true);
  assert.equal(user.loginAttempts, 0); assert.equal(user.lockedUntil, null); assert.deepEqual(revoked, [user.id]);
  const again = await request('POST', '/api/password-reset/confirm', { body: { token, password: 'Otra-clave-7!' } });
  assert.equal(again.status, 400); assert.equal(again.body.code, 'reset_invalid');
  assert.equal(await bcrypt.compare(STRONG, user.password), true);
  assert.equal(rows.every(row => row.usedAt !== null), true);
});

test('ES-132: dos confirmaciones simultáneas con el mismo enlace: solo una gana', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  const user = await addUser('known@example.invalid');
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  const token = tokenFrom(sent[0]);
  const results = await Promise.all([1, 2, 3, 4].map(n => request('POST', '/api/password-reset/confirm', { body: { token, password: `Clave-${n}-valida!` } })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 400 && r.body.code === 'reset_invalid').length, 3);
  assert.equal(revoked.length, 1); assert.ok(user.password);
});

test('ES-132: enlace vencido, inexistente, de otra cuenta inactiva o malformado responden lo mismo (reset_invalid)', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  const user = await addUser('known@example.invalid');
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  const token = tokenFrom(sent[0]);
  rows[0].expiresAt = new Date(Date.now() - 1000);
  const answers = [];
  for (const candidate of [token, 'x'.repeat(43), 'a', 'x'.repeat(5000)]) {
    const response = await request('POST', '/api/password-reset/confirm', { body: { token: candidate, password: STRONG } });
    answers.push([response.status, response.body.code]);
  }
  assert.deepEqual(answers, answers.map(() => [400, 'reset_invalid']));
  rows[0].expiresAt = new Date(Date.now() + 60000); user.active = false;
  const inactive = await request('POST', '/api/password-reset/confirm', { body: { token, password: STRONG } });
  assert.equal(inactive.body.code, 'reset_invalid'); assert.notEqual(await bcrypt.compare(STRONG, user.password), true);
});

test('ES-132: una contraseña débil no gasta el enlace y devuelve los requisitos que faltan (política de ES-128)', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  const user = await addUser('known@example.invalid'); const oldHash = user.password;
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  const token = tokenFrom(sent[0]);
  const weak = await request('POST', '/api/password-reset/confirm', { body: { token, password: 'abcdefgh' } });
  assert.equal(weak.status, 400); assert.equal(weak.body.code, 'password_policy'); assert.deepEqual(weak.body.missing, ['upper', 'digit', 'special']);
  assert.equal(user.password, oldHash); assert.equal(rows[0].usedAt, null); assert.deepEqual(revoked, []);
  assert.equal((await request('POST', '/api/password-reset/confirm', { body: { token, password: STRONG } })).status, 200);
});

test('ES-132: entradas inválidas responden 400 controlado y nunca 5xx ni escriben', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid');
  for (const body of [undefined, {}, { email: '' }, { email: 5 }, { email: [] }, { email: null }]) {
    const response = await request('POST', '/api/password-reset/request', { body });
    assert.equal(response.status, 400);
  }
  for (const body of [{}, { token: '' }, { token: 'x' }, { password: STRONG }, { token: 5, password: STRONG }, { token: 'x', password: {} }]) {
    const response = await request('POST', '/api/password-reset/confirm', { body });
    assert.ok(response.status === 400, JSON.stringify(body));
  }
  assert.equal(rows.length, 0); assert.deepEqual(revoked, []);
});

test('ES-132: el token y el enlace nunca aparecen en logs ni en respuestas, y sin proveedor no se envía ni se registra el enlace', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid');
  const responses = [await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } })]; await resetRouter.idle();
  const token = tokenFrom(sent[0]);
  responses.push(await request('POST', '/api/password-reset/confirm', { body: { token, password: STRONG } }));
  responses.push(await request('POST', '/api/password-reset/confirm', { body: { token, password: STRONG } }));
  const everything = JSON.stringify(responses.map(r => r.body)) + logs.join('\n');
  for (const secret of [token, STRONG, 'reset-password#']) assert.equal(everything.includes(secret), false, secret);
  // Sin proveedor: no se envía.
  const provider = process.env.MAIL_PROVIDER; delete process.env.MAIL_PROVIDER; sent.length = 0;
  await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  process.env.MAIL_PROVIDER = provider;
  assert.equal(sent.length, 0);
  assert.equal(logs.some(line => /sin proveedor/.test(line)), true);
  assert.equal(logs.join('\n').includes('known@example.invalid'), false);
});

test('ES-132: un fallo del proveedor de correo no cambia la respuesta ni filtra datos', async t => {
  const request = await startApp(t); t.after(restoreConsole);
  await addUser('known@example.invalid');
  mailer.providers.test = async () => { throw new Error('boom known@example.invalid'); };
  const response = await request('POST', '/api/password-reset/request', { body: { email: 'known@example.invalid' } }); await resetRouter.idle();
  assert.equal(response.status, 202);
  assert.equal(logs.join('\n').includes('known@example.invalid'), false);
});
