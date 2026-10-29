// ES-96 · Privacidad del terapeuta (ES93-A1, A3, M7) por HTTP REAL, JWT real y PostgreSQL REAL.
// El terapeuta ve SOLO lo que la persona autorizó (propósito therapist_sharing ligado a ESE terapeuta), nada de quien se está borrando, está
// inactivo o se desvinculó, y nunca se cachea. Express real con los routers y middlewares reales; migraciones reales; datos sintéticos.
//   ES96_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-96-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const blocked = async (promise, ms = 400) => Promise.race([promise.then(() => false, () => false), sleep(ms).then(() => true)]);

test('ES-96 PostgreSQL + HTTP: el terapeuta ve solo lo autorizado y pierde el acceso al desvincular, revocar o borrar', { timeout: 180000 }, async (t) => {
  assert.ok(process.env.ES96_TEST_DATABASE_URL, 'Se requiere ES96_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES96_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es96_test_${crypto.randomBytes(8).toString('hex')}`;
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
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  process.env.DATA_RIGHTS_ENABLED = 'true'; // la ruta de eliminación (ES-23) está detrás de esta bandera
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  // Proveedor de IA: doble (el resumen del terapeuta llama al modelo; aquí solo importa el control de acceso).
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Resumen sintético.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarTerapeuta } = require('../../middlewares/auth');
  const consent = require('../../utils/consent');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api', require('../../routes/dataRights'));
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  api.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role, { therapistId = null, active = true, name = null } = {}) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = name || `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=$3, "therapistId"=$4 WHERE id=$1', [id, role, active, therapistId]);
    const email = (await q('SELECT email FROM "Users" WHERE id=$1', [id]))[0].email;
    return { id, role, email, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed, text, cache: res.headers.get('cache-control') };
  };
  const today = new Date().toISOString().slice(0, 10);
  const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  async function addData(person) {
    for (const [offset, a, b] of [[1, 4, 5], [2, 4, 4], [5, 2, 3], [6, 2, 2]]) {
      await q(`INSERT INTO "MoodLogs" ("UserId","checkin_mood","checkout_mood","date","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())`, [person.id, a, b, day(offset)]);
    }
    await q(`INSERT INTO "SessionRatings" ("UserId","rating","date","createdAt","updatedAt") VALUES ($1,4,$2,now(),now())`, [person.id, today]);
  }

  const tA = await mkUser('therapist'); const tB = await mkUser('therapist');
  const p1 = await mkUser('user', { therapistId: tA.id, name: 'Persona Uno' });
  const p2 = await mkUser('user', { therapistId: tA.id, name: 'Persona Dos' });
  const p3 = await mkUser('user', { therapistId: tB.id, name: 'Persona Tres' });
  const lonely = await mkUser('user', { name: 'Persona Sola' });
  for (const p of [p1, p2, p3]) await addData(p);
  const grant = (who, status = 'granted') => http(who, 'PUT', '/api/consents/therapist_sharing', { status });
  const SHARING_MSG = /La persona no ha autorizado compartir sus datos con su terapeuta\. \/ The person has not authorized sharing their data with their therapist\./;

  await t.test('sin autorización (nunca dada): el terapeuta ve la identidad mínima del vínculo y nada más; la ficha, las notas y el resumen responden 403 y no escriben', async () => {
    // Una nota previa del propio terapeuta sobre p1 (como las que existían antes de este cambio).
    const note = (await q(`INSERT INTO "ClinicalNotes" ("UserId","therapistId","content","type","sessionDate","createdAt","updatedAt") VALUES ($1,$2,$3,'session_note',$4,now(),now()) RETURNING id`,
      [p1.id, tA.id, require('../../utils/crypto').encriptar('Nota previa sintética'), today]))[0].id;
    const list = await http(tA, 'GET', '/api/therapist/pacientes');
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.map((p) => [p.id, p.name, p.sharing, p.email, p.lastMood, p.avgRating, p.totalSessions, p.trend]).sort((x, y) => x[0] - y[0]),
      [[p1.id, 'Persona Uno', false, '', null, null, 0, null], [p2.id, 'Persona Dos', false, '', null, null, 0, null]]);
    assert.ok(!list.text.includes('canario-correo'), 'ni correo ni cifras de quien no autorizó');
    assert.deepEqual((await http(tA, 'GET', '/api/therapist/alerts')).body, { inactivePatients: [], notableProgress: [] }, 'las alertas usan el ánimo: sin autorización, no hay alertas');
    for (const route of [`/api/therapist/pacientes/${p1.id}/historial`, `/api/therapist/pacientes/${p1.id}/historia`, `/api/therapist/pacientes/${p1.id}/resumen-ia`]) {
      const r = await http(tA, 'GET', route);
      assert.deepEqual([r.status, r.body.code], [403, 'consent_required'], route);
      assert.match(r.body.error, SHARING_MSG);
      assert.ok(!r.text.includes('Nota previa') && !r.text.includes('canario'));
    }
    assert.equal(provider.calls, 0, 'sin autorización no se llama al proveedor');
    const create = await http(tA, 'POST', `/api/therapist/pacientes/${p1.id}/notas`, { content: 'Nota nueva', sessionDate: today });
    assert.deepEqual([create.status, create.body.code], [403, 'consent_required']);
    assert.equal((await q('SELECT count(*)::int n FROM "ClinicalNotes" WHERE "UserId"=$1', [p1.id]))[0].n, 1, 'no se escribió');
    const edit = await http(tA, 'PUT', `/api/therapist/notas/${note}`, { content: 'Editada' });
    assert.equal(edit.status, 403);
    // Otro terapeuta: 404 uniforme, como si no existiera.
    for (const route of [`/api/therapist/pacientes/${p1.id}/historial`, `/api/therapist/pacientes/${p1.id}/historia`, `/api/therapist/pacientes/${p1.id}/resumen-ia`]) {
      assert.equal((await http(tB, 'GET', route)).status, 404, `B ${route}`);
    }
  });

  await t.test('la persona autoriza a SU terapeuta (el alcance sale del servidor, no del cliente) y solo entonces se ve lo suyo', async () => {
    assert.deepEqual([(await http(p1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted', scope: 'therapist-' + tB.id })).status], [400], 'el cliente no puede elegir a quién autoriza');
    assert.equal((await http(p1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted', scope: 'default' })).status, 400);
    const noTherapist = await grant(lonely);
    assert.deepEqual([noTherapist.status, noTherapist.body.code], [409, 'no_therapist']);
    const own = await http(lonely, 'GET', '/api/consents');
    assert.equal(own.body.consents.find((c) => c.purpose === 'therapist_sharing').applicable, false);

    const ok = await grant(p1);
    assert.deepEqual([ok.status, ok.body.scope, ok.body.status], [200, `therapist-${tA.id}`, 'granted']);
    const mine = (await http(p1, 'GET', '/api/consents')).body.consents.find((c) => c.purpose === 'therapist_sharing');
    assert.deepEqual([mine.status, mine.scope, mine.applicable], ['granted', `therapist-${tA.id}`, true]);
    assert.equal((await http(p2, 'GET', '/api/consents')).body.consents.find((c) => c.purpose === 'therapist_sharing').status, 'undecided');

    const list = await http(tA, 'GET', '/api/therapist/pacientes');
    const one = list.body.find((p) => p.id === p1.id); const two = list.body.find((p) => p.id === p2.id);
    assert.deepEqual([one.sharing, one.email === p1.email, one.totalSessions, one.avgRating], [true, true, 4, 4]);
    assert.deepEqual([two.sharing, two.email, two.totalSessions], [false, '', 0], 'quien no autorizó sigue en lo mínimo');
    assert.ok(!list.text.includes(p2.email));
    const alerts = await http(tA, 'GET', '/api/therapist/alerts');
    assert.equal(alerts.status, 200);
    assert.ok(![...alerts.body.inactivePatients, ...alerts.body.notableProgress].some((a) => a.userId === p2.id), 'p2 no aparece en las alertas');
    assert.ok(alerts.body.notableProgress.some((a) => a.userId === p1.id), 'p1 sí (ánimo 2,5 → 4,5)');
    const hist = await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`);
    assert.deepEqual([hist.status, hist.body.moodLogs.length, hist.body.ratings.length], [200, 4, 1]);
    const hs = await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`);
    assert.deepEqual([hs.status, hs.body.notes.length, hs.body.notes[0].content], [200, 1, 'Nota previa sintética']);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/resumen-ia`)).status, 200);
    const created = await http(tA, 'POST', `/api/therapist/pacientes/${p1.id}/notas`, { content: 'Nota autorizada', sessionDate: today });
    assert.equal(created.status, 201);
    assert.equal((await http(tA, 'PUT', `/api/therapist/notas/${created.body.note.id}`, { content: 'Editada' })).status, 200);
    // Otro terapeuta sigue sin ver nada de p1; p3 (de B) no se mezcla.
    assert.equal((await http(tB, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).status, 404);
    assert.deepEqual((await http(tB, 'GET', '/api/therapist/pacientes')).body.map((p) => p.id), [p3.id]);
    // Correo en la lista de sesiones: solo de quien autorizó.
    await q(`INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt","duration","status","createdAt","updatedAt") VALUES ($1,$2,now()+interval '2 day',50,'scheduled',now(),now()),($1,$3,now()+interval '3 day',50,'scheduled',now(),now())`, [tA.id, p1.id, p2.id]);
    const sessions = await http(tA, 'GET', '/api/sessions/therapist');
    const byPatient = Object.fromEntries(sessions.body.map((s) => [s.patientId, s]));
    assert.deepEqual([byPatient[p1.id].patientEmail === p1.email, byPatient[p2.id].patientEmail, byPatient[p2.id].patientName], [true, '', 'Persona Dos']);
  });

  await t.test('retirar la autorización corta el acceso en la siguiente petición y una revocación en curso no deja pasar lecturas viejas', async () => {
    // Una revocación a medias (fila del consentimiento bloqueada) hace esperar la lectura del terapeuta; al confirmarse, la lectura ya no pasa.
    const holder = new Client({ connectionString: urlFor(dbName), ssl: false }); await holder.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT 1 FROM "Consents" WHERE "UserId"=$1 AND purpose='therapist_sharing' FOR UPDATE`, [p1.id]);
      await holder.query(`UPDATE "Consents" SET status='revoked' WHERE "UserId"=$1 AND purpose='therapist_sharing'`, [p1.id]);
      const read = http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`);
      assert.equal(await blocked(read), true, 'la lectura espera a la revocación en curso');
      await holder.query('COMMIT');
      const result = await read;
      assert.deepEqual([result.status, result.body.code], [403, 'consent_required']);
    } finally { await holder.end().catch(() => {}); }
    await q(`UPDATE "Consents" SET status='granted' WHERE "UserId"=$1 AND purpose='therapist_sharing'`, [p1.id]);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 200);
    // Retirarla por la API.
    const revoked = await grant(p1, 'revoked');
    assert.deepEqual([revoked.status, revoked.body.status], [200, 'revoked']);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 403);
    assert.equal(JSON.stringify((await http(tA, 'GET', '/api/therapist/pacientes')).body.find((p) => p.id === p1.id).sharing), 'false');
    assert.ok(!(await http(tA, 'GET', '/api/therapist/alerts')).text.includes(`"userId":${p1.id}`));
    // El historial de decisiones de la persona conserva ambos cambios.
    const history = (await http(p1, 'GET', '/api/consents/history')).body.history.filter((h) => h.purpose === 'therapist_sharing');
    assert.ok(history.some((h) => h.status === 'revoked' && h.scope === `therapist-${tA.id}`) && history.some((h) => h.status === 'granted' && h.scope === `therapist-${tA.id}`), 'ambas decisiones quedan en el historial');
  });

  await t.test('un terapeuta nuevo no hereda la autorización: cambiar de terapeuta exige una decisión nueva de la persona', async () => {
    await grant(p1); // vuelve a autorizar a A
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 200);
    await q('UPDATE "Users" SET "therapistId"=$2 WHERE id=$1', [p1.id, tB.id]); // el administrador la reasigna a B
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 404, 'A ya no es su terapeuta');
    const asB = await http(tB, 'GET', `/api/therapist/pacientes/${p1.id}/historial`);
    assert.deepEqual([asB.status, asB.body.code], [403, 'consent_required'], 'B no hereda lo que se autorizó a A');
    assert.equal((await http(p1, 'GET', '/api/consents')).body.consents.find((c) => c.purpose === 'therapist_sharing').status, 'undecided');
    const ok = await grant(p1);
    assert.equal(ok.body.scope, `therapist-${tB.id}`);
    assert.equal((await http(tB, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 200);
    await q('UPDATE "Users" SET "therapistId"=$2 WHERE id=$1', [p1.id, tA.id]);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historial`)).status, 200, 'volver con A recupera la autorización que se le dio');
  });

  await t.test('la persona se desvincula sola: el terapeuta pierde el acceso de inmediato, las sesiones futuras se cancelan y la autorización queda retirada', async () => {
    await q(`INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt","duration","status","createdAt","updatedAt") VALUES ($1,$2,now()-interval '5 day',50,'completed',now(),now())`, [tA.id, p1.id]);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).status, 200);
    assert.equal((await http(tA, 'DELETE', '/api/sessions/user/my-therapist')).status, 403, 'solo la persona');
    const r = await http(p1, 'DELETE', '/api/sessions/user/my-therapist');
    assert.deepEqual([r.status, r.body.unlinked], [200, true]);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [p1.id]))[0].therapistId, null);
    for (const route of [`/api/therapist/pacientes/${p1.id}/historial`, `/api/therapist/pacientes/${p1.id}/historia`, `/api/therapist/pacientes/${p1.id}/resumen-ia`]) {
      assert.equal((await http(tA, 'GET', route)).status, 404, route);
    }
    assert.equal((await http(tA, 'POST', `/api/therapist/pacientes/${p1.id}/notas`, { content: 'x', sessionDate: today })).status, 404);
    assert.ok(!(await http(tA, 'GET', '/api/therapist/pacientes')).body.some((p) => p.id === p1.id));
    const sessions = await q('SELECT status, "cancelReason" FROM "TherapySessions" WHERE "patientId"=$1 ORDER BY id', [p1.id]);
    assert.deepEqual(sessions.map((s) => [s.status, s.cancelReason]), [['cancelled', 'unlinked_by_person'], ['completed', null]], 'lo futuro se cancela; lo terminado se conserva');
    assert.equal((await q(`SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose='therapist_sharing' AND scope=$2`, [p1.id, `therapist-${tA.id}`]))[0].status, 'revoked');
    assert.equal((await q(`SELECT count(*)::int n FROM "ClinicalNotes" WHERE "UserId"=$1`, [p1.id]))[0].n >= 1, true, 'las notas del terapeuta son su registro: no se borran');
    const again = await http(p1, 'DELETE', '/api/sessions/user/my-therapist');
    assert.deepEqual([again.status, again.body.unlinked], [200, false], 'idempotente');
    assert.equal((await http(lonely, 'DELETE', '/api/sessions/user/my-therapist')).body.unlinked, false);
  });

  await t.test('A1: aceptada la eliminación de la cuenta, el terapeuta pierde de inmediato lista, alertas, ficha y notas (sin esperar al purgado)', async () => {
    await grant(p2);
    await q(`INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt","duration","status","createdAt","updatedAt") VALUES ($1,$2,now()+interval '9 day',50,'scheduled',now(),now())`, [tA.id, p2.id]);
    const noteId = (await q(`INSERT INTO "ClinicalNotes" ("UserId","therapistId","content","type","sessionDate","createdAt","updatedAt") VALUES ($1,$2,$3,'session_note',$4,now(),now()) RETURNING id`, [p2.id, tA.id, require('../../utils/crypto').encriptar('Nota de p2'), today]))[0].id;
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${p2.id}/historia`)).status, 200);
    const request = await http(p2, 'POST', '/api/account/deletion-requests', { confirm: true });
    assert.ok([200, 202].includes(request.status), `deletion-requests -> ${request.status} ${request.text.slice(0, 80)}`);
    for (const route of [`/api/therapist/pacientes/${p2.id}/historial`, `/api/therapist/pacientes/${p2.id}/historia`, `/api/therapist/pacientes/${p2.id}/resumen-ia`]) {
      assert.equal((await http(tA, 'GET', route)).status, 404, route);
    }
    assert.equal((await http(tA, 'POST', `/api/therapist/pacientes/${p2.id}/notas`, { content: 'x', sessionDate: today })).status, 404);
    assert.equal((await http(tA, 'PUT', `/api/therapist/notas/${noteId}`, { content: 'x' })).status, 404);
    assert.ok(!(await http(tA, 'GET', '/api/therapist/pacientes')).body.some((p) => p.id === p2.id));
    assert.ok(!(await http(tA, 'GET', '/api/therapist/alerts')).text.includes(`"userId":${p2.id}`));
    const future = await q('SELECT status, "cancelReason" FROM "TherapySessions" WHERE "patientId"=$1 AND "scheduledAt" > now()', [p2.id]);
    assert.ok(future.length >= 1 && future.every((x) => x.status === 'cancelled' && x.cancelReason === 'account_deletion'), 'sus sesiones futuras se cancelan con motivo');
    assert.equal((await q('SELECT "therapistId", active FROM "Users" WHERE id=$1', [p2.id]))[0].therapistId, null);
    assert.equal((await q('SELECT count(*)::int n FROM "DeletionRequests" WHERE "UserId"=$1', [p2.id]))[0].n, 1);
  });

  await t.test('A1 (solicitudes anteriores a este cambio): una eliminación ya aceptada, sin desvincular, también corta el acceso', async () => {
    const legacy = await mkUser('user', { therapistId: tA.id, name: 'Persona Heredada' });
    await addData(legacy);
    assert.equal((await grant(legacy)).status, 200);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${legacy.id}/historial`)).status, 200);
    // Estado histórico: la solicitud quedó aceptada cuando el vínculo aún no se cortaba (se simula insertando la fila sin pasar por requestDeletion).
    await q(`INSERT INTO "DeletionRequests" ("id","UserId","status","attempts","createdAt","updatedAt") VALUES (gen_random_uuid(),$1,'accepted',0,now(),now())`, [legacy.id]);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [legacy.id]))[0].therapistId, tA.id, 'sigue vinculada en la base');
    for (const route of [`/api/therapist/pacientes/${legacy.id}/historial`, `/api/therapist/pacientes/${legacy.id}/historia`, `/api/therapist/pacientes/${legacy.id}/resumen-ia`]) {
      assert.equal((await http(tA, 'GET', route)).status, 404, route);
    }
    assert.equal((await http(tA, 'POST', `/api/therapist/pacientes/${legacy.id}/notas`, { content: 'x', sessionDate: today })).status, 404);
    assert.ok(!(await http(tA, 'GET', '/api/therapist/pacientes')).body.some((x) => x.id === legacy.id));
    assert.ok(!(await http(tA, 'GET', '/api/therapist/alerts')).text.includes(`"userId":${legacy.id}`));
  });
  await t.test('personas inactivas no son accesibles; roles ajenos no entran; ninguna respuesta con datos de personas se cachea (M7)', async () => {
    const inactive = await mkUser('user', { therapistId: tA.id, active: false, name: 'Persona Inactiva' });
    await addData(inactive);
    await q(`INSERT INTO "Consents" ("UserId","purpose","scope","status","version","decidedAt","createdAt","updatedAt") VALUES ($1,'therapist_sharing',$2,'granted',1,now(),now(),now())`, [inactive.id, `therapist-${tA.id}`]);
    assert.equal((await http(tA, 'GET', `/api/therapist/pacientes/${inactive.id}/historial`)).status, 404);
    assert.ok(!(await http(tA, 'GET', '/api/therapist/pacientes')).body.some((p) => p.id === inactive.id));
    for (const who of [p3, await mkUser('admin')]) assert.equal((await http(who, 'GET', '/api/therapist/pacientes')).status, 403);
    // no-store en las respuestas con datos (éxito, 403, 404) del terapeuta y de las sesiones
    await grant(p3).catch(() => {});
    for (const [who, route] of [[tA, '/api/therapist/pacientes'], [tA, '/api/therapist/alerts'], [tA, `/api/therapist/pacientes/${p1.id}/historial`], [tA, '/api/therapist/prompt'],
      [tB, `/api/therapist/pacientes/${p3.id}/historia`], [tA, '/api/sessions/therapist'], [tA, '/api/sessions/therapist/upcoming'], [p3, '/api/sessions/user/my-therapist']]) {
      const r = await http(who, 'GET', route);
      assert.match(String(r.cache), /no-store/, `${route} -> ${r.status}`);
    }
  });
});
