// ES-101 (ES93-A1): el terapeuta no accede a una persona con eliminación de cuenta aceptada (ES-23) ni con la cuenta inactiva.
// Express real y HTTP real; persistencia simulada. Los dobles aplican el filtro `where` que envía la ruta.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp, grantTherapistSharing } = require('./support.cjs');
const { blockedPatientIds } = require('../utils/therapistAccess');

const T = 301; const OTHER_T = 302;
const OK = 1001; const DELETING = 1002; const INACTIVE = 1003; const FOREIGN = 1004;
const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) => {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.includes(row[key]);
  if (value !== null && typeof value === 'object') return true; // operadores (Op.gte…): no se filtran en este doble
  return String(row[key]) === String(value);
});

function seed() {
  const state = { deletions: [DELETING], noteWrites: 0, summaries: 0, ledgerDown: false };
  const users = [
    record({ id: OK, name: 'Persona Activa', email: 'ok@example.invalid', role: 'user', therapistId: T, active: true, createdAt: new Date() }),
    record({ id: DELETING, name: 'Persona Eliminando', email: 'deleting@example.invalid', role: 'user', therapistId: T, active: true, createdAt: new Date() }), // eliminación aceptada pero cuenta activa (p. ej. reactivada por un administrador)
    record({ id: INACTIVE, name: 'Persona Inactiva', email: 'inactive@example.invalid', role: 'user', therapistId: T, active: false, createdAt: new Date() }),
    record({ id: FOREIGN, name: 'Persona Ajena', email: 'foreign@example.invalid', role: 'user', therapistId: OTHER_T, active: true, createdAt: new Date() }),
  ];
  const notes = [
    record({ id: 71, UserId: OK, therapistId: T, content: 'nota-ok', type: 'session_note', sessionDate: '2026-10-01' }),
    record({ id: 72, UserId: DELETING, therapistId: T, content: 'nota-eliminando', type: 'session_note', sessionDate: '2026-10-01' }),
  ];
  const sessions = [OK, DELETING, INACTIVE].map((patientId, i) => record({
    id: 51 + i, patientId, therapistId: T, status: 'in_progress', scheduledAt: new Date('2099-01-01T12:00:00Z'), duration: 50,
  }));
  grantTherapistSharing(); // ES-96
  models.User.findAll = async ({ where } = {}) => users.filter(u => matches(u, where));
  models.User.findOne = async ({ where } = {}) => users.find(u => matches(u, where)) ?? null;
  models.User.findByPk = async (id) => users.find(u => u.id === Number(id)) ?? null;
  models.DeletionRequest.findAll = async ({ where }) => {
    if (state.ledgerDown) throw new Error('SYNTHETIC_LEDGER_DOWN');
    return state.deletions.filter(id => where.UserId.includes(id)).map(id => ({ UserId: id }));
  };
  models.DeletionRequest.findOne = async ({ where }) => { // ES-96: deletionGuard consulta de a una persona; mismo registro
    if (state.ledgerDown) throw new Error('SYNTHETIC_LEDGER_DOWN');
    return state.deletions.includes(where.UserId) ? { UserId: where.UserId } : null;
  };
  models.MoodLog.findAll = async () => [];
  models.SessionRating.findAll = async () => [];
  models.ClinicalNote.findAll = async ({ where }) => notes.filter(n => matches(n, where));
  models.ClinicalNote.findOne = async ({ where }) => notes.find(n => matches(n, where)) ?? null;
  models.ClinicalNote.create = async (values) => { state.noteWrites++; return record({ id: 99, ...values }); };
  models.TherapySession.findAll = async ({ where }) => sessions.filter(s => matches(s, where));
  models.TherapySession.findOne = async ({ where }) => sessions.find(s => matches(s, where)) ?? null;
  models.TherapySession.create = async (values) => { state.noteWrites++; return record({ id: 60, ...values }); };
  models.SessionNote.findAll = async () => [];
  models.SessionNote.create = async (values) => { state.noteWrites++; return record({ id: 5, ...values }); };
  anthropic.messages.create = async () => { state.summaries++; return { content: [{ type: 'text', text: 'Resumen sintético.' }] }; };
  return { state, notes };
}
const as = (request, method, url, body) => request(method, url, { role: 'therapist', id: T, body });
const NOTE = { content: 'Nota sintética de prueba', sessionDate: '2026-10-02' };

