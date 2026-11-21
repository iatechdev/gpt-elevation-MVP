// ES-288 contra Postgres REAL: índices únicos parciales con requestId en AiUsages (solo consumos completados) y SessionNotes. La migración detecta duplicados PRIMERO y los resuelve
// sin borrar nada (se conserva la fila más antigua y las demás se marcan «~dup<id>»), para que un arranque con duplicados no falle; es idempotente. Datos sintéticos.
// Crea y borra SOLO su base aleatoria en loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES288_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:requestid-unique:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-288 PostgreSQL: índices únicos con requestId, migración con duplicados sembrados y carrera', { timeout: 120000 }, async (t) => {
  const source = process.env.ES288_TEST_DATABASE_URL;
  assert.ok(source, 'ES288_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es288_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es288_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const AiUsage = require('../../AiUsage');
  const SessionNote = require('../../SessionNote');
  await Promise.all([AiUsage.sync(), SessionNote.sync()]);
  const migration = require('../../migrations/20261118020000-es288-requestid-unico.cjs');
  const q = (sql, replacements) => sequelize.query(sql, { type: 'SELECT', replacements });
  const indexes = async () => (await q(`SELECT indexname FROM pg_indexes WHERE indexname IN ('ai_usages__request_done','session_notes__request') ORDER BY 1`)).map((r) => r.indexname);
  const dropIndexes = () => migration.down(sequelize).catch(() => sequelize.query('DROP INDEX IF EXISTS "ai_usages__request_done"').then(() => sequelize.query('DROP INDEX IF EXISTS "session_notes__request"')));
  const usage = (o) => ({ UserId: 7, kind: 'chat', model: 'm', periodKey: '2026-11', reservedTokens: 10, status: 'completed', requestId: null, ...o });
  const note = (o) => ({ sessionId: 1, therapistId: 2, content: 'nota sintética', requestId: null, ...o });

  // El modelo ya declara los índices (para la deriva): se parte del estado ANTERIOR (sin ellos) para probar la migración.
  assert.deepEqual(await indexes(), ['ai_usages__request_done', 'session_notes__request'], 'sync() crea los mismos índices que la migración');
  await sequelize.query('DROP INDEX "ai_usages__request_done"'); await sequelize.query('DROP INDEX "session_notes__request"');
  assert.deepEqual(await indexes(), []);

  await t.test('con duplicados sembrados la migración NO falla: conserva la fila más antigua, marca las demás «~dup<id>», no borra nada y crea los dos índices', async () => {
    const U = await AiUsage.bulkCreate([
      usage({ requestId: 'req-a' }), usage({ requestId: 'req-a' }), usage({ requestId: 'req-a' }), // 3 completados iguales: 2 a marcar
      usage({ requestId: 'req-b', status: 'failed' }), usage({ requestId: 'req-b', status: 'failed' }), usage({ requestId: 'req-b' }), // fallidos repetidos NO cuentan: 0 a marcar
      usage({ requestId: 'req-a', UserId: 8 }), usage({ requestId: 'req-a', kind: 'matching' }), // otra persona / otro tipo: distintos
      usage({ requestId: null }), usage({ requestId: null }),
    ]);
    const N = await SessionNote.bulkCreate([note({ requestId: 'n-1' }), note({ requestId: 'n-1' }), note({ requestId: 'n-1', sessionId: 2 }), note(), note()]);
    const beforeUsage = await AiUsage.count(); const beforeNotes = await SessionNote.count();
    const resolved = await migration.up(sequelize);
    assert.deepEqual(resolved, { AiUsages: 2, SessionNotes: 1 });
    assert.equal(await AiUsage.count(), beforeUsage, 'no se borró ninguna fila de consumo'); assert.equal(await SessionNote.count(), beforeNotes, 'ninguna nota');
    const rows = await q(`SELECT "id","requestId","status","UserId","kind" FROM "AiUsages" WHERE "requestId" LIKE 'req-a%' AND "UserId" = 7 AND "kind" = 'chat' ORDER BY "id"`);
    assert.deepEqual(rows.map((r) => r.requestId), ['req-a', `req-a~dup${U[1].id}`, `req-a~dup${U[2].id}`], 'la más antigua queda tal cual; las demás se marcan con su id');
    assert.equal((await q(`SELECT count(*)::int AS n FROM "AiUsages" WHERE "requestId" = 'req-b'`))[0].n, 3, 'los fallidos repetidos no se tocan');
    const notes = await q(`SELECT "id","requestId","content" FROM "SessionNotes" WHERE "sessionId" = 1 AND "requestId" LIKE 'n-1%' ORDER BY "id"`);
    assert.deepEqual(notes.map((r) => r.requestId), ['n-1', `n-1~dup${N[1].id}`]); assert.ok(notes.every((r) => r.content === 'nota sintética'), 'el contenido no cambia');
    assert.deepEqual(await indexes(), ['ai_usages__request_done', 'session_notes__request']);
  });

  await t.test('idempotente: repetirla no cambia nada (0 a marcar) y no falla', async () => {
    const before = JSON.stringify(await q('SELECT "id","requestId" FROM "AiUsages" ORDER BY "id"'));
    assert.deepEqual(await migration.up(sequelize), { AiUsages: 0, SessionNotes: 0 });
    assert.equal(JSON.stringify(await q('SELECT "id","requestId" FROM "AiUsages" ORDER BY "id"')), before);
  });

  await t.test('los índices hacen cumplir la regla: un segundo completado con el mismo requestId se rechaza; fallidos, reservados, NULL y otra persona/tipo/sesión pasan', async () => {
    await assert.rejects(AiUsage.create(usage({ requestId: 'req-x' })).then(() => AiUsage.create(usage({ requestId: 'req-x' }))), (error) => error.original?.code === '23505');
    await AiUsage.create(usage({ requestId: 'req-x', status: 'failed' })); await AiUsage.create(usage({ requestId: 'req-x', status: 'reserved' }));
    await AiUsage.create(usage({ requestId: 'req-x', UserId: 9 })); await AiUsage.create(usage({ requestId: 'req-x', kind: 'matching' })); await AiUsage.create(usage({ requestId: null })); await AiUsage.create(usage({ requestId: null }));
    await SessionNote.create(note({ requestId: 'n-x' }));
    await assert.rejects(SessionNote.create(note({ requestId: 'n-x' })), (error) => error.original?.code === '23505');
    await SessionNote.create(note({ requestId: 'n-x', sessionId: 5 })); await SessionNote.create(note({ requestId: 'n-x', therapistId: 3 }));
  });

  await t.test('carrera: 8 consumos completados y 8 notas simultáneos con el mismo requestId dejan UNA fila y los demás reciben el rechazo de unicidad (nunca otro error)', async () => {
    const usages = await Promise.allSettled(Array.from({ length: 8 }, () => AiUsage.create(usage({ requestId: 'req-race', UserId: 21 }))));
    assert.equal(usages.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(usages.filter((r) => r.status === 'rejected').every((r) => r.reason.original?.code === '23505'));
    assert.equal(await AiUsage.count({ where: { requestId: 'req-race', UserId: 21 } }), 1);
    const notes = await Promise.allSettled(Array.from({ length: 8 }, () => SessionNote.create(note({ requestId: 'n-race', sessionId: 31 }))));
    assert.equal(notes.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(notes.filter((r) => r.status === 'rejected').every((r) => r.reason.original?.code === '23505'));
    assert.equal(await SessionNote.count({ where: { requestId: 'n-race', sessionId: 31 } }), 1);
  });

  await t.test('reintento de un turno fallido: el consumo del reintento SÍ se registra (el índice no lo bloquea)', async () => {
    await AiUsage.create(usage({ requestId: 'req-retry', status: 'failed', UserId: 41 }));
    const second = await AiUsage.create(usage({ requestId: 'req-retry', status: 'reserved', UserId: 41 }));
    await second.update({ status: 'completed' }); // el reintento completa: es el único completado
    assert.equal(await AiUsage.count({ where: { requestId: 'req-retry', UserId: 41 } }), 2);
  });

  await t.test('down (con permiso explícito): quita los índices y conserva los requestId marcados', async () => {
    const guard = process.env.ALLOW_DESTRUCTIVE_MIGRATION; process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    try { await migration.down(sequelize); } finally { if (guard === undefined) delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; else process.env.ALLOW_DESTRUCTIVE_MIGRATION = guard; }
    assert.deepEqual(await indexes(), []);
    assert.ok((await q(`SELECT count(*)::int AS n FROM "AiUsages" WHERE "requestId" LIKE '%~dup%'`))[0].n >= 2);
    await dropIndexes();
  });

  // E385-1 / E385-4 (QA): la marca «~dup<id>» puede coincidir con el requestId de OTRA fila del mismo grupo, y con un requestId de 64 caracteres la marca debe seguir cabiendo.
  await t.test('E385-1: si ya existe una fila completada cuyo requestId es EXACTAMENTE la marca, la migración NO aborta: elige otra marca libre y no pierde nada', async () => {
    await dropIndexes();
    const first = await AiUsage.create(usage({ UserId: 9121, requestId: 'collide' }));
    const dup = await AiUsage.create(usage({ UserId: 9121, requestId: 'collide' }));
    const squatter = await AiUsage.create(usage({ UserId: 9121, requestId: `collide~dup${dup.id}` })); // el requestId que la marca usaría
    const note1 = await SessionNote.create(note({ sessionId: 9131, requestId: 'ncollide' })); const noteDup = await SessionNote.create(note({ sessionId: 9131, requestId: 'ncollide' }));
    await SessionNote.create(note({ sessionId: 9131, requestId: `ncollide~dup${noteDup.id}` }));
    const before = await AiUsage.count(); const beforeNotes = await SessionNote.count();
    const resolved = await migration.up(sequelize);
    assert.ok(resolved.AiUsages >= 1 && resolved.SessionNotes >= 1);
    assert.equal(await AiUsage.count(), before); assert.equal(await SessionNote.count(), beforeNotes);
    const rows = await q('SELECT "id","requestId" FROM "AiUsages" WHERE "UserId" = 9121 ORDER BY "id"');
    assert.equal(rows[0].requestId, 'collide', 'la más antigua queda tal cual'); assert.equal(rows[2].requestId, `collide~dup${dup.id}`, 'la fila que ya tenía esa marca no se toca');
    assert.equal(rows[1].requestId, `collide~dup${dup.id}_1`, 'el duplicado recibe la marca libre con contador');
    assert.equal(new Set(rows.map((r) => r.requestId)).size, 3);
    const notes = await q('SELECT "id","requestId" FROM "SessionNotes" WHERE "sessionId" = 9131 ORDER BY "id"');
    assert.deepEqual(notes.map((r) => r.requestId), ['ncollide', `ncollide~dup${noteDup.id}_1`, `ncollide~dup${noteDup.id}`]);
    assert.ok(first && squatter && note1 && squatter.id > dup.id);
    assert.deepEqual(await indexes(), ['ai_usages__request_done', 'session_notes__request']);
  });

  await t.test('E385-4: con un requestId de 64 caracteres la marca cabe en VARCHAR(64), es única y el contenido no cambia (recortar a 60 en vez de 50 NO pasa)', async () => {
    await dropIndexes();
    const long = 'x'.repeat(64);
    const a = await AiUsage.create(usage({ UserId: 9122, requestId: long })); const b = await AiUsage.create(usage({ UserId: 9122, requestId: long })); const c = await AiUsage.create(usage({ UserId: 9122, requestId: long }));
    await migration.up(sequelize);
    const rows = await q('SELECT "id","requestId" FROM "AiUsages" WHERE "UserId" = 9122 ORDER BY "id"');
    assert.equal(rows[0].requestId, long); assert.equal(rows[1].requestId, `${'x'.repeat(50)}~dup${b.id}`); assert.equal(rows[2].requestId, `${'x'.repeat(50)}~dup${c.id}`);
    assert.ok(rows.every((r) => r.requestId.length <= 64)); assert.equal(new Set(rows.map((r) => r.requestId)).size, 3); assert.ok(a);
    const source = require('node:fs').readFileSync(require.resolve('../../migrations/20261118020000-es288-requestid-unico.cjs'), 'utf8');
    assert.ok(source.includes('slice(0, n === 0 ? 50 : 40)'), 'el recorte es 50 (40 con contador): con 60 una marca con id largo no cabría');
  });
});
