// ES-145 (ES43-QA-03): el chat no entrega teléfonos ni líneas de ayuda sin verificar. Proveedor simulado y almacén en memoria (sin red ni datos reales).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { COMPANION_LIMITS, containsPhoneNumber } = require('../utils/promptSafety');
const { COMPASS_KEY, COMPASS_RULES, defaultPrompt, composeCompassPrompt } = require('../utils/compassGuide');
const { buildSafetyReply, buildSupportNote } = require('../utils/safety');
const { PAUSE_REPLY } = require('../utils/companionTone');

const vault = { [COMPASS_KEY]: null, elevation_system_prompt: 'Synthetic default prompt' };
promptVault.getActivePrompt = async key => vault[key] ?? null;

const post = (request, body, id = 101) => request('POST', '/api/chat', { id, role: 'user', body });

test('ES-145: el detector reconoce teléfonos y líneas de ayuda, y no confunde años ni cantidades', () => {
  for (const text of [
    'Llama a la línea 106 ahora', 'Call 988 if you are in danger', 'Marca 123', 'Escríbeles al +57 300 123 4567',
    'Call (601) 555-1234', 'Line: 1-800-273-8255', 'Helpline 141', 'Número 192',
  ]) assert.equal(containsPhoneNumber(text), true, text);
  for (const text of [
    'Synthetic response.', 'Esto lo hice en 2021 durante 3 meses.', 'Subí las ventas un 15 % en 40 días.',
    'Contacta a los servicios de emergencia o de salud de tu país y a alguien de confianza.',
  ]) assert.equal(containsPhoneNumber(text), false, text);
});

test('ES-145: ningún prompt fijo ni respuesta de seguridad trae teléfonos, y se prohíbe darlos', () => {
  const fixed = {
    COMPANION_LIMITS, COMPASS_RULES, defaultPromptEs: defaultPrompt('es'), defaultPromptEn: defaultPrompt('en'),
    compassEs: composeCompassPrompt({ vaultPrompt: null, manifest: null, lang: 'es' }),
    compassEn: composeCompassPrompt({ vaultPrompt: null, manifest: null, lang: 'en' }),
    pauseEs: PAUSE_REPLY.es, pauseEn: PAUSE_REPLY.en,
  };
  for (const lang of ['es', 'en']) {
    // Sin país verificado (el registro sale vacío): solo el aviso general.
    for (const country of [null, 'CO', 'US']) {
      fixed[`safety-${lang}-${country}`] = buildSafetyReply({ lang, country });
      fixed[`note-${lang}-${country}`] = buildSupportNote({ lang, country });
    }
  }
  for (const [name, text] of Object.entries(fixed)) assert.equal(containsPhoneNumber(text), false, `${name}: ${text}`);
  assert.match(COMPANION_LIMITS, /Never give phone numbers, helpline names or lists of resources/);
});

test('ES-145: el prompt que llega al modelo lleva la regla al final y la respuesta no trae teléfonos', async t => {
  install(); const calls = [];
  models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
  anthropic.messages.create = async options => { calls.push(options); return { content: [{ type: 'text', text: 'Synthetic response.' }] }; };
  const request = await startApp(t);
  for (const mode of [undefined, 'compass']) {
    const res = await post(request, { message: 'Synthetic message', ...(mode ? { mode } : {}) });
    assert.equal(res.status, 200);
    assert.equal(containsPhoneNumber(res.body.reply), false);
  }
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(containsPhoneNumber(call.system), false, 'el prompt enviado al modelo no debe traer teléfonos');
    assert.ok(call.system.trimEnd().endsWith(`${COMPANION_LIMITS}\n---`));
  }
});
