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
process.env.REGISTER_RATE_LIMIT_MAX = '100000'; // ES-221: ráfagas de registros desde una sola IP (el límite real es 30 por hora y no se respeta en producción)
const { startRealApi } = require('../support/realApi.cjs');

test('ES-306 PostgreSQL + HTTP: correo sin distinguir mayúsculas en registro, login, recuperación e invitaciones; migración que reporta y crea el índice solo sin duplicados', { timeout: 900000 }, async (t) => {
  const { q, http, app, mkUser, dbName } = await startRealApi(t, { envVar: 'ES306_TEST_DATABASE_URL', prefix: 'es306' });
  const migration = require('../../migrations/20261114010000-es306-email-lower-unique.cjs');
  const PASSWORD = 'Sintetica-Clave-2026!';
  const HASH = await bcrypt.hash(PASSWORD, 4);
  const register = (email, patch = {}) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email, password: PASSWORD, acceptedTerms: true, termsVersion: '2026-11-v1', ...patch });
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

  await t.test('cuenta ANTIGUA guardada con ESPACIOS laterales (el registro anterior los permitía): login, recuperación, registro duplicado e invitación la encuentran; el índice también cubre btrim', async () => {
    const old = await mkUser('user'); await q('UPDATE "Users" SET email=$2, password=$3 WHERE id=$1', [old.id, '  Espacios.Antigua@Example.invalid  ', HASH]);
    const before = await people();
    for (const variant of ['espacios.antigua@example.invalid', 'ESPACIOS.ANTIGUA@example.invalid', '  espacios.antigua@example.invalid ']) assert.equal((await register(variant)).status, 400, `registro ${variant}`);
    assert.equal(await people(), before, 'no se duplicó');
    for (const variant of ['espacios.antigua@example.invalid', 'ESPACIOS.ANTIGUA@EXAMPLE.INVALID', ' Espacios.Antigua@Example.invalid ']) assert.equal((await login(variant)).status, 200, `login ${variant}`);
    const resets = async () => Number((await q('SELECT count(*) n FROM "PasswordResets" WHERE "UserId"=$1', [old.id]))[0].n);
    await http(null, 'POST', '/api/password-reset/request', { email: 'Espacios.Antigua@example.invalid' });
    assert.equal(await waitFor(async () => (await resets()) === 1), true, 'la recuperación la encuentra');
    const admin = await mkUser('superadmin'); assert.equal((await http(admin, 'POST', '/api/admin/invitations', { email: 'espacios.antigua@example.invalid', role: 'user' })).status, 409, 'invitar a ese correo = ya existe');
    await assert.rejects(() => q(`INSERT INTO "Users" (name, email, password, role, active, "createdAt", "updatedAt") VALUES ('x','espacios.antigua@example.invalid','x','user',true,now(),now())`), /duplicate key/, 'el índice (lower+btrim) frena el duplicado por debajo de la aplicación');
    assert.equal((await q('SELECT email FROM "Users" WHERE id=$1', [old.id]))[0].email, '  Espacios.Antigua@Example.invalid  ', 'no se reescribe la cuenta existente');
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

  await t.test('E306-1: un fallo REAL de la base al registrar (no un duplicado) sigue siendo 500 genérico, sin SQL ni correo, y NO se disfraza de «ya registrado»', async () => {
    await q(`CREATE OR REPLACE FUNCTION es306_fail() RETURNS trigger AS 'BEGIN RAISE EXCEPTION ''es306 fallo inyectado''; RETURN NEW; END' LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER es306_fail_insert BEFORE INSERT ON "Users" FOR EACH ROW EXECUTE FUNCTION es306_fail()`);
    try {
      const before = await people();
      const out = await register('Fallo.Inyectado@Example.invalid');
      assert.equal(out.status, 500, JSON.stringify(out.body));
      assert.deepEqual(out.body, { error: 'Error en el servidor al registrar.' }, 'mensaje genérico estable');
      assert.ok(!/es306|INSERT|Users|fallo\.inyectado|example\.invalid/i.test(JSON.stringify(out.body)), 'sin SQL ni correo en la respuesta');
      assert.equal(await people(), before);
    } finally { await q('DROP TRIGGER IF EXISTS es306_fail_insert ON "Users"'); await q('DROP FUNCTION IF EXISTS es306_fail()'); }
    assert.equal((await register('Fallo.Inyectado@Example.invalid')).status, 201, 'sin el fallo, el mismo correo se registra');
  });

  await t.test('E306-3: el bloqueo de login de un correo SIN cuenta cuenta igual en cualquier casing o espacios (una sola clave)', async () => {
    const outs = [];
    for (const variant of ['Fantasma.Sin.Cuenta@Example.invalid', 'FANTASMA.SIN.CUENTA@example.invalid', ' fantasma.sin.cuenta@EXAMPLE.invalid ']) outs.push((await login(variant, 'Otra-Clave-9999!')).status);
    assert.deepEqual(outs, [401, 401, 423], 'tres fallos con casings distintos bloquean como un solo correo');
    assert.equal((await login('fantasma.sin.cuenta@example.invalid', 'Otra-Clave-9999!')).status, 423, 'el bloqueo vale también para el casing normalizado');
  });

  await t.test('E306-4: la migración de reparación reemplaza el índice VIEJO (lower sin btrim) por lower(btrim) sin tocar ninguna cuenta; con duplicados lo deja y avisa; idempotente', async () => {
    const repair = require('../../migrations/20261115010000-es306-email-index-repair.cjs');
    const def = async () => (await q(`SELECT indexdef FROM pg_indexes WHERE indexname = 'users_email_lower_unique'`))[0]?.indexdef;
    const snapshot = async () => JSON.stringify(await q('SELECT id, email, active, role FROM "Users" ORDER BY id'));
    const warnings = []; const realWarn = console.warn; console.warn = (...args) => { warnings.push(args.join(' ')); };
    try {
      assert.equal((await repair.repairIndex(app)).action, 'already-correct', 'con el índice correcto no hace nada');
      const correct = await def(); assert.match(correct, /btrim/);
      // Base que aplicó la primera versión: índice viejo lower(email).
      await q('DROP INDEX "users_email_lower_unique"'); await q('CREATE UNIQUE INDEX "users_email_lower_unique" ON "Users" (lower("email"))');
      assert.doesNotMatch(await def(), /btrim/, 'precondición: índice viejo');
      const a = await mkUser('user'); const b = await mkUser('user');
      await q('UPDATE "Users" SET email=$2 WHERE id=$1', [a.id, 'repara.espacios@example.invalid']); await q('UPDATE "Users" SET email=$2 WHERE id=$1', [b.id, ' repara.espacios@example.invalid ']);
      const before = await snapshot();
      await repair.up(app);
      assert.doesNotMatch(await def(), /btrim/, 'con duplicados por espacios NO se reemplaza');
      assert.equal(await snapshot(), before, 'no se tocó ninguna cuenta');
      assert.ok(warnings.length === 1 && /ES-306/.test(warnings[0]) && !/@/.test(warnings[0]) && warnings[0].includes(`[${a.id},${b.id}]`), `avisa con ids y sin correos: ${warnings.join('|')}`);
      await q('DELETE FROM "Users" WHERE id=$1', [b.id]);
      assert.equal((await repair.repairIndex(app)).action, 'replaced'); assert.equal(await def(), correct, 'queda exactamente el índice correcto');
      assert.equal((await repair.repairIndex(app)).action, 'already-correct', 'idempotente');
      await assert.rejects(() => q(`INSERT INTO "Users" (name, email, password, role, active, "createdAt", "updatedAt") VALUES ('x',' REPARA.ESPACIOS@example.invalid','x','user',true,now(),now())`), /duplicate key/, 'ahora el índice frena el duplicado con espacios');
      await q('DELETE FROM "Users" WHERE id=$1', [a.id]);
    } finally { console.warn = realWarn; }
    assert.equal(await hasIndex(), true);
  });

  await t.test('E306-4 (estados y atomicidad): índice ausente, correcto (no-op: no toca el índice) e índice viejo con un fallo a mitad del reemplazo (se revierte: nunca queda sin índice único)', async () => {
    const repair = require('../../migrations/20261115010000-es306-email-index-repair.cjs');
    const info = async () => (await q(`SELECT i.indexrelid::int AS oid, pg_get_indexdef(i.indexrelid) AS def FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'users_email_lower_unique'`))[0];
    const warnings = []; const realWarn = console.warn; console.warn = (...args) => { warnings.push(args.join(' ')); };
    try {
      // Correcto: no-op real (mismo objeto de índice, no se recreó).
      const correct = await info(); assert.match(correct.def, /btrim/);
      assert.equal((await repair.repairIndex(app)).action, 'already-correct'); await repair.up(app);
      assert.deepEqual(await info(), correct, 'con el índice correcto la migración no lo toca (mismo oid y definición)');
      // Ausente y sin duplicados: lo crea.
      await q('DROP INDEX "users_email_lower_unique"'); assert.equal(await hasIndex(), false);
      assert.equal((await repair.repairIndex(app)).created, true); assert.match((await info()).def, /btrim/);
      // Ausente CON duplicados: no lo crea, no cambia filas, avisa sin correos.
      await q('DROP INDEX "users_email_lower_unique"');
      const a = await mkUser('user'); const b = await mkUser('user');
      await q('UPDATE "Users" SET email=$2 WHERE id=$1', [a.id, 'ausente.dup@example.invalid']); await q('UPDATE "Users" SET email=$2 WHERE id=$1', [b.id, 'AUSENTE.DUP@example.invalid']);
      const rows = JSON.stringify(await q('SELECT id, email FROM "Users" ORDER BY id'));
      assert.equal((await repair.repairIndex(app)).created, false); assert.equal(await hasIndex(), false, 'con duplicados no se crea');
      assert.equal(JSON.stringify(await q('SELECT id, email FROM "Users" ORDER BY id')), rows, 'filas intactas');
      assert.ok(warnings.length >= 1 && warnings.every((w) => !/@/.test(w)), 'el aviso no imprime correos');
      await q('DELETE FROM "Users" WHERE id IN ($1,$2)', [a.id, b.id]);
      // Atomicidad: índice viejo y el CREATE del nuevo falla → se revierte el DROP; la tabla nunca queda sin índice único.
      await q('CREATE UNIQUE INDEX "users_email_lower_unique" ON "Users" (lower("email"))');
      const old = await info(); assert.doesNotMatch(old.def, /btrim/);
      const failing = new Proxy(app, { get(target, prop) { const v = target[prop]; if (prop !== 'query') return typeof v === 'function' ? v.bind(target) : v; return (sql, ...rest) => (/CREATE UNIQUE INDEX/.test(String(sql)) ? Promise.reject(new Error('fallo inyectado en el CREATE')) : target.query(sql, ...rest)); } });
      await assert.rejects(() => repair.repairIndex(failing), /fallo inyectado/);
      assert.deepEqual(await info(), old, 'se revirtió: sigue el índice viejo (mismo oid), no quedó sin índice único');
      await assert.rejects(() => q(`INSERT INTO "Users" (name, email, password, role, active, "createdAt", "updatedAt") VALUES ('x','ANA.PEREZ@example.invalid','x','user',true,now(),now())`), /duplicate key/, 'la unicidad sigue protegida tras el fallo');
      assert.equal((await repair.repairIndex(app)).action, 'replaced'); assert.match((await info()).def, /btrim/);
      // down: exige permiso explícito (ES-59) y, con él, no toca nada.
      const after = await info(); await assert.rejects(() => repair.down(), /ALLOW_DESTRUCTIVE_MIGRATION/);
      process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; try { await repair.down(); } finally { delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; }
      assert.deepEqual(await info(), after, 'el down no cambia el índice');
    } finally { console.warn = realWarn; }
    assert.equal(await hasIndex(), true);
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
      // E306-2: dos cuentas ANTIGUAS duplicadas por casing (sin índice): el texto exacto entra a su propia cuenta y el casing distinto va a la MÁS ANTIGUA.
      const first = await mkUser('user'); const second = await mkUser('user');
      await q('UPDATE "Users" SET email=$2, password=$3 WHERE id=$1', [first.id, 'orden.antigua@example.invalid', await bcrypt.hash('Clave-Primera-2026!', 4)]);
      await q('UPDATE "Users" SET email=$2, password=$3 WHERE id=$1', [second.id, 'ORDEN.ANTIGUA@example.invalid', await bcrypt.hash('Clave-Segunda-2026!', 4)]);
      assert.equal((await login('Orden.Antigua@Example.invalid', 'Clave-Primera-2026!')).status, 200, 'un casing que no es de ninguna va a la cuenta más antigua');
      assert.equal((await login('ORDEN.ANTIGUA@example.invalid', 'Clave-Segunda-2026!')).status, 200, 'el texto exacto entra a su propia cuenta');
      assert.equal((await login('Orden.Antigua@Example.invalid', 'Clave-Segunda-2026!')).status, 401, 'el casing ambiguo NO entra a la más nueva');
      await q('DELETE FROM "Users" WHERE id IN ($1,$2)', [first.id, second.id]);
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