test('ES-101: la lista de pacientes y las alertas no incluyen a la persona con eliminación aceptada (aunque su cuenta siga activa) ni a la inactiva', async t => {
  seed(); const request = await startApp(t);
  const list = await as(request, 'GET', '/api/therapist/pacientes');
  assert.equal(list.status, 200); assert.deepEqual(list.body.map(p => p.id), [OK]);
  assert.doesNotMatch(JSON.stringify(list.body), /eliminando|inactiva|deleting@|inactive@/i);
  const alerts = await as(request, 'GET', '/api/therapist/alerts');
  assert.equal(alerts.status, 200);
  assert.deepEqual(alerts.body.inactivePatients.map(p => p.userId), [OK]); // sin registros de ánimo: solo la persona accesible
  assert.doesNotMatch(JSON.stringify(alerts.body), /Eliminando|Inactiva/);
});

test('ES-101: historial, historia y resumen con IA responden 404 uniforme para la persona bloqueada y siguen funcionando para la accesible', async t => {
  const { state } = seed(); const request = await startApp(t);
  // ES-97: con cero datos el proveedor ya no se llama. Este caso prueba acceso con evidencia suficiente.
  models.MoodLog.findAll = async () => [record({ checkin_mood: 3, checkout_mood: 4 })];
  for (const path of ['historial', 'historia', 'resumen-ia']) {
    const before = state.summaries;
    assert.equal((await as(request, 'GET', `/api/therapist/pacientes/${OK}/${path}`)).status, 200, `${path} accesible`);
    for (const id of [DELETING, INACTIVE]) {
      const blocked = await as(request, 'GET', `/api/therapist/pacientes/${id}/${path}`);
      assert.equal(blocked.status, 404, `${path} ${id}`); assert.equal(blocked.body.error, 'Patient not found or not assigned to you.');
      assert.doesNotMatch(JSON.stringify(blocked.body), /@example|Persona|nota-/);
    }
    const foreign = await as(request, 'GET', `/api/therapist/pacientes/${FOREIGN}/${path}`);
    assert.equal(foreign.status, 404); assert.equal(foreign.body.error, 'Patient not found or not assigned to you.'); // mismo mensaje que antes (A/B)
    if (path === 'resumen-ia') assert.equal(state.summaries - before, 1, 'el proveedor solo se llama para la persona accesible');
  }
});

test('ES-101: no se crean ni editan notas de una persona bloqueada, y las de la accesible sí', async t => {
  const { state, notes } = seed(); const request = await startApp(t);
  assert.equal((await as(request, 'POST', `/api/therapist/pacientes/${OK}/notas`, NOTE)).status, 201);
  assert.equal(state.noteWrites, 1);
  for (const id of [DELETING, INACTIVE]) assert.equal((await as(request, 'POST', `/api/therapist/pacientes/${id}/notas`, NOTE)).status, 404, String(id));
  assert.equal(state.noteWrites, 1);
  assert.equal((await as(request, 'PUT', '/api/therapist/notas/71', { content: 'Editada' })).status, 200);
  const blocked = await as(request, 'PUT', '/api/therapist/notas/72', { content: 'Editada por error' });
  assert.equal(blocked.status, 404); assert.equal(notes[1].content, 'nota-eliminando'); // la nota no cambió
});

