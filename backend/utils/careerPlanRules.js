// ES-33: reglas puras, sin red, IA, ORM ni datos del espacio privado.
const words = (es, en) => ({ es, en });
const TEMPLATE_VERSION = 1;
const TEMPLATE = Object.freeze({
  title: words('Muestra breve de una tarea, con datos ficticios', 'Short task sample using fictitious data'),
  question: words('¿Qué puedo aprender al probar esta tarea y explicar mis decisiones?', 'What can I learn by trying this task and explaining my decisions?'),
  initialTask: words('Elige una tarea de la ficha. Prepara un ejemplo pequeño con datos ficticios y anota qué hiciste, qué verificaste y qué ayuda utilizaste.', 'Choose a task from the role card. Prepare a small example with fictitious data and record what you did, what you checked, and what help you used.'),
  expectedEvidence: words('Una muestra breve o una descripción verificable del trabajo y sus límites; no incluyas datos de terceros.', 'A short sample or a verifiable description of the work and its limits; do not include third-party data.'),
  criteria: words('Describe la decisión tomada; identifica una comprobación; declara la ayuda utilizada y lo que queda por verificar.', 'Describe the decision made; identify a check; state the assistance used and what remains to be verified.'),
  limitation: words('Este ejercicio no acredita competencia, autonomía ni habilitación profesional.', 'This exercise does not establish competence, autonomy or professional authorization.'),
});
class CareerPlanError extends Error {
  constructor(status, code, es, en) { super(`${es} / ${en}`); this.status = status; this.code = code; }
}
const problem = (code, es, en, status = 422) => new CareerPlanError(status, code, es, en);
const invalid = () => problem('invalid_input', 'Datos inválidos.', 'Invalid data.', 400);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function shape(value, keys) { if (!plain(value) || !Object.keys(value).every(key => keys.includes(key))) throw invalid(); }
function text(value, max = 2000, optional = false) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw invalid();
  return value.trim();
}
function id(value) { if (!Number.isSafeInteger(value) || value < 1) throw invalid(); return value; }
function rid(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) throw invalid(); return value; }
function version(value) { if (!Number.isSafeInteger(value) || value < 1) throw invalid(); return value; }
function contextSnapshot(context) {
  if (!plain(context) || !Number.isSafeInteger(context.version) || context.version < 1 || !Number.isInteger(context.weeklyMinutes) || context.weeklyMinutes < 0 || context.weeklyMinutes > 10080 || !['es', 'en'].includes(context.locale) || typeof context.timeZone !== 'string' || context.timeZone.length > 64) throw problem('needs_availability', 'Confirma disponibilidad, idioma y zona horaria.', 'Confirm availability, language and time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone: context.timeZone }); } catch { throw invalid(); }
  return { version: context.version, weeklyMinutes: context.weeklyMinutes, timeZone: context.timeZone, locale: context.locale };
}
function experimentProposal({ choiceId, route, taskIndex, minutes, context, basisHash }) {
  id(choiceId);
  if (![20, 30, 45].includes(minutes) || !Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= route.tasks.length) throw invalid();
  const availability = contextSnapshot(context);
  if (availability.weeklyMinutes < minutes) throw problem('needs_scope_reduction', 'Reduce el alcance o confirma más disponibilidad.', 'Reduce scope or confirm more availability.');
  if (route.regulated.isRegulated) throw problem('needs_safe_template', 'La tarea regulada necesita una plantilla revisada por un especialista.', 'The regulated task needs a specialist-reviewed template.');
  return { schemaVersion: 1, templateVersion: TEMPLATE_VERSION, choiceId, basisHash, roleKey: route.roleKey,
    taskIndex, task: structuredClone(route.tasks[taskIndex]), minutes, availability, content: structuredClone(TEMPLATE),
    rubric: { version: TEMPLATE_VERSION, status: 'not_domain_validated', criteria: structuredClone(TEMPLATE.criteria) },
    cost: { status: 'unknown' }, resources: [], lifecycle: 'ready' };
}
const ASSISTANCE = ['none', 'planning', 'drafting', 'substantial', 'unknown'];
function refs(value = []) {
  if (!Array.isArray(value) || value.length > 8) throw invalid();
  const seen = new Set();
  return value.map(ref => { shape(ref, ['evidenceId', 'version']); id(ref.evidenceId); version(ref.version);
    if (seen.has(ref.evidenceId)) throw invalid(); seen.add(ref.evidenceId); return { evidenceId: ref.evidenceId, version: ref.version }; });
}
function changeExperiment(previous, input) {
  shape(input, ['action', 'sample', 'evidenceRefs', 'assistance', 'observation', 'interpretation', 'decision', 'reason']);
  const next = structuredClone(previous);
  if (input.action === 'start') {
    shape(input, ['action']); if (previous.lifecycle !== 'ready') throw problem('transition_not_allowed', 'Transición no permitida.', 'Transition not allowed.', 409);
    next.lifecycle = 'in_progress';
  } else if (input.action === 'submit') {
    shape(input, ['action', 'sample', 'evidenceRefs', 'assistance']);
    if (!['in_progress', 'submitted', 'self_reviewed', 'decided'].includes(previous.lifecycle)) throw problem('transition_not_allowed', 'Inicia el experimento antes de entregar.', 'Start the experiment before submitting.', 409);
    if (!ASSISTANCE.includes(input.assistance)) throw invalid();
    const sample = text(input.sample, 6000, true), evidenceRefs = refs(input.evidenceRefs);
    if (!sample && !evidenceRefs.length) throw invalid();
    next.submission = { sample, evidenceRefs, assistance: { degree: input.assistance, source: 'self_report' } };
    delete next.reflection; delete next.decision; next.lifecycle = 'submitted';
  } else if (input.action === 'reflect') {
    shape(input, ['action', 'observation', 'interpretation']);
    if (!['submitted', 'self_reviewed'].includes(previous.lifecycle)) throw problem('transition_not_allowed', 'Primero guarda una entrega.', 'Save a submission first.', 409);
    next.reflection = { observation: text(input.observation), interpretation: text(input.interpretation), source: 'self_report' };
    next.lifecycle = 'self_reviewed';
  } else if (input.action === 'decide') {
    shape(input, ['action', 'decision', 'reason']);
    if (!['self_reviewed', 'decided'].includes(previous.lifecycle) || !['continue', 'adjust', 'pause', 'discard'].includes(input.decision)) throw problem('transition_not_allowed', 'Revisa la entrega antes de decidir.', 'Review the submission before deciding.', 409);
    next.decision = { value: input.decision, reason: text(input.reason) }; next.lifecycle = 'decided';
  } else throw invalid();
  return next;
}
const PURPOSES = {
  7: words('Revisar la prueba y explicar lo aprendido.', 'Review the trial and explain what was learned.'),
  30: words('Repetir o ajustar una práctica con una brecha concreta.', 'Repeat or adapt a practice addressing a specific gap.'),
  90: words('Revisar la evidencia y decidir el siguiente paso.', 'Review the evidence and decide the next step.'),
};
function money(value) {
  shape(value, ['amount', 'currency']);
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0 || value.amount > 1e9 || typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) throw invalid();
  return { amount: value.amount, currency: value.currency };
}
function proposePlan(experiment, experimentVersion, context, resources, budget = null) {
  if (experiment.lifecycle !== 'decided' || ['pause', 'discard'].includes(experiment.decision.value)) throw problem('transition_not_allowed', 'La decisión no permite proponer un plan activo.', 'The decision does not allow an active plan.', 409);
  const availability = contextSnapshot(context);
  if (availability.weeklyMinutes < 20) throw problem('needs_scope_reduction', 'No hay disponibilidad para una tarea de veinte minutos.', 'There is no availability for a twenty-minute task.');
  return { schemaVersion: 1, templateVersion: TEMPLATE_VERSION, experimentVersion, basisHash: experiment.basisHash, availability,
    decision: experiment.decision, budget: budget === null ? null : money(budget), status: 'proposed', actions: [7, 30, 90].map((horizonDays, i) => ({
      actionKey: `step_${horizonDays}`, horizonDays, purpose: PURPOSES[horizonDays], estimatedMinutes: 20,
      dependencies: i ? [`step_${[7, 30, 90][i - 1]}`] : [], chosenDate: null, status: 'proposed', accepted: false,
      completionEvidence: { expected: TEMPLATE.expectedEvidence, actual: null }, resourceRefs: [],
    })), resources, limitations: TEMPLATE.limitation };
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw invalid();
  return value;
}
// Día de calendario ISO de la semana (lunes), independiente de la zona del host.
function weekKey(date) { const d = new Date(day(date)); const weekday = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - weekday + 1); return d.toISOString().slice(0, 10); }
function acceptPlan(proposed, selections) {
  if (!Array.isArray(selections) || !selections.length || selections.length > 12) throw invalid();
  const plan = structuredClone(proposed), selected = new Map(), byWeek = new Map(); let totalCost = 0;
  for (const item of selections) {
    shape(item, ['actionKey', 'chosenDate', 'estimatedMinutes', 'resourceRefs', 'declaredCost']);
    const action = plan.actions.find(a => a.actionKey === item.actionKey);
    if (!action || selected.has(item.actionKey) || !Number.isInteger(item.estimatedMinutes) || item.estimatedMinutes < 1 || item.estimatedMinutes > 10080) throw invalid();
    if (action.horizonDays === 7 && (item.estimatedMinutes < 20 || item.estimatedMinutes > 45)) throw invalid();
    const date = day(item.chosenDate); const week = weekKey(date);
    if (!Array.isArray(item.resourceRefs) || item.resourceRefs.length > 3 || new Set(item.resourceRefs).size !== item.resourceRefs.length) throw invalid();
    let resourceMinutes = 0, resourceCost = 0;
    for (const key of item.resourceRefs) {
      const resource = proposed.resources.find(r => r.resourceKey === key);
      if (!resource || !Number.isInteger(resource.duration?.minutes)) throw problem('resource_time_unknown', 'Confirma la duración del recurso.', 'Confirm the resource duration.');
      resourceMinutes += resource.duration.minutes;
      if (proposed.budget) {
        if (!resource.price?.published || resource.price.currency !== proposed.budget.currency) throw problem('needs_cost_confirmation', 'Confirma el precio y moneda del recurso.', 'Confirm the resource price and currency.');
        resourceCost += resource.price.amount;
      }
    }
    // Los minutos elegidos incluyen el recurso; no se añaden dos veces.
    if (resourceMinutes > item.estimatedMinutes) throw problem('needs_scope_reduction', 'El recurso no cabe en el esfuerzo elegido.', 'The resource does not fit the chosen effort.');
    const cost = item.declaredCost === undefined ? { status: 'unknown' } : { status: 'declared', ...money(item.declaredCost), source: 'self_report' };
    if (proposed.budget && (cost.status === 'unknown' || cost.currency !== proposed.budget.currency || cost.amount < resourceCost)) throw problem('needs_cost_confirmation', 'Confirma el costo total de la acción en la moneda del presupuesto.', 'Confirm the total action cost in the budget currency.');
    if (proposed.budget) totalCost += cost.amount;
    Object.assign(action, { chosenDate: date, estimatedMinutes: item.estimatedMinutes, resourceRefs: item.resourceRefs, accepted: true, status: 'accepted', cost });
    selected.set(item.actionKey, action); byWeek.set(week, (byWeek.get(week) || 0) + item.estimatedMinutes);
  }
  if ([...byWeek.values()].some(minutes => minutes > proposed.availability.weeklyMinutes)) throw problem('needs_scope_reduction', 'El plan supera la disponibilidad semanal.', 'The plan exceeds weekly availability.');
  if (proposed.budget && totalCost > proposed.budget.amount) throw problem('budget_exceeded', 'El costo declarado supera el presupuesto.', 'The declared cost exceeds the budget.');
  const visiting = new Set(), visited = new Set();
  function visit(action) {
    if (visiting.has(action.actionKey)) throw problem('invalid_dependencies', 'Las dependencias forman un ciclo.', 'Dependencies form a cycle.');
    if (visited.has(action.actionKey)) return;
    visiting.add(action.actionKey);
    for (const key of action.dependencies) {
      const parent = selected.get(key);
      if (!parent || parent.chosenDate > action.chosenDate) throw problem('invalid_dependencies', 'Falta una dependencia o su fecha es posterior.', 'A dependency is missing or scheduled later.');
      visit(parent);
    }
    visiting.delete(action.actionKey); visited.add(action.actionKey);
  }
  for (const action of selected.values()) visit(action);
  plan.actions = [...selected.values()]; plan.status = 'accepted'; return plan;
}
function localInstant(localDateTime, timeZone) {
  if (typeof localDateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) throw invalid();
  day(localDateTime.slice(0, 10)); const hour = Number(localDateTime.slice(11, 13)), minute = Number(localDateTime.slice(14, 16));
  if (hour > 23 || minute > 59 || typeof timeZone !== 'string' || timeZone.length > 64) throw invalid();
  let formatter;
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { throw invalid(); }
  const render = instant => { const p = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const naive = Date.parse(localDateTime + ':00Z'); const matches = [];
  // Todos los offsets IANA actuales son múltiplos de 15 minutos, entre UTC-12 y UTC+14.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) { const instant = new Date(naive + offset * 60000); if (render(instant) === localDateTime) matches.push(instant); }
  if (matches.length !== 1) throw problem('ambiguous_local_time', 'Elige otra hora local: esta hora no existe o es ambigua.', 'Choose another local time: this time does not exist or is ambiguous.');
  return matches[0].toISOString();
}
module.exports = { CareerPlanError, invalid, problem, shape, text, id, rid, version, refs, contextSnapshot, experimentProposal, changeExperiment, proposePlan, acceptPlan, localInstant, TEMPLATE_VERSION, TEMPLATE };
