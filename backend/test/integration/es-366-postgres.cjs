// ES-366 (QA-419-2) contra Postgres REAL: el corte de sesiones por versión (`sv`) es correcto con varias instancias y relojes desfasados.
// «Instancias» = copias independientes del módulo utils/sessions (cada una con sus marcas por proceso y su reloj: adelantado o atrasado) sobre la MISMA base.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES366_TEST_DATABASE_URL=postgres://usuario:clave@127.0.0.1:PUERTO/postgres npm run test:session-version:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');

test('ES-366 PostgreSQL: versión de sesión, dos instancias con relojes desfasados', { timeout: 180000 }, async (t) => {
  const source = process.env.ES366_TEST_DATABASE_URL;
  assert.ok(source, 'ES366_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es366_test_${randomBytes(8).toString('hex')}`; const oldName = `es366_old_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es366_test_[a-f0-9]{16}$/); assert.match(oldName, /^es366_old_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let oldDb; let server; const created = [];
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (oldDb) await oldDb.close();
    for (const name of created) await admin.query(`DROP DATABASE "${name}"`); // los nombres los genera este archivo, nunca vienen de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created.push(dbName);
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.LOGIN_RATE_LIMIT_MAX = '500';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  require('../../PricingPlan');
  const User = require('../../User'); const AuthRevocation = require('../../AuthRevocation');
  const authRouter = require('../../routes/auth'); // antes de sync(): registra también DeletionRequest, RevokedToken y AuthRevocation
  const sessionRouter = require('../../routes/session'); const adminRouter = require('../../routes/adminUsers'); const resetRouter = require('../../routes/passwordReset');
  await sequelize.sync();
  const { verificarToken, verificarAdmin } = require('../../middlewares/auth');

  // «Instancias»: copias nuevas del módulo (marcas lastCutMs/lastIssuedMs propias) con su propio reloj.
  const sessionsPath = require.resolve('../../utils/sessions');
  const instance = (offsetMs) => {
    delete require.cache[sessionsPath]; const mod = require('../../utils/sessions'); delete require.cache[sessionsPath];
    const withClock = (fn) => { const real = Date.now; Date.now = () => real() + offsetMs; try { return fn(); } finally { Date.now = real; } };
    return {
      // Como el login real: lee la versión de la base y firma.
      login: async (user) => { const sv = await mod.currentSessionVersion(user.id); return withClock(() => mod.issueToken(user, sv)); },
      legacyLogin: (user) => withClock(() => mod.issueToken(user)), // sin `sv`: token de antes del despliegue
      cut: (userId) => withClock(() => mod.revokeUserSessions(userId)),
      check: (token) => mod.sessionProblem(jwt.verify(token, process.env.JWT_SECRET)),
    };
  };
  const ahead = instance(+5000); const behind = instance(-5000); const sameClock = instance(0);
  const person = (name, role = 'user', extra = {}) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role, ...extra });
  const version = async (user) => Number((await sequelize.query('SELECT "sessionVersion" FROM "AuthRevocations" WHERE "UserId" = :id', { replacements: { id: user.id }, type: Sequelize.QueryTypes.SELECT }))[0]?.sessionVersion ?? 0);

  await t.test('C8a: token de la instancia ADELANTADA anterior a un corte hecho por la instancia ATRASADA → revocado (con la regla por tiempo sobrevivía)', async () => {
    const u = await person('Ca');
    const token = await ahead.login(u); assert.equal(await behind.check(token), null, 'antes del corte vale');
    await behind.cut(u.id);
    assert.equal(await behind.check(token), 'revoked'); assert.equal(await ahead.check(token), 'revoked');
    // Contraste honesto: el mismo escenario con un token SIN `sv` (regla vieja) sobrevive: es el límite que ES-366 elimina para los tokens nuevos.
    const u2 = await person('Ca2'); const legacy = ahead.legacyLogin(u2); await behind.cut(u2.id);
    assert.equal(await behind.check(legacy), null, 'documentado: el token sin sv conserva la regla por tiempo (hasta que expire a las 8 h)');
  });

  await t.test('C8b: inicio de sesión POSTERIOR a un corte hecho por otra instancia con el reloj ADELANTADO → NO se revoca (con la regla por tiempo quedaba revocado)', async () => {
    const u = await person('Cb');
    await ahead.cut(u.id);
    const token = await behind.login(u);
    assert.equal(await behind.check(token), null); assert.equal(await ahead.check(token), null);
    const u2 = await person('Cb2'); await ahead.cut(u2.id); const legacy = behind.legacyLogin(u2);
    assert.equal(await behind.check(legacy), 'revoked', 'contraste: sin sv la deriva sí lo revoca de más');
  });

  await t.test('C8c: en ambos sentidos y con varios cortes, ningún token anterior sobrevive y ninguno posterior se revoca', async () => {
    const u = await person('Cc'); const pairs = [[ahead, behind], [behind, ahead], [ahead, sameClock], [sameClock, behind], [behind, behind], [ahead, ahead]];
    for (const [issuer, cutter] of pairs) {
      const before = await issuer.login(u); await cutter.cut(u.id); const after = await issuer.login(u);
      assert.equal(await cutter.check(before), 'revoked'); assert.equal(await issuer.check(before), 'revoked');
      assert.equal(await cutter.check(after), null); assert.equal(await issuer.check(after), null);
    }
    assert.equal(await version(u), pairs.length);
  });

  await t.test('cortes CONCURRENTES de la misma persona: la versión sube exactamente N y ningún token anterior sobrevive', async () => {
    const u = await person('Conc'); const early = await Promise.all([ahead, behind, sameClock].map((i) => i.login(u)));
    const cuts = [ahead, behind, sameClock, ahead, behind, sameClock, ahead, behind];
    await Promise.all(cuts.map((i) => i.cut(u.id)));
    assert.equal(await version(u), cuts.length);
    for (const token of early) assert.equal(await sameClock.check(token), 'revoked');
    const row = await AuthRevocation.findByPk(u.id); assert.ok(row.revokedBefore instanceof Date, 'el instante sigue escribiéndose (rollback de código)');
    assert.equal(await sameClock.check(await sameClock.login(u)), null);
  });

  await t.test('sesión que se firma EN PARALELO con el corte: si leyó la versión anterior queda revocada; si leyó la nueva, vale; nunca vale una anterior al corte', async () => {
    const u = await person('Par'); let ok = 0; let revoked = 0;
    for (let i = 0; i < 12; i += 1) {
      const [token] = await Promise.all([behind.login(u), ahead.cut(u.id)]);
      const state = await sameClock.check(token); assert.ok(state === null || state === 'revoked', String(state));
      if (state === null) ok += 1; else revoked += 1;
      assert.equal(await sameClock.check(await sameClock.login(u)), null, 'el inicio de sesión posterior al corte siempre vale');
    }
    assert.equal(ok + revoked, 12);
  });

  await t.test('compatibilidad: token sin `sv` sigue la regla actual (iatMs vs revokedBefore); `sv` mayor que la vigente, no entero o ajeno se rechaza; versión 0 sin fila vale', async () => {
    const u = await person('Comp'); const legacy = sameClock.legacyLogin(u);
    assert.equal(await sameClock.check(legacy), null, 'sin fila ni sv: vale (ninguna sesión vigente se invalida al desplegar)');
    assert.equal(await sameClock.check(await sameClock.login(u)), null, 'sin fila: la versión es 0 y vale');
    await new Promise((r) => setTimeout(r, 5)); await sameClock.cut(u.id);
    assert.equal(await sameClock.check(legacy), 'revoked');
    const fresh = sameClock.legacyLogin(u); assert.equal(await sameClock.check(fresh), null, 'token sin sv emitido tras el corte vale');
    const current = await version(u); const forge = (sv) => jwt.sign({ id: u.id, role: 'user', iatMs: Date.now(), sv }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: randomBytes(8).toString('hex') });
    assert.equal(await sameClock.check(forge(current)), null);
    for (const sv of [current + 1, current - 1, -1, 1.5, '1', null]) assert.equal(await sameClock.check(forge(sv)), 'revoked', JSON.stringify(sv));
    const other = await person('CompOtro'); assert.equal(await sameClock.check(forge(current)) === null && await sameClock.check(jwt.sign({ id: other.id, role: 'user', iatMs: Date.now(), sv: current }, process.env.JWT_SECRET, { jwtid: 'x1' })), 'revoked', 'la versión de otra persona no sirve: cada una tiene la suya (current > 0 aquí)');
  });

  // Rutas REALES: login, logout, logout-all, cambio de rol/estado de un admin, restablecimiento de contraseña.
  const app = express(); app.use(express.json());
  app.use('/api', authRouter); app.use('/api', resetRouter); app.use('/api', verificarToken, sessionRouter);
  app.use('/api/admin/usuarios', verificarAdmin, adminRouter);
  app.get('/api/probe', verificarToken, (req, res) => res.json({ ok: true }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const good = `Aa1!${randomBytes(12).toString('hex')}`; const hash = await bcrypt.hash(good, 10);
  const call = async (token, method, path, body) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 60) }; } return { status: r.status, body: json }; };
  const login = async (email) => { const r = await call(null, 'POST', '/api/login', { email, password: good }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.token; };
  const make = (name, role = 'user', extra = {}) => person(name, role, { password: hash, ...extra });

  await t.test('login real: el token lleva `sv` = versión vigente; logout-all lo corta; el siguiente login vale y lleva sv+1', async () => {
    const u = await make('Ruta'); const t1 = await login(u.email);
    assert.equal(jwt.decode(t1).sv, 0); assert.equal((await call(t1, 'GET', '/api/probe')).status, 200);
    assert.equal((await call(t1, 'POST', '/api/logout-all')).status, 200);
    assert.equal((await call(t1, 'GET', '/api/probe')).status, 401);
    const t2 = await login(u.email); assert.equal(jwt.decode(t2).sv, 1); assert.equal((await call(t2, 'GET', '/api/probe')).status, 200);
    assert.equal(await version(u), 1);
  });

  await t.test('logout (una sesión) no sube la versión: las demás sesiones de la persona siguen vivas', async () => {
    const u = await make('Solo'); const a = await login(u.email); const b = await login(u.email);
    assert.equal((await call(a, 'POST', '/api/logout')).status, 200);
    assert.equal((await call(a, 'GET', '/api/probe')).status, 401); assert.equal((await call(b, 'GET', '/api/probe')).status, 200);
    assert.equal(await version(u), 0);
  });

  await t.test('cambio de rol y de estado por un admin cortan las sesiones de la persona (cada uno sube la versión) y la fila de versión sigue existiendo', async () => {
    const boss = await make('Jefa', 'superadmin'); const bossToken = await login(boss.email);
    const u = await make('Objetivo'); let token = await login(u.email);
    assert.equal((await call(bossToken, 'PUT', `/api/admin/usuarios/${u.id}`, { role: 'therapist' })).status, 200);
    assert.equal((await call(token, 'GET', '/api/probe')).status, 401); assert.equal(await version(u), 1);
    token = await login(u.email); assert.equal((await call(token, 'GET', '/api/probe')).status, 200);
    assert.equal((await call(bossToken, 'PUT', `/api/admin/usuarios/${u.id}`, { active: false })).status, 200);
    assert.equal((await call(token, 'GET', '/api/probe')).status, 401); assert.equal(await version(u), 2);
    assert.ok(await AuthRevocation.findByPk(u.id), 'la fila de versión existe');
  });

  await t.test('el corte que usa el restablecimiento de contraseña (revokeUserSessions, ES-132) corta las sesiones abiertas', async () => {
    const u = await make('Reset'); const token = await login(u.email);
    const before = await version(u);
    const { revokeUserSessions } = require('../../utils/sessions'); await revokeUserSessions(u.id); // el flujo llama exactamente a esta función (routes/passwordReset.js)
    assert.equal((await call(token, 'GET', '/api/probe')).status, 401); assert.equal(await version(u), before + 1);
    assert.ok(resetRouter);
  });

  await t.test('lectura POR PETICIÓN a la base (sin caché por proceso): un corte hecho por otra instancia se ve en la petición siguiente y el costo es una lectura de AuthRevocations', async () => {
    const u = await make('SinCache'); const token = await login(u.email); assert.equal((await call(token, 'GET', '/api/probe')).status, 200);
    const seen = []; const orig = AuthRevocation.findByPk; AuthRevocation.findByPk = function patched(...args) { seen.push(args[0]); return orig.apply(this, args); };
    try { await ahead.cut(u.id); assert.equal((await call(token, 'GET', '/api/probe')).status, 401); } finally { AuthRevocation.findByPk = orig; }
    assert.equal(seen.filter((id) => id === u.id).length, 1, 'exactamente una lectura de AuthRevocations por petición');
    const source = require('node:fs').readFileSync(require.resolve('../../utils/sessions.js'), 'utf8');
    assert.ok(!/new Map\(|cache/i.test(source.replace(/\/\/.*$/gm, '')), 'sin caché en sessions.js');
  });

  await t.test('migración: aditiva e idempotente, conserva filas y deja la columna IDÉNTICA a la que crea sync() (tabla creada con el esquema anterior)', async () => {
    const synced = await sequelize.query(`SELECT data_type, is_nullable, column_default, udt_name, numeric_precision FROM information_schema.columns WHERE table_name = 'AuthRevocations' AND column_name = 'sessionVersion'`, { type: Sequelize.QueryTypes.SELECT });
    assert.equal(synced.length, 1);
    await admin.query(`CREATE DATABASE "${oldName}"`); created.push(oldName);
    const oldTarget = new URL(source); oldTarget.pathname = '/' + oldName;
    oldDb = new Sequelize(oldTarget.toString(), { logging: false, dialectOptions: { ssl: false } });
    await oldDb.query('CREATE TABLE "AuthRevocations" ("UserId" INTEGER, "revokedBefore" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("UserId"))'); // baseline-20261028
    await oldDb.query(`INSERT INTO "AuthRevocations" VALUES (7, '2026-11-01T00:00:00Z', now(), now()), (8, '2026-11-02T00:00:00Z', now(), now())`);
    const migration = require('../../migrations/20261121010000-es366-session-version.cjs');
    await migration.up(oldDb); await migration.up(oldDb); await migration.up({ sequelize: oldDb }); // dos o tres veces: idempotente, y con el contrato de sequelize-cli
    const migrated = await oldDb.query(`SELECT data_type, is_nullable, column_default, udt_name, numeric_precision FROM information_schema.columns WHERE table_name = 'AuthRevocations' AND column_name = 'sessionVersion'`, { type: Sequelize.QueryTypes.SELECT });
    assert.deepEqual(migrated, synced, 'idéntica a la del modelo');
    const rows = await oldDb.query('SELECT "UserId", "sessionVersion", "revokedBefore" FROM "AuthRevocations" ORDER BY 1', { type: Sequelize.QueryTypes.SELECT });
    assert.deepEqual(rows.map((r) => [r.UserId, Number(r.sessionVersion)]), [[7, 0], [8, 0]], 'las filas existentes se conservan, en versión 0');
    assert.equal(rows[0].revokedBefore.toISOString(), '2026-11-01T00:00:00.000Z');
  });
});
