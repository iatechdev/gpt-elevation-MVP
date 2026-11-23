// ES-387 (camino real del chat): el servidor normaliza el mensaje ANTES de evaluar la crisis, y normalizar QUITA los controles e invisibles («me[ZWSP]quiero[ZWSP]morir» -> «mequieromorir»).
// Por eso arreglar solo safety.detectRisk no basta: el chat elige la forma con esos caracteres como ESPACIO si activa el detector (normalizeForRisk), que además es la que se guarda y la que el historial (ES-298) reevalúa.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { detectRisk, normalizeForRisk } = require('../utils/safety');
const { normalizeText } = require('../utils/promptSafety');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';
const A = 102;
const post = (request, body) => request('POST', '/api/chat', { role: 'user', id: A, body });
const c = (...points) => String.fromCharCode(...points);
function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  anthropic.messages.create = async (options) => { calls.push(options); return { content: [{ type: 'text', text: 'Respuesta sintética' }] }; };
  return { state, calls };
}

const CASES = [
  ['me quiero morir', c(0x200B), 'es'], ['no quiero seguir viviendo', c(0xAD), 'es'], ['quiero suicidarme', c(0x2060), 'es'], ['i want to kill myself', c(0xFEFF), 'en'],
  ['me quiero morir', c(0x200D, 0x200E), 'es'], ['i want to kill myself', c(0x202E), 'en'], ['quiero suicidarme', c(0x0B), 'es'], ['no quiero seguir viviendo', c(0x1F), 'es'],
];

test('ES-387 (chat): la frase de crisis con controles o invisibles como espacio INTERRUMPE el turno (sin proveedor) y no viaja en los turnos siguientes (ES/EN)', async (t) => {
  for (const [phrase, separator, lang] of CASES) {
    const message = phrase.split(' ').join(separator);
    assert.equal(detectRisk(normalizeText(message)).level, null, 'sin la corrección, normalizar la esconde: ' + JSON.stringify(message));
    const { state, calls } = setup(); const request = await startApp(t);
    await post(request, { message: 'Hola, quiero hablar de mi carrera' });
    const before = calls.length;
    const crisis = await post(request, { message, lang });
    assert.equal(crisis.body.interrupted, true, `se interrumpe: ${JSON.stringify(message)}`);
    assert.equal(calls.length, before, 'el proveedor NO se llama en el turno de crisis');
    const supportReply = crisis.body.reply;
    for (let i = 0; i < 2; i += 1) await post(request, { message: `Seguimos con la carrera ${i}` });
    const later = calls.slice(before).map((x) => JSON.stringify(x)).join('\n');
    assert.ok(!later.includes(phrase) && !later.includes(phrase.split(' ').join('')), 'la frase no viaja después (ni con espacios ni pegada)');
    assert.ok(!later.includes(supportReply.slice(0, 40)), 'la respuesta de apoyo tampoco');
    assert.ok(later.includes('Hola, quiero hablar de mi carrera'), 'lo ordinario sí viaja');
    assert.ok(state.messages.length >= 2 + 2 + 4, 'nada se borró del historial guardado');
  }
});

test('ES-387 (chat): normalizeForRisk no cambia lo que no es crisis (persa con ZWNJ, emoji compuesto, texto con invisibles) ni lo ya detectable', () => {
  for (const text of [`می${c(0x200C)}خواهم`, `👩${c(0x200D)}💻 hola`, `Hola${c(0x200B)}mundo ${c(0x0B)}normal`, 'Texto llano, sin nada raro.', `Quiero${c(0x200B)}comer${c(0x200B)}mejor`]) {
    assert.equal(normalizeForRisk(text, normalizeText), normalizeText(text), JSON.stringify(text));
  }
  assert.equal(normalizeForRisk('Quiero morir', normalizeText), 'Quiero morir');
  assert.equal(normalizeForRisk(`su${c(0x200B)}icid${c(0x200B)}io`, normalizeText), 'suicidio', 'invisible DENTRO de la palabra: ya se detectaba, se conserva la forma de siempre');
  assert.equal(normalizeForRisk(`me${c(0x200B)}quiero${c(0x200B)}morir`, normalizeText), 'me quiero morir');
  assert.equal(normalizeForRisk(`no${c(0x200B)}aguanto${c(0x200B)}mas`, normalizeText), 'no aguanto mas', 'el nivel medio también');
});
