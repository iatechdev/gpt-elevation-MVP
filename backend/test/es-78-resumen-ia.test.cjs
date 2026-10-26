const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, record, startApp } = require('./support.cjs');

const NAME = 'Nombre Sintetico Paciente';

test('ES-78: el resumen por IA no envía el nombre real ni se presenta como asistente clínico', async t => {
  const wheres = [];
  models.User.findOne = async ({ where, attributes }) => {
    wheres.push({ where, attributes });
    // Solo el terapeuta asignado (101) encuentra al paciente 7; la base simulada también tiene un nombre.
    return where.id === '7' && where.therapistId === 101 && where.role === 'user'
      ? record({ id: 7, name: NAME }) : null;
  };
  models.MoodLog.findAll = async () => [
    record({ checkin_mood: 4, checkout_mood: 5 }), record({ checkin_mood: 3, checkout_mood: 3 }),
  ];
  models.SessionRating.findAll = async () => [record({ rating: 4 })];
  models.ClinicalNote.findAll = async () => [record({ content: 'Nota sintética sin nombre.' })];
  const prompts = [];
  anthropic.messages.create = async options => {
    prompts.push(options);
    return { content: [{ type: 'text', text: 'Resumen sintético.' }] };
  };
  const request = await startApp(t);

  const ok = await request('GET', '/api/therapist/pacientes/7/resumen-ia', { role: 'therapist', id: 101 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.summary, 'Resumen sintético.');
  assert.deepEqual(ok.body.basedOn, { sessions: 2, notes: 1 });
  assert.equal(prompts.length, 1);
  const sent = JSON.stringify(prompts[0]);
  assert.ok(!sent.includes(NAME), 'el nombre del paciente no debe viajar al proveedor');
  assert.doesNotMatch(sent, /clinical assistant|clinical summary|Patient:/i);
  assert.match(sent, /Do not diagnose, prescribe or predict outcomes/);
  assert.match(sent, /Nota sintética sin nombre\./);
  assert.deepEqual(wheres[0].attributes, ['id']); // ni siquiera se carga el nombre
});

test('ES-78: terapeuta no asignado o paciente ajeno siguen recibiendo 404 sin llamar al proveedor', async t => {
  models.User.findOne = async ({ where }) =>
    where.therapistId === 101 && where.id === '7' ? record({ id: 7 }) : null;
  models.MoodLog.findAll = async () => [];
  models.SessionRating.findAll = async () => [];
  models.ClinicalNote.findAll = async () => [];
  let calls = 0;
  anthropic.messages.create = async () => { calls++; return { content: [{ type: 'text', text: 'x' }] }; };
  const request = await startApp(t);

  assert.equal((await request('GET', '/api/therapist/pacientes/7/resumen-ia', { role: 'therapist', id: 202 })).status, 404);
  assert.equal((await request('GET', '/api/therapist/pacientes/8/resumen-ia', { role: 'therapist', id: 101 })).status, 404);
  assert.equal((await request('GET', '/api/therapist/pacientes/7/resumen-ia', { role: 'user', id: 7 })).status, 404);
  assert.equal((await request('GET', '/api/therapist/pacientes/7/resumen-ia')).status, 403);
  assert.equal(calls, 0);
});
