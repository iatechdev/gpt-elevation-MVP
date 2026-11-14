// ES-306 · El correo de una cuenta NO distingue mayúsculas ni espacios a los lados: registro, login, recuperación e invitaciones. HTTP REAL contra el server.js real y PostgreSQL REAL
// (migraciones reales). 0 IA, sin datos reales. Antes, registrar «ANA@x.co» con «ana@x.co» ya registrado creaba una segunda cuenta.
//   ES306_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-306-postgres.cjs
// @pg-env ES306_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bcrypt = require('bcryptjs');
process.env.LOGIN_RATE_LIMIT_MAX = '100000'; process.env.PASSWORD_RESET_IP_LIMIT = '100000';
const { startRealApi } = require('../support/realApi.cjs');

test('ES-306 PostgreSQL + HTTP: correo sin distinguir mayúsculas en registro, login, recuperación e invitaciones; migración que reporta y crea el índice solo sin duplicados', { timeout: 900000 }, async (t) => {
  const { q, http, app, mkUser, dbName } = await startRealApi(t, { envVar: 'ES306_TEST_DATABASE_URL', prefix: 'es306' });
  const migration = require('../../migrations/20261114010000-es306-email-lower-unique.cjs');
  const PASSWORD = 'Sintetica-Clave-2026!';
  const HASH = await bcrypt.hash(PASSWORD, 4);
  const register = (email, patch = {}) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email, password: PASSWORD, ...patch });
  const login = (email, password = PASSWORD) => http(null, 'POST', '/api/login', { email, password });
  const byLower = async (email) => q('SELECT id, email FROM "Users" WHERE lower(btrim(email)) = $1 ORDER BY id', [email.trim().toLowerCase()]);
  const hasIndex = async () => (await q(`SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_lower_unique'`)).length === 1;
  const people = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);
  const waitFor = async (probe) => { for (let i = 0; i < 60; i++) { if (await probe()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
  const ANA = 'Ana.Perez@Example.invalid';

  await t.test('la migración real dejó el índice único sobre lower(email) (la base de prueba no tiene duplicados)', async () => {
    assert.equal(await hasIndex(), true);
  });

  await t.test('registro: el correo se guarda normalizado y cualquier casing/espacios de un correo ya registrado es el MISMO duplicado (misma respuesta que el exacto)', async () => {
    const first = await register(ANA); assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual((await byLower(ANA)).map((r) => r.email), ['ana.perez@example.invalid'], 'se guarda en minúsculas');
    const exact = await register('ana.perez@example.invalid');
    assert.equal(exact.status, 400); assert.match(exact.body.error, /ya está registrado/);
    const before = await people();
    for (const variant of ['ANA.PEREZ@EXAMPLE.INVALID', ANA, 'aNa.PeReZ@ExAmPlE.iNvAlId', '  ana.perez@example.invalid  ', ' ANA.PEREZ@example.invalid']) {
      const out = await register(variant);
      assert.deepEqual([out.status, out.body], [exact.status, exact.body], `«${variant}»: misma respuesta que el duplicado exacto`);
    }
    assert.equal(await people(), before, 'no se creó ninguna cuenta nueva');
    assert.equal((await byLower(ANA)).length, 1, 'una sola cuenta para esa persona');
  });

  await t.test('registro nuevo con mayúsculas o espacios: se crea UNA cuenta con el correo normalizado (sin regresión del registro normal)', async () => {
    const plain = await register('normal@example.invalid'); assert.equal(plain.status, 201); assert.equal((await q('SELECT role FROM "Users" WHERE email=$1', ['normal@example.invalid']))[0].role, 'user');
    const spaced = await register('  Nuevo.Mixto@Example.INVALID  '); assert.equal(spaced.status, 201, JSON.stringify(spaced.body));
    assert.deepEqual((await byLower('nuevo.mixto@example.invalid')).map((r) => r.email), ['nuevo.mixto@example.invalid'], 'sin espacios y en minúsculas');
    assert.equal((await register('nuevo.mixto@example.invalid')).status, 400);
  });

  await t.test('login: el mismo correo con otro casing o espacios entra; contraseña errónea = 401 como un correo inexistente', async () => {
    for (const variant of ['ana.perez@example.invalid', ANA, 'ANA.PEREZ@EXAMPLE.INVALID', '  Ana.Perez@Example.invalid ']) {
      const out = await login(variant); assert.equal(out.status, 200, `«${variant}»: ${JSON.stringify(out.body)}`); assert.ok(out.body.token);
    }
    const wrong = await login('ANA.PEREZ@example.invalid', 'Otra-Clave-9999!'); const unknown = await login('nadie@example.invalid', 'Otra-Clave-9999!');
    assert.deepEqual([wrong.status, wrong.body], [unknown.status, unknown.body], 'no revela si el correo existe');
  });

  await t.test('recuperación de contraseña: el correo en otro casing encuentra la cuenta (y uno inexistente responde igual sin crear nada)', async () => {
    const id = (await byLower(ANA))[0].id; const resets = async () => Number((await q('SELECT count(*) n FROM "PasswordResets" WHERE "UserId"=$1', [id]))[0].n);
    const known = await http(null, 'POST', '/api/password-reset/request', { email: '  ANA.PEREZ@Example.invalid ' });
    const unknown = await http(null, 'POST', '/api/password-reset/request', { email: 'NADIE@Example.invalid' });
    assert.deepEqual([known.status, known.body], [unknown.status, unknown.body], 'misma respuesta exista o no el correo');
    assert.equal(await waitFor(async () => (await resets()) === 1), true, 'se emitió el enlace para la cuenta aunque el correo llegó en otro casing');
    assert.equal(Number((await q('SELECT count(*) n FROM "PasswordResets"'))[0].n), 1, 'solo para esa cuenta');
  });

  await t.test('cuenta ANTIGUA guardada con mayúsculas: registro la detecta como duplicado, entra con cualquier casing y la recuperación la encuentra', async () => {
    const old = await mkUser('user'); await q('UPDATE "Users" SET email=$2, password=$3 WHERE id=$1', [old.id, 'Antigua.Cuenta@Example.invalid', HASH]);
    const before = await people();
    for (const variant of ['antigua.cuenta@example.invalid', 'ANTIGUA.CUENTA@EXAMPLE.INVALID', 'Antigua.Cuenta@Example.invalid']) assert.equal((await register(variant)).status, 400, variant);
    assert.equal(await people(), before);
    for (const variant of ['antigua.cuenta@example.invalid', 'ANTIGUA.CUENTA@example.invalid', 'Antigua.Cuenta@Example.invalid']) assert.equal((await login(variant)).status, 200, `login ${variant}`);
    const resets = async () => Number((await q('SELECT count(*) n FROM "PasswordResets" WHERE "UserId"=$1', [old.id]))[0].n);
    await http(null, 'POST', '/api/password-reset/request', { email: 'antigua.cuenta@example.invalid' });
    assert.equal(await waitFor(async () => (await resets()) === 1), true, 'la recuperación encuentra la cuenta guardada con mayúsculas');
    assert.equal((await q('SELECT email FROM "Users" WHERE id=$1', [old.id]))[0].email, 'Antigua.Cuenta@Example.invalid', 'no se reescribe ninguna cuenta existente');
  });

  await t.test('invitaciones: invitar a un correo existente en otro casing = 409; la invitación guarda el correo normalizado; aceptar no duplica una cuenta creada entretanto', async () => {
    const admin = await mkUser('superadmin');
    const taken = await http(admin, 'POST', '/api/admin/invitations', { email: 'ANA.PEREZ@EXAMPLE.INVALID', role: 'user' }); assert.equal(taken.status, 409, JSON.stringify(taken.body)); assert.equal(taken.body.code, 'email_taken');
    const fresh = await http(admin, 'POST', '/api/admin/invitations', { email: ' Persona.Nueva@Example.INVALID ', role: 'user' }); assert.equal(fresh.status, 201, JSON.stringify(fresh.body));
    assert.equal((await q('SELECT email FROM "Invitations" WHERE id=$1', [fresh.body.id]))[0].email, 'persona.nueva@example.invalid');
    const plant = async (email) => { const token = crypto.randomBytes(32).toString('base64url'); await q(`INSERT INTO "Invitations" (email, role, "invitedBy", "tokenHash", locale, "expiresAt", "createdAt", "updatedAt") VALUES ($1,'user',$2,$3,'es',now()+interval '1 day',now(),now())`, [email, admin.id, crypto.createHash('sha256').update(token).digest('hex')]); return token; };
    const accept = (token) => http(null, 'POST', '/api/invitations/accept', { token, name: 'Persona Invitada', password: 'Clave-nueva-2026!' });
    const raced = await plant('carrera@example.invalid'); assert.equal((await register('CARRERA@Example.invalid')).status, 201); const before = await people();
    const out = await accept(raced); assert.equal(out.status, 400); assert.equal(out.body.code, 'invitation_invalid'); assert.equal(await people(), before, 'no se creó una segunda cuenta');
    const ok = await plant('invitada@example.invalid'); assert.equal((await accept(ok)).status, 201); assert.equal((await register('INVITADA@example.invalid')).status, 400, 'tras aceptar, el correo cuenta como registrado en cualquier casing');
    assert.deepEqual((await byLower('invitada@example.invalid')).map((r) => r.email), ['invitada@example.invalid']);
  });

  await t.test('carrera: 12 registros simultáneos del mismo correo con casing distinto dejan UNA cuenta y ningún 5xx', async () => {
    const variants = ['Carrera.Dos@Example.invalid', 'CARRERA.DOS@EXAMPLE.INVALID', 'carrera.dos@example.invalid', ' carrera.dos@Example.invalid'];
    const outs = await Promise.all(Array.from({ length: 12 }, (_, i) => register(variants[i % variants.length])));
    assert.equal((await byLower('carrera.dos@example.invalid')).length, 1, 'una sola cuenta');
    assert.equal(outs.filter((o) => o.status === 201).length, 1, 'una sola creación');
    assert.deepEqual(outs.filter((o) => o.status >= 500).map((o) => o.status), [], '0 respuestas 5xx');
  });

  await t.test('el índice único de la base también frena el casing distinto por debajo de la aplicación (red de seguridad)', async () => {
    await assert.rejects(() => q(`INSERT INTO "Users" (name, email, password, role, active, "createdAt", "updatedAt") VALUES ('x','ANA.PEREZ@example.invalid','x','user',true,now(),now())`), /users_email_lower_unique|duplicate key/);
  });

  await t.test('migración con duplicados REALES: reporta (ids, sin correos), no crea el índice, no borra ni fusiona nada; resuelto, lo crea; idempotente; down con permiso', async () => {
    const mig = migration; const warnings = []; const realWarn = console.warn; console.warn = (...args) => { warnings.push(args.join(' ')); };
    try {
      await q('DROP INDEX "users_email_lower_unique"'); assert.equal(await hasIndex(), false);
      // Sin el índice (entorno con duplicados antiguos) el control es de la APLICACIÓN: sigue rechazando el casing distinto sin crear cuenta.
      const guarded = await people(); assert.equal((await register('ANA.PEREZ@EXAMPLE.INVALID')).status, 400); assert.equal((await register(' ana.perez@example.invalid ')).status, 400); assert.equal(await people(), guarded, 'sin índice, la aplicación igual no duplica');
      const mixed = await mkUser('user'); await q('UPDATE "Users" SET email=$2 WHERE id=$1', [mixed.id, 'Mixta.Antigua@Example.invalid']); const guardedMixed = await people();
      assert.equal((await register('mixta.antigua@example.invalid')).status, 400, 'una cuenta antigua con mayúsculas tampoco se duplica sin el índice (el único exacto no la ve)'); assert.equal(await people(), guardedMixed);
      await q('DELETE FROM "Users" WHERE id=$1', [mixed.id]);
      const a = await mkUser('user'); const b = await mkUser('user'); const c = await mkUser('user'); const lone = await mkUser('user');
      await q('UPDATE "Users" SET email=$2 WHERE id=$1', [a.id, 'dup.uno@example.invalid']); await q('UPDATE "Users" SET email=$2 WHERE id=$1', [b.id, 'DUP.UNO@Example.invalid']); await q('UPDATE "Users" SET email=$2 WHERE id=$1', [c.id, ' dup.uno@example.invalid ']);
      await q('UPDATE "Users" SET email=$2 WHERE id=$1', [lone.id, 'sola@example.invalid']);
      const snapshot = async () => JSON.stringify(await q('SELECT id, email, active, role FROM "Users" ORDER BY id'));
      const before = await snapshot();
      await mig.up(app); await mig.up(app);
      assert.equal(await hasIndex(), false, 'con duplicados NO se crea el índice');
      assert.equal(await snapshot(), before, 'no se borró, fusionó ni reescribió ninguna cuenta');
      assert.ok(warnings.length >= 1 && warnings.every((w) => /ES-306/.test(w) && !/@/.test(w)), 'el aviso no imprime correos'); assert.ok(warnings[0].includes(`[${a.id},${b.id},${c.id}]`), 'informa los ids del grupo');
      assert.deepEqual((await mig.duplicateGroups(app)).map((g) => [g.accounts, g.ids]), [[3, [a.id, b.id, c.id]]]);
      const url = new URL(process.env.ES306_TEST_DATABASE_URL); url.pathname = `/${dbName}`;
      const run = () => spawnSync(process.execPath, ['scripts/es306-email-duplicates.cjs'], { cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf8', env: { ...process.env, DATABASE_URL: url.toString(), DB_SSL: 'false', NODE_ENV: 'test' } });
      const report = run(); assert.equal(report.status, 2, report.stdout + report.stderr); assert.ok(report.stdout.includes(`ids=${a.id},${b.id},${c.id}`)); assert.ok(!/example.invalid/i.test(report.stdout), 'el informe no imprime correos');
      assert.equal(await snapshot(), before, 'el informe es de solo lectura');
      // La persona resuelve los duplicados (aquí: marca dos como eliminadas de la prueba) y la migración crea el índice.
      await q('DELETE FROM "Users" WHERE id IN ($1,$2)', [b.id, c.id]);
      assert.equal(run().status, 0); await mig.up(app); assert.equal(await hasIndex(), true, 'sin duplicados se crea el índice'); await mig.up(app); assert.equal(await hasIndex(), true, 'idempotente');
      await assert.rejects(() => q(`INSERT INTO "Users" (name, email, password, role, active, "createdAt", "updatedAt") VALUES ('x','DUP.UNO@example.invalid','x','user',true,now(),now())`), /duplicate key/);
      await assert.rejects(() => mig.down(app.getQueryInterface()), /ALLOW_DESTRUCTIVE_MIGRATION/, 'el down exige permiso explícito');
      process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
      try { await mig.down(app.getQueryInterface()); } finally { delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; }
      assert.equal(await hasIndex(), false); await mig.up(app); assert.equal(await hasIndex(), true, 'up→down→up');
    } finally { console.warn = realWarn; }
  });
});
