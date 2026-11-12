// ES-275 · El comando de purga (scripts/purgePersonalData.js) se ejecuta COMO LO HARÍA UN OPERADOR (proceso aparte) contra PostgreSQL REAL: exige DATABASE_URL explícita, no carga .env
// (aunque haya uno con variables DB_* trampa en su directorio), muestra el entorno sin credenciales por stderr y deja en stdout SOLO el JSON de estado. Crea y borra su propia base en loopback.
//   ES275_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-275-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const backend = path.resolve(__dirname, '..', '..');
const script = path.join(backend, 'scripts', 'purgePersonalData.js');

test('ES-275 PostgreSQL real: la purga exige DATABASE_URL explícita, no usa .env ni DB_*, y su salida es limpia', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES275_TEST_DATABASE_URL, 'Se requiere ES275_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES275_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es275_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let db; let trapDir;
  t.after(async () => {
    if (db) await db.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
    if (trapDir) fs.rmSync(trapDir, { recursive: true, force: true });
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-400)}`);
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  // persona sintética con una solicitud de eliminación aceptada y un dato en un almacén de ES-23
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  const names = []; const vals = [];
  for (const c of cols) {
    let v;
    if (c.column_name === 'name') v = 'Persona Sintética'; else if (c.column_name === 'email') v = `purga-${dbName}@example.test`;
    else if (/char|text/.test(c.data_type)) v = 'x'; else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
    names.push(`"${c.column_name}"`); vals.push(v);
  }
  const userId = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, vals))[0].id;
  await q(`UPDATE "Users" SET role='user' WHERE id=$1`, [userId]);
  const requestId = crypto.randomUUID();
  await q(`INSERT INTO "DeletionRequests" (id,"UserId",status,attempts,"createdAt","updatedAt") VALUES ($1,$2,'accepted',0,now(),now())`, [requestId, userId]);
  await q(`INSERT INTO "MoodLogs" ("UserId","date","checkin_mood","createdAt","updatedAt") VALUES ($1,'2026-11-01',3,now(),now())`, [userId]);
  const snapshot = async () => JSON.stringify([await q('SELECT id,status,attempts,"activePurgedAt" FROM "DeletionRequests" ORDER BY id'), await q('SELECT count(*)::int n FROM "MoodLogs"')]);

  // un directorio con un .env TRAMPA (apunta a otra base y trae DB_*): el comando no debe leerlo
  trapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'es275-'));
  fs.writeFileSync(path.join(trapDir, '.env'), 'DB_HOST=host-equivocado.invalid\nDB_NAME=base_equivocada\nDB_USER=usuario_equivocado\nDB_PASS=clave-trampa-no-debe-aparecer\nDATABASE_URL=postgres://trampa:clave-trampa-no-debe-aparecer@host-equivocado.invalid/otra\n');
  // el entorno del servicio (lo que `railway run` aporta): las variables que exigen los módulos de la aplicación, pero NO la conexión, que sale solo de DATABASE_URL
  const service = { JWT_SECRET: crypto.randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'), NODE_ENV: 'test' };
  const clean = (extra = {}) => { const env = { ...process.env, ...service, ...extra }; for (const k of ['DATABASE_URL', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_PORT']) if (!(k in extra)) delete env[k]; return env; };
  const run = (args, extraEnv, cwd = trapDir) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: clean(extraEnv), timeout: 60000 });
  const before = await snapshot();

  await t.test('sin DATABASE_URL (aunque haya .env y DB_*) termina con error, sin banner de dotenv, sin conectar y sin tocar nada', async () => {
    const out = run([requestId, '--producers-stopped-and-drained'], { DB_HOST: '127.0.0.1', DB_NAME: dbName, DB_USER: 'elevation', DB_PASS: 'elevation_local' });
    assert.notEqual(out.status, 0, 'sale con error');
    assert.equal(out.stdout, '', 'stdout vacío');
    assert.match(out.stderr, /DATABASE_URL is required/);
    assert.doesNotMatch(out.stderr + out.stdout, /dotenv|clave-trampa|host-equivocado/);
    assert.equal(await snapshot(), before, 'la base quedó intacta');
  });

  await t.test('argumentos incorrectos (UUID, bandera de confirmación, --replay) terminan con error sin leer la base', async () => {
    for (const args of [[], ['no-es-uuid', '--producers-stopped-and-drained'], [requestId], [requestId, '--si'], [requestId, '--producers-stopped-and-drained', '--otro']]) {
      const out = run(args, { DATABASE_URL: urlFor(dbName), DB_SSL: 'false' });
      assert.notEqual(out.status, 0, JSON.stringify(args)); assert.equal(out.stdout, '', JSON.stringify(args));
    }
    for (const bad of ['', 'no-es-una-url', 'mysql://127.0.0.1/x', 'postgres://']) {
      const out = run([requestId, '--producers-stopped-and-drained'], { DATABASE_URL: bad, DB_SSL: 'false' });
      assert.notEqual(out.status, 0, bad); assert.equal(out.stdout, '', bad);
    }
    assert.equal(await snapshot(), before);
  });

  await t.test('con DATABASE_URL explícita: stdout es SOLO el JSON de estado, stderr muestra el entorno sin credenciales y se purga en ESA base (no en la del .env)', async () => {
    const url = new URL(urlFor(dbName)); url.password = 'elevation_local';
    const out = run([requestId, '--producers-stopped-and-drained'], { DATABASE_URL: url.toString(), DB_SSL: 'false' });
    assert.equal(out.status, 0, `stderr: ${out.stderr.slice(0, 200)}`);
    const lines = out.stdout.trim().split('\n');
    assert.equal(lines.length, 1, 'una sola línea en stdout: ' + out.stdout);
    assert.deepEqual(JSON.parse(lines[0]), { status: 'awaiting_verification', deadlinesVerified: false });
    assert.doesNotMatch(out.stdout, /dotenv|\[/);
    assert.match(out.stderr, new RegExp(`Environment: ${target.hostname.replace(/[.[\]]/g, '\\$&')}:${target.port || '5432'}/${dbName}`));
    assert.doesNotMatch(out.stderr + out.stdout, /elevation_local|clave-trampa|host-equivocado|usuario_equivocado/, 'ni credenciales ni valores del .env');
    assert.equal((await q('SELECT count(*)::int n FROM "MoodLogs" WHERE "UserId"=$1', [userId]))[0].n, 0, 'el dato de la persona se purgó');
    assert.equal((await q('SELECT status FROM "DeletionRequests" WHERE id=$1', [requestId]))[0].status, 'awaiting_verification');
  });

  await t.test('sin las variables del servicio (JWT_SECRET) el comando dice qué falta, sin traza ni conexión (exit ≠ 0, stdout vacío)', async () => {
    const stateBefore = await snapshot();
    const env = clean({ DATABASE_URL: urlFor(dbName), DB_SSL: 'false' }); delete env.JWT_SECRET;
    const out = spawnSync(process.execPath, [script, requestId, '--producers-stopped-and-drained'], { cwd: trapDir, encoding: 'utf8', env, timeout: 60000 });
    assert.notEqual(out.status, 0); assert.equal(out.stdout, '');
    assert.match(out.stderr, /Cannot start the purge: JWT_SECRET must be configured/); assert.doesNotMatch(out.stderr, /\n\s+at /, 'sin traza');
    assert.equal(await snapshot(), stateBefore, 'la base no cambió');
  });

  await t.test('una solicitud inexistente falla con un mensaje genérico (exit 1), sin identificadores ni diagnósticos de la base, y con salida limpia', async () => {
    const out = run([crypto.randomUUID(), '--producers-stopped-and-drained'], { DATABASE_URL: urlFor(dbName), DB_SSL: 'false' });
    assert.equal(out.status, 1); assert.equal(out.stdout, '');
    assert.match(out.stderr, /Purge not completed/); assert.doesNotMatch(out.stderr, /SequelizeDatabaseError|relation|syntax|at \w+ \(/);
  });
});
