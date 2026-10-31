// ES-125: las recomendaciones se generan en el idioma activo, con el posicionamiento no clínico del producto y sin cortes por max_tokens.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp } = require('./support.cjs');

const user = { role: 'user', id: 101 };
const good = JSON.stringify([{ category: 'habit', content: 'Una frase breve.' }]);

function setup(reply = good, extra = {}) {
  const calls = []; const saved = [];
  models.MoodLog.findAll = async () => [record({ checkin_mood: 4, checkout_mood: 5 }), record({ checkin_mood: 3, checkout_mood: 3 })];
  models.WellnessRecommendation.create = async (values) => { saved.push(values); return record({ id: saved.length, ...values }); };
  anthropic.messages.create = async (body) => { calls.push(body); return { content: [{ type: 'text', text: reply }], usage: { input_tokens: 10, output_tokens: 10 }, ...extra }; };
  return { calls, saved };
}
const promptOf = (calls) => calls[0].messages[0].content;

test('ES-125: el idioma de la interfaz llega al prompt; sin dato o con un valor inválido se usa español', async t => {
  const { calls } = setup(); const request = await startApp(t);
  const cases = [[{ lang: 'es' }, 'Spanish'], [{ lang: 'en' }, 'English'], [{ lang: 'en-US' }, 'English'], [{ lang: 'ES_co' }, 'Spanish'],
    [{}, 'Spanish'], [undefined, 'Spanish'], [{ lang: 'fr' }, 'Spanish'], [{ lang: 7 }, 'Spanish'], [{ lang: ['en'] }, 'Spanish'], [{ lang: '"; DROP' }, 'Spanish']];
  for (const [body, expected] of cases) {
    calls.length = 0;
    const response = await request('POST', '/api/recommendations/generate', { ...user, body });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.match(promptOf(calls), new RegExp(`Write every "content" value in ${expected}`), JSON.stringify(body));
  }
});

test('ES-125: el prompt es no clínico, no usa voseo y no promete ni diagnostica; el promedio sigue sobre los valores registrados', async t => {
  const { calls } = setup(); const request = await startApp(t);
  await request('POST', '/api/recommendations/generate', { ...user, body: { lang: 'es' } });
  const prompt = promptOf(calls);
  assert.doesNotMatch(prompt, /mental health platform|wellness coach/i);
  assert.match(prompt, /non-clinical/); assert.match(prompt, /not a clinical, health or emergency service/);
  assert.ok(prompt.includes('informal "tú" form (tuteo)'));
  assert.match(prompt, /Never diagnose, prescribe, give medical advice or promise/);
  assert.match(prompt, /Average mood \(1-5 scale\): 3\.8/);
  assert.match(prompt, /Keep the "category" values exactly as listed/);
});

test('ES-125: tope de tokens con margen y esfuerzo bajo, igual que el chat', async t => {
  const { calls } = setup(); const request = await startApp(t);
  await request('POST', '/api/recommendations/generate', { ...user, body: { lang: 'en' } });
  assert.equal(calls[0].max_tokens, 1200);
  assert.deepEqual(calls[0].output_config, { effort: 'low' });
});

test('ES-125: una salida cortada por max_tokens se rechaza (502 reintentable) y no guarda nada, aunque el texto parcial parezca válido', async t => {
  const { saved } = setup(good, { stop_reason: 'max_tokens' }); const request = await startApp(t);
  const response = await request('POST', '/api/recommendations/generate', { ...user, body: { lang: 'es' } });
  assert.equal(response.status, 502); assert.equal(response.body.code, 'invalid_model_output'); assert.equal(response.body.retryable, true);
  assert.equal(saved.length, 0);
});

test('ES-125: una salida completa (end_turn) se guarda y se devuelve igual que antes', async t => {
  const { saved } = setup(good, { stop_reason: 'end_turn' }); const request = await startApp(t);
  const response = await request('POST', '/api/recommendations/generate', { ...user, body: { lang: 'es' } });
  assert.equal(response.status, 200); assert.equal(saved.length, 1);
  assert.equal(response.body[0].content, 'Una frase breve.'); assert.equal(response.body[0].category, 'habit');
});
