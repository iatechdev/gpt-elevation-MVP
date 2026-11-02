const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { models, anthropic, promptVault, record, startApp } = require('./support.cjs');

// Personas sintéticas A y B: cada una con sus propios datos; los modelos simulados SÍ aplican el filtro `where`
// que envía la ruta, así que si una ruta olvidara el propietario, A vería (o tocaría) datos de B.
// chat.js toma getActivePrompt al cargarse: se sustituye antes de que ninguna prueba cargue el servidor.
promptVault.getActivePrompt = async () => 'Synthetic system prompt';

const A = 101;
const B = 202;
const T1 = 301; // terapeuta de A
const T2 = 302; // terapeuta de B

const bearer = (id, role = 'user') => ({ Authorization: 'Bearer ' + jwt.sign(
  { id, role, name: 'Synthetic', jti: randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '1h' },
) });
const where = (rows, filter = {}) => rows.filter(row => Object.entries(filter).every(([key, value]) =>
  value !== null && typeof value === 'object' ? true : String(row[key]) === String(value)));

function seed() {
  const data = {
    messages: [
      record({ id: 1, UserId: A, role: 'user', content: 'texto-privado-de-A' }),
      record({ id: 2, UserId: B, role: 'user', content: 'texto-privado-de-B' }),
    ],
    moods: [
      record({ id: 1, UserId: A, date: '2026-10-01', checkin_mood: 4 }),
      record({ id: 2, UserId: B, date: '2026-10-01', checkin_mood: 1 }),
    ],
    recs: [
      record({ id: 11, UserId: A, text: 'rec-de-A', seenByUser: false }),
      record({ id: 22, UserId: B, text: 'rec-de-B', seenByUser: false }),
    ],
    plans: [
      record({ id: 31, userId: A, status: 'pending', note: 'plan-de-A' }),
      record({ id: 32, userId: B, status: 'pending', note: 'plan-de-B' }),
    ],
    sessions: [
      record({ id: 41, patientId: A, therapistId: T1, status: 'in_progress', meetingUrl: 'https://meet.invalid/a' }),
      record({ id: 42, patientId: B, therapistId: T2, status: 'in_progress', meetingUrl: 'https://meet.invalid/b' }),
    ],
    patients: [
      record({ id: A, name: 'Persona A', role: 'user', active: true, therapistId: T1 }),
      record({ id: B, name: 'Persona B', role: 'user', active: true, therapistId: T2 }),
    ],
  };
  models.message.findAll = async ({ where: w }) => where(data.messages, w);
  models.message.create = async values => { data.messages.push(record({ id: 99, ...values })); return values; };
  models.MoodLog.findAll = async ({ where: w }) => where(data.moods, w);
  models.MoodLog.upsert = async values => { data.upserted = values; return [record(values)]; };
  models.SessionRating.findAll = async ({ where: w } = {}) => where([], w);
  models.WellnessRecommendation.findAll = async ({ where: w }) => where(data.recs, w);
  models.WellnessRecommendation.findOne = async ({ where: w }) => where(data.recs, w)[0] ?? null;
  models.PlanRequest.findOne = async ({ where: w }) => where(data.plans, w)[0] ?? null;
  models.TherapySession.findOne = async ({ where: w }) => where(data.sessions, w)[0] ?? null;
  models.User.findOne = async ({ where: w }) => where(data.patients, w)[0] ?? null;
  models.User.findByPk = async id => data.patients.find(p => p.id === Number(id)) ?? null;
  return data;
}

test('A/B lectura: A solo ve lo suyo en mensajes, ánimo, recomendaciones y solicitud de plan', async t => {
  seed();
  const request = await startApp(t);
  const read = async (url, id) => request('GET', url, { headers: bearer(id) });

  const messagesA = await read('/api/messages', A);
  assert.equal(messagesA.status, 200);
  assert.match(JSON.stringify(messagesA.body), /texto-privado-de-A/);
  assert.doesNotMatch(JSON.stringify(messagesA.body), /texto-privado-de-B/);
  assert.doesNotMatch(JSON.stringify((await read('/api/messages', B)).body), /texto-privado-de-A/);

  const moodsA = await read('/api/mood/history', A);
  assert.deepEqual(moodsA.body.map(row => row.UserId), [A]);
  assert.deepEqual((await read('/api/mood/history', B)).body.map(row => row.UserId), [B]);

  const recsA = await read('/api/recommendations', A);
  assert.deepEqual(recsA.body.map(row => row.id), [11]);
  assert.deepEqual((await read('/api/recommendations', B)).body.map(row => row.id), [22]);

  const planA = await read('/api/plan-requests/me', A);
  assert.match(JSON.stringify(planA.body), /plan-de-A/);
  assert.doesNotMatch(JSON.stringify(planA.body), /plan-de-B/);
});

