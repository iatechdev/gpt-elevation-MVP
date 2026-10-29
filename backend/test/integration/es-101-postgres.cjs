// ES-101 (ES93-A1) contra Postgres REAL: el terapeuta no accede a una persona con eliminación de cuenta aceptada (ES-23) ni inactiva.
// Modelos, consultas y rutas reales, JWT real; solo el proveedor de IA está sustituido (y cuenta sus llamadas).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES101_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:therapist-deletion:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-101: el acceso del terapeuta se corta con la eliminación aceptada y con la cuenta inactiva (PostgreSQL real)', { timeout: 180000 }, async (t) => {
  const source = process.env.ES101_TEST_DATABASE_URL;
  assert.ok(source, 'ES101_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es101_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es101_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  // ES-102: el resumen con IA pasa por el presupuesto de ES-22; se configura uno holgado para esta base desechable.
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000'; process.env.AI_BUDGET_TOKENS_COHORT = '10000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  // Único doble: el proveedor de IA (cuenta las llamadas; nunca sale a la red).
  let providerCalls = 0;
  const anthropicId = require.resolve('../../utils/anthropic');
  require.cache[anthropicId] = { id: anthropicId, filename: anthropicId, loaded: true, exports: {
    MODEL: 'synthetic', messages: { create: async () => { providerCalls++; return { content: [{ type: 'text', text: 'Resumen sintético.' }] }; } } } };
  require('../../associations')();
  const { CORE } = require('../../utils/personalData');
  for (const [, model] of CORE) require('../../' + model);
  for (const model of ['PricingPlan', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest',
    'MoodLog', 'SessionRating', 'ClinicalNote', 'TherapySession', 'SessionNote', 'TherapistProfile', 'promptVault', 'AiUsage', 'AiBudgetCounter']) require('../../' + model);
  await sequelize.sync();

  const User = require('../../User'); const DeletionRequest = require('../../DeletionRequest'); const ClinicalNote = require('../../ClinicalNote');
  const TherapySession = require('../../TherapySession'); const MoodLog = require('../../MoodLog');
  const { encriptar, desencriptar } = require('../../utils/crypto');
  const { issueToken } = require('../../utils/sessions');
  const mk = (name, extra = {}) => User.create({ name, email: `${name.toLowerCase().replace(/\W+/g, '')}@example.invalid`, password: randomBytes(32).toString('hex'), role: 'user', active: true, ...extra });
  const therapist = await mk('SYNTHETIC therapist', { role: 'therapist' });
  const otherTherapist = await mk('SYNTHETIC other therapist', { role: 'therapist' });
  const ok = await mk('SYNTHETIC ok', { therapistId: therapist.id });
  const deleting = await mk('SYNTHETIC deleting', { therapistId: therapist.id });
  const inactive = await mk('SYNTHETIC inactive', { therapistId: therapist.id, active: false });
  const foreign = await mk('SYNTHETIC foreign', { therapistId: otherTherapist.id });
  const seeds = {};
  for (const person of [ok, deleting, inactive]) {
    await MoodLog.create({ UserId: person.id, date: new Date().toISOString().slice(0, 10), checkin_mood: 3 });
    seeds[person.id] = {
      note: await ClinicalNote.create({ UserId: person.id, therapistId: therapist.id, content: encriptar(`nota-${person.id}`), type: 'session_note', sessionDate: '2026-10-01' }),
      session: await TherapySession.create({ therapistId: therapist.id, patientId: person.id, scheduledAt: new Date('2099-01-01T12:00:00Z'), status: 'in_progress', duration: 50 }),
    };
  }
  // ES-23: la solicitud aceptada deja un tombstone y desactiva la cuenta; aquí además se reactiva, porque el bloqueo no debe depender de `active`.
  await DeletionRequest.create({ id: randomUUID(), UserId: deleting.id, status: 'accepted' });

  const express = require('express'); const app = express(); app.use(express.json());
  const { verificarToken, verificarTerapeuta } = require('../../middlewares/auth');
  app.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  app.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, user = therapist) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + issueToken(user) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  await t.test('lista y alertas solo traen a la persona accesible', async () => {
    const list = await call('GET', '/api/therapist/pacientes');
    assert.equal(list.status, 200); assert.deepEqual(list.body.map(p => p.id), [ok.id]);
    const alerts = await call('GET', '/api/therapist/alerts'); assert.equal(alerts.status, 200);
    assert.doesNotMatch(JSON.stringify(alerts.body), /SYNTHETIC (deleting|inactive)|deleting@|inactive@/); assert.deepEqual(alerts.body.inactivePatients.map(p => p.userId).filter(id => id !== ok.id), []);
    const sessions = await call('GET', '/api/sessions/therapist'); assert.equal(sessions.status, 200);
    assert.deepEqual(sessions.body.map(s => s.patientId), [ok.id]);
  });

  await t.test('historial, historia y resumen: 200 para la accesible y 404 uniforme para la bloqueada; el proveedor solo recibe la accesible', async () => {
    for (const path of ['historial', 'historia', 'resumen-ia']) {
      assert.equal((await call('GET', `/api/therapist/pacientes/${ok.id}/${path}`)).status, 200, path);
      for (const person of [deleting, inactive]) {
        const response = await call('GET', `/api/therapist/pacientes/${person.id}/${path}`);
        assert.equal(response.status, 404, `${path} ${person.id}`); assert.doesNotMatch(JSON.stringify(response.body), /@example|SYNTHETIC|nota-/);
      }
      assert.equal((await call('GET', `/api/therapist/pacientes/${foreign.id}/${path}`)).status, 404, `${path} ajena`);
    }
    assert.equal(providerCalls, 1);
  });

  await t.test('notas: se crean y editan para la accesible; la bloqueada no cambia en la base', async () => {
    const created = await call('POST', `/api/therapist/pacientes/${ok.id}/notas`, { content: 'Nota sintética nueva', sessionDate: '2026-10-02' });
    assert.equal(created.status, 201);
    for (const person of [deleting, inactive]) {
      assert.equal((await call('POST', `/api/therapist/pacientes/${person.id}/notas`, { content: 'No debe guardarse', sessionDate: '2026-10-02' })).status, 404);
      assert.equal(await ClinicalNote.count({ where: { UserId: person.id } }), 1);
      assert.equal((await call('PUT', `/api/therapist/notas/${seeds[person.id].note.id}`, { content: 'Editada' })).status, 404);
      assert.equal(desencriptar((await ClinicalNote.findByPk(seeds[person.id].note.id)).content), `nota-${person.id}`);
    }
    assert.equal((await call('PUT', `/api/therapist/notas/${seeds[ok.id].note.id}`, { content: 'Editada' })).status, 200);
  });

  await t.test('sesiones: la bloqueada no se agenda, edita, inicia, termina ni se leen sus notas; la accesible sí se lee', async () => {
    assert.equal((await call('POST', '/api/sessions/therapist', { patientId: ok.id, scheduledAt: '2099-02-01T12:00:00Z', duration: 50 })).status, 201);
    for (const person of [deleting, inactive]) {
      const id = seeds[person.id].session.id;
      assert.equal((await call('POST', '/api/sessions/therapist', { patientId: person.id, scheduledAt: '2099-02-01T12:00:00Z', duration: 50 })).status, 403);
      assert.equal((await call('PUT', `/api/sessions/therapist/${id}`, { duration: 60 })).status, 404);
      assert.equal((await call('GET', `/api/sessions/therapist/${id}/notes`)).status, 404);
      assert.equal((await call('POST', `/api/sessions/therapist/${id}/notes`, { content: 'No debe guardarse' })).status, 404);
      assert.equal((await call('POST', `/api/sessions/therapist/${id}/start`)).status, 404);
      assert.equal((await call('POST', `/api/sessions/therapist/${id}/end`, { therapistNote: 'Nota sintética suficiente', patientMoodAfter: 3 })).status, 404);
      assert.equal((await TherapySession.findByPk(id)).status, 'in_progress'); assert.equal((await TherapySession.findByPk(id)).duration, 50);
    }
    assert.equal((await call('GET', `/api/sessions/therapist/${seeds[ok.id].session.id}/notes`)).status, 200);
  });

  await t.test('al cancelarse la solicitud de eliminación el acceso se restablece; con el registro caído nunca se concede', async () => {
    assert.equal((await call('GET', `/api/therapist/pacientes/${deleting.id}/historia`)).status, 404);
    await DeletionRequest.destroy({ where: { UserId: deleting.id } });
    assert.equal((await call('GET', `/api/therapist/pacientes/${deleting.id}/historia`)).status, 200);
    await DeletionRequest.create({ id: randomUUID(), UserId: deleting.id, status: 'accepted' }); // vuelve a quedar bloqueada
    assert.equal((await call('GET', `/api/therapist/pacientes/${deleting.id}/historia`)).status, 404);
    const original = DeletionRequest.findAll; DeletionRequest.findAll = async () => { throw new Error('SYNTHETIC_LEDGER_DOWN'); };
    const logs = []; const previous = console.error; console.error = (...args) => logs.push(args);
    try {
      // 500 de la ruta o 503 del middleware de sesión (que también consulta el registro): en ambos casos se deniega, sin datos.
      for (const path of [`/api/therapist/pacientes/${ok.id}/historia`, '/api/therapist/pacientes']) {
        const response = await call('GET', path); assert.ok([500, 503].includes(response.status), `${path} → ${response.status}`); assert.doesNotMatch(JSON.stringify(response.body), /@example|nota-/);
      }
    } finally { DeletionRequest.findAll = original; console.error = previous; }
    assert.doesNotMatch(JSON.stringify(logs), /@example/);
  });
});
