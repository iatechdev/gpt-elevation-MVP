// ES-371 contra Postgres REAL: la ruta de recuperación de contraseña envía con el proveedor SMTP REAL (utils/mailSmtp) a un servidor SMTP falso
// en memoria (smtp-server, loopback). Sin buzón real ni red. Sin MAIL_PROVIDER sigue el modo anterior (sin correo ni enlace creado).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES371_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54463/postgres npm run test:smtp-route:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const { SMTPServer } = require('smtp-server');

test('ES-371 PostgreSQL: el restablecimiento de contraseña sale por SMTP real y sin variables conserva el modo anterior', { timeout: 120000 }, async (t) => {
  const source = process.env.ES371_TEST_DATABASE_URL;
  assert.ok(source, 'ES371_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es371_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es371_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server; let smtp;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    require('../../utils/mailSmtp').closeSmtp();
    if (smtp) await new Promise(resolve => smtp.close(resolve));
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
  process.env.APP_BASE_URL = 'https://app.example.invalid';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  await require('../../PricingPlan').sync();
  await Promise.all([User, require('../../DeletionRequest'), require('../../AuthRevocation'), require('../../RevokedToken')].map(model => model.sync()));
  await require('../../migrations/20261101-es132-password-reset.cjs').up(sequelize);
  const PasswordReset = require('../../PasswordReset');

  const received = [];
  const SECRET = 'S3cret-Pa55-for-test-only';
  smtp = new SMTPServer({
    logger: false, authOptional: false, disabledCommands: ['STARTTLS'], allowInsecureAuth: true,
    onAuth(auth, session, cb) { return auth.username === 'buzon' && auth.password === SECRET ? cb(null, { user: 'buzon' }) : cb(new Error('535 credenciales inválidas')); },
    onData(stream, session, cb) {
      const chunks = []; stream.on('data', c => chunks.push(c));
      stream.on('end', () => { received.push({ raw: Buffer.concat(chunks).toString('utf8'), to: session.envelope.rcptTo.map(r => r.address) }); cb(); });
    },
  });
  await new Promise((resolve, reject) => { smtp.once('error', reject); smtp.listen(0, '127.0.0.1', resolve); });

  const logged = [];
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level];
    console[level] = (...args) => { logged.push(args.map(String).join(' ')); original.apply(console, args); };
    t.after(() => { console[level] = original; });
  }

  const router = require('../../routes/passwordReset');
  const app = express(); app.use(express.json()); app.use('/api', router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = async (email) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/password-reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const body = await response.json(); await router.idle(); return { status: response.status, body };
  };
  const smtpEnv = (extra = {}) => ({ MAIL_PROVIDER: 'smtp', MAIL_FROM: 'Elevation <no-reply@staging.example.test>', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.server.address().port), SMTP_SECURE: 'false', SMTP_USER: 'buzon', SMTP_PASS: SECRET, SMTP_TIMEOUT_MS: '4000', ...extra });
  const withEnv = async (env, fn) => {
    const keys = ['MAIL_PROVIDER', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_TIMEOUT_MS'];
    const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, env);
    try { return await fn(); } finally {
      for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
      require('../../utils/mailSmtp').closeSmtp();
    }
  };
  await User.create({ name: 'Synthetic', email: 'real@example.invalid', password: await bcrypt.hash('Clave-vieja-1!', 4), role: 'user' });

  await t.test('con SMTP configurado: llega UN correo al destinatario correcto con el enlace de un solo uso, y la respuesta no lo revela', async () => {
    received.length = 0; await sequelize.query('DELETE FROM "PasswordResets"');
    await withEnv(smtpEnv(), async () => {
      const known = await request('real@example.invalid');
      const unknown = await request('nobody@example.invalid');
      assert.deepEqual(known, unknown); assert.equal(known.status, 202);
      assert.ok(!JSON.stringify(known.body).includes('token'), 'la respuesta no contiene el token');
    });
    assert.equal(received.length, 1, 'solo la cuenta existente recibe correo');
    assert.deepEqual(received[0].to, ['real@example.invalid']);
    assert.match(received[0].raw, /https:\/\/app\.example\.invalid\S*#token=/);
    assert.equal(await PasswordReset.count(), 1);
  });

  await t.test('SMTP caído o con credenciales malas: la petición responde igual (202), sin 500, y nada sensible llega a los logs', async () => {
    for (const env of [smtpEnv({ SMTP_PORT: '1' }), smtpEnv({ SMTP_PASS: 'otra-clave-distinta-9' })]) {
      logged.length = 0; received.length = 0;
      await withEnv(env, async () => { const r = await request('real@example.invalid'); assert.equal(r.status, 202); });
      assert.equal(received.length, 0);
      const text = logged.join('\n');
      for (const secret of [SECRET, 'otra-clave-distinta-9', 'real@example.invalid', '#token=']) assert.ok(!text.includes(secret), `el log no contiene ${secret.slice(0, 6)}…`);
    }
  });

  await t.test('sin MAIL_PROVIDER (modo anterior): 202, ningún correo y NO se crea enlace que nadie pueda recibir', async () => {
    received.length = 0; await sequelize.query('DELETE FROM "PasswordResets"');
    await withEnv({}, async () => { const r = await request('real@example.invalid'); assert.equal(r.status, 202); });
    assert.equal(received.length, 0); assert.equal(await PasswordReset.count(), 0);
  });
});
