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
  delete process.env.OPERATOR_LINK_TTL_MINUTES; delete process.env.OPERATOR_LINK_PER_ACCOUNT_HOUR;
  process.env.OPERATOR_ID = 'ops-test'; // ES-386: quién opera es obligatorio
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
  await require('../../migrations/20261123010000-es386-audit-actor-label.cjs').up(sequelize); // ES-386
  const PasswordReset = require('../../PasswordReset');
  const AdminAuditEntry = require('../../AdminAuditEntry');
  const { recordDenied } = require('../../utils/adminAudit');
  const { issueOperatorLink, OperatorLinkError, ttlMinutes, perAccountPerHour, checkBase } = require('../../utils/operatorLink');

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
        assert.equal(audit[0].actorLabel, 'ops-test', 'la auditoría dice QUIÉN operó');
      }
    } finally { Object.assign(console, original); }
    const stored = await everythingStored();
    for (const { token } of issued) { assert.ok(!stored.includes(token), 'el token no está en ninguna tabla'); assert.ok(!logs.join('\n').includes(token)); }
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
      const error = await failure(issueOperatorLink({ email: user.email, base, operatorId: 'ops-test', env })); assert.equal(error && error.code, 'config', String(base));
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
      const child = spawn(process.execPath, [script, ...args], { cwd: path.join(__dirname, '..', '..'), env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_PATH: process.env.NODE_PATH || '', DATABASE_URL: databaseUrl, DB_SSL: 'false', OPERATOR_ID: 'ops-test', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

  // ─────────── ES-386 · seguimientos de QA-Claude-6 sobre #441 ───────────
  await t.test('ES-386 quién opera: OPERATOR_ID es obligatorio y de lista cerrada; queda en la auditoría y nada se emite sin él', async () => {
    const user = await mk();
    const resetsBefore = await PasswordReset.count(); const auditBefore = await AdminAuditEntry.count();
    for (const operatorId of ['', '   ', undefined, null, 'a'.repeat(33), 'con espacio', 'con\nsalto', 'ana@correo.co', '-empieza', '.empieza', 'tilde-á', `ops${String.fromCharCode(0x202E)}x`, `ops${String.fromCharCode(0x200B)}x`, "ops'--", 'ops;drop']) {
      const env = { ...process.env }; delete env.OPERATOR_ID;
      const error = await failure(issueOperatorLink({ email: user.email, operatorId, env }));
      assert.ok(error instanceof OperatorLinkError, JSON.stringify(operatorId)); assert.equal(error.code, 'operator_id', JSON.stringify(operatorId));
    }
    assert.equal(await PasswordReset.count(), resetsBefore); assert.equal(await AdminAuditEntry.count(), auditBefore, 'sin operador identificado no se emite ni se audita nada');
    for (const operatorId of ['ops-ana', 'A', 'ops.ana_01', 'x'.repeat(32)]) {
      const person = await mk(); await issueOperatorLink({ email: person.email, operatorId });
      const row = await AdminAuditEntry.findOne({ where: { targetId: person.id } });
      assert.equal(row.actorLabel, operatorId); assert.equal(row.actorRole, 'operator'); assert.equal(row.actorId, null);
    }
    const viaEnv = await mk(); await issueOperatorLink({ email: viaEnv.email, env: { ...process.env, OPERATOR_ID: 'ops-env' } });
    assert.equal((await AdminAuditEntry.findOne({ where: { targetId: viaEnv.id } })).actorLabel, 'ops-env', 'toma OPERATOR_ID del entorno');
    const denied = await mk('admin'); await failure(issueOperatorLink({ email: denied.email, operatorId: 'ops-ana' }));
    assert.equal((await AdminAuditEntry.findOne({ where: { targetId: denied.id } })).actorLabel, 'ops-ana', 'también en el intento denegado');
  });

  await t.test('ES-386 la auditoría no guarda como etiqueta nada que no sea un identificador válido (defensa de la capa de auditoría)', async () => {
    const { recordAdminAction } = require('../../utils/adminAudit');
    for (const [label, expected] of [['ops-ana', 'ops-ana'], ['con espacio', null], ['ana@correo.co', null], ['a'.repeat(33), null], [undefined, null], [42, null], ['', null], [`ops${String.fromCharCode(0x202E)}`, null]]) {
      const row = await recordAdminAction({ actor: { id: null, role: 'operator', label }, action: 'user.operator_link', targetType: 'user', targetId: 99 });
      assert.equal(row.actorLabel ?? null, expected, JSON.stringify(label)); assert.equal((await AdminAuditEntry.findByPk(row.id)).actorLabel, expected);
    }
    assert.equal((await recordAdminAction({ actor: { id: 5, role: 'admin' }, action: 'user.update', targetType: 'user', targetId: 1 })).actorLabel ?? null, null, 'una cuenta de la aplicación no lleva etiqueta');
  });

  await t.test('ES-386 cuota propia: las solicitudes anónimas de la ruta pública (filas de PasswordResets) NO agotan la cuota del operador', async () => {
    const user = await mk();
    for (let i = 0; i < 6; i += 1) await PasswordReset.create({ UserId: user.id, tokenHash: sha256(`publica-${user.id}-${i}`), expiresAt: new Date(Date.now() + 60000) }); // lo que dejarían 6 solicitudes anónimas
    const first = await issueOperatorLink({ email: user.email, operatorId: 'ops-ana' });
    assert.equal((await confirm(tokenOf(first.link), NEW)).status, 200, 'el operador pudo emitir y el enlace sirve');
    const other = await mk();
    for (let i = 0; i < 3; i += 1) await issueOperatorLink({ email: other.email, operatorId: 'ops-ana' });
    assert.equal((await failure(issueOperatorLink({ email: other.email, operatorId: 'ops-ana' }))).code, 'rate_limited', 'el operador sí tiene su propio tope');
    // el tope es por cuenta y no por operador: otro operador sobre la MISMA cuenta tampoco lo supera, y otra cuenta no se ve afectada
    assert.equal((await failure(issueOperatorLink({ email: other.email, operatorId: 'ops-bruno' }))).code, 'rate_limited');
    const third = await mk(); await issueOperatorLink({ email: third.email, operatorId: 'ops-ana' });
  });

  await t.test('ES-386 cuota propia: el tope sale de OPERATOR_LINK_PER_ACCOUNT_HOUR (1–10, por defecto 3), solo cuentan los éxitos y no los intentos denegados ni los vencidos', async () => {
    assert.equal(perAccountPerHour({}), 3); assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: '0' }), 3); assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: '-2' }), 3); assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: 'x' }), 3);
    assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: '1' }), 1); assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: '99' }), 10); assert.equal(perAccountPerHour({ OPERATOR_LINK_PER_ACCOUNT_HOUR: '5' }), 5);
    const env = { ...process.env, OPERATOR_LINK_PER_ACCOUNT_HOUR: '1' };
    const one = await mk(); await issueOperatorLink({ email: one.email, operatorId: 'ops-ana', env });
    assert.equal((await failure(issueOperatorLink({ email: one.email, operatorId: 'ops-ana', env }))).code, 'rate_limited');
    const five = await mk(); const env5 = { ...process.env, OPERATOR_LINK_PER_ACCOUNT_HOUR: '5' };
    for (let i = 0; i < 5; i += 1) await issueOperatorLink({ email: five.email, operatorId: 'ops-ana', env: env5 });
    assert.equal((await failure(issueOperatorLink({ email: five.email, operatorId: 'ops-ana', env: env5 }))).code, 'rate_limited');
    // una emisión de hace más de una hora ya no cuenta
    const old = await mk(); for (let i = 0; i < 3; i += 1) await issueOperatorLink({ email: old.email, operatorId: 'ops-ana' });
    await sequelize.query(`UPDATE "AdminAuditEntries" SET "createdAt" = now() - interval '61 minutes' WHERE "targetId" = :id AND action = 'user.operator_link'`, { replacements: { id: old.id } });
    await issueOperatorLink({ email: old.email, operatorId: 'ops-ana' });
    // los intentos denegados (rol) y fallidos no gastan la cuota de nadie
    const admin = await mk('admin'); for (let i = 0; i < 5; i += 1) assert.equal((await failure(issueOperatorLink({ email: admin.email, operatorId: 'ops-ana' }))).code, 'role_not_allowed');
  });

  await t.test('ES-386 carrera: emisiones simultáneas del operador sobre la MISMA cuenta respetan el tope exacto y dejan UN solo enlace vivo (30 cuentas × 8 a la vez)', async () => {
    for (let round = 0; round < 30; round += 1) {
      const user = await mk();
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => issueOperatorLink({ email: user.email, operatorId: 'ops-ana' })));
      const ok = results.filter(r => r.status === 'fulfilled'); const limited = results.filter(r => r.status === 'rejected' && r.reason && r.reason.code === 'rate_limited');
      assert.equal(ok.length, 3, `ronda ${round}: exactamente 3 éxitos, hubo ${ok.length}`); assert.equal(limited.length, 5, `ronda ${round}: 5 con rate_limited`);
      assert.equal(await AdminAuditEntry.count({ where: { targetId: user.id, action: 'user.operator_link', result: 'ok' } }), 3);
      const live = (await sequelize.query('SELECT count(*)::int AS n FROM "PasswordResets" WHERE "UserId" = :id AND "usedAt" IS NULL', { replacements: { id: user.id }, type: 'SELECT' }))[0].n;
      assert.equal(live, 1, `ronda ${round}: un solo enlace vivo`);
      const statuses = await Promise.all(ok.map(r => confirm(tokenOf(r.value.link), NEW).then(res => res.status)));
      assert.deepEqual(statuses.sort(), [200, 400, 400], `ronda ${round}: solo sirve el último`);
    }
  });

  await t.test('ES-386 el rol y el estado se RECOMPRUEBAN bajo el bloqueo: si cambian mientras se espera, no se emite nada', async () => {
    const holdAndChange = async (change) => {
      const user = await mk();
      const holder = await sequelize.transaction();
      await User.findOne({ where: { id: user.id }, transaction: holder, lock: true }); // quien cambia la cuenta tiene el bloqueo
      const pending = failure(issueOperatorLink({ email: user.email, operatorId: 'ops-ana' })); // lee la cuenta (aún como persona activa) y espera el bloqueo
      await new Promise(resolve => setTimeout(resolve, 400));
      await change(user, holder);
      await holder.commit();
      return { user, error: await pending };
    };
    const toAdmin = await holdAndChange((user, tx) => User.update({ role: 'admin' }, { where: { id: user.id }, transaction: tx }));
    assert.ok(toAdmin.error instanceof OperatorLinkError); assert.equal(toAdmin.error.code, 'role_not_allowed', 'pasó a admin mientras esperaba');
    assert.equal(await PasswordReset.count({ where: { UserId: toAdmin.user.id } }), 0);
    assert.equal((await AdminAuditEntry.findOne({ where: { targetId: toAdmin.user.id } })).result, 'denied');
    const toInactive = await holdAndChange((user, tx) => User.update({ active: false }, { where: { id: user.id }, transaction: tx }));
    assert.equal(toInactive.error && toInactive.error.code, 'inactive', 'se desactivó mientras esperaba'); assert.equal(await PasswordReset.count({ where: { UserId: toInactive.user.id } }), 0);
    const toPending = await holdAndChange((user, tx) => DeletionRequest.create({ id: require('node:crypto').randomUUID(), UserId: user.id }, { transaction: tx }));
    assert.equal(toPending.error && toPending.error.code, 'deletion_pending', 'se pidió su baja mientras esperaba'); assert.equal(await PasswordReset.count({ where: { UserId: toPending.user.id } }), 0);
  });

  await t.test('ES-386 el script: sin OPERATOR_ID no emite nada; con él, queda en la auditoría', async () => {
    const script = path.join(__dirname, '..', '..', 'scripts', 'issue-link.cjs');
    const run = (args, env) => new Promise((resolve) => {
      const child = spawn(process.execPath, [script, ...args], { cwd: path.join(__dirname, '..', '..'), env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_PATH: process.env.NODE_PATH || '', DATABASE_URL: databaseUrl, DB_SSL: 'false', APP_BASE_URL: BASE, ALLOW_OPERATOR_LINK: 'true', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = ''; child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; }); child.on('exit', code => resolve({ code, stdout, stderr }));
    });
    const user = await mk();
    const none = await run(['--email', user.email, '--stdout-ok'], {});
    assert.equal(none.code, 1); assert.equal(none.stdout, ''); assert.match(none.stderr, /OPERATOR_ID/); assert.ok(!none.stderr.includes(user.email));
    const bad = await run(['--email', user.email, '--stdout-ok'], { OPERATOR_ID: 'ana@correo.co' });
    assert.equal(bad.code, 1); assert.equal(bad.stdout, '');
    assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0);
    const ok = await run(['--email', user.email, '--stdout-ok'], { OPERATOR_ID: 'ops-ana' });
    assert.equal(ok.code, 0, ok.stderr); assert.equal((await AdminAuditEntry.findOne({ where: { targetId: user.id } })).actorLabel, 'ops-ana');
    const limited = await run(['--email', user.email, '--stdout-ok'], { OPERATOR_ID: 'ops-ana', OPERATOR_LINK_PER_ACCOUNT_HOUR: '1' });
    assert.equal(limited.code, 1); assert.equal(limited.stdout, ''); assert.match(limited.stderr, /tope de enlaces de operador/);
  });

  await t.test('ES-386 los intentos DENEGADOS no gastan la cuota: una cuenta que fue admin y luego es persona puede recibir sus 3 enlaces', async () => {
    const user = await mk('admin');
    for (let i = 0; i < 4; i += 1) assert.equal((await failure(issueOperatorLink({ email: user.email, operatorId: 'ops-ana' }))).code, 'role_not_allowed');
    assert.equal(await AdminAuditEntry.count({ where: { targetId: user.id, result: 'denied' } }), 4);
    await User.update({ role: 'user' }, { where: { id: user.id } });
    for (let i = 0; i < 3; i += 1) await issueOperatorLink({ email: user.email, operatorId: 'ops-ana' });
    assert.equal((await failure(issueOperatorLink({ email: user.email, operatorId: 'ops-ana' }))).code, 'rate_limited', 'el tope sigue siendo 3 de éxitos');
  });

  await t.test('ES-386 despliegue: sin la columna actorLabel (migración aún no aplicada) la auditoría de siempre sigue funcionando; el script de operador NO emite (falla cerrado); la migración es idempotente', async () => {
    const { recordAdminAction } = require('../../utils/adminAudit');
    await sequelize.query('ALTER TABLE "AdminAuditEntries" DROP COLUMN "actorLabel"');
    try {
      const row = await recordAdminAction({ actor: { id: 7, role: 'admin' }, action: 'user.update', targetType: 'user', targetId: 1 });
      assert.ok(row.id && row.actorId === 7 && row.result === 'ok', 'una acción de administración se audita aunque la columna no exista todavía');
      assert.equal((await sequelize.query('SELECT count(*)::int AS n FROM "AdminAuditEntries" WHERE id = :id', { replacements: { id: row.id }, type: 'SELECT' }))[0].n, 1);
      await recordDenied({ id: 7, role: 'admin' }, 'user.reset_link', 'user', 1);
      const user = await mk();
      const error = await failure(issueOperatorLink({ email: user.email, operatorId: 'ops-ana' }));
      assert.ok(error instanceof OperatorLinkError); assert.equal(error.code, 'failed', 'sin la columna el operador no emite');
      assert.equal(await PasswordReset.count({ where: { UserId: user.id } }), 0, 'ni deja filas');
    } finally { await require('../../migrations/20261123010000-es386-audit-actor-label.cjs').up(sequelize); }
    const migration = require('../../migrations/20261123010000-es386-audit-actor-label.cjs');
    await migration.up(sequelize); await migration.up(sequelize); // idempotente
    const cols = await sequelize.query("SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name = 'AdminAuditEntries' AND column_name = 'actorLabel'", { type: 'SELECT' });
    assert.deepEqual(cols, [{ data_type: 'character varying', character_maximum_length: 32, is_nullable: 'YES' }]);
    // y sobre una tabla creada por sync() (que ya trae la columna del modelo): la migración no cambia nada ni falla (lección de ES-169, #412)
    await sequelize.query('DROP TABLE "AdminAuditEntries"'); await AdminAuditEntry.sync();
    await migration.up(sequelize); await migration.up(sequelize);
    assert.equal((await sequelize.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'AdminAuditEntries' AND column_name = 'actorLabel'", { type: 'SELECT' }))[0].n, 1);
    const after = await mk(); await issueOperatorLink({ email: after.email, operatorId: 'ops-ana' });
    assert.equal((await AdminAuditEntry.findOne({ where: { targetId: after.id } })).actorLabel, 'ops-ana');
  });
});
