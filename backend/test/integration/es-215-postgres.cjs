// ES-215 (QA-42-01) contra Postgres REAL: una cuenta admin no puede cambiar el rol ni el estado de otra admin ni de una superadmin;
// solo superadmin lo hace; la plataforma nunca queda sin una superadmin activa (ni con cambios simultáneos). Ruta REAL, sesiones reales.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES215_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:admin-rank:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-215 PostgreSQL: rango del objetivo al cambiar rol o estado de una cuenta', { timeout: 180000 }, async (t) => {
  const source = process.env.ES215_TEST_DATABASE_URL;
  assert.ok(source, 'ES215_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es215_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es215_test_[a-f0-9]{16}$/);
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
  await require('../../AdminAuditEntry').sync(); // ES-186 B: las rutas de administración auditan
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  app.get('/api/probe', verificarAdmin, (req, res) => res.json({ ok: true }));
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

  const [adm, adm2, sup, sup2, mia, pro, junta] = [await person('admin', 'Adm'), await person('admin', 'Adm2'), await person('superadmin', 'Sup'), await person('superadmin', 'Sup2'),
    await person('user', 'Persona'), await person('therapist', 'Pro'), await person('board', 'Junta')];

  await t.test('admin → superadmin: desactivar y degradar dan 403, el superadmin queda intacto y con sesión viva (R-c2, R-c3)', async () => {
    assert.equal(await session(sup), 200);
    for (const body of [{ active: false }, { role: 'user' }, { role: 'admin' }, { role: 'superadmin' }, { active: true }]) {
      const r = await call(adm, 'PUT', `/api/admin/usuarios/${sup.id}`, body);
      assert.equal(r.status, 403, JSON.stringify(body));
      if (!['admin', 'superadmin'].includes(body.role)) assert.equal(r.body.code, 'target_rank'); // asignar un rol privilegiado ya se negaba antes
    }
    const after = await row(sup);
    assert.equal(after.role, 'superadmin'); assert.equal(after.active, true);
    assert.equal(await session(sup), 200, 'la sesión del superadmin no se revocó');
  });

  await t.test('admin → admin: rol y estado dan 403 y la otra cuenta queda intacta; el cambio de datos no privilegiados no cambia', async () => {
    for (const body of [{ active: false }, { role: 'user' }, { role: 'therapist' }]) {
      const r = await call(adm, 'PUT', `/api/admin/usuarios/${adm2.id}`, body);
      assert.equal(r.status, 403, JSON.stringify(body)); assert.equal(r.body.code, 'target_rank');
    }
    const after = await row(adm2); assert.equal(after.role, 'admin'); assert.equal(after.active, true); assert.equal(await session(adm2), 200);
    // una petición sin cambios de rol ni estado no se trata como un cambio privilegiado
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${adm2.id}`, {})).status, 200);
  });

  await t.test('admin sigue gestionando user, therapist y board como antes (desactivar, reactivar, cambiar entre no privilegiados) y no asigna roles privilegiados', async () => {
    for (const p of [mia, pro, junta]) {
      assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${p.id}`, { active: false })).status, 200); assert.equal((await row(p)).active, false);
      assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${p.id}`, { active: true })).status, 200); assert.equal((await row(p)).active, true);
    }
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${mia.id}`, { role: 'therapist' })).status, 200);
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${mia.id}`, { role: 'user' })).status, 200);
    for (const role of ['admin', 'superadmin', 'board']) assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${mia.id}`, { role })).status, 403, role);
    assert.equal((await row(mia)).role, 'user');
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${adm.id}`, { active: false })).status, 403, 'nunca sobre sí misma');
  });

  await t.test('superadmin sí cambia admin y a otro superadmin (hay otra activa), y el cambio corta la sesión de esa cuenta', async () => {
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${adm2.id}`, { active: false })).status, 200);
    assert.equal((await row(adm2)).active, false); assert.equal(await session(adm2), 401);
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${adm2.id}`, { active: true })).status, 200);
    const extra = await person('superadmin', 'SupExtra');
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${extra.id}`, { role: 'user' })).status, 200); assert.equal((await row(extra)).role, 'user');
  });

  await t.test('la plataforma nunca queda sin una superadmin activa: se rechaza con 409 al quitar la última', async () => {
    // Sup desactiva a Sup2: queda Sup como ÚNICA superadmin activa.
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${sup2.id}`, { active: false })).status, 200);
    // Aunque la cuenta inactiva Sup2 llegara con un token válido, no puede quitar a la última activa: 409 y Sup intacta.
    const lone = await call(sup2, 'PUT', `/api/admin/usuarios/${sup.id}`, { role: 'user' });
    assert.equal(lone.status, 409); assert.equal(lone.body.code, 'last_superadmin');
    assert.equal((await call(sup2, 'PUT', `/api/admin/usuarios/${sup.id}`, { active: false })).status, 409);
    assert.equal((await row(sup)).role, 'superadmin');
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${sup2.id}`, { active: true })).status, 200);
  });

  await t.test('cambios simultáneos entre dos superadmins: nunca quedan cero superadmins activas', async () => {
    const [a, b] = [await person('superadmin', 'RaceA'), await person('superadmin', 'RaceB')];
    // Las dos se degradan entre sí a la vez; también hay otras superadmins (Sup, Sup2), así que se aíslan: se desactivan primero.
    for (const other of [sup, sup2]) await User.update({ active: false }, { where: { id: other.id } });
    const results = await Promise.all([call(a, 'PUT', `/api/admin/usuarios/${b.id}`, { role: 'user' }), call(b, 'PUT', `/api/admin/usuarios/${a.id}`, { role: 'user' })]);
    const statuses = results.map((r) => r.status).sort();
    assert.ok(statuses.includes(200), JSON.stringify(results.map((r) => r.status)));
    const active = await User.count({ where: { role: 'superadmin', active: true } });
    assert.ok(active >= 1, `quedaron ${active} superadmin activas`);
    // la perdedora recibe 409 (la regla) o 401 (su sesión ya se había revocado), nunca 200
    assert.ok(statuses.filter((s) => s === 200).length === 1, JSON.stringify(statuses));
    for (const other of [sup, sup2]) await User.update({ active: true }, { where: { id: other.id } });
  });

  await t.test('con una sola superadmin, ninguna cuenta puede desactivarla ni degradarla (admin 403; ella misma 403 por regla propia)', async () => {
    for (const other of [sup2]) await User.update({ role: 'user' }, { where: { id: other.id } });
    await User.destroy({ where: { name: ['RaceA', 'RaceB'] } });
    const supers = await User.findAll({ where: { role: 'superadmin', active: true } });
    assert.equal(supers.length, 1);
    assert.equal((await call(adm, 'PUT', `/api/admin/usuarios/${sup.id}`, { active: false })).status, 403);
    assert.equal((await call(sup, 'PUT', `/api/admin/usuarios/${sup.id}`, { role: 'user' })).status, 403);
    assert.equal((await row(sup)).role, 'superadmin');
  });
});
