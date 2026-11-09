// ES-217 contra Postgres REAL: PUT /api/admin/usuarios/:id/unlock solo levanta el bloqueo por intentos fallidos (nunca reactiva cuentas
// desactivadas por administración), respeta la jerarquía de rangos de ES-215 y un id inválido es 400 (QA-215-01), no 500.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES217_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:admin-unlock:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-217 PostgreSQL: unlock solo levanta bloqueos por intentos, con jerarquía de rangos e id válido', { timeout: 180000 }, async (t) => {
  const source = process.env.ES217_TEST_DATABASE_URL;
  assert.ok(source, 'ES217_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es217_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es217_test_[a-f0-9]{16}$/);
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
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map((model) => model.sync()));
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin, verificarToken } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  app.get('/api/probe', verificarToken, (req, res) => res.json({ ok: true })); // cualquier sesión válida, sea cual sea el rol
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');

  const person = (role, name, extra = {}) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role, ...extra });
  // Una sesión por persona, emitida la primera vez que se usa: así se ve si un cambio de rol o estado la corta (un token nuevo sería válido).
  const tokens = new Map();
  const tokenFor = (who) => { if (!tokens.has(who.id)) tokens.set(who.id, issueToken(who)); return tokens.get(who.id); };
  const call = async (who, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(who)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json };
  };
  const row = async (p) => (await User.findByPk(p.id, { raw: true }));
  const session = async (p) => (await call(p, 'GET', '/api/probe')).status; // 200 mientras la sesión siga viva

  const [adm, adm2, sup, mia, pro, junta] = [await person('admin', 'Adm'), await person('admin', 'Adm2'), await person('superadmin', 'Sup'),
    await person('user', 'Persona'), await person('therapist', 'Pro'), await person('board', 'Junta')];
  const lock = (p) => User.update({ loginAttempts: 5, lockedUntil: new Date(Date.now() + 15 * 60000) }, { where: { id: p.id } });
  const unlock = (who, p) => call(who, 'PUT', `/api/admin/usuarios/${p.id}/unlock`);

  await t.test('el bloqueo por intentos fallidos sí se levanta (persona, profesional y junta) y no cambia el estado activo', async () => {
    for (const p of [mia, pro, junta]) {
      await lock(p);
      const r = await unlock(adm, p);
      assert.equal(r.status, 200, p.name);
      const after = await row(p); assert.equal(after.loginAttempts, 0); assert.equal(after.lockedUntil, null); assert.equal(after.active, true);
    }
  });

  await t.test('una cuenta desactivada por administración SIGUE desactivada tras unlock, y sus sesiones siguen revocadas (criterios 1 y 6)', async () => {
    assert.equal(await session(mia), 200);
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${mia.id}`, { active: false })).status, 200);
    assert.equal(await session(mia), 401);
    await lock(mia);
    const r = await unlock(adm, mia);
    assert.equal(r.status, 200);
    const after = await row(mia); assert.equal(after.active, false, 'unlock no reactiva'); assert.equal(after.loginAttempts, 0); assert.equal(after.lockedUntil, null);
    assert.equal(await session(mia), 401, 'la sesión sigue revocada');
    // superadmin tampoco reactiva con unlock: reactivar es PUT con active:true
    assert.equal((await unlock(sup, mia)).status, 200); assert.equal((await row(mia)).active, false);
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${mia.id}`, { active: true })).status, 200); assert.equal((await row(mia)).active, true);
  });

  await t.test('rango: admin→admin y admin→superadmin = 403 y la cuenta queda como estaba (U1); superadmin sí actúa sobre ambas', async () => {
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${adm2.id}`, { active: false })).status, 200); // desactivada por superadmin
    await lock(adm2); await lock(sup);
    for (const target of [adm2, sup]) {
      const r = await unlock(adm, target);
      assert.equal(r.status, 403, target.name); assert.equal(r.body.code, 'target_rank');
    }
    const a = await row(adm2); assert.equal(a.active, false, 'U1: un admin no reactiva a un admin desactivado'); assert.ok(a.lockedUntil, 'sigue bloqueada');
    assert.ok((await row(sup)).lockedUntil);
    assert.equal((await unlock(sup, adm2)).status, 200);
    const b = await row(adm2); assert.equal(b.active, false); assert.equal(b.lockedUntil, null);
  });

  await t.test('roles sin permiso no llegan a unlock (persona, profesional y junta con sesión válida) y sin sesión se rechaza', async () => {
    const [p2, t2, j2] = [await person('user', 'Persona2'), await person('therapist', 'Pro2'), await person('board', 'Junta2')];
    for (const who of [p2, t2, j2]) { const r = await unlock(who, mia); assert.ok([401, 403].includes(r.status), `${who.role} ${r.status}`); }
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/usuarios/${mia.id}/unlock`, { method: 'PUT' });
    assert.ok([401, 403].includes(res.status));
  });

  await t.test('QA-215-01: un id que no es un entero positivo da 400 (nunca 500) en todas las rutas con :id', async () => {
    for (const bad of ['abc', '0', '-1', '1.5', '99999999999', '1e3', '%20']) {
      for (const [method, suffix, body] of [['PUT', '', { active: true }], ['PUT', '/unlock'], ['DELETE', ''], ['PUT', '/plan', { planId: null }], ['GET', '/stats'], ['POST', '/reset-link', {}]]) {
        const r = await call(sup, method, `/api/admin/usuarios/${bad}${suffix}`, body);
        assert.equal(r.status, 400, `${method} ${bad}${suffix} → ${r.status}`); assert.equal(r.body.code, 'invalid_id');
      }
    }
    assert.equal((await call(sup, 'PUT', '/api/admin/usuarios/987654', { active: true })).status, 404);
    assert.equal((await call(sup, 'PUT', '/api/admin/usuarios/987654/unlock')).status, 404);
  });
});
