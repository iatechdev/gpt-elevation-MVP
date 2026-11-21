// E393-3 (ES-329) · El «día» de los registros de ánimo y de las calificaciones es el de la ZONA de la persona (la de su contexto participante, ES-14; respaldo America/Bogota),
// no el UTC del servidor. HTTP REAL, JWT real, PostgreSQL REAL (migraciones reales), reloj inyectado para las zonas límite. Datos SINTÉTICOS.
//   ES393_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54367/postgres node --test test/integration/es-393-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-393 PostgreSQL + HTTP: el día de ánimo, calificación y racha es el de la zona de la persona (Bogotá por defecto, la de su contexto si es válida)', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES393_TEST_DATABASE_URL, 'Se requiere ES393_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES393_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es393_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  t.after(async () => {
    if (server) await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    if (db) await db.end().catch(() => {});
    if (app) await app.close().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const zone = require('../../utils/personTimeZone');
  const ParticipantContext = require('../../ParticipantContext');
  const { encriptarV2 } = require('../../utils/crypto');
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/mood', verificarToken, require('../../routes/mood'));
  api.use('/api', verificarToken, require('../../routes/ratings'));
  api.use('/api/user', verificarToken, require('../../routes/progress'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(timeZone) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = 'user';
      else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `es393-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=\'user\', active=true WHERE id=$1', [id]);
    if (timeZone !== undefined) await ParticipantContext.create({ UserId: id, version: 1, content: encriptarV2(JSON.stringify({ timeZone })), completedAt: new Date() });
    return { id, token: issueToken({ id, role: 'user' }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed };
  };
  const at = (iso) => { zone.clock.now = () => new Date(iso); };
  const logDates = async (who) => (await q('SELECT to_char("date", \'YYYY-MM-DD\') AS d FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY "date"', [who.id])).map((r) => r.d);

  // 1) Sin contexto (o sin zona): Bogotá. Las 19:00 de Bogotá son las 00:00 UTC del día siguiente: sigue siendo el día de Bogotá.
  const bogota = await mkUser();
  at('2026-11-20T23:59:59Z'); assert.equal((await http(bogota, 'POST', '/api/mood/checkin', { mood: 3 })).status, 200); // 18:59 del 20
  at('2026-11-21T00:00:00Z'); assert.equal((await http(bogota, 'POST', '/api/mood/checkout', { mood: 4 })).status, 200); // 19:00 del 20 = 00:00 UTC del 21
  at('2026-11-21T04:59:59Z'); assert.equal((await http(bogota, 'POST', '/api/mood/checkout', { mood: 5 })).status, 200); // 23:59 del 20
  assert.deepEqual(await logDates(bogota), ['2026-11-20'], 'los tres registros caen en el mismo día de Bogotá (con el día UTC eran dos días)');
  at('2026-11-21T05:00:00Z'); assert.equal((await http(bogota, 'POST', '/api/mood/checkin', { mood: 2 })).status, 200); // 00:00 del 21
  assert.deepEqual(await logDates(bogota), ['2026-11-20', '2026-11-21'])
  // calificación con el mismo criterio
  at('2026-11-21T02:00:00Z'); assert.equal((await http(bogota, 'POST', '/api/rating', { rating: 4 })).status, 200); // 21:00 del 20
  assert.equal((await q('SELECT to_char("date", \'YYYY-MM-DD\') AS d FROM "SessionRatings" WHERE "UserId"=$1', [bogota.id]))[0].d, '2026-11-20');

  // 2) Racha y zona en /progress: tres días seguidos hasta «hoy» de Bogotá a las 20:30 (ya es el día siguiente en UTC).
  const racha = await mkUser();
  for (const day of ['2026-11-18', '2026-11-19', '2026-11-20']) await q('INSERT INTO "MoodLogs" ("UserId","date","checkin_mood","createdAt","updatedAt") VALUES ($1,$2,3,now(),now())', [racha.id, day]);
  at('2026-11-21T01:30:00Z');
  const progress = await http(racha, 'GET', '/api/user/progress');
  assert.equal(progress.status, 200); assert.equal(progress.body.stats.streak, 3, 'con el día UTC la racha era 0 (esperaba el 21)'); assert.equal(progress.body.timeZone, 'America/Bogota');

  // 3) Zona de la persona = la de su contexto: UTC+13 (Auckland en horario de verano) y UTC−5; una zona inválida cae a Bogotá.
  const auckland = await mkUser('Pacific/Auckland');
  at('2026-11-20T12:00:00Z'); await http(auckland, 'POST', '/api/mood/checkin', { mood: 3 }); // 01:00 del 21 en NZDT (UTC+13)
  assert.deepEqual(await logDates(auckland), ['2026-11-21']);
  at('2026-11-20T10:59:59Z'); await http(auckland, 'POST', '/api/mood/checkout', { mood: 4 }); // 23:59 del 20 en NZDT
  assert.deepEqual(await logDates(auckland), ['2026-11-20', '2026-11-21']);
  assert.equal((await http(auckland, 'GET', '/api/user/progress')).body.timeZone, 'Pacific/Auckland');
  const bad = await mkUser('Marte/Olimpo');
  at('2026-11-21T02:00:00Z'); await http(bad, 'POST', '/api/mood/checkin', { mood: 3 });
  assert.deepEqual(await logDates(bad), ['2026-11-20'], 'zona inválida → America/Bogota'); assert.equal((await http(bad, 'GET', '/api/user/progress')).body.timeZone, 'America/Bogota');
  const noZone = await mkUser(null);
  at('2026-11-21T02:00:00Z'); await http(noZone, 'POST', '/api/mood/checkin', { mood: 3 });
  assert.deepEqual(await logDates(noZone), ['2026-11-20'], 'contexto sin zona → America/Bogota');

  // 4) Cambio de horario (Nueva York, 8-mar-2026: de EST a EDT): la racha cuenta días de CALENDARIO, no bloques de 24 h.
  const ny = await mkUser('America/New_York');
  for (const day of ['2026-03-07', '2026-03-08', '2026-03-09']) await q('INSERT INTO "MoodLogs" ("UserId","date","checkin_mood","createdAt","updatedAt") VALUES ($1,$2,3,now(),now())', [ny.id, day]);
  at('2026-03-09T04:30:00Z'); // 00:30 EDT del 9 (la víspera fue de 23 h)
  assert.equal((await http(ny, 'GET', '/api/user/progress')).body.stats.streak, 3);

  // 5) Los registros anteriores NO se reescriben (el cambio solo afecta a lo que se guarda desde ahora).
  assert.equal((await logDates(racha)).length, 3);
});
