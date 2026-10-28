const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { fixture } = require('./es-32-fixture.cjs');
const source = readFileSync(require.resolve('../utils/routeEngine'), 'utf8');
function engine(text) { const context = { module: { exports: {} } }; vm.runInNewContext(text, context, { timeout: 1000 }); return context.module.exports.calculateRoutes; }
const cases = [
  ['mercado', '!constraints.targetMarkets.includes(role.market)', 'false', input => input.constraints.targetMarkets = ['DK'], result => result.routes.length === 0],
  ['idioma', 'knownLanguages.some(language => !constraints.languages.includes(language))', 'false', input => input.constraints.languages = ['fr'], result => result.routes.length === 0],
  ['modalidad', '!knownModalities.some(modality => constraints.modalities.includes(modality))', 'false', input => input.constraints.modalities = ['onsite'], result => result.routes.length === 0],
  ['regulación', "constraints.acceptRegulated === 'no'", 'false', input => { input.constraints.acceptRegulated = 'no'; input.catalog.roles.forEach(role => role.regulated.isRegulated = true); }, result => result.routes.length === 0],
  ['vigencia de evidencia', '!value.stale', 'true', input => input.map.skills[0].self.stale = true, result => !result.routes.some(route => route.slot === 'adjacency')],
  ['no duplicar rol', '!used.has(candidate.route.roleKey)', 'true', input => { input.catalog.roles = [input.catalog.roles[0]]; input.constraints.preferredModalities = ['remote']; }, result => result.routes.length === 1],
];
for (const [name, before, after, prepare, condition] of cases) test(`ES-32 mutación detectada: ${name}`, () => {
  assert.ok(source.includes(before)); const input = fixture(); prepare(input);
  assert.ok(condition(engine(source)(input)), 'el control original debe pasar');
  assert.equal(condition(engine(source.replace(before, after))(input)), false, 'el caso debe detectar el control eliminado');
});
test('ES-32: núcleo aislado sin require/red/IA y orquestador sin modelos privados', () => {
  assert.ok(!/\brequire\s*\(|\bfetch\s*\(/.test(source));
  const orchestrator = readFileSync(require.resolve('../utils/routes'), 'utf8');
  assert.ok(!/require\(['"][^'"]*(?:DiaryEntry|message|MoodLog|ChatTurn|anthropic|aiClient|ClinicalNote)/i.test(orchestrator));
  const server = readFileSync(require.resolve('../server'), 'utf8');
  assert.match(server, /app\.use\('\/api\/routes',\s+verificarToken,\s+require\('\.\/routes\/routes'\)\)/);
});
