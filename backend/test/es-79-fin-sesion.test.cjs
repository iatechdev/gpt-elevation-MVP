const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp, grantTherapistSharing } = require('./support.cjs');

const NAME = 'Nombre Sintetico Paciente';
const T1 = 301;
const T2 = 302;
const PATIENT = 7;

function setup() {
  grantTherapistSharing(); // ES-96: la persona autorizó compartir con este terapeuta
  const session = record({ id: 41, patientId: PATIENT, therapistId: T1, status: 'in_progress' });
  models.TherapySession.findOne = async ({ where }) =>
    String(where.id) === '41' && where.therapistId === T1 ? session : null;
  // Si la ruta intentara cargar al paciente, el nombre estaría disponible; no debe usarse.
  let patientLookups = 0;
  models.User.findByPk = async () => { patientLookups++; return record({ id: PATIENT, name: NAME }); };
  const created = [];
  models.WellnessRecommendation.create = async values => { created.push(values); return record({ id: 900, ...values }); };
  const prompts = [];
  const provider = { fail: false };
  anthropic.messages.create = async options => {
    prompts.push(options);
    if (provider.fail) throw new Error('proveedor caído');
    return { content: [{ type: 'text', text: 'Recomendación sintética.' }] };
  };
  return { session, created, prompts, provider, lookups: () => patientLookups };
}

const body = { therapistNote: 'Nota sintética sin nombres, de más de diez caracteres.', patientMoodAfter: 4 };

test('ES-79: la recomendación de fin de sesión no envía el nombre real del paciente', async t => {
  const { session, created, prompts, lookups } = setup();
  const request = await startApp(t);
  const response = await request('POST', '/api/sessions/therapist/41/end', { role: 'therapist', id: T1, body });
  assert.equal(response.status, 200);
  assert.equal(session.status, 'completed');
  assert.deepEqual(response.body.recommendation, { id: 900 });
  assert.equal(created.length, 1);
  assert.equal(created[0].UserId, PATIENT);
  assert.equal(session.therapistNote, body.therapistNote); // la nota se sigue guardando en la sesión (cifrada en producción)
  assert.equal(prompts.length, 1);
  const sent = JSON.stringify(prompts[0]);
  assert.ok(!sent.includes(NAME), 'el nombre del paciente no debe viajar al proveedor');
  assert.match(sent, /La persona terminó una sesión de terapia sintiéndose bien/);
  // Decisión del 26-oct: la nota del terapeuta tampoco viaja al proveedor; solo el estado de ánimo.
  assert.ok(!sent.includes('Nota sintética'), 'la nota del terapeuta no debe viajar al proveedor');
  assert.doesNotMatch(sent, /nota del terapeuta/i);
  assert.equal(lookups(), 0); // ni siquiera se consulta el nombre
});

test('ES-79: un fallo del proveedor no rompe el cierre; terapeuta ajeno y roles incorrectos no finalizan nada', async t => {
  const { session, prompts, provider } = setup();
  const request = await startApp(t);
  assert.equal((await request('POST', '/api/sessions/therapist/41/end', { role: 'therapist', id: T2, body })).status, 404);
  assert.equal((await request('POST', '/api/sessions/therapist/41/end', { role: 'user', id: PATIENT, body })).status, 403);
  assert.equal((await request('POST', '/api/sessions/therapist/41/end', { role: 'admin', id: 1, body })).status, 403);
  assert.equal(session.status, 'in_progress');
  assert.equal(prompts.length, 0);

  provider.fail = true;
  const response = await request('POST', '/api/sessions/therapist/41/end', { role: 'therapist', id: T1, body });
  assert.equal(response.status, 200); // la sesión ya quedó guardada
  assert.equal(response.body.recommendation, null);
  assert.equal(session.status, 'completed');
});
