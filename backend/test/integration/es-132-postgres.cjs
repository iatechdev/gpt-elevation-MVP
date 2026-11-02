// ES-132 contra Postgres REAL: migración, enlace de un solo uso con concurrencia real, vencimiento, fuerza bruta,
// revocación de sesiones y desbloqueo. El PROVEEDOR de correo está simulado. Crea y borra SOLO su propia base aleatoria
// en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES132_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:passwordreset:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');

test('ES-132 PostgreSQL: recuperación de contraseña de un solo uso, con vencimiento, concurrencia y revocación de sesiones', { timeout: 120000 }, async (t) => {
  const source = process.env.ES132_TEST_DATABASE_URL;
  assert.ok(source, 'ES132_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es132_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es132_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 10, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PASSWORD_RESET_IP_LIMIT = '100000';
  process.env.PASSWORD_RESET_CONFIRM_LIMIT = '100000';
  process.env.MAIL_PROVIDER = 'test';
  process.env.APP_BASE_URL = 'https://app.example.invalid';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync(); // User la consulta al sincronizar
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map(model => model.sync()));
  // La tabla de enlaces se crea con la migración real, no con sync().
  const migration = require('../../migrations/20261101-es132-password-reset.cjs');
  await migration.up(sequelize); await migration.up(sequelize); // idempotente
  const PasswordReset = require('../../PasswordReset');
  const columns = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'PasswordResets'`, { type: 'SELECT' });
  assert.deepEqual(columns.map(c => c.column_name).sort(), ['UserId', 'createdAt', 'expiresAt', 'id', 'tokenHash', 'updatedAt', 'usedAt']);

  const mailer = require('../../utils/mailer');
  const sent = [];
  mailer.providers.test = async message => { sent.push(message); };
  const router = require('../../routes/passwordReset');
  const { issueToken, sessionProblem } = require('../../utils/sessions');
  const app = express(); app.use(express.json()); app.use('/api', router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const tokenOf = message => new URL(message.text.match(/https:\/\/\S+/)[0]).hash.replace('#token=', '');
  const ask = async email => { sent.length = 0; const r = await call('/password-reset/request', { email }); await router.idle(); return { r, token: sent[0] ? tokenOf(sent[0]) : null }; };
  const OLD = 'Clave-vieja-1!'; const NEW = 'Clave-nueva-2!';
  const person = await User.create({ name: 'Synthetic', email: 'real@example.invalid', password: await bcrypt.hash(OLD, 4), role: 'user', loginAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

  await t.test('misma respuesta con correo existente e inexistente; el token no se guarda, solo su hash', async () => {
    const known = await ask('real@example.invalid'); const unknown = await ask('nobody@example.invalid');
    assert.deepEqual(known.r, unknown.r); assert.equal(known.r.status, 202); assert.equal(unknown.token, null);
    const stored = await sequelize.query('SELECT "tokenHash", "usedAt" FROM "PasswordResets"', { type: 'SELECT' });
    assert.equal(stored.length, 1); assert.match(stored[0].tokenHash, /^[0-9a-f]{64}$/); assert.notEqual(stored[0].tokenHash, known.token);
  });

  await t.test('seis confirmaciones simultáneas con el mismo enlace: exactamente una gana; sesiones previas revocadas; cuenta desbloqueada', async () => {
    const { token } = await ask('real@example.invalid');
    const live = issueToken(person); const decoded = jwt.decode(live);
    assert.equal(await sessionProblem(decoded), null);
    await new Promise(resolve => setTimeout(resolve, 15));
    const results = await Promise.all(Array.from({ length: 6 }, (_, n) => call('/password-reset/confirm', { token, password: `Clave-nueva-${n}-ok!` })));
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(results.filter(r => r.status === 400 && r.body.code === 'reset_invalid').length, 5);
    assert.equal(await sessionProblem(decoded), 'revoked');
    const fresh = await User.findByPk(person.id);
    assert.equal(fresh.loginAttempts, 0); assert.equal(fresh.lockedUntil, null); assert.equal(await bcrypt.compare(OLD, fresh.password), false);
    assert.equal(await sessionProblem(jwt.decode(issueToken(fresh))), null); // un inicio de sesión nuevo vale
    assert.equal((await call('/password-reset/confirm', { token, password: NEW })).body.code, 'reset_invalid'); // reutilizar el enlace
  });

  await t.test('enlace vencido y fuerza bruta de tokens: siempre reset_invalid, sin cambios', async () => {
    const { token } = await ask('real@example.invalid');
    await sequelize.query(`UPDATE "PasswordResets" SET "expiresAt" = now() - interval '1 second' WHERE "usedAt" IS NULL`);
    const before = (await User.findByPk(person.id)).password;
    assert.equal((await call('/password-reset/confirm', { token, password: NEW })).body.code, 'reset_invalid');
    const guesses = await Promise.all(Array.from({ length: 60 }, () => call('/password-reset/confirm', { token: randomBytes(32).toString('base64url'), password: NEW })));
    assert.ok(guesses.every(r => r.status === 400 && r.body.code === 'reset_invalid'));
    assert.equal((await User.findByPk(person.id)).password, before);
  });

  await t.test('una solicitud nueva deja un solo enlace vivo y el máximo por hora se respeta', async () => {
    await sequelize.query('DELETE FROM "PasswordResets"');
    const first = await ask('real@example.invalid'); const second = await ask('real@example.invalid');
    assert.equal((await call('/password-reset/confirm', { token: first.token, password: NEW })).body.code, 'reset_invalid');
    await ask('real@example.invalid'); const over = await ask('real@example.invalid');
    assert.equal(over.token, null); // 4.ª en la hora: se calla
    assert.equal((await PasswordReset.count()), 3);
    assert.equal((await call('/password-reset/confirm', { token: second.token, password: 'abc' })).body.code, 'password_policy');
  });

  await t.test('ráfaga de seis solicitudes simultáneas al mismo correo (QA-132-01): máximo 3 correos y un solo enlace vivo', async () => {
    await sequelize.query('DELETE FROM "PasswordResets"');
    for (let round = 0; round < 3; round++) {
      await sequelize.query('DELETE FROM "PasswordResets"');
      sent.length = 0;
      const answers = await Promise.all(Array.from({ length: 6 }, () => call('/password-reset/request', { email: 'real@example.invalid' })));
      await router.idle();
      assert.ok(answers.every(answer => answer.status === 202));
      assert.equal(sent.length, 3, 'correos enviados en la ráfaga');
      assert.equal(await PasswordReset.count(), 3);
      assert.equal(await PasswordReset.count({ where: { usedAt: null } }), 1, 'enlaces vivos');
      // El único vivo es el del último correo creado; los demás ya no sirven.
      const live = await PasswordReset.findOne({ where: { usedAt: null } });
      assert.ok(live);
    }
  });

  await t.test('cuenta inactiva o con eliminación pendiente: no se crea enlace ni se envía correo', async () => {
    await sequelize.query('DELETE FROM "PasswordResets"');
    const off = await User.create({ name: 'Off', email: 'off@example.invalid', password: 'x', role: 'user', active: false });
    assert.equal((await ask('off@example.invalid')).token, null);
    const gone = await User.create({ name: 'Gone', email: 'gone@example.invalid', password: 'x', role: 'user' });
    await DeletionRequest.create({ id: randomUUID(), UserId: gone.id, status: 'accepted' });
    assert.equal((await ask('gone@example.invalid')).token, null);
    assert.equal(await PasswordReset.count(), 0); assert.ok(off.id);
  });
});
