const { createHmac } = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const Constraints = require('../RouteConstraintsVersion');
const Choice = require('../RouteChoice');
const Review = require('../RouteReviewRequest');
const Assessment = require('../SkillAssessment');
const { deletionPending } = require('./deletionGuard');
const { encriptarV2, desencriptar } = require('./crypto');
const JWT_SECRET = require('../config/jwt');
const catalogStore = require('./routeCatalog');
const skillMap = require('./skillMap');
const { calculateRoutes, RULE_VERSION } = require('./routeEngine');

class RoutesError extends Error {
  constructor(status, code, es, en) { super(`${es} / ${en}`); this.status = status; this.code = code; }
}
const invalid = () => new RoutesError(400, 'invalid_input', 'Datos inválidos.', 'Invalid data.');
const conflict = () => new RoutesError(409, 'conflict', 'La base cambió. Revisa las rutas antes de decidir.', 'The basis changed. Review the routes before deciding.');
const missing = () => new RoutesError(404, 'route_record_not_found', 'Registro no encontrado.', 'Record not found.');
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function shape(value, keys) { if (!plain(value) || !Object.keys(value).every(key => keys.includes(key))) throw invalid(); }
const REQUEST = /^[A-Za-z0-9_-]{8,64}$/;
const KEY = /^[a-z][a-z0-9_-]{0,47}$/;
function requestId(value) { if (typeof value !== 'string' || !REQUEST.test(value)) throw invalid(); return value; }
const canonical = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(canonical) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => createHmac('sha256', JWT_SECRET).update('es32:').update(JSON.stringify(canonical(value))).digest('hex');
function strings(value, max, pattern) {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || !pattern.test(item)) || new Set(value).size !== value.length) throw invalid();
  return [...value].sort();
}
function normalizeConstraints(value) {
  shape(value, ['targetMarkets', 'languages', 'modalities', 'acceptRegulated', 'originContextKey', 'interestContextKeys', 'preferredModalities']);
  const targetMarkets = strings(value.targetMarkets, 3, /^[A-Z]{2}$/);
  if (!targetMarkets.length || !['yes', 'no', 'unknown'].includes(value.acceptRegulated)) throw invalid();
  if (value.originContextKey !== null && (typeof value.originContextKey !== 'string' || !KEY.test(value.originContextKey))) throw invalid();
  const out = { targetMarkets, languages: strings(value.languages, 12, /^[a-z]{2}$/),
    modalities: strings(value.modalities, 3, /^(onsite|hybrid|remote)$/), acceptRegulated: value.acceptRegulated,
    originContextKey: value.originContextKey, interestContextKeys: strings(value.interestContextKeys, 6, KEY),
    preferredModalities: strings(value.preferredModalities, 3, /^(onsite|hybrid|remote)$/) };
  if (out.modalities.length && out.preferredModalities.some(m => !out.modalities.includes(m))) throw invalid();
  return out;
}
async function authorize(userId, transaction, lock = false) {
  const user = await User.findByPk(userId, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!user || !user.active || user.role !== 'user') throw new RoutesError(403, 'owner_required', 'Solo la persona titular puede acceder.', 'Only the participant owner may access this.');
  if (await deletionPending(userId, transaction)) throw new RoutesError(403, 'deletion_pending', 'La cuenta tiene una solicitud de eliminación.', 'The account has a deletion request.');
}
async function write(userId, fn) {
  try {
    return await sequelize.transaction(async transaction => { await authorize(userId, transaction, true); return fn(transaction); });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || ['40001', '40P01'].includes(error.parent?.code)) throw conflict();
    throw error;
  }
}
const decode = row => row ? { id: row.id, version: row.version, status: row.status, payload: JSON.parse(desencriptar(row.payload)), createdAt: row.createdAt } : null;
async function currentConstraints(userId, transaction) { return Constraints.findOne({ where: { UserId: userId, status: 'current' }, transaction }); }
async function getConstraints(userId) { return { constraints: decode(await currentConstraints(userId)) }; }
async function putConstraints(userId, input) {
  shape(input, ['baseVersion', 'requestId', 'payload']);
  requestId(input.requestId);
  if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0) throw invalid();
  const payload = normalizeConstraints(input.payload);
  const inputHash = hash({ baseVersion: input.baseVersion, payload });
  // QA-32-01: el catálogo se lee ANTES de abrir la transacción. Una lectura externa dentro de write() pide una segunda conexión mientras la
  // primera sigue retenida y, con el pool lleno de escrituras, nadie avanza. El orden de los errores no cambia: se evalúa dentro, como antes.
  const catalog = await catalogStore.getPublishedRouteCatalog();
  return write(userId, async transaction => {
    const repeated = await Constraints.findOne({ where: { UserId: userId, requestId: input.requestId }, transaction });
    if (repeated) { if (repeated.inputHash !== inputHash) throw conflict(); return { constraints: decode(repeated), created: false }; }
    const current = await currentConstraints(userId, transaction);
    if ((current?.version || 0) !== input.baseVersion) throw conflict();
    if (!catalog) throw new RoutesError(503, 'catalog_unavailable', 'Catálogo no disponible.', 'Catalog unavailable.');
    const contexts = new Set(catalog.contexts.map(context => context.contextKey));
    if ((payload.originContextKey && !contexts.has(payload.originContextKey)) || payload.interestContextKeys.some(key => !contexts.has(key))) throw invalid();
    if (current) await current.update({ status: 'superseded' }, { transaction });
    const row = await Constraints.create({ UserId: userId, version: input.baseVersion + 1, status: 'current', payload: encriptarV2(JSON.stringify(payload)), requestId: input.requestId, inputHash }, { transaction });
    return { constraints: decode(row), created: true };
  });
}
async function getRoutes(userId) {
  const catalog = await catalogStore.getPublishedRouteCatalog();
  if (!catalog) throw new RoutesError(503, 'catalog_unavailable', 'Catálogo no disponible.', 'Catalog unavailable.');
  const constraints = decode(await currentConstraints(userId));
  // Sin mercado no se lee el mapa ni se consulta ningún texto privado para intentar inferirlo.
  if (!constraints) return { ...calculateRoutes({ catalog, map: null, constraints: null }), constraintsVersion: 0, basisHash: null };
  const map = await skillMap.getMap(userId);
  const assessments = await Assessment.findAll({ where: { UserId: userId, status: 'current' }, attributes: ['id', 'skillKey', 'track', 'evidenceRefs', 'updatedAt'], order: [['id', 'ASC']] });
  const result = calculateRoutes({ catalog, map, constraints: constraints.payload });
  const basisHash = hash({ owner: userId, ruleVersion: RULE_VERSION, constraints, catalogVersion: catalog.version,
    skillCatalogVersion: map.catalogVersion, assessments: assessments.map(row => ({ id: row.id, skillKey: row.skillKey, track: row.track, evidenceRefs: row.evidenceRefs, updatedAt: row.updatedAt })), result });
  return { ...result, constraintsVersion: constraints.version, basisHash };
}
const choiceDto = (row, basisHash) => ({ id: row.id, roleKey: row.roleKey, slot: row.slot, decision: row.decision,
  catalogVersion: row.catalogVersion, constraintsVersion: row.constraintsVersion, status: row.status,
  basisChanged: !basisHash || row.basisHash !== basisHash, createdAt: row.createdAt });
