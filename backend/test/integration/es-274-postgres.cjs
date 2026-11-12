// ES-274 (opción A) · Al atender una solicitud de eliminación se purga lo de la PERSONA (cuestionario de emparejamiento, ánimo, campos de persona en la sesión, todo CORE) y se CONSERVA lo que escribió el profesional.
// Purga, exportación y respuesta del servidor reales sobre PostgreSQL REAL (migraciones reales), pool de 5.
//   ES274_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-274-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-274 PostgreSQL + HTTP: la purga conserva solo lo que escribió el profesional y borra lo de la persona', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES274_TEST_DATABASE_URL, 'Se requiere ES274_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES274_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es274_test_${crypto.randomBytes(8).toString('hex')}`;
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

  const rights = require('../../utils/dataRights');
  const { requestDeletion } = rights;
  const { processDeletion } = require('../../utils/deletionProcessor');
  const User = require('../../User');
  const ClinicalNote = require('../../ClinicalNote'); const TherapySession = require('../../TherapySession'); const SessionNote = require('../../SessionNote');
  const MatchingRequest = require('../../MatchingRequest'); const MoodLog = require('../../MoodLog');

  const therapist = await mkUser('therapist'); const therapist2 = await mkUser('therapist');
  const NOTE_TEXT = (tag) => `Nota del profesional ${tag}: texto libre que podría nombrar a la persona`;
  async function mkPerson(tag, therapistRow = therapist) {
    const person = await mkUser('user', { therapistId: therapistRow.id });
    await ClinicalNote.create({ UserId: person.id, therapistId: therapistRow.id, content: NOTE_TEXT(`${tag}-1`), type: 'session_note', sessionDate: '2026-10-01' });
    await ClinicalNote.create({ UserId: person.id, therapistId: therapistRow.id, content: NOTE_TEXT(`${tag}-2`), type: 'session_note', sessionDate: '2026-10-08' });
    const session = await TherapySession.create({ therapistId: therapistRow.id, patientId: person.id, scheduledAt: new Date('2026-10-01T15:00:00Z'), status: 'completed', duration: 50,
      therapistNote: NOTE_TEXT(`${tag}-sesión`), patientMoodAfter: 4, cancelReason: 'motivo-persona', meetingUrl: 'https://example.test/sala', recordingUrl: 'https://example.test/grabacion', googleEventId: 'evento-sintetico' });
    await SessionNote.create({ sessionId: session.id, therapistId: therapistRow.id, content: NOTE_TEXT(`${tag}-viva`) });
    await MatchingRequest.create({ UserId: person.id, answers: '{"pregunta":"respuesta sintética"}', suggestions: '[]', chosenTherapistId: therapistRow.id, status: 'confirmed' });
    await MoodLog.create({ UserId: person.id, date: '2026-10-02', checkin_mood: 3 });
    return { ...person, sessionId: session.id };
  }
  // Foto de lo que escribió el profesional y de lo que es de la persona, para comparar antes y después.
  const professionalSide = async (p) => JSON.stringify([
    await q('SELECT id,"UserId","therapistId",content,type,"sessionDate" FROM "ClinicalNotes" WHERE "UserId"=$1 ORDER BY id', [p.id]),
    await q('SELECT id,"sessionId","therapistId",content FROM "SessionNotes" WHERE "sessionId"=$1 ORDER BY id', [p.sessionId]),
    await q('SELECT id,"therapistId","patientId","scheduledAt",status,duration,"therapistNote" FROM "TherapySessions" WHERE "patientId"=$1 ORDER BY id', [p.id]),
  ]);
  const personSide = async (p) => JSON.stringify([
    await q('SELECT id,answers,suggestions,"chosenTherapistId" FROM "MatchingRequests" WHERE "UserId"=$1 ORDER BY id', [p.id]),
    await q('SELECT id,checkin_mood FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY id', [p.id]),
    await q('SELECT "patientMoodAfter","cancelReason","meetingUrl","recordingUrl","googleEventId" FROM "TherapySessions" WHERE "patientId"=$1 ORDER BY id', [p.id]),
  ]);
  const purgeOf = async (p) => {
    await requestDeletion(p.id);
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [p.id]))[0].id;
    return { request, receipt: await processDeletion(request, { quiescent: true }) };
  };

  const P = await mkPerson('P'); const Q = await mkPerson('Q'); const R = await mkPerson('R', therapist2);
  const proBefore = await professionalSide(P); const qBefore = [await professionalSide(Q), await personSide(Q)]; const rBefore = [await professionalSide(R), await personSide(R)];

  await t.test('ES-274: una persona con emparejamiento, notas y sesiones SE PURGA (antes quedaba en awaiting_review) y el recibo dice qué se conserva, sin contenido', async () => {
    const out = await purgeOf(P);
    assert.equal(out.receipt.status, 'awaiting_verification');
    assert.deepEqual(out.receipt.retained, ['clinicalNotes', 'sessionNotes', 'therapySessions']);
    assert.doesNotMatch(JSON.stringify(out.receipt), /Nota del profesional|anonim|desvincul/i, 'el recibo no lleva contenido ni afirma anonimización');
    const tomb = (await q('SELECT name,email,active FROM "Users" WHERE id=$1', [P.id]))[0];
    assert.match(tomb.name, /Cuenta eliminada/); assert.match(tomb.email, /@deleted\.invalid$/); assert.equal(tomb.active, false);
  });

  await t.test('lo de la PERSONA desaparece: cuestionario de emparejamiento, ánimo y campos de persona de la sesión (NULL)', async () => {
    assert.deepEqual(JSON.parse(await personSide(P)), [[], [], [{ patientMoodAfter: null, cancelReason: null, meetingUrl: null, recordingUrl: null, googleEventId: null }]]);
  });

  await t.test('lo que ESCRIBIÓ EL PROFESIONAL se conserva idéntico (notas clínicas, notas en vivo, agenda y nota de la sesión)', async () => {
    assert.equal(await professionalSide(P), proBefore);
  });

  await t.test('otras personas y otros profesionales NO se tocan (misma profesional y otra distinta)', async () => {
    assert.deepEqual([await professionalSide(Q), await personSide(Q)], qBefore);
    assert.deepEqual([await professionalSide(R), await personSide(R)], rBefore);
  });

  await t.test('repetir y --replay son idempotentes y no cambian lo conservado', async () => {
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [P.id]))[0].id;
    const again = await processDeletion(request, { quiescent: true });
    assert.equal(again.status, 'awaiting_verification'); assert.deepEqual(again.retained, ['clinicalNotes', 'sessionNotes', 'therapySessions']);
    assert.equal((await processDeletion(request, { quiescent: true, replay: true })).status, 'awaiting_verification');
    assert.equal(await professionalSide(P), proBefore);
    assert.deepEqual(JSON.parse(await personSide(P)).slice(0, 2), [[], []]);
  });

  await t.test('la persona ya no es accesible para el profesional por las rutas normales (404) y no queda vinculada', async () => {
    assert.equal((await http(therapist, 'GET', `/api/therapist/pacientes/${P.id}/notas`)).status, 404);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [P.id]))[0].therapistId, null);
  });

  await t.test('exportación: la persona con notas del profesional PUEDE exportar, sin esas notas y con un aviso (ES y EN), y sin contenido ajeno', async () => {
    for (const locale of ['es', 'en']) {
      const preview = await rights.preview(Q.id, { type: 'personal', locale });
      const text = JSON.stringify(preview.data);
      assert.doesNotMatch(text, /Nota del profesional|texto libre/, 'ninguna nota del profesional');
      assert.equal(preview.data.notices[0].code, 'professional_notes_not_included');
      assert.match(preview.data.notices[0].message, locale === 'es' ? /registro profesional.*no se incluyen/ : /professional record.*not included/);
    }
    const lonely = await mkUser('user');
    assert.equal((await rights.preview(lonely.id, { type: 'personal', locale: 'es' })).data.notices, undefined, 'sin notas del profesional no hay aviso');
  });

  await t.test('el lado del PROFESIONAL sigue en revisión: un profesional, o una persona con referencias propias de profesional, no se purgan', async () => {
    const proPurge = await purgeOf(therapist2);
    assert.equal(proPurge.receipt.status, 'awaiting_review');
    assert.equal(await professionalSide(R), rBefore[0], 'las notas de su profesional siguen intactas');
    const odd = await mkUser('user');
    await ClinicalNote.create({ UserId: Q.id, therapistId: odd.id, content: NOTE_TEXT('rara'), type: 'session_note', sessionDate: '2026-10-15' });
    assert.equal((await purgeOf(odd)).receipt.status, 'awaiting_review', 'una persona que figura como autora de notas no se purga');
    assert.equal((await q('SELECT count(*)::int n FROM "ClinicalNotes" WHERE "therapistId"=$1', [odd.id]))[0].n, 1);
  });

  await t.test('un fallo a mitad de la purga revierte TODO (incluidas las sesiones) y reintentar funciona', async () => {
    const W = await mkPerson('W'); const wPro = await professionalSide(W); const wPerson = await personSide(W);
    await requestDeletion(W.id);
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [W.id]))[0].id;
    const original = TherapySession.update;
    TherapySession.update = async () => { throw new Error('fallo sintético'); };
    try { await assert.rejects(() => processDeletion(request, { quiescent: true }), /Active purge failed/); } finally { TherapySession.update = original; }
    assert.equal(await personSide(W), wPerson, 'nada de la persona se borró');
    assert.equal(await professionalSide(W), wPro);
    assert.equal((await q('SELECT status FROM "DeletionRequests" WHERE id=$1', [request]))[0].status, 'failed');
    assert.equal((await processDeletion(request, { quiescent: true, replay: true })).status, 'awaiting_verification');
    assert.equal(await professionalSide(W), wPro);
  });

  await t.test('texto del servidor al solicitar la eliminación (administración): dice que se conservan las notas del profesional y que pueden identificar; nunca «anonimizado» ni plazos', async () => {
    const S = await mkPerson('S'); const root = await mkUser('superadmin');
    const out = await http(root, 'DELETE', `/api/admin/usuarios/${S.id}`);
    assert.equal(out.status, 202, JSON.stringify(out.body));
    assert.match(out.body.message, /Solo se conservan las notas y registros que escribió su profesional, que pueden contener datos que la identifiquen/);
    assert.match(out.body.message, /Only the notes and records written by their professional are kept, and they may contain data that identifies the person/);
    assert.match(out.body.message, /política de retención está en definición.*retention policy is being defined/s);
    assert.doesNotMatch(out.body.message, /anonim|desvincul|unlink|\b\d+\s*(días|horas|days|hours)\b/i);
  });
});
