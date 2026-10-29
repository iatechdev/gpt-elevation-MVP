const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const rules = require('../utils/careerPlanRules');
const { context, route, proposalInput, decided, selections } = require('./es-33-fixture.cjs');
const code = (fn, expected) => assert.throws(fn, error => error.code === expected);
const plan = () => rules.proposePlan(decided(), 5, context(), route().resources);
test('ES-33 plantilla bilingüe neutral, costo desconocido y rúbrica sin acreditación', () => {
  const p = rules.experimentProposal(proposalInput());
  for (const value of Object.values(p.content)) assert.ok(value.es && value.en);
  assert.equal(p.cost.status, 'unknown'); assert.equal(p.rubric.status, 'not_domain_validated'); assert.equal(p.lifecycle, 'ready');
  p.content.title.es = 'CHANGED'; assert.notEqual(rules.experimentProposal(proposalInput()).content.title.es, 'CHANGED');
});
test('ES-33 tiempo inicial 20/30/45; cero disponibilidad y datos faltantes no crean plan', () => {
  for (const minutes of [20, 30, 45]) assert.equal(rules.experimentProposal({ ...proposalInput(), minutes }).minutes, minutes);
  for (const minutes of [0, 10, 46, 20.5]) code(() => rules.experimentProposal({ ...proposalInput(), minutes }), 'invalid_input');
  code(() => rules.experimentProposal({ ...proposalInput(), context: { ...context(), weeklyMinutes: 0 } }), 'needs_scope_reduction');
  code(() => rules.contextSnapshot({ ...context(), timeZone: null }), 'needs_availability');
});
test('ES-33 tarea regulada exige plantilla revisada; índice ajeno no elige tarea inventada', () => {
  code(() => rules.experimentProposal({ ...proposalInput(), route: { ...route(), regulated: { isRegulated: true } } }), 'needs_safe_template');
  code(() => rules.experimentProposal({ ...proposalInput(), taskIndex: 4 }), 'invalid_input');
});
test('ES-33 estados: entregar antes de iniciar y decidir sin reflexión se rechazan', () => {
  const p = rules.experimentProposal(proposalInput());
  code(() => rules.changeExperiment(p, { action: 'submit', sample: 'x', assistance: 'none' }), 'transition_not_allowed');
  code(() => rules.changeExperiment(p, { action: 'decide', decision: 'continue', reason: 'x' }), 'transition_not_allowed');
  code(() => rules.changeExperiment(p, { action: 'start', UserId: 4 }), 'invalid_input');
});
test('ES-33 reflexión propia mantiene observación, interpretación y ayuda declarada separadas', () => {
  const value = decided(); assert.equal(value.lifecycle, 'decided'); assert.equal(value.reflection.source, 'self_report');
  assert.notEqual(value.reflection.observation, value.reflection.interpretation);
  assert.equal(value.submission.assistance.degree, 'drafting'); assert.equal(value.submission.assistance.source, 'self_report');
  assert.ok(!JSON.stringify(value).includes('human_reviewed'));
});
test('ES-33 nueva entrega retira reflexión/decisión anterior; checkbox no es evidencia', () => {
  const next = rules.changeExperiment(decided(), { action: 'submit', sample: 'new sample', assistance: 'unknown', evidenceRefs: [] });
  assert.equal(next.lifecycle, 'submitted'); assert.equal(next.decision, undefined); assert.equal(next.reflection, undefined);
  code(() => rules.changeExperiment(next, { action: 'submit', sample: true, assistance: 'none' }), 'invalid_input');
  code(() => rules.changeExperiment(next, { action: 'submit', assistance: 'none', evidenceRefs: [] }), 'invalid_input');
});
test('ES-33 referencias cerradas y sin duplicados; ayuda nunca se infiere', () => {
  code(() => rules.refs([{ evidenceId: 1, version: 1, UserId: 2 }]), 'invalid_input');
  code(() => rules.refs([{ evidenceId: 1, version: 1 }, { evidenceId: 1, version: 2 }]), 'invalid_input');
  code(() => rules.changeExperiment(decided(), { action: 'submit', sample: 'sample', assistance: 'autonomous' }), 'invalid_input');
});
test('ES-33 plan propuesto 7/30/90 no contiene acciones aceptadas ni fechas inventadas', () => {
  const value = plan(); assert.equal(value.status, 'proposed'); assert.deepEqual(value.actions.map(a => a.horizonDays), [7, 30, 90]);
  assert.ok(value.actions.every(a => a.accepted === false && a.chosenDate === null && a.completionEvidence.actual === null));
  const paused = decided(); paused.decision.value = 'pause'; code(() => rules.proposePlan(paused, 5, context(), []), 'transition_not_allowed');
});
test('ES-33 aceptar conserva fechas explícitas, dependencia y suma semanal', () => {
  const p = plan(), before = JSON.stringify(p); const accepted = rules.acceptPlan(p, selections());
  assert.equal(accepted.status, 'accepted'); assert.equal(JSON.stringify(p), before); assert.ok(accepted.actions.every(a => a.accepted));
  const insufficient = plan(); insufficient.availability.weeklyMinutes = 20;
  const sameWeek = selections().map(item => ({ ...item, chosenDate: '2026-11-03' }));
  code(() => rules.acceptPlan(insufficient, sameWeek), 'needs_scope_reduction');
});
test('ES-33 ciclos/dependencia ausente o posterior no crean plan', () => {
  code(() => rules.acceptPlan(plan(), selections().slice(1)), 'invalid_dependencies');
  const reverse = selections(); reverse[0].chosenDate = '2027-02-01'; code(() => rules.acceptPlan(plan(), reverse), 'invalid_dependencies');
  const cycle = plan(); cycle.actions[0].dependencies = ['step_90']; const sameDay = selections().map(s => ({ ...s, chosenDate: '2026-11-03' }));
  code(() => rules.acceptPlan(cycle, sameDay), 'invalid_dependencies');
});
test('ES-33 curso no cuenta dos veces; duración desconocida requiere confirmar', () => {
  const p = plan(), chosen = selections(); chosen[0].resourceRefs = ['synthetic_reading'];
  const a = rules.acceptPlan(p, chosen); assert.equal(a.actions[0].estimatedMinutes, 20);
  p.resources[0].duration = {}; code(() => rules.acceptPlan(p, chosen), 'resource_time_unknown');
});
test('ES-33 actividades posteriores pueden superar 45 minutos si caben en disponibilidad', () => {
  const p = plan(); p.availability.weeklyMinutes = 120; p.resources[0].duration.minutes = 90;
  const chosen = selections(); chosen[1].resourceRefs = ['synthetic_reading']; chosen[1].estimatedMinutes = 90;
  assert.equal(rules.acceptPlan(p, chosen).actions[1].estimatedMinutes, 90);
  p.availability.weeklyMinutes = 60; code(() => rules.acceptPlan(p, chosen), 'needs_scope_reduction');
});
test('ES-33 presupuesto no convierte precio desconocido en cero ni aplica cambio de divisa', () => {
  const p = rules.proposePlan(decided(), 5, context(), route().resources, { amount: 20, currency: 'USD' });
  code(() => rules.acceptPlan(p, selections()), 'needs_cost_confirmation');
  const chosen = selections().map(s => ({ ...s, declaredCost: { amount: 5, currency: 'USD' } }));
  assert.equal(rules.acceptPlan(p, chosen).actions[0].cost.source, 'self_report');
  chosen[0].resourceRefs = ['synthetic_reading']; code(() => rules.acceptPlan(p, chosen), 'needs_cost_confirmation');
  chosen[0].resourceRefs = []; chosen[0].declaredCost.currency = 'COP'; code(() => rules.acceptPlan(p, chosen), 'needs_cost_confirmation');
  chosen[0].declaredCost = { amount: 30, currency: 'USD' }; code(() => rules.acceptPlan(p, chosen), 'budget_exceeded');
});
test('ES-33 fecha válida y zona elegida: UTC, Bogotá, Dinamarca; no asume zona del host', () => {
  assert.equal(rules.localInstant('2026-11-03T09:00', 'America/Bogota'), '2026-11-03T14:00:00.000Z');
  assert.equal(rules.localInstant('2026-11-03T09:00', 'Europe/Copenhagen'), '2026-11-03T08:00:00.000Z');
  assert.equal(rules.localInstant('2026-11-03T09:00', 'UTC'), '2026-11-03T09:00:00.000Z');
  code(() => rules.localInstant('2026-02-30T09:00', 'UTC'), 'invalid_input');
});
test('ES-33 horario estacional: hora inexistente/ambigua se rechaza', () => {
  code(() => rules.localInstant('2026-03-29T02:30', 'Europe/Copenhagen'), 'ambiguous_local_time');
  code(() => rules.localInstant('2026-10-25T02:30', 'Europe/Copenhagen'), 'ambiguous_local_time');
});
test('ES-33 frontera: reglas sin require/red; orquestador sin modelos privados ni proveedor', () => {
  const source = readFileSync(require.resolve('../utils/careerPlanRules'), 'utf8'); assert.ok(!/\brequire\s*\(|\bfetch\s*\(/.test(source));
  const service = readFileSync(require.resolve('../utils/careerPlan'), 'utf8'); assert.ok(!/require\(['"][^'"]*(?:DiaryEntry|message|MoodLog|ChatTurn|anthropic|aiClient|ClinicalNote)/i.test(service));
});
for (const [name, before, after, check] of [
  ['tiempo mínimo', '![20, 30, 45].includes(minutes)', 'false', api => api.experimentProposal({ ...proposalInput(), minutes: 10 })],
  ['capacidad semanal', '[...byWeek.values()].some(minutes => minutes > proposed.availability.weeklyMinutes)', 'false', api => { const p = plan(); p.availability.weeklyMinutes = 20; return api.acceptPlan(p, selections().map(s => ({ ...s, chosenDate: '2026-11-03' }))); }],
]) test(`ES-33 mutación detectada: ${name}`, () => {
  const source = readFileSync(require.resolve('../utils/careerPlanRules'), 'utf8'); assert.ok(source.includes(before));
  assert.throws(() => check(rules));
  const context = { module: { exports: {} }, structuredClone }; vm.runInNewContext(source.replace(before, after), context);
  assert.doesNotThrow(() => check(context.module.exports));
});
