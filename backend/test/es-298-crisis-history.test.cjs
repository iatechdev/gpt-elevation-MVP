// ES-298 (E281-1): la frase de crisis y la respuesta de apoyo NO viajan al proveedor de IA en los mensajes siguientes; el historial visible no cambia; sin persistir el indicador.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { detectRisk } = require('../utils/safety');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';
const A = 101;
const as = () => ({ role: 'user', id: A });
const post = (request, body) => request('POST', '/api/chat', { ...as(), body });

function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  anthropic.messages.create = async (options) => { calls.push(options); return { content: [{ type: 'text', text: 'Respuesta sintética' }] }; };
  return { state, calls };
}
const sentText = (calls) => calls.map((c) => JSON.stringify(c)).join('\n');

// Frases de la lista existente: ES/EN, con acentos, caracteres invisibles, mayúsculas y sinónimos.
const CRISIS = [['Quiero morir', 'es'], ['ya no quiero vivir más', 'es'], ['estoy pensando en suicidarme', 'es'], ['Quisiera quitarme la vida', 'es'], ['su​icid​io', 'es'], ['NO VALE LA PENA VIVIR', 'es'], ['mejor me desaparezco', 'es'],
  ['I want to kill myself', 'en'], ["I don't want to be alive", 'en'], ['thinking about ending my life', 'en'], ['everyone is better off dead without me', 'en'], ["better if I wasn't here", 'en']];

test('ES-298: ninguna frase de crisis ni la respuesta de apoyo aparece en las peticiones POSTERIORES al proveedor (ES/EN, unicode, sinónimos); el historial guardado conserva ambos', async (t) => {
  for (const [phrase, lang] of CRISIS) {
    assert.equal(detectRisk(phrase).level, 'high', 'la frase es de la lista: ' + phrase);
    const { state, calls } = setup(); const request = await startApp(t);
    await post(request, { message: 'Hola, quiero hablar de mi carrera' });
    const crisis = await post(request, { message: phrase, lang });
    assert.equal(crisis.body.interrupted, true, phrase); const supportReply = crisis.body.reply;
    const before = calls.length;
    for (let i = 0; i < 3; i++) await post(request, { message: `Seguimos con la carrera ${i}` });
    const later = calls.slice(before); assert.equal(later.length, 3);
    const text = sentText(later);
    assert.ok(!text.includes(phrase) && !text.includes(phrase.replace(/​/g, '')), 'la frase no viaja: ' + phrase);
    assert.ok(!text.includes(supportReply.slice(0, 40)), 'la respuesta de apoyo tampoco');
    assert.ok(later.every((c) => c.messages.at(0).role === 'user'), 'el historial enviado empieza por la persona');
    assert.ok(text.includes('Hola, quiero hablar de mi carrera'), 'lo ordinario sí viaja');
    assert.ok(state.messages.length >= 2 + 2 + 6, 'nada se borró del historial guardado (' + state.messages.length + ')');
  }
});

test('ES-298: el malestar (nivel medio) sigue siendo un turno ordinario y viaja', async (t) => {
  const { calls } = setup(); const request = await startApp(t);
  await post(request, { message: 'ya no aguanto más con este trabajo' });
  await post(request, { message: 'sigamos' });
  assert.ok(sentText(calls.slice(1)).includes('ya no aguanto más con este trabajo'), 'el nivel medio no se omite');
  assert.deepEqual(calls[1].messages.map((m) => m.role), ['user', 'assistant', 'user']);
});

test('ES-298: una crisis EN MEDIO se omite con su respuesta y el orden del resto se conserva; una frase de crisis sin respuesta guardada omite solo la frase', async (t) => {
  const { state, calls } = setup(); const request = await startApp(t);
  await post(request, { message: 'primer tema' }); await post(request, { message: 'Quiero morir' }); await post(request, { message: 'tercer tema' });
  await post(request, { message: 'cuarto tema' });
  const last = calls.at(-1).messages;
  assert.deepEqual(last.filter((m) => m.role === 'user').map((m) => m.content), ['primer tema', 'tercer tema', 'cuarto tema']);
  assert.ok(!JSON.stringify(last).includes('Quiero morir'));
  const { encriptar } = require('../utils/crypto');
  state.messages.push({ id: 9001, UserId: A, role: 'user', content: encriptar('I want to kill myself'), createdAt: new Date(Date.now() + 1), updatedAt: new Date() });
  await post(request, { message: 'quinto tema' });
  assert.ok(!JSON.stringify(calls.at(-1).messages).includes('kill myself'));
});

test('ES-298: el indicador de riesgo no se persiste ni se registra y el contrato de la API no cambia', async (t) => {
  const { state } = setup(); const request = await startApp(t);
  const crisis = await post(request, { message: 'Quiero morir' });
  assert.deepEqual(Object.keys(crisis.body).sort(), ['interrupted', 'reply']);
  const next = await post(request, { message: 'seguimos' });
  assert.deepEqual(Object.keys(next.body).sort(), ['reply']);
  assert.ok(state.messages.every((m) => Object.keys(m).every((k) => !/risk|crisis|level|safety/i.test(k))), 'ninguna columna de riesgo');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'chat.js'), 'utf8');
  assert.match(source, /interrumpidos/); assert.match(source, /detectRisk\(m\.text\)\.level === 'high'/);
  assert.ok(!/console\.(log|warn|error)\([^)]*detectRisk/.test(source), 'el nivel no se registra');
});
