// ES-98: el promedio de ánimo que recibe el matching se calcula sobre todos los valores (entrada y salida), no entre el número de registros.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp } = require('./support.cjs');

test('ES-98: matching/request envía el promedio de ánimo correcto y no un valor duplicado', async (t) => {
  models.User.findAll = async () => [record({ id: 303, name: 'Synthetic therapist' })];
  models.MoodLog.findAll = async () => [record({ checkin_mood: 4, checkout_mood: 5 }), record({ checkin_mood: 2, checkout_mood: 3 })];
  models.MatchingRequest.create = async (values) => record({ id: 7, ...values });
  const prompts = [];
  anthropic.messages.create = async (options) => {
    prompts.push(options);
    return { content: [{ type: 'text', text: JSON.stringify([{ therapistId: 303, score: 5, reason: 'Sintético' }]) }] };
  };
  const request = await startApp(t);
  const res = await request('POST', '/api/matching/request', { role: 'user', id: 101, body: { answers: { area: 'sintético' } } });
  assert.equal(res.status, 200);
  const sent = JSON.stringify(prompts[0]);
  assert.match(sent, /Average mood \(1-5\): 3\.5/); // (4 + 5 + 2 + 3) / 4; antes: 14 / 2 = 7.0
  assert.doesNotMatch(sent, /Average mood \(1-5\): 7/);
  assert.match(sent, /Recent sessions: 2/);
});

test('ES-98: sin registros de ánimo el matching dice «No data», no un número', async (t) => {
  models.User.findAll = async () => [record({ id: 303, name: 'Synthetic therapist' })];
  models.MoodLog.findAll = async () => [];
  models.MatchingRequest.create = async (values) => record({ id: 8, ...values });
  const prompts = [];
  anthropic.messages.create = async (options) => {
    prompts.push(options);
    return { content: [{ type: 'text', text: JSON.stringify([{ therapistId: 303, score: 5, reason: 'Sintético' }]) }] };
  };
  const request = await startApp(t);
  assert.equal((await request('POST', '/api/matching/request', { role: 'user', id: 101, body: { answers: { area: 'x' } } })).status, 200);
  assert.match(JSON.stringify(prompts[0]), /Average mood \(1-5\): No data/);
});
