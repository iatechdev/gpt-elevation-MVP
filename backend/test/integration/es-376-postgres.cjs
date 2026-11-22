// ES-376 contra Postgres REAL: enlace de restablecimiento emitido por quien opera (sin correo). La ruta pública de confirmación es la REAL (no cambia).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env. Sin red ni correo: los usuarios y correos son sintéticos.
// Uso (en backend/):  ES376_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:operator-link:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawn } = require('node:child_process');
const express = require('express');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

const sha256 = value => createHash('sha256').update(value).digest('hex');

test('ES-376 PostgreSQL: enlace de operador de un solo uso, sin guardar el token, con auditoría y límites', { timeout: 180000 }, async (t) => {
  const source = process.env.ES376_TEST_DATABASE_URL;
  assert.ok(source, 'ES376_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es376_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es376_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  const databaseUrl = target.toString();
  sequelize = new Sequelize(databaseUrl, { logging: false, dialectOptions: { ssl: false }, pool: { max: 10, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PASSWORD_RESET_CONFIRM_LIMIT = '100000';
  delete process.env.MAIL_PROVIDER; // sin proveedor: es justo el caso de este ticket
  const BASE = 'https://app.example.invalid';
  process.env.APP_BASE_URL = BASE;
  delete process.env.OPERATOR_LINK_TTL_MINUTES;
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  const Invitation = require('../../Invitation');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken, Invitation].map(model => model.sync()));
  await require('../../migrations/20261101-es132-password-reset.cjs').up(sequelize);
  await require('../../migrations/20261112010000-es186-admin-audit.cjs').up(sequelize);
  const PasswordReset = require('../../PasswordReset');
  const AdminAuditEntry = require('../../AdminAuditEntry');
  const { issueOperatorLink, OperatorLinkError, ttlMinutes, checkBase } = require('../../utils/operatorLink');

  const app = express();
  app.use(express.json());
  app.use('/api', require('../../routes/passwordReset'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const api = `http://127.0.0.1:${server.address().port}/api`;
  const confirm = (token, password) => fetch(`${api}/password-reset/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password }) });
  const OLD = 'Clave-vieja-12345!'; const NEW = 'Clave-nueva-67890!';
  const hash = await bcrypt.hash(OLD, 4);
  let counter = 0;
  const mk = async (role = 'user', extra = {}) => { counter += 1; return User.create({ name: `Persona ${counter}`, email: `persona${counter}@example.invalid`, password: hash, role, ...extra }); };
  const tokenOf = link => { assert.ok(link.startsWith(`${BASE}/reset-password#token=`), link.slice(0, 40)); return link.slice(`${BASE}/reset-password#token=`.length); };
  const failure = async (promise) => { try { await promise; } catch (error) { return error; } return null; };
  const everythingStored = async () => JSON.stringify({ resets: await sequelize.query('SELECT * FROM "PasswordResets"', { type: 'SELECT' }), audit: await sequelize.query('SELECT * FROM "AdminAuditEntries"', { type: 'SELECT' }), users: await sequelize.query('SELECT * FROM "Users"', { type: 'SELECT' }) });

  await t.test('persona y profesional: el enlace sirve UNA vez, el token no queda en la base y la auditoría no lleva token ni correo', async () => {
    const logs = []; const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    for (const level of Object.keys(original)) console[level] = (...args) => { logs.push(args.map(String).join(' ')); };
    const issued = [];
    try {
      for (const role of ['user', 'therapist']) {
        const user = await mk(role);
        const before = Date.now();
        const { link, expiresAt, minutes } = await issueOperatorLink({ email: user.email });
        issued.push({ user, token: tokenOf(link), link });
        assert.equal(minutes, 15);
        assert.ok(expiresAt.getTime() - before >= 14.9 * 60 * 1000 && expiresAt.getTime() - before <= 15.1 * 60 * 1000, 'vence en ~15 minutos');
        assert.match(tokenOf(link), /^[A-Za-z0-9_-]{43}$/);
        const rows = await PasswordReset.findAll({ where: { UserId: user.id } });
        assert.equal(rows.length, 1); assert.equal(rows[0].tokenHash, sha256(tokenOf(link))); assert.equal(rows[0].usedAt, null);
        const audit = await AdminAuditEntry.findAll({ where: { targetId: user.id } });
        assert.equal(audit.length, 1);
        assert.deepEqual([audit[0].actorId, audit[0].actorRole, audit[0].action, audit[0].targetType, audit[0].result], [null, 'operator', 'user.operator_link', 'user', 'ok']);
      }
    } finally { Object.assign(console, original); }
    const stored = await everythingStored();
    for (const { token, user } of issued) { assert.ok(!stored.includes(token), 'el token no está en ninguna tabla'); assert.ok(!logs.join('\n').includes(token)); }
    assert.ok(!JSON.stringify(await sequelize.query('SELECT * FROM "AdminAuditEntries"', { type: 'SELECT' })).includes('example.invalid'), 'la auditoría no lleva correos');
    assert.equal(logs.join('\n').includes('example.invalid'), false, 'nada se registró con correos ni enlaces');
    // Un solo uso, con la ruta pública REAL.
    for (const { user, token } of issued) {
      const first = await confirm(token, NEW); assert.equal(first.status, 200);
      assert.ok(await bcrypt.compare(NEW, (await User.findByPk(user.id)).password));
      const second = await confirm(token, 'Otra-clave-99999!'); assert.equal(second.status, 400);
      assert.ok(await bcrypt.compare(NEW, (await User.findByPk(user.id)).password), 'la segunda no cambió nada');
    }
  });

  await t.test('dos usos simultáneos del mismo enlace: solo uno gana', async () => {
    const user = await mk();
    const token = tokenOf((await issueOperatorLink({ email: user.email })).link);
    const results = await Promise.all(Array.from({ length: 6 }, () => confirm(token, NEW)));
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(results.filter(r => r.status === 400).length, 5);
  });

  await t.test('vencimiento: un enlace vencido no sirve; el tiempo se acota entre 5 y 60 minutos', async () => {
    const user = await mk();
    const token = tokenOf((await issueOperatorLink({ email: user.email })).link);
    await PasswordReset.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { UserId: user.id } });
    assert.equal((await confirm(token, NEW)).status, 400);
    assert.equal(ttlMinutes({}), 15); assert.equal(ttlMinutes({ OPERATOR_LINK_TTL_MINUTES: '1' }), 5); assert.equal(ttlMinutes({ OPERATOR_LINK_TTL_MINUTES: '9999' }), 60);
    assert.equal(ttlMinutes({ OPERATOR_LINK_TTL_MINUTES: 'abc' }), 15); assert.equal(ttlMinutes({ OPERATOR_LINK_TTL_MINUTES: '-3' }), 15); assert.equal(ttlMinutes({ OPERATOR_LINK_TTL_MINUTES: '30' }), 30);
    const other = await mk(); const before = Date.now();
    const issued = await issueOperatorLink({ email: other.email, env: { ...process.env, OPERATOR_LINK_TTL_MINUTES: '30' } });
    assert.ok(issued.expiresAt.getTime() - before > 29 * 60 * 1000 && issued.expiresAt.getTime() - before < 31 * 60 * 1000);
  });

  await t.test('un enlace nuevo invalida el anterior; dos emisiones simultáneas dejan UN solo enlace vivo', async () => {
    const user = await mk();
    const a = tokenOf((await issueOperatorLink({ email: user.email })).link);
    const b = tokenOf((await issueOperatorLink({ email: user.email })).link);
    assert.equal((await confirm(a, NEW)).status, 400, 'el primero ya no sirve');
    assert.equal((await confirm(b, NEW)).status, 200);
    const racer = await mk();
    const [x, y] = (await Promise.all([issueOperatorLink({ email: racer.email }), issueOperatorLink({ email: racer.email })])).map(r => tokenOf(r.link));
    const codes = [(await confirm(x, NEW)).status, (await confirm(y, NEW)).status].sort();
    assert.deepEqual(codes, [200, 400], 'exactamente uno de los dos enlaces sirve');
  });

  await t.test('roles no permitidos (board, admin, superadmin): no se emite nada y el intento queda auditado como denegado', async () => {
    for (const role of ['board', 'admin', 'superadmin', 'otro']) {
      const user = await mk(role);
      const error = await failure(issueOperatorLink({ email: user.email }));
      assert.ok(error instanceof OperatorLinkError); assert.equal(error.code, 'role_not_allowed');
      assert.ok(!error.message.includes(user.email) && !error.message.includes(String(user.id)));
      assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0);
      const audit = await AdminAuditEntry.findAll({ where: { targetId: user.id } });
      assert.deepEqual(audit.map(a => [a.action, a.result, a.actorRole]), [['user.operator_link', 'denied', 'operator']]);
    }
  });

  await t.test('cuenta inexistente, correo mal formado, inactiva o con baja pendiente: error sin datos y sin filas', async () => {
    const cases = [
      ['nadie@example.invalid', 'not_found'], ['', 'not_found'], ['   ', 'not_found'], [undefined, 'not_found'], [null, 'not_found'], [{ $ne: null }, 'not_found'], ['a'.repeat(300) + '@example.invalid', 'not_found'],
    ];
    const resetsBefore = await PasswordReset.count(); const auditBefore = await AdminAuditEntry.count();
    for (const [email, code] of cases) { const error = await failure(issueOperatorLink({ email })); assert.ok(error instanceof OperatorLinkError, String(email)); assert.equal(error.code, code); }
    const inactive = await mk('user', { active: false });
    assert.equal((await failure(issueOperatorLink({ email: inactive.email }))).code, 'inactive');
    const pending = await mk();
    await DeletionRequest.create({ id: require('node:crypto').randomUUID(), UserId: pending.id });
    assert.equal((await failure(issueOperatorLink({ email: pending.email }))).code, 'deletion_pending');
    assert.equal(await PasswordReset.count(), resetsBefore, 'no se creó ningún enlace');
    assert.equal(await AdminAuditEntry.count(), auditBefore, 'ni auditoría de éxito');
  });

  await t.test('el correo se busca sin importar mayúsculas ni espacios', async () => {
    const user = await mk();
    const { link } = await issueOperatorLink({ email: `  ${user.email.toUpperCase()}  ` });
    assert.equal((await confirm(tokenOf(link), NEW)).status, 200);
  });

  await t.test('tope de 3 enlaces por hora y cuenta (el mismo de la ruta pública)', async () => {
    const user = await mk();
    for (let i = 0; i < 3; i += 1) await issueOperatorLink({ email: user.email });
    const error = await failure(issueOperatorLink({ email: user.email }));
    assert.equal(error.code, 'rate_limited'); assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 3);
  });

  await t.test('la base del enlace debe ser https (o localhost): sin base, con http remoto o con credenciales se niega', async () => {
    const user = await mk();
    for (const base of ['', undefined, 'http://app.example.invalid', 'ftp://app.example.invalid', 'https://usuario:clave@app.example.invalid', 'https://app.example.invalid?x=1', 'no es una url', 'https://app.example.invalid#frag']) {
      const env = { APP_BASE_URL: undefined, FRONTEND_URL: undefined };
      const error = await failure(issueOperatorLink({ email: user.email, base, env })); assert.equal(error && error.code, 'config', String(base));
    }
    assert.equal(checkBase('http://localhost:5173/'), 'http://localhost:5173');
    assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0);
  });

  await t.test('si la auditoría no se puede escribir, NO sale ningún enlace y no queda ninguna fila', async () => {
    const user = await mk();
    await sequelize.query('ALTER TABLE "AdminAuditEntries" RENAME TO "AdminAuditEntries_x"');
    try {
      const error = await failure(issueOperatorLink({ email: user.email }));
      assert.ok(error instanceof OperatorLinkError); assert.equal(error.code, 'failed');
    } finally { await sequelize.query('ALTER TABLE "AdminAuditEntries_x" RENAME TO "AdminAuditEntries"'); }
    assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0);
  });

  await t.test('el script: exige la bandera, se niega si la salida no es una terminal y, si se autoriza, imprime SOLO el enlace en stdout', async () => {
    const script = path.join(__dirname, '..', '..', 'scripts', 'issue-link.cjs');
    const run = (args, env) => new Promise((resolve) => {
      const child = spawn(process.execPath, [script, ...args], { cwd: path.join(__dirname, '..', '..'), env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_PATH: process.env.NODE_PATH || '', DATABASE_URL: databaseUrl, DB_SSL: 'false', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
      child.on('exit', code => resolve({ code, stdout, stderr }));
    });
    const user = await mk();
    const base = { APP_BASE_URL: BASE };
    const noFlag = await run(['--email', user.email, '--stdout-ok'], base);
    assert.equal(noFlag.code, 1); assert.equal(noFlag.stdout, ''); assert.match(noFlag.stderr, /ALLOW_OPERATOR_LINK/);
    const noTty = await run(['--email', user.email], { ...base, ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(noTty.code, 1); assert.equal(noTty.stdout, '', 'sin terminal no se imprime ningún enlace'); assert.match(noTty.stderr, /no es una terminal/);
    const noEmail = await run(['--stdout-ok'], { ...base, ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(noEmail.code, 1); assert.equal(noEmail.stdout, '');
    assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0, 'ninguna de las negativas dejó filas');
    const ok = await run(['--email', user.email, '--stdout-ok'], { ...base, ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(ok.code, 0, ok.stderr);
    const link = ok.stdout.trim(); const token = tokenOf(link);
    assert.equal(ok.stdout.trim().split('\n').length, 1, 'stdout trae únicamente el enlace');
    assert.ok(!ok.stderr.includes(token) && !ok.stderr.includes(user.email), 'stderr no lleva el token ni el correo');
    assert.match(ok.stderr, /Vence en 15 minutos/);
    assert.equal((await confirm(token, NEW)).status, 200);
    const admin1 = await mk('admin');
    const denied = await run(['--email', admin1.email, '--stdout-ok'], { ...base, ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(denied.code, 1); assert.equal(denied.stdout, ''); assert.ok(!denied.stderr.includes(admin1.email)); assert.match(denied.stderr, /personas y profesionales/);
    const missing = await run(['--email', 'nadie@example.invalid', '--stdout-ok'], { ...base, ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(missing.code, 1); assert.equal(missing.stdout, ''); assert.ok(!missing.stderr.includes('nadie@'));
    const httpBase = await run(['--email', user.email, '--stdout-ok'], { APP_BASE_URL: 'http://app.example.invalid', ALLOW_OPERATOR_LINK: 'true' });
    assert.equal(httpBase.code, 1); assert.equal(httpBase.stdout, '');
  });
});
