// ES-163 contra PostgreSQL REAL: guardar una entrada nueva del diario es idempotente con requestId (misma persona); la migración es aditiva e idempotente y las filas antiguas siguen funcionando.
// Crea y borra SOLO sus propias bases aleatorias en loopback. Nunca carga .env ni llama a un proveedor externo.
// Uso (en backend/):  ES163_TEST_DATABASE_URL=postgres://... npm run test:diary-request:pg   (o  node scripts/testEs163Local.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

const OLD_TABLE = `CREATE TABLE "DiaryEntries" (
  "id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL, "entryDate" DATE NOT NULL, "content" TEXT NOT NULL, "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`;

test('ES-163 PostgreSQL: migración aditiva e idempotente y guardado idempotente con requestId', { timeout: 180000 }, async (t) => {
  const source = process.env.ES163_TEST_DATABASE_URL;
  assert.ok(source, 'ES163_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const names = ['es163_mig_', 'es163_app_'].map((p) => `${p}${randomBytes(8).toString('hex')}`);
  names.forEach((n) => assert.match(n, /^es163_(mig|app)_[a-f0-9]{16}$/));
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  const made = []; let migrationDb; let sequelize; let server;
  const urlOf = (name) => { const u = new URL(source); u.pathname = '/' + name; return u.toString(); };
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (migrationDb) await migrationDb.close();
    for (const name of made) await admin.query(`DROP DATABASE "${name}"`); // los nombres los genera este archivo
    await admin.close();
  });
  for (const name of names) { await admin.query(`CREATE DATABASE "${name}"`); made.push(name); }

  // 1) Migración sobre el esquema ANTERIOR (sin requestId) con filas existentes.
  await t.test('la migración es aditiva e idempotente: columna NULLABLE sin tocar filas, índice único parcial, repetirla no cambia nada', async () => {
    migrationDb = new Sequelize(urlOf(names[0]), { logging: false, dialectOptions: { ssl: false } });
    await migrationDb.query(OLD_TABLE);
    await migrationDb.query(`INSERT INTO "DiaryEntries" ("UserId","entryDate","content","createdAt","updatedAt") VALUES (1,'2026-10-01','v2:antigua-1',now(),now()),(1,'2026-10-02','v2:antigua-2',now(),now())`);
    const migration = require('../../migrations/20261110000000-es163-diary-request-id.cjs');
    await migration.up(migrationDb); await migration.up(migrationDb); // dos veces: no falla ni duplica
    const [column] = await migrationDb.query(`SELECT is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_name='DiaryEntries' AND column_name='requestId'`, { type: 'SELECT' });
    assert.deepEqual(column, { is_nullable: 'YES', column_default: null, character_maximum_length: 64 });
    const indexes = await migrationDb.query(`SELECT indexdef FROM pg_indexes WHERE tablename='DiaryEntries' AND indexname='${migration.INDEX}'`, { type: 'SELECT' });
    assert.equal(indexes.length, 1);
    assert.match(indexes[0].indexdef, /UNIQUE/); assert.match(indexes[0].indexdef, /"UserId", "requestId"/); assert.match(indexes[0].indexdef, /WHERE \(?"requestId" IS NOT NULL\)?/);
    // las filas antiguas siguen ahí y otra sin requestId de la misma persona no choca (el índice es parcial)
    assert.equal((await migrationDb.query('SELECT count(*)::int AS n FROM "DiaryEntries" WHERE "requestId" IS NULL', { type: 'SELECT' }))[0].n, 2);
    await migrationDb.query(`INSERT INTO "DiaryEntries" ("UserId","entryDate","content","createdAt","updatedAt") VALUES (1,'2026-10-03','v2:sin-request',now(),now())`);
    await migrationDb.query(`INSERT INTO "DiaryEntries" ("UserId","entryDate","content","requestId","createdAt","updatedAt") VALUES (1,'2026-10-04','v2:con-request','req-mig-0001',now(),now())`);
    await assert.rejects(() => migrationDb.query(`INSERT INTO "DiaryEntries" ("UserId","entryDate","content","requestId","createdAt","updatedAt") VALUES (1,'2026-10-05','v2:otra','req-mig-0001',now(),now())`), /duplicate key|unique/i);
    await migrationDb.query(`INSERT INTO "DiaryEntries" ("UserId","entryDate","content","requestId","createdAt","updatedAt") VALUES (2,'2026-10-04','v2:otra-persona','req-mig-0001',now(),now())`); // otra persona, mismo requestId: permitido
    // el down exige permiso explícito (guard-down): sin él se niega y no toca nada
    const previous = process.env.ALLOW_DESTRUCTIVE_MIGRATION; delete process.env.ALLOW_DESTRUCTIVE_MIGRATION;
    const hasColumn = async () => (await migrationDb.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='DiaryEntries' AND column_name='requestId'`, { type: 'SELECT' }))[0].n;
    try { await assert.rejects(() => migration.down(migrationDb), /ALLOW_DESTRUCTIVE_MIGRATION/); assert.equal(await hasColumn(), 1); } finally { if (previous !== undefined) process.env.ALLOW_DESTRUCTIVE_MIGRATION = previous; }
    // con permiso explícito el down quita índice y columna y deja las filas; volver a aplicar la migración funciona
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    try { await migration.down(migrationDb); } finally { if (previous === undefined) delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; else process.env.ALLOW_DESTRUCTIVE_MIGRATION = previous; }
    assert.equal(await hasColumn(), 0);
    assert.equal((await migrationDb.query('SELECT count(*)::int AS n FROM "DiaryEntries"', { type: 'SELECT' }))[0].n, 5);
    await migration.up(migrationDb); assert.equal(await hasColumn(), 1);
  });

  // 2) El servicio con el esquema que crea sync() a partir del modelo (que debe coincidir con la migración).
  sequelize = new Sequelize(urlOf(names[1]), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../PricingPlan'); const User = require('../../User'); const DiaryEntry = require('../../DiaryEntry'); require('../../DerivedInvalidation');
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const { desencriptar } = require('../../utils/crypto');
  const router = require('../../routes/diary');
  await sequelize.sync();
  const app = express(); app.use(express.json()); app.use('/api/diary', verificarToken, router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = async (token, method, path, body) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/diary${path}`, {
      method, headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  const person = (suffix) => User.create({ name: 'Synthetic', email: `${suffix}@example.invalid`, password: 'not-a-real-credential', role: 'user', active: true });
  const a = await person('a'); const b = await person('b');
  const [ta, tb] = [a, b].map((user) => issueToken(user));
  const rows = (UserId) => DiaryEntry.count({ where: { UserId } });
  const post = (token, body) => call(token, 'POST', '', body);

  await t.test('el modelo y la migración definen el mismo índice parcial', async () => {
    const indexes = await sequelize.query(`SELECT indexdef FROM pg_indexes WHERE tablename='DiaryEntries' AND indexname='diary_entries__user_request_id'`, { type: 'SELECT' });
    assert.equal(indexes.length, 1); assert.match(indexes[0].indexdef, /UNIQUE/); assert.match(indexes[0].indexdef, /"UserId", "requestId"/); assert.match(indexes[0].indexdef, /WHERE \(?"requestId" IS NOT NULL\)?/);
  });

  await t.test('sin requestId el contrato no cambia: dos guardados iguales son dos entradas', async () => {
    const one = await post(ta, { date: '2026-10-01', content: 'Entrada sin requestId' });
    const two = await post(ta, { date: '2026-10-01', content: 'Entrada sin requestId' });
    assert.equal(one.status, 201); assert.equal(two.status, 201); assert.notEqual(one.body.id, two.body.id);
    assert.deepEqual(Object.keys(one.body).sort(), ['content', 'createdAt', 'date', 'id', 'updatedAt']); // requestId no se expone
    assert.equal(await rows(a.id), 2);
  });

  await t.test('con requestId: el primer guardado crea (201); repetirlo devuelve LA MISMA entrada (200) sin duplicar', async () => {
    const body = { date: '2026-10-02', content: 'Entrada idempotente', requestId: 'req-es163-0001' };
    const first = await post(ta, body); const again = await post(ta, body);
    assert.equal(first.status, 201); assert.equal(again.status, 200); assert.deepEqual(again.body, first.body);
    assert.equal(await DiaryEntry.count({ where: { UserId: a.id, requestId: 'req-es163-0001' } }), 1);
    const [stored] = await sequelize.query(`SELECT content FROM "DiaryEntries" WHERE id = ${first.body.id}`, { type: 'SELECT' });
    assert.match(stored.content, /^v2:/); assert.doesNotMatch(stored.content, /idempotente/); // el contenido sigue cifrado
  });

  await t.test('envío doble simultáneo con el mismo requestId = 1 fila (una respuesta 201 y las demás 200 con la misma entrada)', async () => {
    const body = { date: '2026-10-03', content: 'Entrada concurrente', requestId: 'req-es163-race' };
    const results = await Promise.all(Array.from({ length: 12 }, () => post(ta, body)));
    assert.deepEqual(results.filter((r) => ![200, 201].includes(r.status)).map((r) => r.status), []);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
    assert.equal(await DiaryEntry.count({ where: { UserId: a.id, requestId: 'req-es163-race' } }), 1);
  });

  await t.test('el mismo requestId con OTRO contenido u otra fecha = 409 request_id_reuse y no cambia nada', async () => {
    const before = await rows(a.id);
    const otherText = await post(ta, { date: '2026-10-02', content: 'Otro texto', requestId: 'req-es163-0001' });
    const otherDate = await post(ta, { date: '2026-10-09', content: 'Entrada idempotente', requestId: 'req-es163-0001' });
    assert.equal(otherText.status, 409); assert.equal(otherText.body.code, 'request_id_reuse');
    assert.equal(otherDate.status, 409); assert.equal(otherDate.body.code, 'request_id_reuse');
    assert.equal(await rows(a.id), before);
    assert.doesNotMatch(JSON.stringify([otherText.body, otherDate.body]), /Entrada idempotente|Otro texto/); // no devuelve contenido
  });

  await t.test('usuarios A/B: un requestId ajeno nunca revela ni devuelve nada de otra persona', async () => {
    // B usa el MISMO requestId que A con su propio texto: crea SU entrada (201) y no ve la de A.
    const mine = await post(tb, { date: '2026-10-02', content: 'Texto de B', requestId: 'req-es163-0001' });
    assert.equal(mine.status, 201); assert.equal(mine.body.content, 'Texto de B');
    const aRow = await DiaryEntry.findOne({ where: { UserId: a.id, requestId: 'req-es163-0001' } });
    assert.notEqual(mine.body.id, aRow.id); assert.equal(desencriptar(aRow.content), 'Entrada idempotente');
    // B intentando repetir el texto de A con ese requestId solo se encuentra con SU propia entrada (409 por otro contenido), nunca con la de A.
    const probe = await post(tb, { date: '2026-10-02', content: 'Entrada idempotente', requestId: 'req-es163-0001' });
    assert.equal(probe.status, 409); assert.doesNotMatch(JSON.stringify(probe.body), /Texto de B|Entrada idempotente/);
    assert.equal(await rows(b.id), 1);
  });

  await t.test('borrar una entrada no se puede «resucitar» repitiendo su requestId (409) y requestId inválidos = 400 sin escribir', async () => {
    const body = { date: '2026-10-04', content: 'Se borrará', requestId: 'req-es163-del1' };
    const created = await post(ta, body);
    assert.equal((await call(ta, 'DELETE', `/${created.body.id}`)).status, 200);
    const replay = await post(ta, body);
    assert.equal(replay.status, 409); assert.equal(replay.body.code, 'request_id_reuse');
    assert.equal((await call(ta, 'GET', `/${created.body.id}`)).status, 404);
    const before = await rows(a.id);
    for (const bad of ['corto', 'x'.repeat(65), 'con espacios aqui', 'ñandú-123456', 12345678, {}, []]) {
      assert.equal((await post(ta, { date: '2026-10-04', content: 'x', requestId: bad })).status, 400, JSON.stringify(bad));
    }
    assert.equal(await rows(a.id), before);
  });

  await t.test('sin sesión no hay acceso', async () => {
    const anonymous = await fetch(`http://127.0.0.1:${server.address().port}/api/diary`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: '2026-10-04', content: 'x', requestId: 'req-es163-anon' }) });
    assert.ok([401, 403].includes(anonymous.status), String(anonymous.status));
    assert.equal(await DiaryEntry.count({ where: { requestId: 'req-es163-anon' } }), 0);
  });
});
