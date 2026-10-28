const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateRoutes } = require('../utils/routeEngine');
const { fixture } = require('./es-32-fixture.cjs');

test('ES-32: tres casillas justificadas, dimensiones separadas y sin programación por defecto', () => {
  const input = fixture(); const result = calculateRoutes(input);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.routes.map(r => r.slot), ['continuity', 'adjacency', 'exploration']);
  assert.deepEqual(result.routes.map(r => r.roleKey), ['teacher', 'operations', 'finance']);
  assert.equal(result.routes[2].dimensions.demonstratedTransfer.status, 'none_yet');
  assert.ok(result.routes[2].uncertainties.some(i => i.code === 'insufficient_transfer'));
  assert.equal(Object.keys(result.routes[0].dimensions).length, 3);
  assert.ok(!JSON.stringify(result).includes('CANARY_PRIVATE'));
  assert.ok(!JSON.stringify(result).includes('employability'));
});
test('ES-32: mercado ausente no se infiere de idioma/residencia/profesión', () => {
  const input = fixture(); input.constraints = null;
  assert.equal(calculateRoutes(input).status, 'needs_constraints');
});
for (const [filter, mutate] of [
  ['market', input => input.constraints.targetMarkets = ['DK']],
  ['language', input => input.constraints.languages = ['fr']],
  ['modality', input => input.constraints.modalities = ['onsite']],
  ['regulated', input => { input.constraints.acceptRegulated = 'no'; input.catalog.roles.forEach(r => r.regulated.isRegulated = true); }],
]) test(`ES-32: filtro duro ${filter} excluye antes de clasificación`, () => {
  const input = fixture(); mutate(input); const result = calculateRoutes(input);
  assert.equal(result.status, 'no_pertinent_catalog'); assert.equal(result.discarded[filter], 3); assert.equal(result.humanReview.offered, true);
});
test('ES-32: desconocidos no coinciden ni se descartan como incumplimiento conocido', () => {
  const input = fixture(); input.catalog.roles.forEach(r => { r.languagesRequired = ['unknown']; r.modality = ['unknown']; });
  input.constraints.languages = []; input.constraints.modalities = [];
  const result = calculateRoutes(input); assert.equal(result.routes.length, 3);
  assert.deepEqual(result.clarifications.map(i => i.code), ['languages', 'modalities']);
  assert.ok(result.routes.every(r => ['language_unknown', 'modality_unknown', 'languages', 'modalities'].every(code => r.uncertainties.some(i => i.code === code))));
});
test('ES-32: idioma conocido incompatible no se oculta por una segunda entrada unknown', () => {
  const input = fixture(); input.constraints.languages = ['fr']; input.catalog.roles.forEach(r => r.languagesRequired = ['en', 'unknown']);
  assert.equal(calculateRoutes(input).discarded.language, 3);
});
test('ES-32: sin evidencia, nivel null, stale, contradictorio, rúbrica antigua o cero citas no generan adyacencia', () => {
  for (const change of [s => s.self = null, s => s.self.level = null, s => s.self.stale = true, s => s.self.needsReview = true,
    s => s.self.state = 'contradictory', s => s.self.catalogOutdated = true, s => s.self.evidenceCount = 0]) {
    const input = fixture(); change(input.map.skills[0]);
    const result = calculateRoutes(input); assert.ok(!result.routes.some(r => r.slot === 'adjacency'));
    assert.ok(result.routes.every(r => r.roleKey !== 'operations'));
  }
});
test('ES-32: revisión y autorreporte conservan sus pistas y no suman niveles', () => {
  const input = fixture(); input.map.skills[0].review = { ...input.map.skills[0].self, level: 1 };
  const capability = calculateRoutes(input).routes[0].dimensions.demonstratedTransfer.capabilities[0];
  assert.deepEqual(capability.tracks.map(t => [t.track, t.level]), [['self', 3], ['review', 1]]);
});
test('ES-32: skillMissing no cuenta como transferencia; brecha bilingüe sin nivel inventado', () => {
  const input = fixture(); input.map.skills = [];
  const capability = calculateRoutes(input).routes[0].dimensions.demonstratedTransfer.capabilities[0];
  assert.equal(capability.skillMissing, true); assert.deepEqual(capability.tracks, []); assert.ok(capability.text.es && capability.text.en);
});
test('ES-32: no rellena tres rutas ni duplica un rol para rellenar casillas', () => {
  const input = fixture(); input.catalog.roles = [input.catalog.roles[0]];
  const result = calculateRoutes(input); assert.equal(result.status, 'partial'); assert.equal(result.routes.length, 1);
});
test('ES-32: sin contexto origen ni transferencia ni intereses no recomienda por similitud suelta', () => {
  const input = fixture(); input.constraints.originContextKey = null; input.constraints.interestContextKeys = []; input.constraints.preferredModalities = []; input.map.skills = [];
  assert.equal(calculateRoutes(input).status, 'no_pertinent_catalog');
});
test('ES-32: profesiones reguladas siempre pendientes, incluso aceptadas y con idioma del mercado', () => {
  for (const accepted of ['yes', 'unknown']) {
    const input = fixture(); input.catalog.roles[0].regulated = { isRegulated: true, note: { es: 'Verificar', en: 'Verify' }, sourceKey: 'source' };
    input.constraints.acceptRegulated = accepted;
    const route = calculateRoutes(input).routes[0]; assert.equal(route.regulated.status, 'pending'); assert.ok(route.verificationTask);
    assert.ok(!JSON.stringify(route).includes('eligible'));
  }
});
test('ES-32: fuente antigua y oferta vencida nunca se convierten en confirmación actual', () => {
  const input = fixture(); input.catalog.sources[0].stale = true;
  input.catalog.offers = [{ offerKey: 'expired', roleKey: 'teacher', salary: { published: false }, status: 'expired' }];
  const route = calculateRoutes(input).routes[0]; assert.equal(route.dimensions.viability.status, 'unclear'); assert.ok(route.sources[0].stale);
  assert.equal(route.offers[0].status, 'expired'); assert.deepEqual(route.offers[0].salary, { published: false }); assert.ok(route.verificationTask);
  assert.equal(route.opportunityType, 'occupational');
});
test('ES-32: fuentes autorizadas ausentes no autorizan rutas y los recursos solo atienden brechas', () => {
  const input = fixture(); input.catalog.roles[0].sourceKeys = ['missing'];
  assert.ok(!calculateRoutes(input).routes.some(r => r.roleKey === 'teacher'));
  input.catalog.roles[0].sourceKeys = ['source'];
  input.catalog.resources = [{ resourceKey: 'practice', roleKeys: ['teacher'], linkedSkillKey: 'analysis' }, { resourceKey: 'irrelevant', roleKeys: ['teacher'], linkedSkillKey: 'communication' }];
  input.catalog.roles[0].capabilities.push({ skillKey: 'analysis', importance: 'essential' });
  assert.deepEqual(calculateRoutes(input).routes[0].resources.map(r => r.resourceKey), ['practice']);
});
test('ES-32: orden estable por fundamento, fecha y clave; entradas permanecen intactas', () => {
  const input = fixture(); const before = JSON.stringify(input);
  const first = calculateRoutes(input); assert.equal(JSON.stringify(input), before);
  input.catalog.roles.reverse(); assert.deepEqual(calculateRoutes(input), first);
});
test('ES-32: una capacidad repetida en el catálogo no multiplica la transferencia', () => {
  const input = fixture(); input.catalog.roles[0].capabilities.push({ skillKey: 'communication', importance: 'essential' });
  assert.equal(calculateRoutes(input).routes[0].dimensions.demonstratedTransfer.capabilities.length, 1);
});
test('ES-32: docente y contadora no reciben programación por defecto aunque exista en el catálogo', () => {
  for (const context of ['education', 'finance']) {
    const input = fixture(); input.constraints.originContextKey = context;
    input.catalog.roles.push({ ...structuredClone(input.catalog.roles[0]), roleKey: 'programming', contexts: ['software'], capabilities: [{ skillKey: 'coding', importance: 'essential' }] });
    const result = calculateRoutes(input); assert.ok(!result.routes.some(route => route.roleKey === 'programming'));
    assert.equal(result.routes[0].roleKey, context === 'education' ? 'teacher' : 'finance');
  }
});