test('ES-101: las sesiones de una persona bloqueada no se listan, agendan, editan, ni se leen o escriben sus notas, ni se inician o terminan', async t => {
  const { state } = seed(); const request = await startApp(t);
  const list = await as(request, 'GET', '/api/sessions/therapist');
  assert.equal(list.status, 200); assert.deepEqual(list.body.map(s => s.patientId), [OK]); assert.doesNotMatch(JSON.stringify(list.body), /Eliminando|Inactiva|deleting@|inactive@/);
  const upcoming = await as(request, 'GET', '/api/sessions/therapist/upcoming'); assert.equal(upcoming.status, 200);
  assert.doesNotMatch(JSON.stringify(upcoming.body), /Eliminando|Inactiva/);
  assert.equal((await as(request, 'POST', '/api/sessions/therapist', { patientId: OK, scheduledAt: '2099-02-01T12:00:00Z', duration: 50 })).status, 201);
  const writes = state.noteWrites;
  for (const id of [DELETING, INACTIVE]) {
    assert.equal((await as(request, 'POST', '/api/sessions/therapist', { patientId: id, scheduledAt: '2099-02-01T12:00:00Z', duration: 50 })).status, 403, `agendar ${id}`);
  }
  for (const sessionId of [52, 53]) { // sesiones de las personas bloqueadas
    assert.equal((await as(request, 'PUT', `/api/sessions/therapist/${sessionId}`, { duration: 60 })).status, 404, `editar ${sessionId}`);
    assert.equal((await as(request, 'POST', `/api/sessions/therapist/${sessionId}/notes`, { content: 'Nota sintética' })).status, 404, `nota ${sessionId}`);
    assert.equal((await as(request, 'GET', `/api/sessions/therapist/${sessionId}/notes`)).status, 404, `leer notas ${sessionId}`);
    assert.equal((await as(request, 'POST', `/api/sessions/therapist/${sessionId}/start`)).status, 404, `iniciar ${sessionId}`);
    assert.equal((await as(request, 'POST', `/api/sessions/therapist/${sessionId}/end`, { therapistNote: 'Nota sintética suficiente', patientMoodAfter: 3 })).status, 404, `terminar ${sessionId}`);
  }
  assert.equal(state.noteWrites, writes, 'ninguna escritura sobre sesiones bloqueadas');
  assert.equal((await as(request, 'GET', '/api/sessions/therapist/51/notes')).status, 200); // la persona accesible sigue funcionando
});

test('ES-101: si se cancela la solicitud de eliminación (el registro desaparece) y la cuenta está activa, el acceso se restablece', async t => {
  const { state } = seed(); const request = await startApp(t);
  assert.equal((await as(request, 'GET', `/api/therapist/pacientes/${DELETING}/historia`)).status, 404);
  state.deletions.length = 0;
  assert.equal((await as(request, 'GET', `/api/therapist/pacientes/${DELETING}/historia`)).status, 200);
  const list = await as(request, 'GET', '/api/therapist/pacientes'); assert.ok(list.body.some(p => p.id === DELETING));
});

test('ES-101: si el registro de eliminaciones no está disponible nunca se concede acceso (500, sin datos) y no se registran datos personales', async t => {
  const { state } = seed(); const request = await startApp(t); state.ledgerDown = true;
  const logs = []; const previous = console.error; console.error = (...args) => logs.push(args);
  try {
    for (const url of ['/api/therapist/pacientes', `/api/therapist/pacientes/${OK}/historia`, '/api/therapist/alerts', '/api/sessions/therapist']) {
      const response = await as(request, 'GET', url);
      assert.ok([500, 503].includes(response.status), `${url} ${response.status}`); // ES-96: algunas rutas cierran en falla con 503 (no se pudo verificar); ninguna concede acceso assert.doesNotMatch(JSON.stringify(response.body), /ok@|Persona|nota-/);
    }
    assert.doesNotMatch(JSON.stringify(logs), /ok@example|deleting@example|nota-/);
  } finally { console.error = previous; }
});

test('ES-101: blockedPatientIds — ids inválidos se ignoran, duplicados no cuentan, una cuenta cuyo active no es false no se bloquea y la unión es correcta', async () => {
  seed();
  assert.deepEqual([...await blockedPatientIds([])], []); assert.deepEqual([...await blockedPatientIds(undefined)], []);
  assert.deepEqual([...await blockedPatientIds(['x', null, NaN, 1.5])], []);
  assert.deepEqual([...await blockedPatientIds([OK, OK, DELETING, INACTIVE, FOREIGN])].sort(), [DELETING, INACTIVE]);
  models.User.findAll = async () => [record({ id: OK })]; // un doble que devuelve usuarios sin `active` no bloquea a nadie
  assert.deepEqual([...await blockedPatientIds([OK])], []);
});
