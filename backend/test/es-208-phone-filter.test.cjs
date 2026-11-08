// ES-208 (QA-145-01): el servidor sustituye cualquier respuesta del modelo que traiga un teléfono o una línea de ayuda.
// Proveedor simulado y almacén en memoria (sin red ni datos reales).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { containsPhoneNumber } = require('../utils/promptSafety');
const { PHONE_FILTER_REPLY } = require('../utils/companionTone');
const { desencriptar } = require('../utils/crypto');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';
const A = { role: 'user', id: 101 };
const post = (request, body) => request('POST', '/api/chat', { ...A, body });

function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  const provider = { reply: 'Respuesta limpia.' };
  anthropic.messages.create = async options => { calls.push(options); return { content: [{ type: 'text', text: provider.reply }], stop_reason: 'end_turn' }; };
  return { state, calls, provider };
}

const PHONES = [
  'Llama a la línea 106 o al 024 ahora.', 'Call 988 if you are in danger.', 'Marca 123 si es urgente.',
  'Escríbeles al +57 300 123 4567.', 'Call (601) 555-1234.', 'Line: 1-800-273-8255.', 'Helpline 141.', 'Número 192.', 'Su celular es 300.123.4567.',
];
const CLEAN = [
  'Esto lo hice en 2021 durante 3 meses.', 'Subí las ventas un 15 % en 40 días.', 'Mi reunión es el 2026-11-08 a las 10.',
  'La fecha límite es 08/11/2026.', 'El sueldo era de $1.500.000 al mes.', 'Cobraba 1.500.000 pesos mensuales y 2.000 dólares extra.',
  'I worked there from 2019 to 2023, about 4 years.', 'Contacta a los servicios de emergencia o de salud de tu país y a alguien de confianza.',
];

test('ES-208 detector: teléfonos en varios formatos ES/EN se detectan; años, precios, fechas y «3 meses» no', () => {
  for (const text of PHONES) assert.equal(containsPhoneNumber(text), true, text);
  for (const text of CLEAN) assert.equal(containsPhoneNumber(text), false, text);
});

test('ES-208 texto fijo: ES y EN, sin números y no clínico', () => {
  for (const lang of ['es', 'en']) {
    const text = PHONE_FILTER_REPLY[lang];
    assert.ok(text.length > 40);
    assert.equal(containsPhoneNumber(text), false);
    assert.equal(/\d/.test(text), false);
  }
});

for (const mode of [undefined, 'compass']) {
  test(`ES-208 ${mode ?? 'chat'}: respuesta con teléfono se sustituye, no se guarda ni se registra, sin reintento`, async t => {
    const { state, calls, provider } = setup();
    const warnings = []; const originalWarn = console.warn;
    console.warn = (...args) => { warnings.push(args); };
    t.after(() => { console.warn = originalWarn; });
    const request = await startApp(t);
    for (const [index, lang] of ['es', 'en'].entries()) {
      provider.reply = 'Llama a la línea 106 o al 024 ahora.';
      const requestId = `phone-${mode ?? 'chat'}-${lang}-0001`;
      const res = await post(request, { message: `Synthetic message ${index}`, lang, requestId, ...(mode ? { mode } : {}) });
      assert.equal(res.status, 200);
      assert.equal(res.body.reply, PHONE_FILTER_REPLY[lang]);
      assert.equal(res.body.truncated, undefined);
      // El reintento con el mismo requestId devuelve el texto fijo guardado, sin otra llamada al modelo.
      const replay = await post(request, { message: `Synthetic message ${index}`, lang, requestId, ...(mode ? { mode } : {}) });
      assert.equal(replay.body.reply, PHONE_FILTER_REPLY[lang]);
    }
    assert.equal(calls.length, 2, 'una llamada por solicitud: no se reintenta el modelo');
    const stored = state.messages.map(m => desencriptar(m.content));
    assert.equal(stored.filter(text => /106|024/.test(text)).length, 0, 'la respuesta original no se guarda');
    assert.ok(stored.includes(PHONE_FILTER_REPLY.es) && stored.includes(PHONE_FILTER_REPLY.en));
    assert.ok(warnings.length >= 2, 'queda un evento por respuesta filtrada');
    assert.equal(/106|024|línea/i.test(JSON.stringify(warnings)), false, 'el registro no lleva el texto del modelo');
  });
}

test('ES-208: una respuesta limpia (años, precios, fechas, «3 meses») pasa intacta', async t => {
  const { calls, provider } = setup();
  const request = await startApp(t);
  for (const text of CLEAN) {
    provider.reply = text;
    const res = await post(request, { message: 'Synthetic message' });
    assert.equal(res.status, 200);
    assert.equal(res.body.reply, text);
  }
  assert.equal(calls.length, CLEAN.length);
});

test('ES-208: sin sesión no hay respuesta y el filtro no cambia el control de acceso', async t => {
  setup();
  const request = await startApp(t);
  const res = await request('POST', '/api/chat', { body: { message: 'Synthetic message' } });
  assert.ok([401, 403].includes(res.status));
});
