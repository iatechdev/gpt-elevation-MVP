// ES-192 contra Postgres REAL: invitación por enlace (un solo uso, vencimiento, concurrencia), contraseña con las reglas del registro,
// permisos por rol, aislamiento entre administradores (A y B), «enviar enlace de restablecimiento» y rutas retiradas. El PROVEEDOR de correo
// está simulado. Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES192_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:invitations:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

test('ES-192 PostgreSQL: invitación por enlace y contraseña con las reglas del registro', { timeout: 180000 }, async (t) => {
  const source = process.env.ES192_TEST_DATABASE_URL;
  assert.ok(source, 'ES192_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es192_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es192_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.MAIL_PROVIDER = 'test';
  process.env.MAIL_FROM = 'no-reply@example.invalid';
  process.env.APP_BASE_URL = 'https://app.example.invalid';
  process.env.INVITATION_PER_INVITER_HOUR = '1000';
  process.env.INVITATION_ACCEPT_LIMIT = '100000';
  process.env.PASSWORD_RESET_IP_LIMIT = '100000';
  process.env.PASSWORD_RESET_CONFIRM_LIMIT = '100000';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map((model) => model.sync()));
  await require('../../migrations/20261101-es132-password-reset.cjs').up(sequelize);

  await t.test('la migración es idempotente, guarda solo el hash del token y activa RLS', async () => {
    const migration = require('../../migrations/20261107010000-es192-invitations.cjs');
    await migration.up(sequelize); await migration.up(sequelize);
    const columns = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Invitations' ORDER BY 1`, { type: 'SELECT' });
    assert.deepEqual(columns.map((c) => c.column_name), ['acceptedUserId', 'createdAt', 'email', 'expiresAt', 'id', 'invitedBy', 'locale', 'role', 'tokenHash', 'updatedAt', 'usedAt']);
    assert.equal((await sequelize.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'Invitations'`, { type: 'SELECT' }))[0].relrowsecurity, true);
  });

  await require('../../migrations/20261112010000-es186-admin-audit.cjs').up(sequelize); // ES-186 B: auditoría de administración y Invitations.requestId (las rutas los usan)
  const mailer = require('../../utils/mailer');
  const sent = [];
  mailer.providers.test = async (message) => { sent.push(message); };
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const passwordReset = require('../../routes/passwordReset');
  const { adminRouter, publicRouter } = require('../../routes/invitations');
  const Invitation = require('../../Invitation');
  const app = express(); app.use(express.json());
  app.use('/api', passwordReset);
  app.use('/api/invitations', publicRouter);
  app.use('/api/admin/invitations', verificarAdmin, adminRouter);
  app.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');

  // Nada de lo que pasa en este archivo debe dejar un token o una contraseña en los registros del servidor.
  const logged = []; const keep = { log: console.log, error: console.error, warn: console.warn };
  for (const level of ['log', 'error', 'warn']) console[level] = (...args) => { logged.push(args.map(String).join(' ')); };
  t.after(() => Object.assign(console, keep));

  const person = (role, name) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role });
  const [admA, admB, sup, sup2] = [await person('admin', 'AdmA'), await person('admin', 'AdmB'), await person('superadmin', 'Sup'), await person('superadmin', 'Sup2')];
  const call = async (who, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${issueToken(who)}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json };
  };
  const tokenOf = (message) => new URL(message.text.match(/https:\/\/\S+/)[0]).hash.replace('#token=', '');
  const invite = async (who, email, role = 'user', extra = {}) => { sent.length = 0; const r = await call(who, 'POST', '/api/admin/invitations', { email, role, ...extra }); return { r, token: sent[0] ? tokenOf(sent[0]) : null, message: sent[0] }; };
  const accept = (token, password = 'Clave-nueva-2!', name = 'Persona Invitada') => call(null, 'POST', '/api/invitations/accept', { token, name, password });
  const STRONG = 'Mapa-Rumbo-47!';

  await t.test('administración invita: el enlace va por correo en el fragmento, sin contraseña ni datos; la respuesta y la base no guardan el token', async () => {
    const { r, token, message } = await invite(admA, 'Nueva.Persona@Example.invalid', 'user', { locale: 'en' });
    assert.equal(r.status, 201); assert.equal(r.body.emailSent, true); assert.equal(r.body.status, 'pending'); assert.equal(r.body.email, 'nueva.persona@example.invalid');
    assert.ok(token && token.length >= 40);
    assert.match(message.text, /^Open this link|You have been invited|invited/m); assert.equal(message.to, 'nueva.persona@example.invalid');
    const link = message.text.match(/https:\/\/\S+/)[0];
    assert.match(link, /^https:\/\/app\.example\.invalid\/accept-invitation#token=/); assert.equal(new URL(link).search, '');
    assert.doesNotMatch(message.text, /contraseña:|password:/i); assert.doesNotMatch(link, /nueva|persona|user/i); // sin correo, nombre ni rol en el enlace
    assert.ok(!JSON.stringify(r.body).includes(token)); assert.ok(!('tokenHash' in r.body));
    const [row] = await sequelize.query('SELECT "tokenHash" FROM "Invitations" WHERE "email" = :e', { type: 'SELECT', replacements: { e: 'nueva.persona@example.invalid' } });
    assert.match(row.tokenHash, /^[0-9a-f]{64}$/); assert.notEqual(row.tokenHash, token);
  });

  await t.test('la contraseña débil o común NO gasta el enlace; la fuerte crea la cuenta con el rol y la política del registro; el enlace sirve una sola vez', async () => {
    const { token } = await invite(admA, 'ana@example.invalid');
    const weak = [['Ab1!xyz', 'length'], ['sinmayuscula1!', 'upper'], ['SINMINUSCULA1!', 'lower'], ['SinNumeroAqui!', 'digit'], ['SinEspecial123', 'special'], ['Password1!', 'common'], ['', null]];
    for (const [password, missing] of weak) {
      const r = await accept(token, password);
      assert.equal(r.status, 400, String(password));
      if (missing) { assert.equal(r.body.code, 'password_policy'); assert.ok(r.body.missing.includes(missing), `${password} → ${missing}`); }
    }
    assert.equal((await call(null, 'POST', '/api/invitations/accept', { token, name: 'Ana' })).status, 400); // sin contraseña
    assert.equal((await Invitation.count({ where: { usedAt: null, email: 'ana@example.invalid' } })), 1); // sigue viva
    const ok = await accept(token, STRONG, '  <b>Ana</b>  ');
    assert.equal(ok.status, 201); assert.ok(!JSON.stringify(ok.body).toLowerCase().includes('password') || /contraseña|password/.test(ok.body.message)); assert.equal(typeof ok.body.token, 'undefined');
    const account = await User.findOne({ where: { email: 'ana@example.invalid' } });
    assert.equal(account.role, 'user'); assert.equal(account.active, true); assert.equal(account.name, '<b>Ana</b>'); // el nombre se guarda como texto
    assert.ok(await bcrypt.compare(STRONG, account.password)); assert.notEqual(account.password, STRONG);
    const row = await Invitation.findOne({ where: { email: 'ana@example.invalid' } }); assert.equal(row.acceptedUserId, account.id);
    const again = await accept(token, STRONG); assert.equal(again.status, 400); assert.equal(again.body.code, 'invitation_invalid'); // ya usada
  });

  await t.test('el mismo mensaje para enlace desconocido, vencido, usado, anulado o con correo ya registrado: no revela si el correo existía', async () => {
    const answers = [];
    answers.push(await accept(randomBytes(32).toString('base64url')));
    answers.push(await accept('x'.repeat(500)));
    const expired = (await invite(admA, 'vencida@example.invalid')).token;
    await sequelize.query(`UPDATE "Invitations" SET "expiresAt" = now() - interval '1 second' WHERE "email" = 'vencida@example.invalid'`);
    answers.push(await accept(expired));
    const revoked = await invite(admA, 'anulada@example.invalid');
    assert.equal((await call(admA, 'POST', `/api/admin/invitations/${revoked.r.body.id}/revoke`)).status, 200);
    answers.push(await accept(revoked.token));
    const raced = await invite(admA, 'carrera@example.invalid');
    await User.create({ name: 'Antes', email: 'carrera@example.invalid', password: 'x', role: 'user' }); // alguien se registró con ese correo mientras tanto
    answers.push(await accept(raced.token));
    for (const r of answers) { assert.equal(r.status, 400); assert.deepEqual(r.body, answers[0].body); }
    assert.equal(await User.count({ where: { email: 'carrera@example.invalid' } }), 1); // sin cuenta duplicada
    // un correo que ya existe recibe la misma respuesta (202/201) al invitarlo y solo se le dice a quien administra, nunca en el enlace
    assert.equal((await invite(admA, 'ana@example.invalid')).r.status, 409);
  });

  await t.test('seis aceptaciones simultáneas con el mismo enlace: exactamente una gana y existe una sola cuenta', async () => {
    const { token } = await invite(admA, 'simultanea@example.invalid');
    const results = await Promise.all(Array.from({ length: 6 }, (_, n) => accept(token, `Clave-${n}-Segura!x`)));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 400 && r.body.code === 'invitation_invalid').length, 5);
    assert.equal(await User.count({ where: { email: 'simultanea@example.invalid' } }), 1);
  });

  await t.test('nadie invita a un rol superior al propio; un invitador degradado o inactivo ya no puede completar la invitación', async () => {
    for (const role of ['admin', 'superadmin', 'board']) assert.equal((await invite(admA, `x-${role}@example.invalid`, role)).r.status, 403, role);
    for (const role of ['', 'root', 'ADMIN', 5, null]) assert.equal((await call(admA, 'POST', '/api/admin/invitations', { email: 'r@example.invalid', role })).status, 400 + (typeof role === 'string' && role ? 3 : 0), String(role));
    for (const role of ['user', 'therapist']) assert.equal((await invite(admA, `ok-${role}@example.invalid`, role)).r.status, 201, role);
    const high = await invite(sup, 'nuevoadmin@example.invalid', 'admin');
    assert.equal(high.r.status, 201); assert.equal(high.r.body.role, 'admin');
    await admA.update({ role: 'user' }); // degradado antes de que la persona acepte
    const pending = await Invitation.findOne({ where: { email: 'ok-therapist@example.invalid' } });
    assert.ok(pending);
    const stale = (await invite(sup, 'degradado@example.invalid', 'therapist')); // invitación válida de superadmin
    await sequelize.query(`UPDATE "Invitations" SET "invitedBy" = :id WHERE "email" = 'degradado@example.invalid'`, { replacements: { id: admA.id } });
    assert.equal((await accept(stale.token)).status, 400); assert.equal(await User.count({ where: { email: 'degradado@example.invalid' } }), 0);
    await admA.update({ role: 'admin' });
    assert.equal((await call(null, 'POST', '/api/admin/invitations', { email: 'z@example.invalid', role: 'user' })).status, 403); // sin sesión
    const person = await person_('user', 'Persona'); assert.equal((await call(person, 'POST', '/api/admin/invitations', { email: 'z@example.invalid', role: 'user' })).status, 403);
    const therapist = await person_('therapist', 'Terapeuta'); assert.equal((await call(therapist, 'POST', '/api/admin/invitations', { email: 'z@example.invalid', role: 'user' })).status, 403);
  });
  async function person_(role, name) { return User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role }); }

  await t.test('entradas hostiles: correo con HTML o inyección, enormes y de otros tipos dan 400, nunca 500', async () => {
    const emails = ['<script>alert(1)</script>@example.invalid', 'a@b', 'sin-arroba', "x'; DROP TABLE \"Users\";--@example.invalid", 'a b@example.invalid', '"quoted"@example.invalid', `${'a'.repeat(300)}@example.invalid`, '', '   ', 42, null, { $ne: null }, ['a@example.invalid']];
    for (const email of emails) { const r = await call(sup, 'POST', '/api/admin/invitations', { email, role: 'user' }); assert.equal(r.status, 400, JSON.stringify(email).slice(0, 40)); }
    assert.equal((await call(sup, 'POST', '/api/admin/invitations', 'no es json')).status, 400);
    for (const body of [undefined, [], null]) assert.ok([400, 403].includes((await call(sup, 'POST', '/api/admin/invitations', body)).status));
    const { token } = await invite(sup, 'hostil@example.invalid');
    for (const body of [{ token, name: 'x'.repeat(101), password: STRONG }, { token, name: '   ', password: STRONG }, { token: 5, name: 'a', password: STRONG }, { token, name: 'a', password: 'x'.repeat(100000) }, { token: { $ne: null }, name: 'a', password: STRONG }, { token, name: ['a'], password: STRONG }]) {
      const r = await call(null, 'POST', '/api/invitations/accept', body); assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
    }
    assert.equal((await Invitation.count({ where: { email: 'hostil@example.invalid', usedAt: null } })), 1); // ninguno gastó el enlace
    assert.equal((await accept(token)).status, 201);
  });

  await t.test('administradores A y B: cada uno ve y anula solo lo suyo; superadministración ve todo; nada devuelve el token', async () => {
    await invite(admA, 'de-a@example.invalid'); const b = await invite(admB, 'de-b@example.invalid');
    const listA = await call(admA, 'GET', '/api/admin/invitations'); const listB = await call(admB, 'GET', '/api/admin/invitations'); const all = await call(sup, 'GET', '/api/admin/invitations');
    assert.ok(listA.body.every((i) => i.invitedBy === admA.id)); assert.ok(listB.body.every((i) => i.invitedBy === admB.id));
    assert.ok(listA.body.some((i) => i.email === 'de-a@example.invalid') && !listA.body.some((i) => i.email === 'de-b@example.invalid'));
    assert.ok(all.body.some((i) => i.email === 'de-b@example.invalid') && all.body.some((i) => i.email === 'de-a@example.invalid'));
    assert.ok(!/tokenHash|"token"/.test(JSON.stringify([listA.body, all.body])));
    assert.equal((await call(admA, 'POST', `/api/admin/invitations/${b.r.body.id}/revoke`)).status, 404); // ajena = no existe
    for (const id of ['abc', '0', '-1', '1.5', '99999999999', '999999']) assert.equal((await call(admA, 'POST', `/api/admin/invitations/${id}/revoke`)).status, 404, id);
    assert.equal((await Invitation.findOne({ where: { id: b.r.body.id } })).usedAt, null);
    assert.equal((await call(sup, 'POST', `/api/admin/invitations/${b.r.body.id}/revoke`)).status, 200);
    assert.equal((await accept(b.token)).status, 400);
    assert.equal((await call(sup, 'POST', `/api/admin/invitations/${b.r.body.id}/revoke`)).status, 404); // ya anulada
    assert.equal((await call(person_ && await person_('therapist', 'Otro'), 'GET', '/api/admin/invitations')).status, 403);
  });

  await t.test('un solo enlace vivo por correo (vale el último) y límites por invitador y por IP', async () => {
    const first = await invite(admB, 'doble@example.invalid'); const second = await invite(admB, 'doble@example.invalid');
    assert.equal((await accept(first.token)).status, 400); assert.equal((await accept(second.token)).status, 201);
    let limited = null;
    process.env.INVITATION_PER_INVITER_HOUR = '8';
    for (let n = 0; n < 12 && !limited; n += 1) { const r = await call(admB, 'POST', '/api/admin/invitations', { email: `masa${n}@example.invalid`, role: 'user' }); if (r.status === 429) limited = r; }
    process.env.INVITATION_PER_INVITER_HOUR = '1000';
    assert.ok(limited && limited.body.code === 'rate_limited'); // INVITATION_PER_INVITER_HOUR = 8
    process.env.INVITATION_ACCEPT_LIMIT = '3';
    const statuses = []; for (let n = 0; n < 6; n += 1) statuses.push((await accept(randomBytes(32).toString('base64url'))).status);
    process.env.INVITATION_ACCEPT_LIMIT = '100000';
    assert.ok(statuses.includes(429), `límite por IP: ${statuses}`);
  });

  await t.test('«enviar enlace de restablecimiento» sustituye la contraseña escrita por administración: va al correo de la cuenta, nunca se muestra y las rutas viejas están retiradas', async () => {
    const target = await User.findOne({ where: { email: 'ana@example.invalid' } });
    const old = target.password;
    sent.length = 0;
    const r = await call(sup, 'POST', `/api/admin/usuarios/${target.id}/reset-link`, { locale: 'es' });
    assert.equal(r.status, 202); assert.ok(!/token|password|contraseña:/i.test(JSON.stringify(r.body).replace(/restablecimiento/gi, '')));
    await passwordReset.idle();
    assert.equal(sent.length, 1); assert.equal(sent[0].to, 'ana@example.invalid'); // al correo de la cuenta, no a quien lo pide
    assert.equal((await User.findByPk(target.id)).password, old); // administración no cambió nada
    const confirm = await call(null, 'POST', '/api/password-reset/confirm', { token: tokenOf(sent[0]), password: 'Otra-Clave-91!' });
    assert.equal(confirm.status, 200);
    assert.ok(await bcrypt.compare('Otra-Clave-91!', (await User.findByPk(target.id)).password));
    // permisos y blancos
    assert.equal((await call(admA, 'POST', `/api/admin/usuarios/${target.id}/reset-link`)).status, 403);
    assert.equal((await call(sup, 'POST', `/api/admin/usuarios/${sup2.id}/reset-link`)).status, 403); // otro superadmin
    assert.equal((await call(sup, 'POST', '/api/admin/usuarios/999999/reset-link')).status, 404);
    // las rutas que escribían contraseñas ajenas están retiradas, para todos los roles de administración
    for (const who of [admA, sup]) {
      const create = await call(who, 'POST', '/api/admin/usuarios', { name: 'X', email: 'x@example.invalid', password: 'Clave-Fuerte-1!', role: 'user' });
      assert.equal(create.status, 410); assert.equal(create.body.code, 'user_create_with_password_removed');
      const reset = await call(who, 'PUT', `/api/admin/usuarios/${target.id}/reset-password`, { newPassword: 'Cualquiera-1!' });
      assert.equal(reset.status, 410); assert.equal(reset.body.code, 'admin_password_reset_removed');
    }
    assert.equal(await User.count({ where: { email: 'x@example.invalid' } }), 0);
    assert.ok(await bcrypt.compare('Otra-Clave-91!', (await User.findByPk(target.id)).password)); // el PUT retirado no cambió nada
  });

  await t.test('ES-210: «abc123», vacía, de otro tipo y muy larga se rechazan en el servidor por reset-link y por la aceptación; 72 bytes pasan y 73 no; ningún rol escribe contraseñas ajenas', async () => {
    const POLICY = require('../../../shared/registration-password-policy.json');
    const at72 = 'Aa1!' + 'x'.repeat(POLICY.maxUtf8Bytes - 4); const at73 = at72 + 'x';
    assert.equal(Buffer.byteLength(at72), POLICY.maxUtf8Bytes); assert.equal(Buffer.byteLength(at73), POLICY.maxUtf8Bytes + 1);
    const ñ72 = 'Ña1!' + 'ñ'.repeat(34); // caracteres de 2 bytes: la medida es en bytes, no en caracteres
    assert.ok(Buffer.byteLength(ñ72) > POLICY.maxUtf8Bytes);
    const hostile = [['abc123', null], ['', null], ['   ', null], [null, null], [12345678, null], [['Mapa-Rumbo-47!'], null], [{ $ne: 1 }, null], ['x'.repeat(100000), 'max_bytes'], [at73, 'max_bytes'], [ñ72, 'max_bytes']];
    // 1) Restablecimiento por enlace: ninguna gasta el enlace, nada da 500 y la contraseña no cambia.
    const victim = await person('user', 'Victima210');
    const before = (await User.findByPk(victim.id)).password;
    sent.length = 0;
    assert.equal((await call(sup, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, { locale: 'en' })).status, 202);
    await passwordReset.idle();
    const resetToken = tokenOf(sent[0]);
    for (const [password, code] of hostile) {
      const r = await call(null, 'POST', '/api/password-reset/confirm', { token: resetToken, password });
      assert.equal(r.status, 400, `reset: ${JSON.stringify(password)?.slice(0, 30)}`);
      if (code) assert.ok(r.body.missing?.includes(code), `reset ${code}`);
    }
    assert.equal((await User.findByPk(victim.id)).password, before); // ni una pasó
    assert.equal((await call(null, 'POST', '/api/password-reset/confirm', { token: resetToken, password: at72 })).status, 200); // el enlace seguía vivo; 72 bytes exactos valen
    assert.ok(await bcrypt.compare(at72, (await User.findByPk(victim.id)).password));
    // 2) Aceptación de invitación: igual.
    const { token } = await invite(admA, 'abuso210@example.invalid');
    for (const [password, code] of hostile) {
      const r = await accept(token, password);
      assert.equal(r.status, 400, `accept: ${JSON.stringify(password)?.slice(0, 30)}`);
      if (code) assert.ok(r.body.missing?.includes(code), `accept ${code}`);
    }
    assert.equal(await User.count({ where: { email: 'abuso210@example.invalid' } }), 0); // la cuenta no se creó
    assert.equal((await accept(token, at72)).status, 201); // el enlace seguía vivo
    // 3) Ningún rol escribe la contraseña de otra persona: ni profesional (sin acceso), ni administración, ni superadministración.
    const pro = await person('therapist', 'Pro210');
    const target = await User.findOne({ where: { email: 'ana@example.invalid' } }); const snapshot = target.password;
    for (const [who, label] of [[pro, 'profesional'], [admA, 'admin'], [sup, 'superadmin']]) {
      for (const [method, path, body] of [
        ['PUT', `/api/admin/usuarios/${target.id}/reset-password`, { newPassword: 'abc123' }],
        ['PUT', `/api/admin/usuarios/${target.id}`, { password: 'abc123', newPassword: 'abc123', name: 'Ana' }],
        ['POST', '/api/admin/usuarios', { name: 'Y', email: 'y210@example.invalid', password: 'abc123', role: 'user' }],
      ]) {
        const r = await call(who, method, path, body);
        // PUT /:id solo lee rol y activo: el campo de contraseña se ignora (200 sin efecto); lo que importa es que la contraseña no cambie, abajo.
        const okStatus = path.endsWith(`/${target.id}`) ? [200, 403, 404] : [403, 404, 410];
        assert.ok(okStatus.includes(r.status), `${label} ${method} ${path} → ${r.status}`);
      }
    }
    assert.equal((await User.findByPk(target.id)).password, snapshot);
    assert.equal(await User.count({ where: { email: 'y210@example.invalid' } }), 0);
  });

  await t.test('el token, el enlace y las contraseñas no quedan en los registros del servidor ni en ninguna respuesta', async () => {
    assert.ok(logged.length > 0, 'la captura de registros funciona');
    const text = logged.join('\n');
    assert.doesNotMatch(text, /accept-invitation#token|reset-password#token/); assert.doesNotMatch(text, new RegExp(STRONG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(text, /Clave-nueva-2!|Otra-Clave-91!/);
    const tokens = (await sequelize.query('SELECT "tokenHash" FROM "Invitations"', { type: 'SELECT' })).map((r) => r.tokenHash);
    assert.ok(tokens.every((h) => /^[0-9a-f]{64}$/.test(h)));
  });
  await t.test('ES-252: un correo con caracteres de control o de formato Unicode (bidi, ancho cero, saltos) se rechaza con 400 invalid_email y no crea invitación; los correos con acentos e IDN siguen valiendo', async () => {
    const before = await Invitation.count();
    const hostile = ['ana\u202Eexample@x.com', 'an\u200Ba@example.com', 'an\uFEFFa@example.com', 'ana\n@example.com', 'ana\u2028@example.com', 'ana\u00AD@example.com', 'ana\u0000@example.com', 'ana\uE000@example.com'];
    for (const email of hostile) {
      const r = await call(admA, 'POST', '/api/admin/invitations', { email, role: 'user' });
      assert.equal(r.status, 400, JSON.stringify(email)); assert.equal(r.body.code, 'invalid_email');
    }
    assert.equal(await Invitation.count(), before, 'ninguna invitación creada');
    for (const email of ['josé.pérez@example.invalid', 'ñandú@example.invalid', 'usuario@bücher.example']) {
      assert.equal((await invite(admA, email)).r.status, 201, email);
    }
  });
});
