// ES-223 contra Postgres REAL: solicitar el plan que la persona ya tiene responde 409 y no crea fila; otros planes siguen funcionando; el dueño sale del token, nunca del cuerpo.
// Crea y borra SOLO su propia base aleatoria en loopback.
// Uso (en backend/):  ES223_TEST_DATABASE_URL=postgres://... npm run test:planreq:pg   (o  node scripts/testEs223Local.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-223 PostgreSQL: solicitar el plan actual = 409 sin fila; otros planes, propietario y concurrencia siguen bien', { timeout: 120000 }, async (t) => {
  const source = process.env.ES223_TEST_DATABASE_URL;
  assert.ok(source, 'ES223_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es223_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es223_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 10, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const PricingPlan = require('../../PricingPlan');
  const User = require('../../User');
  const PlanRequest = require('../../PlanRequest');
  User.belongsTo(PricingPlan, { as: 'plan', foreignKey: 'planId' });
  PlanRequest.belongsTo(PricingPlan, { as: 'plan', foreignKey: 'planId' });
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const router = require('../../routes/planRequests');
  await sequelize.sync();
  const app = express(); app.use(express.json()); app.use('/api/plan-requests', verificarToken, router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = async (token, body, path = '') => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/plan-requests${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };

  const plan = (slug, extra = {}) => PricingPlan.create({ slug, name_es: slug, name_en: slug, description_es: '', description_en: '', price: '0.00', currency: 'COP', period: 'month', features_es: [], features_en: [], isActive: true, isHighlighted: false, order: 1, ...extra });
  const base = await plan('base'); const plus = await plan('plus'); const hidden = await plan('oculto', { isActive: false });
  const person = (suffix, planId = null) => User.create({ name: 'Synthetic', email: `${suffix}@example.invalid`, password: 'not-a-real-credential', role: 'user', active: true, planId });
  const a = await person('a', base.id); const b = await person('b', plus.id); const c = await person('c');
  const [ta, tb, tc] = [a, b, c].map((user) => issueToken(user));
  const rows = (userId) => PlanRequest.count({ where: { userId } });

  // 1) El plan actual se rechaza con un código estable y no crea fila.
  const same = await call(ta, { planId: base.id });
  assert.equal(same.status, 409); assert.equal(same.body.code, 'already_on_plan'); assert.match(same.body.error, /Ya tienes este plan/);
  assert.equal(await rows(a.id), 0);
  assert.equal((await call(ta, undefined, '/me')).body.request, null);

  // 2) Otros planes siguen funcionando (y quedan pendientes).
  const other = await call(ta, { planId: plus.id });
  assert.equal(other.status, 201); assert.equal(other.body.request.planId, plus.id); assert.equal(await rows(a.id), 1);
  // Con una pendiente, el plan actual sigue siendo 409 already_on_plan y otro plan sigue siendo el 409 de «ya hay una pendiente» (sin código nuevo).
  assert.equal((await call(ta, { planId: base.id })).body.code, 'already_on_plan');
  const pending = await call(ta, { planId: plus.id });
  assert.equal(pending.status, 409); assert.notEqual(pending.body.code, 'already_on_plan');
  assert.equal(await rows(a.id), 1);

  // 3) Una persona sin plan puede pedir cualquiera; un plan inactivo o inexistente sigue siendo 404.
  assert.equal((await call(tc, { planId: base.id })).status, 201);
  assert.equal((await call(tb, { planId: hidden.id })).status, 404); assert.equal((await call(tb, { planId: 999999 })).status, 404);

  // 4) Propietario: el plan actual sale de la fila del dueño del token; un userId en el cuerpo se rechaza y el plan de OTRA persona no bloquea ni autoriza nada.
  assert.equal((await call(tb, { planId: plus.id, userId: a.id })).status, 400);
  assert.equal((await call(tb, { planId: plus.id })).body.code, 'already_on_plan'); // b tiene «plus»
  const bBase = await call(tb, { planId: base.id }); // a tiene «base» pero b no: b sí puede pedirlo
  assert.equal(bBase.status, 201); assert.equal(await rows(b.id), 1);

  // 5) Concurrencia sobre el plan actual: 8 simultáneas, ninguna crea fila.
  const d = await person('d', plus.id); const td = issueToken(d);
  const burst = await Promise.all(Array.from({ length: 8 }, () => call(td, { planId: plus.id })));
  assert.deepEqual([...new Set(burst.map((r) => r.status))], [409]); assert.equal(await rows(d.id), 0);

  // 6) Sin sesión no hay acceso.
  const anonymous = (await fetch(`http://127.0.0.1:${server.address().port}/api/plan-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: base.id }) })).status;
  assert.ok([401, 403].includes(anonymous), String(anonymous)); // sin token: el guardián del montaje rechaza (hoy 403) y no se crea nada
  assert.equal(await PlanRequest.count(), 3); // a (plus), b (base) y c (base): ninguna solicitud del plan actual ni anónima
});
