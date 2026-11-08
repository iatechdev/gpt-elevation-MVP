// ES-205: el prompt que llega al modelo le pide responder en el idioma activo de la persona (o el de su mensaje), en chat y Brújula.
// Proveedor simulado y almacén en memoria: no se llama a Claude. Que el modelo real obedezca NO se verifica aquí (muestra controlada aparte).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { COMPANION_LIMITS } = require('../utils/promptSafety');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';
const post = (request, body, id = 101) => request('POST', '/api/chat', { id, role: 'user', body });

for (const mode of [undefined, 'compass']) {
  test(`ES-205 ${mode ?? 'chat'}: la regla de idioma sigue a «lang», va antes de los límites y no se mezcla con el otro idioma`, async t => {
    install(); const calls = [];
    models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
    anthropic.messages.create = async options => { calls.push(options); return { content: [{ type: 'text', text: 'Synthetic response.' }], stop_reason: 'end_turn' }; };
    const request = await startApp(t);
    for (const [lang, other] of [['es', 'Spanish'], ['en', 'English']]) {
      const res = await post(request, { message: 'Synthetic message', lang, ...(mode ? { mode } : {}) });
      assert.equal(res.status, 200);
      const system = calls.at(-1).system;
      const own = lang === 'es' ? 'Reply in Spanish' : 'Reply in English';
      assert.ok(system.includes(`REPLY LANGUAGE (fixed): ${own}`), `${lang}: falta la regla de idioma`);
      assert.equal(system.includes(lang === 'es' ? 'REPLY LANGUAGE (fixed): Reply in English' : 'REPLY LANGUAGE (fixed): Reply in Spanish'), false, `${lang}: la regla del otro idioma no debe ir`);
      assert.ok(system.indexOf('REPLY LANGUAGE') < system.indexOf('COMPANION LIMITS'), 'la regla va antes de los límites');
      assert.ok(system.trimEnd().endsWith(`${COMPANION_LIMITS}\n---`), 'los límites siguen siendo lo último que lee el modelo');
      assert.ok(system.includes('Never mix both languages'), other);
    }
    // Sin «lang» válido: español por defecto.
    await post(request, { message: 'Synthetic message', lang: 'fr', ...(mode ? { mode } : {}) });
    assert.ok(calls.at(-1).system.includes('REPLY LANGUAGE (fixed): Reply in Spanish'));
  });
}
