// ES-259 contra Postgres REAL: POST /api/register con correos enormes, con coma, con espacios o doble @ responde 400 invalid_email (nunca 5xx) y no crea filas;
// los correos válidos (acentos, IDN, 254 caracteres) se registran. Crea y borra SOLO su propia base aleatoria en loopback.
//   ES259_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-259-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-259 PostgreSQL: el registro valida forma y longitud del correo; sin 5xx y sin filas por entradas inválidas', { timeout: 120000 }, async (t) => {
  const source = process.env.ES259_TEST_DATABASE_URL;
  assert.ok(source, 'ES259_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es259_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es259_test_[a-f0-9]{16}$/);
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
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../PricingPlan');
  const User = require('../../User');
  const authRouter = require('../../routes/auth');
  await sequelize.sync();
  const app = express(); app.use(express.json()); app.use('/api', authRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const password = 'Aa1!' + 'x'.repeat(20);
  const register = async (email) => {
    const res = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Synthetic', email, password }) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const long = (n) => 'a'.repeat(n - '@example.com'.length) + '@example.com';
  const max254 = 'a'.repeat(64) + '@' + 'b'.repeat(185) + '.com';

  await t.test('inválidos → 400 invalid_email, nunca 5xx, y ninguna fila creada', async () => {
    const invalid = [long(255), long(260), long(5000), 'a,b@example.com', 'ana perez@example.com', 'ana@@example.com', 'ana@foo@example.com', 'anaexample.com', 'ana@example', '"a"@example.com'];
    for (const email of invalid) {
      const out = await register(email);
      assert.equal(out.status, 400, `${email.slice(0, 30)}…(${email.length}) → ${out.status}`);
      assert.equal(out.body.code, 'invalid_email');
    }
    assert.equal(await User.count(), 0, 'no se creó ninguna cuenta');
  });

  await t.test('válidos: acentos, IDN y el máximo de 254 caracteres se registran; repetir uno responde igual que antes (sin enumeración nueva)', async () => {
    for (const email of ['josé@ejemplo.co', 'usuario@bücher.example', max254]) assert.equal((await register(email)).status, 201, email.slice(0, 30));
    assert.equal(await User.count(), 3);
    const again = await register('josé@ejemplo.co');
    assert.ok(again.status < 500, `repetido: ${again.status}`);
  });
});
