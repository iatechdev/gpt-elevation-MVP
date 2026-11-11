// ES-241 + ES-267 (servidor) · GET /api/sessions/therapist y /upcoming: quien NO autorizó compartir sale como «Persona n» (mismo ordinal que el panel) sin nombre ni correo en ninguna
// respuesta; la sesión ya empezada o con la hora pasada y vigente sigue visible (in_progress / due). HTTP REAL, JWT real, PostgreSQL REAL (migraciones reales), pool de 5.
//   ES241_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-241-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-241 + ES-267 PostgreSQL + HTTP: sesiones del profesional con «Persona n» para quien no comparte y sesión ya empezada visible', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES241_TEST_DATABASE_URL, 'Se requiere ES241_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES241_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es241_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  const realFetch = global.fetch;
  t.after(async () => {
    global.fetch = realFetch;
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
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const mailer = { sent: true }; const mailerModule = require.resolve('../../utils/mailer'); const realMailer = require('../../utils/mailer');
  require.cache[mailerModule] = { id: mailerModule, filename: mailerModule, loaded: true, exports: { ...realMailer, sendInvitation: async () => ({ sent: mailer.sent }) } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { setConsent } = require('../../utils/consent');
  const { verificarToken, verificarAdmin, verificarSuperAdmin, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/matching', verificarAdmin, require('../../routes/matching'));
  api.use('/api/admin/plan-requests', verificarAdmin, require('../../routes/planRequests'));
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  api.use('/api/admin/invitations', verificarAdmin, require('../../routes/invitations').adminRouter);
  api.use('/api/superadmin/audit', verificarSuperAdmin, require('../../routes/adminAudit'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  api.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role, { therapistId = null } = {}) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, therapistId]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed };
  };

  const therapistA = await mkUser('therapist'); const therapistB = await mkUser('therapist');
  // nombre y correo SINTÉTICOS y reconocibles, para buscar fugas en cualquier respuesta
  const named = async (role, label, therapistId) => {
    const u = await mkUser(role, { therapistId });
    const name = `Nombre${label}Sintetico`; const email = `correo-${label.toLowerCase()}-${dbName}@example.test`;
    await q('UPDATE "Users" SET name=$2, email=$3 WHERE id=$1', [u.id, name, email]);
    return { ...u, name, email };
  };
  const shares = await named('user', 'Comparte', therapistA.id);      // autorizó compartir con A
  const hides = await named('user', 'Oculta', therapistA.id);         // NO autorizó
  const revoker = await named('user', 'Revoca', therapistA.id);       // autoriza y luego revoca
  const ofB = await named('user', 'DeB', therapistB.id);
  await setConsent(shares.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`);
  await setConsent(revoker.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`);
  await setConsent(ofB.id, 'therapist_sharing', 'granted', `therapist-${therapistB.id}`);

  const minutes = (m) => new Date(Date.now() + m * 60000);
  const mkSession = async (therapist, person, { at, status = 'scheduled', duration = 50, startedAt = null }) => (await q(
    `INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt","startedAt","duration","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now(),now()) RETURNING id`,
    [therapist.id, person.id, at, startedAt, duration, status]))[0].id;
  const s = {
    futureShare: await mkSession(therapistA, shares, { at: minutes(30) }),
    futureHide: await mkSession(therapistA, hides, { at: minutes(60) }),
    inProgress: await mkSession(therapistA, shares, { at: minutes(-20), status: 'in_progress', startedAt: minutes(-18) }),
    dueHide: await mkSession(therapistA, hides, { at: minutes(-10) }),
    ended: await mkSession(therapistA, shares, { at: minutes(-30), status: 'completed' }),
    cancelled: await mkSession(therapistA, shares, { at: minutes(40), status: 'cancelled' }),
    tooOld: await mkSession(therapistA, shares, { at: minutes(-300) }),
    longGone: await mkSession(therapistA, hides, { at: minutes(-200), status: 'in_progress', startedAt: minutes(-200) }),
    revokerFuture: await mkSession(therapistA, revoker, { at: minutes(90) }),
    ofB: await mkSession(therapistB, ofB, { at: minutes(20) }),
  };
  const get = (who, route) => http(who, 'GET', route);
  const leaks = (body) => { const text = JSON.stringify(body); return ['NombreOculta', `correo-oculta-`, hides.email].filter((x) => text.includes(x)); };

  await t.test('ES-267: «Próximas sesiones» incluye la sesión ya empezada («in_progress») y la que pasó su hora sin iniciar («due»), y excluye cerradas, canceladas y muy antiguas', async () => {
    const out = await get(therapistA, '/api/sessions/therapist/upcoming');
    assert.equal(out.status, 200);
    const byId = new Map(out.body.map((x) => [x.id, x]));
    assert.equal(byId.get(s.inProgress).phase, 'in_progress');
    assert.equal(byId.get(s.dueHide).phase, 'due');
    assert.equal(byId.get(s.futureShare).phase, 'upcoming');
    for (const id of [s.ended, s.cancelled, s.tooOld, s.longGone, s.ofB]) assert.equal(byId.has(id), false, `la sesión ${id} no debe aparecer`);
    const times = out.body.map((x) => new Date(x.scheduledAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'ordenadas por inicio');
    assert.ok(out.body.length <= 5);
  });

  await t.test('ES-267: la ventana es duración + margen; una sesión de 15 min sin iniciar desaparece pasados 30 min, una de 120 min sigue a la hora y 15 min', async () => {
    const short = await mkSession(therapistA, shares, { at: minutes(-31), duration: 15 });
    const edge = await mkSession(therapistA, shares, { at: minutes(-120), duration: 120 });
    const out = (await get(therapistA, '/api/sessions/therapist/upcoming')).body.map((x) => x.id);
    assert.equal(out.includes(short), false); assert.equal(out.includes(edge), true);
    await q('DELETE FROM "TherapySessions" WHERE id IN ($1,$2)', [short, edge]);
  });

  await t.test('ES-241: quien NO autorizó compartir sale como «Persona n» en «Próximas» y en el listado; ni nombre ni correo viajan en NINGUNA respuesta', async () => {
    const up = await get(therapistA, '/api/sessions/therapist/upcoming');
    const all = await get(therapistA, '/api/sessions/therapist');
    const panel = await get(therapistA, '/api/therapist/pacientes'); const alerts = await get(therapistA, '/api/therapist/alerts');
    for (const res of [up, all, panel, alerts]) { assert.equal(res.status, 200); assert.deepEqual(leaks(res.body), [], 'filtración de la persona que no comparte'); }
    const hidden = [...up.body, ...all.body].filter((x) => x.patientId === hides.id);
    assert.ok(hidden.length >= 3);
    for (const x of hidden) assert.deepEqual([x.patientName, x.patientEmail, x.sharing, Number.isInteger(x.patientOrdinal)], [null, '', false, true]);
    // el MISMO ordinal que el panel y estable entre las dos listas
    const panelOrdinal = panel.body.find((p) => p.id === hides.id).ordinal;
    assert.ok(hidden.every((x) => x.patientOrdinal === panelOrdinal), 'mismo ordinal que el panel');
    // quien sí comparte conserva su nombre
    const shown = [...up.body, ...all.body].filter((x) => x.patientId === shares.id);
    assert.ok(shown.length >= 2 && shown.every((x) => x.patientName === shares.name && x.sharing === true && x.patientOrdinal === null));
  });

  await t.test('ES-241: al revocar el consentimiento, el nombre desaparece de las listas al instante; al volver a autorizar, reaparece', async () => {
    const find = async (res) => res.body.find((x) => x.patientId === revoker.id);
    assert.equal((await find(await get(therapistA, '/api/sessions/therapist'))).patientName, revoker.name);
    await setConsent(revoker.id, 'therapist_sharing', 'revoked', `therapist-${therapistA.id}`);
    const after = await get(therapistA, '/api/sessions/therapist'); const upAfter = await get(therapistA, '/api/sessions/therapist/upcoming');
    const row = await find(after);
    assert.deepEqual([row.patientName, row.patientEmail, row.sharing], [null, '', false]);
    for (const res of [after, upAfter]) assert.equal(JSON.stringify(res.body).includes('NombreRevoca'), false);
    await setConsent(revoker.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`);
    assert.equal((await find(await get(therapistA, '/api/sessions/therapist'))).patientName, revoker.name);
  });

  await t.test('aislamiento: el profesional B no ve las sesiones de A ni A las de B; los demás roles reciben 403', async () => {
    const asB = await get(therapistB, '/api/sessions/therapist');
    assert.deepEqual(asB.body.map((x) => x.id), [s.ofB]);
    assert.equal(JSON.stringify(asB.body).includes('NombreComparte'), false);
    assert.equal((await get(shares, '/api/sessions/therapist')).status, 403);
    assert.equal((await get(shares, '/api/sessions/therapist/upcoming')).status, 403);
  });

  await t.test('concurrencia: 12 lecturas simultáneas de las dos listas (pool de 5) dan el mismo ordinal y ningún 5xx', async () => {
    const outs = await Promise.all(Array.from({ length: 12 }, (_, i) => get(therapistA, i % 2 ? '/api/sessions/therapist' : '/api/sessions/therapist/upcoming')));
    assert.ok(outs.every((o) => o.status === 200), outs.map((o) => o.status).join());
    const ordinals = new Set(outs.flatMap((o) => o.body.filter((x) => x.patientId === hides.id).map((x) => x.patientOrdinal)));
    assert.equal(ordinals.size, 1, [...ordinals].join());
  });
});