async function activeBasis(userId) {
  try { return (await getRoutes(userId)).basisHash; } catch (error) {
    if (error.code === 'catalog_unavailable') return null;
    throw error;
  }
}
async function listChoices(userId, after = 0) {
  const rows = await Choice.findAll({ where: { UserId: userId, id: { [Op.gt]: after } }, order: [['id', 'ASC']], limit: 101 });
  const basis = await activeBasis(userId);
  return { choices: rows.slice(0, 100).map(row => choiceDto(row, basis)), nextAfter: rows.length > 100 ? rows[99].id : null };
}
async function getChoice(userId, id) {
  const row = await Choice.findOne({ where: { UserId: userId, id } });
  if (!row) throw missing();
  return { choice: choiceDto(row, await activeBasis(userId)) };
}
// Contrato para ES-33: una elección rechazada, reemplazada o con fundamento cambiado no autoriza un experimento.
async function getAcceptedChoice(userId, id) {
  await authorize(userId);
  const { choice } = await getChoice(userId, id);
  if (choice.status !== 'current' || choice.decision !== 'accepted' || choice.basisChanged) throw conflict();
  return choice;
}
async function choose(userId, input) {
  shape(input, ['requestId', 'roleKey', 'slot', 'decision', 'basisHash']);
  requestId(input.requestId);
  if (typeof input.roleKey !== 'string' || !KEY.test(input.roleKey) || !['continuity', 'adjacency', 'exploration'].includes(input.slot) ||
    !['accepted', 'rejected'].includes(input.decision) || typeof input.basisHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.basisHash)) throw invalid();
  const inputHash = hash(input);
  // QA-32-01: getRoutes/activeBasis abren sus propias conexiones (mapa, consentimiento, evidencia). Dentro de write() la transacción ya retiene
  // una; con el pool lleno de escrituras nadie conseguía la segunda y todas daban 503. Por eso las lecturas van fuera de la transacción:
  // antes (la base que vio la persona) y después de confirmar (el estado que se devuelve). La denegación temprana se conserva con authorize().
  await authorize(userId);
  let basis, basisError;
  try { basis = await getRoutes(userId); } catch (error) { basisError = error; }
  const outcome = await write(userId, async transaction => {
    const repeated = await Choice.findOne({ where: { UserId: userId, requestId: input.requestId }, transaction });
    if (repeated) { if (repeated.inputHash !== inputHash) throw conflict(); return { row: repeated, created: false }; }
    if (basisError) throw basisError;
    if (basis.basisHash !== input.basisHash) throw conflict();
    if (!basis.routes.some(route => route.roleKey === input.roleKey && route.slot === input.slot)) throw new RoutesError(422, 'route_not_proposed', 'La ruta no forma parte de la propuesta vigente.', 'The route is not part of the current proposal.');
    // Las restricciones se escriben bajo el mismo bloqueo de la persona: leerlas con esta transacción confirma que siguen siendo las de la base.
    const latest = await currentConstraints(userId, transaction);
    if ((latest?.version || 0) !== basis.constraintsVersion) throw conflict();
    const current = await Choice.findOne({ where: { UserId: userId, roleKey: input.roleKey, status: 'current' }, transaction });
    if (current) await current.update({ status: 'superseded' }, { transaction });
    const row = await Choice.create({ UserId: userId, ...input, inputHash, catalogVersion: basis.catalogVersion, constraintsVersion: basis.constraintsVersion, status: 'current' }, { transaction });
    return { row, created: true };
  });
  // Si el catálogo, la evidencia o el mapa cambiaron entre la lectura y la confirmación, la elección queda guardada y marcada basisChanged
  // (hay que revisarla, no autoriza un experimento); antes se revertía con 409. No se promete un snapshot global de helpers.
  return { choice: choiceDto(outcome.row, await activeBasis(userId)), created: outcome.created };
}
const reviewDto = row => ({ id: row.id, status: row.status, note: row.note ? desencriptar(row.note) : null, createdAt: row.createdAt });
async function requestReview(userId, input) {
  shape(input, ['requestId', 'note']); requestId(input.requestId);
  const note = input.note === undefined || input.note === null ? null : input.note;
  if (note !== null && (typeof note !== 'string' || note.length > 300 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))) throw invalid();
  const inputHash = hash({ note });
  return write(userId, async transaction => {
    const repeated = await Review.findOne({ where: { UserId: userId, requestId: input.requestId }, transaction });
    if (repeated) { if (repeated.inputHash !== inputHash) throw conflict(); return { reviewRequest: reviewDto(repeated), created: false }; }
    if (await Review.findOne({ where: { UserId: userId, status: 'open' }, transaction })) throw new RoutesError(409, 'review_already_open', 'Ya existe una solicitud abierta.', 'A review request is already open.');
    const row = await Review.create({ UserId: userId, status: 'open', note: note === null ? null : encriptarV2(note), requestId: input.requestId, inputHash }, { transaction });
    return { reviewRequest: reviewDto(row), created: true };
  });
}
async function getReview(userId) {
  const row = await Review.findOne({ where: { UserId: userId, status: 'open' } });
  return { reviewRequest: row ? reviewDto(row) : null };
}
module.exports = { RoutesError, authorize, getConstraints, putConstraints, getRoutes, choose, listChoices, getChoice, getAcceptedChoice, requestReview, getReview, normalizeConstraints };