test('A/B escritura: cambiar IDs o enviar el propietario en el cuerpo no toca datos ajenos', async t => {
  const data = seed();
  models.EthicManifest.findOne = async () => null;
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: 'respuesta sintética' }] });
  const request = await startApp(t);

  // Marcar como vista la recomendación de B siendo A: 404 y B queda intacta.
  assert.equal((await request('PUT', `/api/recommendations/22/seen`, { headers: bearer(A) })).status, 404);
  assert.equal(data.recs[1].seenByUser, false);
  assert.equal((await request('PUT', `/api/recommendations/11/seen`, { headers: bearer(A) })).status, 200);
  assert.equal(data.recs[0].seenByUser, true);

  // El propietario siempre sale del token: un UserId en el cuerpo se ignora (ánimo y chat).
  assert.equal((await request('POST', '/api/mood/checkin', { headers: bearer(A), body: { mood: 3, UserId: B } })).status, 200);
  assert.equal(data.upserted.UserId, A);
  const chat = await request('POST', '/api/chat', { headers: bearer(A), body: { message: 'hola sintético', UserId: B } });
  assert.equal(chat.status, 200);
  const created = data.messages.filter(message => message.id === 99);
  assert.equal(created.length, 2);
  assert.ok(created.every(message => message.UserId === A));
});

test('A/B sesiones y terapeutas: unirse, finalizar o leer pacientes ajenos devuelve 404', async t => {
  const data = seed();
  const request = await startApp(t);

  // Persona A intenta unirse a la sesión de B; B sí puede con la suya.
  assert.equal((await request('GET', '/api/sessions/user/42/join', { headers: bearer(A) })).status, 404);
  const own = await request('GET', '/api/sessions/user/41/join', { headers: bearer(A) });
  assert.equal(own.status, 200);
  assert.equal(own.body.meetingUrl, 'https://meet.invalid/a');

  // Un terapeuta no puede iniciar ni finalizar la sesión de otro terapeuta.
  const other = bearer(T1, 'therapist');
  assert.equal((await request('POST', '/api/sessions/therapist/42/end', { headers: other, body: { therapistNote: 'Synthetic fixture', patientMoodAfter: 3 } })).status, 404);
  assert.equal((await request('POST', '/api/sessions/therapist/42/start', { headers: other })).status, 404);
  assert.equal(data.sessions[1].status, 'in_progress');

  // Un terapeuta solo lee a su paciente asignado; un usuario cualquiera no lee a nadie.
  models.MoodLog.findAll = async () => [];
  assert.equal((await request('GET', `/api/therapist/pacientes/${B}/historial`, { headers: bearer(T1, 'therapist') })).status, 404);
  // ES-96: además del vínculo, la persona debe haber autorizado compartir con ESTE terapeuta (therapist_sharing, alcance therapist-<id>).
  models.Consent.findOne = async () => null;
  const noConsent = await request('GET', `/api/therapist/pacientes/${A}/historial`, { headers: bearer(T1, 'therapist') });
  assert.deepEqual([noConsent.status, noConsent.body.code], [403, 'consent_required']);
  models.Consent.findOne = async ({ where }) => (where.purpose === 'therapist_sharing' && where.scope === `therapist-${T1}`
    ? { UserId: where.UserId, purpose: where.purpose, scope: where.scope, status: 'granted', version: 1 } : null);
  assert.equal((await request('GET', `/api/therapist/pacientes/${A}/historial`, { headers: bearer(T1, 'therapist') })).status, 200);
  // Un usuario sin rol de terapeuta ya no entra a estas rutas (QA-18-01).
  assert.equal((await request('GET', `/api/therapist/pacientes/${B}/historial`, { headers: bearer(A) })).status, 403);
});

test('El administrador no recibe texto de conversaciones y las respuestas no incluyen contraseñas', async t => {
  const data = seed();
  let touched = 0;
  for (const method of ['findAll', 'findOne', 'findByPk', 'count']) {
    models.message[method] = async () => { touched++; return []; };
  }
  // El doble respeta `attributes`: solo devuelve las columnas que la ruta pide (la contraseña no debe pedirse).
  const pick = (row, attributes) => attributes ? Object.fromEntries(attributes.filter(key => key in row).map(key => [key, row[key]])) : row;
  models.User.findAll = async ({ attributes } = {}) => data.patients.map(p => record(pick({ ...p, email: `${p.id}@example.invalid`, active: true, password: 'hash-secreto' }, attributes)));
  models.User.findByPk = async (id, { attributes } = {}) => {
    const p = data.patients.find(row => row.id === Number(id));
    return p ? record(pick({ ...p, email: `${p.id}@example.invalid`, active: true, password: 'hash-secreto' }, attributes)) : null;
  };
  models.MoodLog.count = async () => 1;
  models.SessionRating.findAll = async () => [];
  const request = await startApp(t);
  const admin = { headers: bearer(1, 'admin') };

  const list = await request('GET', '/api/admin/usuarios', admin);
  const stats = await request('GET', `/api/admin/usuarios/${A}/stats`, admin);
  assert.equal(list.status, 200);
  assert.equal(stats.status, 200);
  for (const body of [list.body, stats.body]) {
    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /texto-privado|hash-secreto|"password"|"content"/);
  }
  // Solo cifras agregadas: ninguna entrada de ánimo o valoración individual por fecha llega al administrador.
  assert.deepEqual(Object.keys(stats.body.stats).sort(), ['moodPromedio', 'ratingPromedio', 'sesiones']);
  assert.doesNotMatch(JSON.stringify(stats.body), /checkin_mood|checkout_mood|ultimosMoods|ultimosRatings/);
  assert.equal(touched, 0);
});
