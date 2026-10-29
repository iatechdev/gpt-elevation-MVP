// ES-105: el promedio de ánimo se calcula sobre los valores registrados (nunca fuera de 1-5) en el resumen del terapeuta, el matching y las
// recomendaciones; y una respuesta vacía del proveedor en el resumen es un fallo reintentable, no un 200 con texto vacío.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp, grantTherapistSharing } = require('./support.cjs');
const { averageMood, formatAverage } = require('../utils/moodStats');

const log = (checkin_mood, checkout_mood) => ({ checkin_mood, checkout_mood });

test('ES-105 averageMood: promedio sobre los valores registrados, siempre entre 1 y 5, y null sin evidencia', () => {
  assert.equal(averageMood([log(4, 5), log(3, 3)]), 3.75); // antes: (4+5+3+3)/2 = 7,5
  assert.equal(formatAverage(averageMood([log(4, 5), log(3, 3)]), 'N/A'), '3.8');
  assert.equal(averageMood([log(5, undefined), log(1, null)]), 3); // solo entradas
  assert.equal(averageMood([log(undefined, 2), log(null, 4)]), 3); // solo salidas
  assert.equal(averageMood([log(5, 5)]), 5); assert.equal(averageMood([log(1, 1)]), 1);
  for (const empty of [[], undefined, null, 'texto', {}, [log(undefined, undefined)], [log(null, null)], [{}], [null]]) assert.equal(averageMood(empty), null, String(empty));
  // valores fuera de la escala o que no son números se ignoran: no se inventa un promedio
  assert.equal(averageMood([log(0, 6), log(-3, NaN), log('4', Infinity)]), null);
  assert.equal(averageMood([log(4, 99), log(2, 0)]), 3);
  assert.equal(formatAverage(null, 'No data'), 'No data'); assert.equal(formatAverage(null, null), null); assert.equal(formatAverage(4, 'x'), '4.0');
  for (let i = 0; i < 200; i++) { // propiedad: con valores 1-5 el promedio nunca sale de la escala
    const logs = Array.from({ length: 1 + (i % 9) }, (_, j) => log(1 + ((i * 7 + j * 3) % 5), (i + j) % 3 ? 1 + ((i + j * 5) % 5) : undefined));
    const average = averageMood(logs); assert.ok(average >= 1 && average <= 5, String(average));
  }
});

const asTherapist = { role: 'therapist', id: 301 };
function summarySetup(output) {
  grantTherapistSharing(); // ES-96
  const calls = [];
  models.User.findOne = async ({ where }) => where.id === '7' ? record({ id: 7, active: true }) : null;
  models.MoodLog.findAll = async () => [record({ checkin_mood: 4, checkout_mood: 5 }), record({ checkin_mood: 3, checkout_mood: 3 })];
  models.SessionRating.findAll = async () => [record({ rating: 4 })];
  anthropic.messages.create = async (body) => { calls.push(body); return { content: [{ type: 'text', text: output }], usage: { input_tokens: 10, output_tokens: 10 } }; };
  return calls;
}

test('ES-105 (F03): una respuesta vacía o de solo espacios del proveedor responde 502 reintentable; una válida se recorta y sigue en 200', async t => {
  const calls = summarySetup('   \n  '); const request = await startApp(t);
  const logs = []; const previous = console.error; console.error = (...args) => logs.push(args);
  try {
    for (const empty of ['', '   ', '\n\t']) {
      anthropic.messages.create = async () => ({ content: [{ type: 'text', text: empty }], usage: { input_tokens: 10, output_tokens: 10 } });
      const response = await request('GET', '/api/therapist/pacientes/7/resumen-ia', asTherapist);
      assert.equal(response.status, 502, JSON.stringify(empty)); assert.equal(response.body.code, 'provider_unavailable'); assert.equal(response.body.retryable, true);
      assert.equal('summary' in response.body, false);
    }
    anthropic.messages.create = async () => ({ content: [], usage: { input_tokens: 10, output_tokens: 10 } }); // sin bloques de texto
    assert.equal((await request('GET', '/api/therapist/pacientes/7/resumen-ia', asTherapist)).status, 502);
  } finally { console.error = previous; }
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: '  Resumen sintético.  ' }], usage: { input_tokens: 10, output_tokens: 10 } });
  const ok = await request('GET', '/api/therapist/pacientes/7/resumen-ia', asTherapist);
  assert.equal(ok.status, 200); assert.equal(ok.body.summary, 'Resumen sintético.');
});

test('ES-105 (O1): el prompt del resumen, del matching y de las recomendaciones lleva el promedio sobre los valores registrados (3,8 y no 7,5)', async t => {
  const prompts = {};
  const keep = (name, reply) => async (body) => { prompts[name] = JSON.stringify(body); return { content: [{ type: 'text', text: reply }], usage: { input_tokens: 10, output_tokens: 10 } }; };
  const request = await startApp(t);
  const logs = [record({ checkin_mood: 4, checkout_mood: 5 }), record({ checkin_mood: 3, checkout_mood: 3 })];
  models.MoodLog.findAll = async () => logs;
  // Resumen del terapeuta
  grantTherapistSharing(); // ES-96
  models.User.findOne = async ({ where }) => where.id === '7' ? record({ id: 7, active: true }) : null; models.SessionRating.findAll = async () => [];
  anthropic.messages.create = keep('summary', 'Resumen sintético.');
  assert.equal((await request('GET', '/api/therapist/pacientes/7/resumen-ia', asTherapist)).status, 200);
  assert.match(prompts.summary, /Average mood \(1-5\): 3\.8/); assert.doesNotMatch(prompts.summary, /7\.5/);
  // Matching
  models.User.findAll = async () => [record({ id: 303, name: 'Synthetic therapist' })]; models.MatchingRequest.create = async values => record({ id: 7, ...values });
  anthropic.messages.create = keep('matching', JSON.stringify([{ therapistId: 303, score: 7, reason: 'Sintético' }]));
  assert.equal((await request('POST', '/api/matching/request', { role: 'user', id: 101, body: { answers: { area: 'sintético' } } })).status, 200);
  assert.match(prompts.matching, /Average mood \(1-5\): 3\.8/); assert.doesNotMatch(prompts.matching, /7\.5/);
  // Recomendaciones
  models.WellnessRecommendation.create = async values => record({ id: 1, ...values });
  anthropic.messages.create = keep('recommendations', JSON.stringify([{ category: 'habit', content: 'Una frase breve.' }]));
  assert.equal((await request('POST', '/api/recommendations/generate', { role: 'user', id: 101 })).status, 200);
  assert.match(prompts.recommendations, /Average mood \(1-5 scale\): 3\.8/); assert.doesNotMatch(prompts.recommendations, /7\.5/);
  // Sin registros: nada inventado
  models.MoodLog.findAll = async () => [];
  anthropic.messages.create = keep('matching', JSON.stringify([{ therapistId: 303, score: 7, reason: 'Sintético' }]));
  assert.equal((await request('POST', '/api/matching/request', { role: 'user', id: 101, body: { answers: { area: 'sintético' } } })).status, 200);
  assert.match(prompts.matching, /Average mood \(1-5\): No data/);
  anthropic.messages.create = keep('recommendations', JSON.stringify([{ category: 'habit', content: 'Una frase breve.' }]));
  assert.equal((await request('POST', '/api/recommendations/generate', { role: 'user', id: 101 })).status, 200);
  assert.match(prompts.recommendations, /Average mood \(1-5 scale\): No data yet/);
});
