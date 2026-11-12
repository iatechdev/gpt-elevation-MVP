// ES-240 · «Mi profesional» en secciones (perfil / sesiones) por HTTP REAL, JWT real y PostgreSQL REAL.
// Mismo contrato de privacidad que la lectura completa (HU-071): solo la propia persona (rol «user»), solo SU vínculo vigente leído de la base en cada petición, sin sesiones de otras
// personas ni de otros profesionales, y nada de más. Express real con el router y los middlewares reales; migraciones reales; datos sintéticos.
//   ES240_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-240-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-240 PostgreSQL + HTTP: perfil y sesiones de «Mi profesional» por separado, solo del propietario y del vínculo vigente', { timeout: 180000 }, async (t) => {
  assert.ok(process.env.ES240_TEST_DATABASE_URL, 'Se requiere ES240_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES240_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es240_test_${crypto.randomBytes(8).toString('hex')}`;
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 5000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role, { therapistId = null, name = null } = {}) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = name || `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `correo-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, therapistId]);
    return { id, role, token: issueToken({ id, role }), name: name || `Sintético ${seq}` };
  }
  const http = async (who, route) => {
    const res = await fetch(`${base}${route}`, { headers: who ? { Authorization: `Bearer ${who.token}` } : {} });
    const text = await res.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body, text };
  };
  const day = (offset) => new Date(Date.now() + offset * 86400000);
  async function session(patient, therapist, { status, offset, mood = null, url = null }) {
    return (await q(`INSERT INTO "TherapySessions" ("patientId","therapistId","scheduledAt","duration","status","meetingUrl","patientMoodAfter","therapistNote","createdAt","updatedAt")
      VALUES ($1,$2,$3,50,$4,$5,$6,'NOTA PRIVADA DEL PROFESIONAL',now(),now()) RETURNING id`, [patient.id, therapist.id, day(offset), status, url, mood]))[0].id;
  }
  async function profile(therapist, { approach }) {
    await q(`INSERT INTO "TherapistProfiles" ("UserId","specialties","approach","languages","bio","createdAt","updatedAt") VALUES ($1,$2,$3,'es,en','Bio sintética',now(),now())`, [therapist.id, JSON.stringify(['mindfulness']), approach]);
  }

  const tA = await mkUser('therapist', { name: 'Profesional A' }); const tB = await mkUser('therapist', { name: 'Profesional B' });
  await profile(tA, { approach: 'Enfoque A' });
  const p1 = await mkUser('user', { therapistId: tA.id, name: 'Persona Uno' });
  const p2 = await mkUser('user', { therapistId: tA.id, name: 'Persona Dos' }); // misma profesional: sus sesiones no deben aparecerle a p1
  const lonely = await mkUser('user', { name: 'Persona Sola' });
  const admin1 = await mkUser('admin'); const board = await mkUser('board');
  const upcoming1 = await session(p1, tA, { status: 'scheduled', offset: 2, url: 'https://sala.example.test/1' });
  await session(p1, tA, { status: 'scheduled', offset: -2 }); // programada en el pasado: no es próxima
  const past1 = await session(p1, tA, { status: 'completed', offset: -3, mood: 4 });
  await session(p2, tA, { status: 'scheduled', offset: 1, url: 'https://sala.example.test/2' }); await session(p2, tA, { status: 'completed', offset: -4, mood: 2 });
  await session(p1, tB, { status: 'completed', offset: -30, mood: 5 }); // sesión de una vinculación anterior con OTRO profesional

  await t.test('perfil: solo el profesional vigente y su perfil, con la forma exacta y sin sesiones', async () => {
    const r = await http(p1, '/api/sessions/user/my-therapist/profile');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body), ['therapist']);
    assert.deepEqual(Object.keys(r.body.therapist).sort(), ['email', 'id', 'name', 'profile']);
    assert.equal(r.body.therapist.id, tA.id); assert.equal(r.body.therapist.name, 'Profesional A');
    assert.deepEqual(Object.keys(r.body.therapist.profile).sort(), ['approach', 'bio', 'languages', 'specialties']);
    assert.equal(r.body.therapist.profile.approach, 'Enfoque A');
    for (const leaked of ['upcomingSessions', 'pastSessions', 'NOTA PRIVADA', 'Persona Dos', 'Profesional B']) assert.ok(!r.text.includes(leaked), `no se filtra ${leaked}`);
  });

  await t.test('sesiones: solo las propias con el profesional vigente (nunca de otra persona ni de otro profesional), sin la nota privada', async () => {
    const r = await http(p1, '/api/sessions/user/my-therapist/sessions');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body).sort(), ['pastSessions', 'upcomingSessions']);
    assert.deepEqual(r.body.upcomingSessions.map((s) => s.id), [upcoming1]);
    assert.deepEqual(Object.keys(r.body.upcomingSessions[0]).sort(), ['duration', 'id', 'meetingUrl', 'scheduledAt', 'status']);
    assert.deepEqual(r.body.pastSessions.map((s) => s.id), [past1]); // la de tB (vínculo anterior) y las de p2 no están
    assert.deepEqual(Object.keys(r.body.pastSessions[0]).sort(), ['id', 'patientMoodAfter', 'scheduledAt', 'status']);
    assert.ok(!r.text.includes('NOTA PRIVADA') && !r.text.includes('sala.example.test/2'));
    const other = await http(p2, '/api/sessions/user/my-therapist/sessions'); // A/B: p2 ve solo lo suyo
    assert.equal(other.body.upcomingSessions.length, 1); assert.equal(other.body.pastSessions.length, 1);
    assert.ok(!other.body.upcomingSessions.some((s) => s.id === upcoming1) && !other.body.pastSessions.some((s) => s.id === past1));
  });

  await t.test('sin profesional: perfil null y sesiones vacías; la lectura completa de siempre sigue igual y coincide con las dos secciones', async () => {
    assert.deepEqual((await http(lonely, '/api/sessions/user/my-therapist/profile')).body, { therapist: null });
    assert.deepEqual((await http(lonely, '/api/sessions/user/my-therapist/sessions')).body, { upcomingSessions: [], pastSessions: [] });
    assert.deepEqual((await http(lonely, '/api/sessions/user/my-therapist')).body, { therapist: null });
    const full = (await http(p1, '/api/sessions/user/my-therapist')).body;
    const part = { ...(await http(p1, '/api/sessions/user/my-therapist/profile')).body, ...(await http(p1, '/api/sessions/user/my-therapist/sessions')).body };
    assert.deepEqual(part, full, 'las dos secciones juntas son la lectura completa (compatibilidad)');
  });

  await t.test('control de acceso: otros roles y sin sesión no leen nada; un token inválido es 401', async () => {
    for (const route of ['/api/sessions/user/my-therapist/profile', '/api/sessions/user/my-therapist/sessions']) {
      for (const who of [tA, admin1, board]) { const r = await http(who, route); assert.equal(r.status, 403, `${who.role} ${route}`); assert.ok(!r.text.includes('Enfoque A') && !r.text.includes('Profesional')); }
      const none = await http(null, route); assert.ok([401, 403].includes(none.status), `sin sesión ${route}: ${none.status}`); assert.ok(!none.text.includes('Profesional'));
      const bad = await fetch(`${base}${route}`, { headers: { Authorization: 'Bearer no-es-un-token' } }); assert.equal(bad.status, 401, route);
    }
  });

  await t.test('vínculo retirado o cambiado a mitad: la petición siguiente refleja el vínculo vigente, sin datos del profesional anterior', async () => {
    const mid = await mkUser('user', { therapistId: tA.id, name: 'Persona Media' });
    await session(mid, tA, { status: 'scheduled', offset: 3, url: 'https://sala.example.test/mid' });
    assert.equal((await http(mid, '/api/sessions/user/my-therapist/profile')).body.therapist.id, tA.id);
    assert.equal((await http(mid, '/api/sessions/user/my-therapist/sessions')).body.upcomingSessions.length, 1);
    await q('UPDATE "Users" SET "therapistId"=NULL WHERE id=$1', [mid.id]); // la persona se desvincula entre una petición y la otra
    assert.deepEqual((await http(mid, '/api/sessions/user/my-therapist/sessions')).body, { upcomingSessions: [], pastSessions: [] });
    assert.deepEqual((await http(mid, '/api/sessions/user/my-therapist/profile')).body, { therapist: null });
    await q('UPDATE "Users" SET "therapistId"=$2 WHERE id=$1', [mid.id, tB.id]); // se vincula con otro profesional: no aparecen las sesiones del anterior
    const sessions = await http(mid, '/api/sessions/user/my-therapist/sessions');
    assert.deepEqual(sessions.body, { upcomingSessions: [], pastSessions: [] }); assert.ok(!sessions.text.includes('sala.example.test/mid'));
    const prof = await http(mid, '/api/sessions/user/my-therapist/profile');
    assert.equal(prof.body.therapist.id, tB.id); assert.equal(prof.body.therapist.profile, null);
  });
});
