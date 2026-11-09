// ES-220 contra Postgres REAL: el login (modelo User real) no revela si un correo tiene cuenta. Crea y borra SOLO su propia base aleatoria en loopback.
// Uso (en backend/):  ES220_TEST_DATABASE_URL=postgres://... npm run test:login:pg   (o  node scripts/testEs220Local.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

test('ES-220 PostgreSQL: inexistente, inactiva y bloqueada responden igual y el bloqueo de cuentas reales no cambia', { timeout: 120000 }, async (t) => {
  const source = process.env.ES220_TEST_DATABASE_URL;
  assert.ok(source, 'ES220_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es220_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es220_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.LOGIN_RATE_LIMIT_MAX = '200'; // este archivo hace ráfagas desde una sola IP; el límite por IP de producción (10/min) no es lo que se prueba aquí
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../PricingPlan');
  const User = require('../../User');
  const authRouter = require('../../routes/auth'); // antes de sync(): registra también DeletionRequest, RevokedToken y AuthRevocation
  await sequelize.sync();
  const attempts = require('../../utils/loginAttempts');
  const app = express(); app.use(express.json()); app.use('/api', authRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/login`;
  // El limitador por IP del login (10/min) es del proceso: se cuentan las llamadas (máximo 10).
  const login = async (email, password) => { const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); return { status: r.status, body: await r.json() }; };

  const good = `Aa1!${randomBytes(12).toString('hex')}`; const wrong = `Bb2?${randomBytes(12).toString('hex')}`;
  const hash = await bcrypt.hash(good, 10);
  const make = (email, extra = {}) => User.create({ name: 'Synthetic', email, password: hash, role: 'user', active: true, ...extra });
  await make('real@example.invalid'); await make('inactive@example.invalid', { active: false });
  attempts.reset();

  // Primer intento: mismo status y cuerpo para las tres.
  const ghost1 = await login('ghost@example.invalid', wrong); const real1 = await login('real@example.invalid', wrong); const inactive1 = await login('inactive@example.invalid', wrong);
  assert.deepEqual([ghost1.status, real1.status, inactive1.status], [401, 401, 401]);
  assert.deepEqual(ghost1.body, real1.body); assert.deepEqual(ghost1.body, inactive1.body);

  // Bloqueo a los 3: la cuenta real (en la base) y el correo sin cuenta (en memoria) responden lo mismo.
  await login('ghost@example.invalid', wrong); const ghost3 = await login('ghost@example.invalid', wrong);
  await login('real@example.invalid', wrong); const real3 = await login('real@example.invalid', wrong);
  assert.deepEqual([ghost3.status, real3.status], [423, 423]); assert.deepEqual(ghost3.body, real3.body);
  const row = await User.findOne({ where: { email: 'real@example.invalid' } });
  assert.equal(row.loginAttempts, 3); assert.ok(row.lockedUntil && row.lockedUntil.getTime() - Date.now() > 14 * 60 * 1000 && row.lockedUntil.getTime() - Date.now() <= 15 * 60 * 1000); // umbral y 15 min sin cambios

  // Con la contraseña correcta la cuenta real bloqueada sigue bloqueada, igual que respondería un correo inexistente bloqueado.
  const lockedGood = await login('real@example.invalid', good);
  assert.equal(lockedGood.status, 423); assert.deepEqual(lockedGood.body, ghost3.body);

  // Cuenta inactiva con su contraseña correcta: aviso de cuenta inactiva (no es un oráculo: exige la contraseña). Cuenta activa nueva entra y limpia intentos.
  const inactiveGood = await login('inactive@example.invalid', good);
  assert.equal(inactiveGood.status, 403); assert.equal(inactiveGood.body.deactivated, true);
  await make('fine@example.invalid', { loginAttempts: 2 });
  const fine = await login('fine@example.invalid', good);
  assert.equal(fine.status, 200); assert.ok(fine.body.token);
  assert.equal((await User.findOne({ where: { email: 'fine@example.invalid' } })).loginAttempts, 0);

  // QA-220-01: intentos SIMULTÁNEOS. Cinco fallos en paralelo desde una IP deben verse igual para la cuenta real, el correo inexistente y la cuenta inactiva:
  // 2 × 401 y 3 × 423, en cada ronda. Con leer-sumar-escribir la cuenta real respondía 401 × 5 y dejaba pasar más de 3 intentos.
  const burst = (email) => Promise.all(Array.from({ length: 5 }, () => login(email, wrong)));
  const shape = (rows) => rows.map((r) => r.status).sort().join(',');
  for (let round = 0; round < 6; round++) {
    const names = ['real', 'ghost', 'inactive'].map((kind) => `${kind}-p${round}@example.invalid`);
    await make(names[0]); await make(names[2], { active: false });
    const [real, ghost, inactive] = await Promise.all(names.map(burst));
    assert.equal(shape(real), '401,401,423,423,423', `ronda ${round} cuenta real: ${shape(real)}`);
    assert.equal(shape(ghost), shape(real), `ronda ${round} inexistente: ${shape(ghost)}`);
    assert.equal(shape(inactive), shape(real), `ronda ${round} inactiva: ${shape(inactive)}`);
    for (const rows of [real, ghost, inactive]) for (const r of rows.filter((x) => x.status === 423)) assert.deepEqual(r.body, ghost.find((x) => x.status === 423).body);
    const row = await User.findOne({ where: { email: names[0] } });
    assert.equal(row.loginAttempts, 5); assert.ok(row.lockedUntil.getTime() - Date.now() > 14 * 60 * 1000 && row.lockedUntil.getTime() - Date.now() <= 15 * 60 * 1000); // ningún intento extra alarga el bloqueo
  }
});
