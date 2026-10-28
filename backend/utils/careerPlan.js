const { createHmac } = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const Experiment = require('../CareerExperiment');
const ExperimentVersion = require('../CareerExperimentVersion');
const Plan = require('../CareerPlanVersion');
const Review = require('../CareerExperimentReview');
const Reminder = require('../CareerReminder');
const Consent = require('../Consent');
const ConsentEvent = require('../ConsentEvent');
const { deletionPending } = require('./deletionGuard');
const { encriptarV2, desencriptar } = require('./crypto');
const JWT_SECRET = require('../config/jwt');
const tokens = require('./proposalToken');
const consent = require('./consent');
const evidence = require('./evidence');
const contracts = require('./careerPlanContracts');
const rules = require('./careerPlanRules');
const { gate } = require('./connectionGate');
const { shape, id, rid, version, invalid, problem } = rules;
const canonical = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => createHmac('sha256', JWT_SECRET).update('es33:').update(JSON.stringify(canonical(value))).digest('hex');
const pack = value => { const payload = { ...value }; delete payload.basisHash; return encriptarV2(JSON.stringify(payload)); };
const unpack = row => JSON.parse(desencriptar(row.payload));
const conflict = () => problem('version_conflict', 'La versión o el fundamento cambió. Recupera el estado guardado.', 'The version or basis changed. Retrieve the saved state.', 409);
const missing = () => problem('resource_not_found', 'Recurso no encontrado.', 'Resource not found.', 404);
async function authorize(userId, transaction, lock = false) {
  const user = await User.findByPk(userId, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!user || !user.active || user.role !== 'user') throw problem('owner_required', 'Solo la persona titular puede acceder.', 'Only the participant owner may access this.', 403);
  if (await deletionPending(userId, transaction)) throw problem('deletion_pending', 'La cuenta tiene una solicitud de eliminación.', 'The account has a deletion request.', 403);
}
// QA-33-01: la compuerta limita las escrituras simultáneas para que siempre quede una conexión libre para las lecturas internas (basis, evidencia).
const write = (userId, fn) => gate().run(() => writeInGate(userId, fn));
async function writeInGate(userId, fn) {
  const transaction = await sequelize.transaction();
  try {
    await authorize(userId, transaction, true);
    const result = await fn(transaction);
    if (!transaction.finished) await transaction.commit();
    return result;
  } catch (error) {
    if (!transaction.finished) await transaction.rollback().catch(() => {});
    if (error.name === 'SequelizeUniqueConstraintError' || ['40001', '40P01'].includes(error.parent?.code)) throw conflict(); throw error;
  }
}
async function repeated(Model, userId, input, transaction) {
  rid(input.requestId);
  const row = await Model.findOne({ where: { UserId: userId, requestId: input.requestId }, transaction });
  if (row && row.inputHash !== hash(input)) throw conflict();
  return row;
}
const command = (userId, input) => ({ UserId: userId, requestId: input.requestId, inputHash: hash(input) });
async function ownExperiment(userId, experimentId, transaction) {
  id(experimentId);
  const row = await Experiment.findOne({ where: { UserId: userId, id: experimentId }, transaction });
  if (!row) throw missing(); return row;
}
async function currentVersion(userId, experiment, transaction) {
  const row = await ExperimentVersion.findOne({ where: { UserId: userId, experimentId: experiment.id, version: experiment.currentVersion }, transaction });
  if (!row) throw missing(); return row;
}
async function ownPlan(userId, planId, transaction) {
  id(planId); const row = await Plan.findOne({ where: { UserId: userId, id: planId }, transaction });
  if (!row) throw missing(); return row;
}
async function basis(userId, choiceId) {
  const route = await contracts.getRoute(userId, choiceId);
  const context = rules.contextSnapshot(await contracts.getContext(userId));
  const confirmed = await evidence.getConfirmedEvidence(userId, 'career-plan');
  const refs = confirmed.map(e => ({ evidenceId: e.evidenceId, version: e.version })).sort((a, b) => a.evidenceId - b.evidenceId);
  return { route: route.route, context, confirmed, hash: hash({ userId, choiceId, routeHash: route.basisHash, context, refs, templateVersion: rules.TEMPLATE_VERSION, templateHash: hash(rules.TEMPLATE) }) };
}
async function stillCurrent(userId, experiment, row) {
  try { return (await basis(userId, experiment.choiceId)).hash === row.basisHash ? { status: 'current', reasons: [] } : { status: 'needs_review', reasons: ['basis_changed'] }; }
  catch (error) {
    if ([403, 404, 409, 422, 503].includes(error.status)) return { status: 'needs_review', reasons: [error.code] };
    throw error;
  }
}
const versionDto = row => ({ id: row.id, experimentId: row.experimentId, version: row.version, lifecycle: row.lifecycle, payload: unpack(row), createdAt: row.createdAt });
async function getExperiment(userId, experimentId, after = 0) {
  const experiment = await ownExperiment(userId, experimentId);
  const current = await currentVersion(userId, experiment);
  const rows = await ExperimentVersion.findAll({ where: { UserId: userId, experimentId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
  const requests = await Review.findAll({ where: { UserId: userId, experimentId }, order: [['id', 'DESC']], limit: 101 });
  const withdrawals = new Set(requests.filter(row => row.status === 'withdrawn').map(row => unpack(row).targetId));
  const pending = await Review.findOne({ where: { UserId: userId, experimentId, status: 'pending_authorization', submissionVersion: unpack(current).submission?.version ?? 0 } });
  return { experiment: { id: experiment.id, choiceId: experiment.choiceId, currentVersion: experiment.currentVersion }, current: versionDto(current),
    basis: await stillCurrent(userId, experiment, current), versions: rows.slice(0, 100).map(versionDto), nextAfter: rows.length > 100 ? rows[99].id : null,
    humanReview: { status: pending ? 'pending_authorization' : 'not_requested', shared: false, contract: 'pending', requests: requests.slice(0, 100).map(row => ({ id: row.id, submissionVersion: row.submissionVersion,
      status: withdrawals.has(row.id) ? 'withdrawn' : row.status, needsReview: row.submissionVersion !== unpack(current).submission?.version,
      materials: unpack(row), createdAt: row.createdAt })), truncated: requests.length > 100 } };
}
async function listExperiments(userId, after = 0) {
  const rows = await Experiment.findAll({ where: { UserId: userId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
  return { experiments: rows.slice(0, 100).map(row => ({ id: row.id, choiceId: row.choiceId, currentVersion: row.currentVersion, createdAt: row.createdAt })), nextAfter: rows.length > 100 ? rows[99].id : null };
}
async function listReviews(userId, experimentId, after = 0) {
  const experiment = await ownExperiment(userId, experimentId), current = await currentVersion(userId, experiment);
  const rows = await Review.findAll({ where: { UserId: userId, experimentId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
  return { reviewRequests: rows.slice(0, 100).map(row => ({ id: row.id, submissionVersion: row.submissionVersion, status: row.status,
    needsReview: row.submissionVersion !== unpack(current).submission?.version, materials: unpack(row), shared: false, createdAt: row.createdAt })), nextAfter: rows.length > 100 ? rows[99].id : null };
}
async function proposeExperiment(userId, input) {
  shape(input, ['choiceId', 'taskIndex', 'minutes']); id(input.choiceId);
  const live = await basis(userId, input.choiceId);
  const proposal = rules.experimentProposal({ ...input, route: live.route, context: live.context, basisHash: live.hash });
  return { proposal, ...tokens.sign('es33-experiment', userId, hash(proposal)) };
}
function checkToken(purpose, userId, input) {
  if (tokens.check(purpose, userId, input.token, hash(input.proposal)) !== 'ok') throw problem('invalid_proposal', 'La propuesta cambió, venció o no pertenece a esta cuenta.', 'The proposal changed, expired or does not belong to this account.', 409);
}
async function createExperiment(userId, input) {
  shape(input, ['requestId', 'proposal', 'token']); rid(input.requestId);
  if (!input.proposal || typeof input.proposal !== 'object') throw invalid();
  return write(userId, async transaction => {
    const repeat = await repeated(Experiment, userId, input, transaction);
    if (repeat) return { experimentId: repeat.id, created: false };
    checkToken('es33-experiment', userId, input);
    const live = await basis(userId, input.proposal.choiceId);
    const expected = rules.experimentProposal({ choiceId: input.proposal.choiceId, route: live.route, taskIndex: input.proposal.taskIndex, minutes: input.proposal.minutes, context: live.context, basisHash: live.hash });
    if (hash(expected) !== hash(input.proposal)) throw conflict();
    const experiment = await Experiment.create({ ...command(userId, input), choiceId: expected.choiceId, currentVersion: 1 }, { transaction });
    await ExperimentVersion.create({ ...command(userId, input), experimentId: experiment.id, version: 1, lifecycle: 'ready', payload: pack(expected), basisHash: live.hash }, { transaction });
    if ((await basis(userId, expected.choiceId)).hash !== live.hash) throw conflict();
    return { experimentId: experiment.id, created: true };
  });
}
function validateRefs(inputRefs, live) {
  const found = new Map(live.confirmed.map(e => [e.evidenceId, e.version]));
  if (inputRefs.some(ref => found.get(ref.evidenceId) !== ref.version)) throw problem('evidence_not_valid', 'La referencia no está disponible o vigente.', 'The reference is not available or current.');
}
async function change(userId, experimentId, input) {
  shape(input, ['requestId', 'expectedVersion', 'change']); rid(input.requestId); version(input.expectedVersion);
  return write(userId, async transaction => {
    const experiment = await ownExperiment(userId, experimentId, transaction);
    const repeat = await repeated(ExperimentVersion, userId, input, transaction);
    if (repeat) { if (repeat.experimentId !== experimentId) throw conflict(); return { version: versionDto(repeat), created: false }; }
    const row = await currentVersion(userId, experiment, transaction);
    if (row.version !== input.expectedVersion) throw conflict();
    const previous = unpack(row), live = await basis(userId, experiment.choiceId);
    let next;
    if (input.change?.action === 'rebase') {
      shape(input.change, ['action']);
      next = rules.experimentProposal({ choiceId: experiment.choiceId, route: live.route, taskIndex: previous.taskIndex, minutes: previous.minutes, context: live.context, basisHash: live.hash });
    } else {
      if (row.basisHash !== live.hash) throw conflict();
      next = rules.changeExperiment(previous, input.change);
      if (input.change.action === 'submit') { validateRefs(next.submission.evidenceRefs, live); next.submission.version = row.version + 1; }
    }
    const saved = await ExperimentVersion.create({ ...command(userId, input), experimentId, version: row.version + 1, lifecycle: next.lifecycle, payload: pack(next), basisHash: live.hash }, { transaction });
    await experiment.update({ currentVersion: saved.version }, { transaction });
    if ((await basis(userId, experiment.choiceId)).hash !== live.hash) throw conflict();
    return { version: versionDto(saved), created: true };
  });
}
async function requestReview(userId, experimentId, input) {
  shape(input, ['requestId', 'expectedVersion', 'action', 'submissionVersion', 'evidenceRefs', 'includeSample', 'reviewId']); rid(input.requestId); version(input.expectedVersion);
  return write(userId, async transaction => {
    const experiment = await ownExperiment(userId, experimentId, transaction);
    const repeat = await repeated(Review, userId, input, transaction);
    if (repeat) { if (repeat.experimentId !== experimentId) throw conflict(); return { reviewRequest: { id: repeat.id, status: repeat.status }, created: false }; }
    const row = await currentVersion(userId, experiment, transaction);
    if (row.version !== input.expectedVersion) throw conflict();
    let payload, submissionVersion, status;
    if (input.action === 'withdraw') {
      shape(input, ['requestId', 'expectedVersion', 'action', 'reviewId']); id(input.reviewId);
      const target = await Review.findOne({ where: { id: input.reviewId, UserId: userId, experimentId, status: 'pending_authorization' }, transaction });
      if (!target) throw missing();
      await target.update({ status: 'withdrawn' }, { transaction });
      payload = { targetId: target.id, shared: false }; submissionVersion = target.submissionVersion; status = 'withdrawn';
    } else if (input.action === 'request') {
      shape(input, ['requestId', 'expectedVersion', 'action', 'submissionVersion', 'evidenceRefs', 'includeSample']);
      const current = unpack(row);
      if (!current.submission || current.submission.version !== input.submissionVersion || typeof input.includeSample !== 'boolean') throw conflict();
      const refs = rules.refs(input.evidenceRefs);
      if (!refs.length && !input.includeSample) throw invalid();
      if (input.includeSample && !current.submission.sample) throw invalid();
      if (refs.some(ref => !current.submission.evidenceRefs.some(allowed => allowed.evidenceId === ref.evidenceId && allowed.version === ref.version))) throw invalid();
      const live = await basis(userId, experiment.choiceId); if (row.basisHash !== live.hash) throw conflict(); validateRefs(refs, live);
      payload = { evidenceRefs: refs, includeSample: input.includeSample, shared: false }; submissionVersion = input.submissionVersion; status = 'pending_authorization';
    } else throw invalid();
    const saved = await Review.create({ ...command(userId, input), experimentId, submissionVersion, status, payload: pack(payload) }, { transaction });
    return { reviewRequest: { id: saved.id, status, shared: false }, created: true };
  });
}
async function proposePlan(userId, input) {
  shape(input, ['experimentId', 'expectedVersion', 'budget']); id(input.experimentId); version(input.expectedVersion);
  const experiment = await ownExperiment(userId, input.experimentId), row = await currentVersion(userId, experiment);
  if (row.version !== input.expectedVersion) throw conflict();
  const live = await basis(userId, experiment.choiceId); if (row.basisHash !== live.hash) throw conflict();
  const proposal = { ...rules.proposePlan({ ...unpack(row), basisHash: row.basisHash }, row.version, live.context, live.route.resources, input.budget ?? null), experimentId: experiment.id };
  return { proposal, ...tokens.sign('es33-plan', userId, hash(proposal)) };
}
async function planStatus(userId, row) {
  const experiment = await ownExperiment(userId, row.experimentId), current = await currentVersion(userId, experiment);
  const result = await stillCurrent(userId, experiment, current);
  if (row.basisHash !== current.basisHash || unpack(row).experimentVersion !== current.version) return { status: 'needs_review', reasons: [...new Set([...result.reasons, 'experiment_changed'])] };
  return result;
}
async function planDto(userId, row) { return { id: row.id, experimentId: row.experimentId, version: row.version, status: row.status, payload: unpack(row), basis: await planStatus(userId, row), createdAt: row.createdAt }; }
async function getPlan(userId, planId) { return { plan: await planDto(userId, await ownPlan(userId, planId)) }; }
async function listPlans(userId, after = 0) {
  const rows = await Plan.findAll({ where: { UserId: userId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
  return { plans: await Promise.all(rows.slice(0, 100).map(row => planDto(userId, row))), nextAfter: rows.length > 100 ? rows[99].id : null };
}
async function savePlan(userId, input) {
  shape(input, ['requestId', 'expectedVersion', 'proposal', 'token', 'selections', 'planId', 'action', 'actionKey', 'completionEvidence']); rid(input.requestId);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw invalid();
  return write(userId, async transaction => {
    const repeat = await repeated(Plan, userId, input, transaction);
    if (repeat) return { plan: await planDto(userId, repeat), created: false };
    let current, next, experimentId, live;
    if (input.action === 'accept') {
      shape(input, ['requestId', 'expectedVersion', 'proposal', 'token', 'selections', 'action']);
      checkToken('es33-plan', userId, input);
      experimentId = id(input.proposal?.experimentId);
      const experiment = await ownExperiment(userId, experimentId, transaction), row = await currentVersion(userId, experiment, transaction);
      live = await basis(userId, experiment.choiceId); if (row.basisHash !== live.hash || row.version !== input.proposal.experimentVersion) throw conflict();
      const expected = { ...rules.proposePlan({ ...unpack(row), basisHash: row.basisHash }, row.version, live.context, live.route.resources, input.proposal.budget ?? null), experimentId };
      if (hash(expected) !== hash(input.proposal)) throw conflict();
      next = rules.acceptPlan(expected, input.selections);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: live.context.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (next.actions.some(action => action.chosenDate < today)) throw invalid();
      const all = await Plan.findAll({ where: { UserId: userId, status: 'accepted' }, transaction });
      // Cuenta también planes pendientes de revisión: no liberar capacidad silenciosamente.
      const totals = new Map();
      const add = action => { if (action.status !== 'completed') { const d = new Date(action.chosenDate); const dow = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - dow + 1); const key = d.toISOString().slice(0, 10); totals.set(key, (totals.get(key) || 0) + action.estimatedMinutes); } };
      for (const other of all) if (other.experimentId !== experimentId) unpack(other).actions.forEach(add);
      next.actions.forEach(add);
      if ([...totals.values()].some(minutes => minutes > live.context.weeklyMinutes)) throw problem('needs_scope_reduction', 'La suma de planes supera tu disponibilidad.', 'The combined plans exceed your availability.');
      current = await Plan.findOne({ where: { UserId: userId, experimentId }, order: [['version', 'DESC']], transaction });
    } else {
      shape(input, ['requestId', 'expectedVersion', 'planId', 'action', 'actionKey', 'completionEvidence']);
      current = await ownPlan(userId, input.planId, transaction); experimentId = current.experimentId;
      if (current.status !== 'accepted') throw conflict();
      next = { ...unpack(current), basisHash: current.basisHash };
      if (input.action === 'pause') {
        shape(input, ['requestId', 'expectedVersion', 'planId', 'action']); next.status = 'paused';
      } else if (input.action === 'complete') {
        if ((await planStatus(userId, current)).status !== 'current') throw conflict();
        const action = next.actions.find(action => action.actionKey === input.actionKey);
        if (!action || action.status === 'completed' || action.dependencies.some(key => next.actions.find(a => a.actionKey === key)?.status !== 'completed')) throw problem('invalid_dependencies', 'Completa las dependencias primero.', 'Complete dependencies first.');
        action.completionEvidence.actual = { text: rules.text(input.completionEvidence), source: 'self_report' }; action.status = 'completed';
      } else throw invalid();
    }
    if ((current?.version || 0) !== input.expectedVersion) throw conflict();
    // Versionar nunca reactivará recordatorios de la versión antigua.
    if (current) await current.update({ status: 'superseded' }, { transaction });
    const saved = await Plan.create({ ...command(userId, input), experimentId, version: (current?.version || 0) + 1, status: next.status, payload: pack(next), basisHash: next.basisHash }, { transaction });
    if (live) {
      const experiment = await ownExperiment(userId, experimentId, transaction);
      if ((await basis(userId, experiment.choiceId)).hash !== live.hash) throw conflict();
    }
    return { plan: await planDto(userId, saved), created: true };
  });
}
const stamp = row => ({ version: row.version, decidedAt: new Date(row.decidedAt).toISOString() });
async function consentStamp(userId, transaction) {
  const row = await Consent.findOne({ where: { UserId: userId, purpose: 'notifications', scope: 'default' }, transaction });
  const event = await ConsentEvent.findOne({ where: { UserId: userId, purpose: 'notifications', scope: 'default' }, order: [['id', 'DESC']], transaction });
  if (!row || !event || event.status !== 'granted') throw problem('consent_required', 'Confirma las notificaciones.', 'Confirm notifications.', 403);
  return { ...stamp(row), grantEventId: event.id };
}
async function withNotifications(userId, fn) {
  try { return await gate().run(() => consent.withConsent(userId, 'notifications', transaction => fn(transaction))); }
  catch (error) { if (error instanceof consent.ConsentRequiredError) throw problem('consent_required', 'Falta consentimiento de notificaciones.', 'Notification consent is required.', 403); throw error; }
}
async function publishNotifications(userId, transaction, fn) {
  return withNotifications(userId, async consentTransaction => {
    const result = await fn(consentTransaction);
    // Publicar la escritura ANTES de liberar el bloqueo canónico del consentimiento.
    await transaction.commit();
    return result;
  });
}
const reminderDto = row => ({ id: row.id, planVersionId: row.planVersionId, actionKey: row.actionKey, status: row.status, payload: unpack(row), createdAt: row.createdAt });
async function listReminders(userId, { history = false, after = 0 } = {}) {
  if (history) {
    const rows = await Reminder.findAll({ where: { UserId: userId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
    return { reminders: rows.slice(0, 100).map(reminderDto), nextAfter: rows.length > 100 ? rows[99].id : null };
  }
  return withNotifications(userId, async transaction => {
    const granted = await consentStamp(userId, transaction);
    const rows = await Reminder.findAll({ where: { UserId: userId, status: 'active', id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101, transaction });
    const due = [];
    for (const row of rows.slice(0, 100)) {
      const payload = unpack(row), plan = await ownPlan(userId, row.planVersionId, transaction);
      if (plan.status === 'accepted' && hash(payload.consentStamp) === hash(granted) && payload.dueAt <= new Date().toISOString() && (await planStatus(userId, plan)).status === 'current') due.push(reminderDto(row));
    }
    return { reminders: due, nextAfter: rows.length > 100 ? rows[99].id : null };
  });
}
async function saveReminder(userId, input) {
  shape(input, ['requestId', 'action', 'planVersionId', 'actionKey', 'localDateTime', 'timeZone', 'accepted', 'reminderId']); rid(input.requestId);
  return write(userId, async transaction => {
    const repeat = await repeated(Reminder, userId, input, transaction); if (repeat) return { reminder: reminderDto(repeat), created: false };
    if (input.action === 'accept') {
      shape(input, ['requestId', 'action', 'planVersionId', 'actionKey', 'localDateTime', 'timeZone', 'accepted']);
      if (input.accepted !== true) throw invalid();
      const plan = await ownPlan(userId, input.planVersionId, transaction), data = unpack(plan);
      const action = data.actions.find(action => action.actionKey === input.actionKey);
      if (plan.status !== 'accepted' || !action || action.status === 'completed' || (await planStatus(userId, plan)).status !== 'current') throw conflict();
      if (input.timeZone !== data.availability.timeZone || typeof input.localDateTime !== 'string' || input.localDateTime.slice(0, 10) !== action.chosenDate) throw invalid();
      const dueAt = rules.localInstant(input.localDateTime, input.timeZone); if (dueAt <= new Date().toISOString()) throw invalid();
      return publishNotifications(userId, transaction, async consentTransaction => {
        const granted = await consentStamp(userId, consentTransaction);
        const active = await Reminder.findOne({ where: { UserId: userId, planVersionId: plan.id, actionKey: action.actionKey, status: 'active' }, transaction });
        if (active) {
          if (hash(unpack(active).consentStamp) === hash(granted)) throw conflict();
          await active.update({ status: 'cancelled' }, { transaction });
        }
        const row = await Reminder.create({ ...command(userId, input), planVersionId: plan.id, actionKey: action.actionKey, status: 'active', payload: pack({ kind: 'accept', accepted: true, localDateTime: input.localDateTime, timeZone: input.timeZone, dueAt, consentStamp: granted }) }, { transaction });
        return { reminder: reminderDto(row), created: true };
      });
    }
    shape(input, ['requestId', 'action', 'reminderId']); id(input.reminderId);
    if (!['cancel', 'acknowledge'].includes(input.action)) throw invalid();
    const target = await Reminder.findOne({ where: { UserId: userId, id: input.reminderId, status: 'active' }, transaction });
    if (!target) throw missing();
    const record = async () => {
      const status = input.action === 'cancel' ? 'cancelled' : 'delivered';
      await target.update({ status }, { transaction });
      const row = await Reminder.create({ ...command(userId, input), planVersionId: target.planVersionId, actionKey: target.actionKey, status, payload: pack({ kind: input.action, targetId: target.id }) }, { transaction });
      return { reminder: reminderDto(row), created: true };
    };
    if (input.action === 'cancel') return record(); // Retirar no requiere renovar el consentimiento.
    return publishNotifications(userId, transaction, async consentTransaction => {
      const data = unpack(target), granted = await consentStamp(userId, consentTransaction), plan = await ownPlan(userId, target.planVersionId, transaction);
      if (hash(data.consentStamp) !== hash(granted) || data.dueAt > new Date().toISOString() || plan.status !== 'accepted' || (await planStatus(userId, plan)).status !== 'current') throw conflict();
      return record();
    });
  });
}
module.exports = { authorize, proposeExperiment, createExperiment, listExperiments, getExperiment, listReviews, change, requestReview, proposePlan, savePlan, getPlan, listPlans, listReminders, saveReminder };
