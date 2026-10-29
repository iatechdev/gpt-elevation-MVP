// ES-98 · Validación de entradas del terapeuta, matching, sesiones y promedio (ES93-M1, M2, B1, B2, B3, B5) por HTTP REAL, JWT real y PostgreSQL REAL.
// Express real con los routers reales y los middlewares reales de rol (verificarToken, verificarAdmin, verificarTerapeuta). Crea y borra SOLO su base aleatoria.
//   ES98_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-98-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-98 PostgreSQL + HTTP: ids, tipos de nota, estados y choques de sesión, matching y promedio', { timeout: 150000 }, async (t) => {
  assert.ok(process.env.ES98_TEST_DATABASE_URL, 'Se requiere ES98_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES98_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es98_test_${crypto.randomBytes(8).toString('hex')}`;
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarAdmin, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api', verificarToken, require('../../routes/ratings'));
  api.use('/api/matching', verificarToken, require('../../routes/matching'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  api.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
  api.use('/api/admin/matching', verificarAdmin, require('../../routes/matching'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role = 'user', { active = true, therapistId = null } = {}) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'active') v = active;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `sintetico-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = false; else if (c.data_type.startsWith('timestamp')) v = new Date();
      else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=$3, "therapistId"=$4 WHERE id=$1', [id, role, active, therapistId]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* HTML */ }
    return { status: res.status, body: parsed, text };
  };
  const noTrace = (text) => assert.ok(!/node_modules|\.js:\d+|at \w+\s\(|SequelizeDatabaseError|invalid input syntax|SELECT |WHERE /i.test(text), 'la respuesta no trae trazas ni SQL');
  const future = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

  const therapist = await mkUser('therapist');
  const patient = await mkUser('user', { therapistId: therapist.id });
  const otherPatient = await mkUser('user', { therapistId: therapist.id });

  await t.test('B1: ids de ruta mal formados dan 404 uniforme (nunca 500) en pacientes, notas, sesiones y matching', async () => {
    const bad = ['abc', '-1', '0', '1.5', '99999999999', '1e3', '%20', '1;DROP', '2147483648', '007x'];
    const admin1 = await mkUser('admin');
    for (const id of bad) {
      const cases = [
        [therapist, 'GET', `/api/therapist/pacientes/${id}/historial`], [therapist, 'GET', `/api/therapist/pacientes/${id}/historia`],
        [therapist, 'GET', `/api/therapist/pacientes/${id}/resumen-ia`], [therapist, 'POST', `/api/therapist/pacientes/${id}/notas`, { content: 'x', sessionDate: '2026-10-01' }],
        [therapist, 'PUT', `/api/therapist/notas/${id}`, { content: 'x' }],
        [therapist, 'PUT', `/api/sessions/therapist/${id}`, { duration: 50 }], [therapist, 'POST', `/api/sessions/therapist/${id}/start`, {}],
        [therapist, 'POST', `/api/sessions/therapist/${id}/end`, { therapistNote: 'nota de más de diez', patientMoodAfter: 3 }],
        [therapist, 'POST', `/api/sessions/therapist/${id}/notes`, { content: 'nota' }], [patient, 'GET', `/api/sessions/user/${id}/join`],
        [admin1, 'POST', `/api/admin/matching/${id}/confirm`, {}],
      ];
      for (const [who, method, route, body] of cases) {
        const r = await http(who, method, route, body);
        assert.equal(r.status, 404, `${method} ${route} -> ${r.status}`);
        assert.equal(r.body && r.body.code, 'not_found');
        assert.match(r.body.error, / \/ /, 'mensaje bilingüe');
        noTrace(r.text);
      }
    }
  });

  await t.test('B2: el tipo de una nota se valida al editar con la misma lista que al crear', async () => {
    const created = await http(therapist, 'POST', `/api/therapist/pacientes/${patient.id}/notas`, { content: 'Nota sintética', sessionDate: '2026-10-01', type: 'tipo-inventado' });
    assert.equal(created.status, 201);
    assert.equal(created.body.note.type, 'session_note', 'al crear, un tipo desconocido se normaliza (comportamiento existente)');
    const id = created.body.note.id;
    const bad = await http(therapist, 'PUT', `/api/therapist/notas/${id}`, { type: 'tipo-inventado' });
    assert.deepEqual([bad.status, bad.body.code], [400, 'invalid_type']);
    assert.match(bad.body.error, /Tipo de nota no válido\. \/ Invalid note type\./);
    assert.equal((await q('SELECT type FROM "ClinicalNotes" WHERE id=$1', [id]))[0].type, 'session_note', 'no cambió');
    for (const type of ['observation', 'goal', 'session_note']) {
      const ok = await http(therapist, 'PUT', `/api/therapist/notas/${id}`, { type });
      assert.deepEqual([ok.status, ok.body.note.type], [200, type]);
    }
    assert.equal((await http(therapist, 'PUT', `/api/therapist/notas/${id}`, { content: 'Editada' })).status, 200, 'sin type no cambia el tipo');
    assert.equal((await q('SELECT type FROM "ClinicalNotes" WHERE id=$1', [id]))[0].type, 'session_note');
  });

  const createSession = (who, body) => http(who, 'POST', '/api/sessions/therapist', body);

  await t.test('B5: sin choques de horario (misma persona, mismo terapeuta, parciales), con bordes contiguos y cancelación que libera', async () => {
    const t0 = Date.now() + 3 * 86400000;
    const at = (offsetMin) => new Date(t0 + offsetMin * 60000).toISOString();
    const first = await createSession(therapist, { patientId: patient.id, scheduledAt: at(0), duration: 50 });
    assert.equal(first.status, 201);
    const conflict = await createSession(therapist, { patientId: patient.id, scheduledAt: at(0), duration: 50 });
    assert.deepEqual([conflict.status, conflict.body.code], [409, 'session_conflict']);
    assert.match(conflict.body.error, /Ya hay una sesión en ese horario\. \/ There is already a session at that time\./);
    for (const [offset, dur] of [[30, 50], [-30, 50], [10, 15], [-40, 60], [0, 120]]) {
      assert.equal((await createSession(therapist, { patientId: patient.id, scheduledAt: at(offset), duration: dur })).status, 409, `${offset} +${dur}`);
    }
    // El terapeuta tampoco puede estar en dos sesiones a la vez, aunque sea con otra persona.
    assert.equal((await createSession(therapist, { patientId: otherPatient.id, scheduledAt: at(20), duration: 30 })).status, 409);
    // Contiguas: terminan cuando empieza la otra.
    assert.equal((await createSession(therapist, { patientId: patient.id, scheduledAt: at(50), duration: 50 })).status, 201);
    assert.equal((await createSession(therapist, { patientId: otherPatient.id, scheduledAt: at(-50), duration: 50 })).status, 201);
    // Cancelar libera el horario.
    const cancelled = await http(therapist, 'PUT', `/api/sessions/therapist/${first.body.session.id}`, { status: 'cancelled', cancelReason: 'Motivo sintético' });
    assert.equal(cancelled.status, 200);
    assert.equal((await createSession(therapist, { patientId: patient.id, scheduledAt: at(0), duration: 50 })).status, 201);
    // Entradas inválidas.
    for (const body of [{ patientId: patient.id, scheduledAt: at(5000), duration: 14 }, { patientId: patient.id, scheduledAt: at(5000), duration: 121 }, { patientId: patient.id, scheduledAt: at(5000), duration: 45.5 },
      { patientId: 99999999999, scheduledAt: at(5000) }, { patientId: patient.id, scheduledAt: '2000-01-01T00:00:00Z' }]) {
      const r = await createSession(therapist, body);
      assert.ok([400, 403].includes(r.status), `${JSON.stringify(body)} -> ${r.status}`);
      noTrace(r.text);
    }
    assert.equal((await createSession(therapist, { patientId: patient.id, scheduledAt: at(6000), duration: '60' })).body.session.duration, 60, 'un texto numérico sigue aceptándose, como entero');
  });

  await t.test('B5: seis altas simultáneas al mismo horario dejan una sola sesión', async () => {
    const slot = new Date(Date.now() + 10 * 86400000).toISOString();
    const results = await Promise.all(Array.from({ length: 6 }, () => createSession(therapist, { patientId: otherPatient.id, scheduledAt: slot, duration: 50 })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
    assert.equal((await q(`SELECT count(*)::int n FROM "TherapySessions" WHERE "scheduledAt"=$1 AND status='scheduled'`, [slot]))[0].n, 1);
  });

  await t.test('B5: otra alta en curso del mismo terapeuta (aún sin confirmar) se espera y su horario se respeta', async () => {
    // Simula una alta concurrente: toma la fila del terapeuta e inserta una sesión SIN confirmar. La del API debe esperar y, al confirmarse la otra, ver el choque.
    // Sin el bloqueo, la comprobación correría antes (sin ver la fila aún no confirmada) y habría doble reserva.
    const holder = new Client({ connectionString: urlFor(dbName), ssl: false }); await holder.connect();
    try {
      const slot = new Date(Date.now() + 20 * 86400000).toISOString();
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM "Users" WHERE id = $1 FOR UPDATE', [therapist.id]);
      await holder.query(`INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt",duration,status,"createdAt","updatedAt") VALUES ($1,$2,$3,50,'scheduled',now(),now())`, [therapist.id, patient.id, slot]);
      const pending = createSession(therapist, { patientId: patient.id, scheduledAt: slot, duration: 50 });
      const waiting = await Promise.race([pending.then(() => false), new Promise((r) => setTimeout(() => r(true), 500))]);
      assert.equal(waiting, true, 'el alta espera a la otra');
      await holder.query('COMMIT');
      const result = await pending;
      assert.deepEqual([result.status, result.body.code], [409, 'session_conflict']);
      assert.equal((await q(`SELECT count(*)::int n FROM "TherapySessions" WHERE "scheduledAt"=$1`, [slot]))[0].n, 1, 'una sola reserva');
    } finally { await holder.end().catch(() => {}); }
  });

  await t.test('M2: por PUT solo se reprograma y se cancela; ningún estado inventado ni saltos del flujo; lo terminado y lo cancelado no se edita', async () => {
    const mk = async (minutes) => (await createSession(therapist, { patientId: patient.id, scheduledAt: future(60 * 24 * 40 + minutes), duration: 50 })).body.session.id;
    const status = async (id) => (await q('SELECT status, "cancelReason", "scheduledAt" FROM "TherapySessions" WHERE id=$1', [id]))[0];
    const id = await mk(0);
    for (const bad of ['cualquier-cosa', 'completed', 'in_progress', 'COMPLETED', '', 'null']) {
      const r = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { status: bad });
      assert.ok(r.status === 400, `status ${JSON.stringify(bad)} -> ${r.status}`);
      assert.equal((await status(id)).status, 'scheduled', 'no cambió');
    }
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { status: 'scheduled' })).status, 200, 'dejar el mismo estado es válido');
    const longReason = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { status: 'cancelled', cancelReason: 'x'.repeat(256) });
    assert.deepEqual([longReason.status, longReason.body.code], [400, 'invalid_cancel_reason']);
    assert.equal((await status(id)).status, 'scheduled');
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { duration: '60' })).status, 200);
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { duration: 14 })).status, 400);
    const resched = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt: future(60 * 24 * 41) });
    assert.equal(resched.status, 200);
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt: '2000-01-01T00:00:00Z' })).status, 400);
    // Reprogramar a un horario ocupado choca; a su propio horario no.
    const other = await mk(60 * 24 * 3);
    const clash = await http(therapist, 'PUT', `/api/sessions/therapist/${other}`, { scheduledAt: (await status(id)).scheduledAt });
    assert.deepEqual([clash.status, clash.body.code], [409, 'session_conflict']);
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt: (await status(id)).scheduledAt })).status, 200);
    // Cancelar, y luego no se edita más.
    const cancelled = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { status: 'cancelled', cancelReason: 'Motivo' });
    assert.equal(cancelled.status, 200);
    assert.deepEqual([(await status(id)).status, (await status(id)).cancelReason], ['cancelled', 'Motivo']);
    for (const body of [{ status: 'scheduled' }, { duration: 50 }, { scheduledAt: future(60 * 24 * 50) }]) {
      const r = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, body);
      assert.deepEqual([r.status, r.body.code], [400, 'session_final']);
    }
    // Completada o en curso: tampoco por PUT.
    const done = await mk(60 * 24 * 5);
    await q(`UPDATE "TherapySessions" SET status='completed' WHERE id=$1`, [done]);
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${done}`, { status: 'scheduled' })).body.code, 'session_final');
    const live = await mk(60 * 24 * 6);
    await q(`UPDATE "TherapySessions" SET status='in_progress' WHERE id=$1`, [live]);
    for (const body of [{ status: 'cancelled' }, { duration: 60 }]) {
      assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${live}`, body)).body.code, 'session_in_progress');
    }
    assert.equal((await status(live)).status, 'in_progress');
    // Otro terapeuta no toca la sesión.
    const stranger = await mkUser('therapist');
    assert.equal((await http(stranger, 'PUT', `/api/sessions/therapist/${live}`, { status: 'cancelled' })).status, 404);
  });

  await t.test('M1: el matching solo vincula con un terapeuta activo que acepta personas nuevas y a un participante activo; las solicitudes resueltas no se reabren', async () => {
    const adminUser = await mkUser('admin');
    const person = await mkUser('user');
    const goodTherapist = await mkUser('therapist');
    const inactiveTherapist = await mkUser('therapist', { active: false });
    const closedTherapist = await mkUser('therapist');
    await q(`INSERT INTO "TherapistProfiles" ("UserId","acceptingNew","createdAt","updatedAt") VALUES ($1,false,now(),now())`, [closedTherapist.id]).catch(async () => {
      await q(`INSERT INTO "TherapistProfiles" ("UserId","specialties","approach","languages","bio","acceptingNew","createdAt","updatedAt") VALUES ($1,'{}','x','{}','x',false,now(),now())`, [closedTherapist.id]);
    });
    const outsider = await mkUser('user');
    const mkRequest = async (userId) => (await q(`INSERT INTO "MatchingRequests" ("UserId","answers","suggestions","status","createdAt","updatedAt") VALUES ($1,'{"area":"x"}','[]','pending',now(),now()) RETURNING id`, [userId]))[0].id;
    const choose = (who, requestId, therapistId) => http(who, 'POST', '/api/matching/choose', { requestId, therapistId });

    // choose: administradores, participantes, desactivados, que no aceptan nuevos y ids inexistentes
    for (const bad of [adminUser.id, outsider.id, inactiveTherapist.id, closedTherapist.id, 2147483000]) {
      const requestId = await mkRequest(person.id);
      const r = await choose(person, requestId, bad);
      assert.deepEqual([r.status, r.body.code], [409, 'therapist_unavailable'], `therapistId ${bad}`);
      assert.match(r.body.error, /no está disponible\. \/ .* not available\./);
      assert.equal((await q('SELECT "chosenTherapistId" FROM "MatchingRequests" WHERE id=$1', [requestId]))[0].chosenTherapistId, null);
    }
    // Solicitud de otra persona: 404
    const foreign = await mkRequest(outsider.id);
    assert.equal((await choose(person, foreign, goodTherapist.id)).status, 404);
    // Camino feliz y confirmación
    const requestId = await mkRequest(person.id);
    assert.equal((await choose(person, requestId, goodTherapist.id)).status, 200);
    assert.equal((await http(person, 'POST', `/api/admin/matching/${requestId}/confirm`, {})).status, 403, 'confirmar es del administrador');
    // El terapeuta se desactiva entre la elección y la confirmación
    await q('UPDATE "Users" SET active=false WHERE id=$1', [goodTherapist.id]);
    const late = await http(adminUser, 'POST', `/api/admin/matching/${requestId}/confirm`, {});
    assert.deepEqual([late.status, late.body.code], [409, 'therapist_unavailable']);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, null, 'nadie quedó vinculado');
    assert.equal((await q('SELECT status FROM "MatchingRequests" WHERE id=$1', [requestId]))[0].status, 'pending');
    await q('UPDATE "Users" SET active=true WHERE id=$1', [goodTherapist.id]);
    // La persona cambió de rol o se desactivó
    await q(`UPDATE "Users" SET role='admin' WHERE id=$1`, [person.id]);
    assert.equal((await http(adminUser, 'POST', `/api/admin/matching/${requestId}/confirm`, {})).body.code, 'person_unavailable');
    await q(`UPDATE "Users" SET role='user', active=false WHERE id=$1`, [person.id]);
    assert.equal((await http(adminUser, 'POST', `/api/admin/matching/${requestId}/confirm`, {})).body.code, 'person_unavailable');
    await q(`UPDATE "Users" SET active=true WHERE id=$1`, [person.id]);
    // Ahora sí
    const ok = await http(adminUser, 'POST', `/api/admin/matching/${requestId}/confirm`, {});
    assert.equal(ok.status, 200);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, goodTherapist.id);
    // No se reabre ni se vuelve a confirmar
    assert.equal((await http(adminUser, 'POST', `/api/admin/matching/${requestId}/confirm`, {})).body.code, 'request_closed');
    assert.equal((await choose(person, requestId, goodTherapist.id)).body.code, 'request_closed');
  });

  await t.test('B3: el promedio global de valoraciones es solo del administrador', async () => {
    const adminUser = await mkUser('admin'); const superadmin = await mkUser('superadmin'); const user = await mkUser('user');
    await q(`INSERT INTO "SessionRatings" ("UserId","rating","date","createdAt","updatedAt") VALUES ($1,4,'2026-10-01',now(),now()),($1,2,'2026-10-02',now(),now())`, [user.id]);
    for (const who of [user, therapist, await mkUser('board')]) {
      const r = await http(who, 'GET', '/api/rating/avg');
      assert.equal(r.status, 403, who.role);
      assert.ok(!r.text.includes('"avg"'));
    }
    assert.ok([401, 403].includes((await http(null, 'GET', '/api/rating/avg')).status));
    for (const who of [adminUser, superadmin]) {
      const r = await http(who, 'GET', '/api/rating/avg');
      assert.equal(r.status, 200);
      assert.ok(Number.isFinite(r.body.avg) && r.body.total >= 2);
    }
    // El participante sigue pudiendo valorar.
    assert.equal((await http(user, 'POST', '/api/rating', { rating: 5 })).status, 200);
  });
});
