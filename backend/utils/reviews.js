// backend/utils/reviews.js
// ES-175 (HU-P24) · Revisiones profesionales recibidas y objeción. Contrato 11612 (aprobado por Mauricio el 12-nov-2026) con sus decisiones:
//   - permiso NUEVO `professional_review`, con alcance por revisor (`reviewer-<id>`); separado de facilitator_sharing;
//   - UNA objeción por revisión y UNA respuesta por objeción (sin réplicas);
//   - el revisor ve a la persona como alias «Persona n» (ES-177), nunca su nombre ni su correo;
//   - retención: mientras exista la cuenta; se exporta y se purga con ES-23 (personalData.CORE);
//   - el revisor es un usuario con rol `therapist` (confirmado por Infra el 12-nov-2026).
// Propietario y permiso se verifican en el SERVIDOR en CADA acceso (withConsent: bloqueo compartido, una retirada concurrente espera). Un id ajeno responde el mismo 404 que uno inexistente.
// NUNCA llega al revisor: crisis, diario, chat, correo, evidencias con origen en el chat ni las no marcadas por la persona.
const { Transaction, UniqueConstraintError } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const Evidence = require('../Evidence');
const EvidenceVersion = require('../EvidenceVersion');
const ReviewShare = require('../ReviewShare');
const ProfessionalReview = require('../ProfessionalReview');
const ReviewObjection = require('../ReviewObjection');
const ReviewResponse = require('../ReviewResponse');
const consent = require('./consent');
const reviewInvites = require('./reviewInvites'); // ES-303 (PR A)
const { deletionPending } = require('./deletionGuard');
const { ordinalsFor } = require('./personOrdinals');
const { encriptar, desencriptar } = require('./crypto');

const PURPOSE = 'professional_review';
const MAX_TEXT = 2000;
const MAX_EVIDENCE = 20;
const MAX_ATTEMPTS_PER_HOUR = 30;
// E262-7: tope de INTENTOS de autorizar por persona y hora (cuenta todo intento válido en forma, tenga éxito o no: con un revisor utilizable, inexistente, persona o admin la respuesta es la misma 429).
// En memoria de este proceso (como loginRateLimit): con varias réplicas el tope se multiplica; declarado. El reloj se puede sustituir en las pruebas.
let clock = () => Date.now();
const attempts = new Map();
function takeAttempt(userId) {
  const cutoff = clock() - 3600 * 1000;
  const recent = (attempts.get(userId) || []).filter((at) => at > cutoff);
  if (recent.length >= MAX_ATTEMPTS_PER_HOUR) { attempts.set(userId, recent); throw new ReviewError(429, 'rate_limited', 'Demasiados intentos seguidos. Inténtalo más tarde.', 'Too many attempts in a row. Try again later.'); }
  recent.push(clock()); attempts.set(userId, recent);
  if (attempts.size > 20000) for (const [key, list] of attempts) { if (!list.some((at) => at > cutoff)) attempts.delete(key); }
}
const LOCALES = ['es', 'en'];

class ReviewError extends Error {
  constructor(status, code, es, en, extra = {}) { super(`${es} / ${en}`); this.status = status; this.code = code; Object.assign(this, extra); }
}
const invalid = () => new ReviewError(400, 'invalid_input', 'Datos inválidos.', 'Invalid data.');
const notFound = () => new ReviewError(404, 'not_found', 'No se encontró.', 'Not found.');

const isId = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const isRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const hasKeysOnly = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key));
// Texto plano: se guarda LITERAL (nunca se interpreta como HTML) y la pantalla lo muestra como texto. Sin caracteres de control.
function cleanText(value) {
  if (typeof value !== 'string') throw invalid();
  const text = value.trim();
  if (!text) throw new ReviewError(400, 'required', 'Completa este campo.', 'Complete this field.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) throw new ReviewError(400, 'control_chars', 'El texto contiene caracteres no permitidos.', 'The text contains characters that are not allowed.');
  if ([...text].length > MAX_TEXT) throw new ReviewError(400, 'too_long', 'El texto supera el máximo permitido.', 'The text exceeds the maximum allowed.', { max: MAX_TEXT });
  return text;
}
const cleanLocale = (value) => { if (!LOCALES.includes(value)) throw invalid(); return value; };
const sameSet = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

// Permiso vigente de la PERSONA hacia ESTE revisor, comprobado dentro de la transacción y con bloqueo compartido.
async function withReviewConsent(personId, reviewerId, code, fn) {
  try { return await consent.withConsent(personId, PURPOSE, fn, consent.reviewerScope(reviewerId)); } catch (error) {
    if (error instanceof consent.ConsentRequiredError) throw new ReviewError(403, code, 'La autorización de esta persona ya no está vigente.', 'This person’s authorization is no longer in effect.');
    throw error;
  }
}

async function reviewerOf(id, transaction) { // ES-303: con `transaction` todo va por la MISMA conexión (dentro de una transacción no se pide otra: con el pool lleno varias canjes simultáneos se bloquearían entre sí)
  if (!isId(id)) return null;
  const user = await User.findOne({ where: { id, role: 'therapist', active: true }, attributes: ['id', 'name'], transaction });
  if (!user || await deletionPending(user.id, transaction)) return null;
  return user;
}

const shareView = (row) => ({ id: row.id, reviewerId: row.reviewerId, materialVersion: row.materialVersion, evidenceCount: row.evidenceRefs.length, status: row.status, createdAt: row.createdAt, revokedAt: row.revokedAt });
// E262-2/3: versión VIGENTE de cada evidencia compartida (una borrada no aparece). Lo fijado en la autorización no cambia; si la persona editó o borró, se avisa («el material cambió»).
async function liveVersions(userId, ids, transaction) {
  const rows = ids.length ? await Evidence.findAll({ where: { id: ids, UserId: userId, deletedAt: null }, attributes: ['id', 'currentVersion'], transaction }) : [];
  return new Map(rows.map((row) => [row.id, row.currentVersion]));
}
const refsChanged = (refs, live) => refs.some((ref) => live.get(ref.evidenceId) !== ref.version);
const decode = (row) => JSON.parse(desencriptar(row.payload));
const sourceRevoked = (row) => (Array.isArray(row.origins) ? row.origins : []).some((o) => o && o.sourceRevokedAt);

// ───────────────────────── La persona: autorizar y retirar ─────────────────────────

// Evidencias que se pueden compartir: confirmadas, vigentes, de la propia persona, SIN origen en el chat y sin marca «para revisión».
async function shareableRefs(userId, evidenceIds) {
  const rows = await EvidenceVersion.findAll({ where: { UserId: userId, EvidenceId: evidenceIds, status: 'confirmed' } });
  const live = await Evidence.findAll({ where: { id: evidenceIds, UserId: userId, deletedAt: null }, attributes: ['id', 'currentVersion'] });
  const current = new Map(live.map((ev) => [ev.id, ev.currentVersion]));
  const refs = [];
  for (const id of evidenceIds) {
    const row = rows.find((r) => r.EvidenceId === id && r.version === current.get(id));
    if (!row || row.hasChatOrigin || sourceRevoked(row)) throw new ReviewError(400, 'invalid_evidence', 'Solo puedes compartir evidencias propias, confirmadas y que no vengan del chat.', 'You can only share your own confirmed evidence that does not come from chat.');
    refs.push({ evidenceId: id, version: row.version });
  }
  return refs;
}

// ES-303 (PR A): ya NO se elige al revisor por número. Dos formas, EXACTAMENTE una por solicitud:
//   { inviteCode, evidenceIds, requestId }  — la primera vez: la persona canjea el código de un solo uso que le dio el revisor (el servidor resuelve al revisor dentro de la transacción);
//   { shareId, evidenceIds, requestId }     — material nuevo para un revisor al que YA tiene autorizado (su última autorización con él sigue vigente): no pide código y no permite autorizar a nadie nuevo.
// `reviewerId` en el cuerpo responde 410 `use_invite` (era el vector de sondeo). Orden fijo para no revelar nada: forma → tope de intentos (usuario e IP) → evidencias PROPIAS → código/autorización → revisor utilizable.
const USE_INVITE = () => new ReviewError(410, 'use_invite', 'Ya no se elige a la persona revisora por número: usa el código de invitación que ella te dio.', 'A reviewer can no longer be chosen by number: use the invitation code they gave you.');
const shareNotFound = () => new ReviewError(404, 'share_not_found', 'No se encontró esa autorización.', 'That authorization was not found.');

async function authorize(userId, body, { ip } = {}) {
  if (body && typeof body === 'object' && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, 'reviewerId')) throw USE_INVITE();
  const viaInvite = !!body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'inviteCode');
  const viaShare = !!body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'shareId');
  if (!hasKeysOnly(body, [viaInvite ? 'inviteCode' : 'shareId', 'evidenceIds', 'requestId']) || viaInvite === viaShare || !isRequestId(body.requestId)
    || !Array.isArray(body.evidenceIds) || body.evidenceIds.length < 1 || body.evidenceIds.length > MAX_EVIDENCE || !body.evidenceIds.every(isId)) throw invalid();
  const rawCode = viaInvite ? reviewInvites.normalizeCode(body.inviteCode) : null;
  if (viaInvite ? !rawCode : !isId(body.shareId)) throw invalid();
  const evidenceIds = [...new Set(body.evidenceIds)].sort((a, b) => a - b);
  if (evidenceIds.length !== body.evidenceIds.length) throw invalid();
  takeAttempt(userId); // ANTES de validar evidencias, código o revisor: el mismo tope para cualquier valor
  if (viaInvite) reviewInvites.takeIpAttempt(ip);
  const conflict = () => new ReviewError(409, 'request_conflict', 'Ese identificador de solicitud ya se usó con otros datos.', 'That request identifier was already used with different data.');
  const replay = async () => {
    const found = await ReviewShare.findOne({ where: { UserId: userId, requestId: body.requestId } });
    if (!found) return null;
    if (!sameSet(found.evidenceRefs.map((r) => r.evidenceId).sort((a, b) => a - b), evidenceIds)) throw conflict();
    if (viaInvite) { const used = await reviewInvites.redeemedBy(userId, rawCode); if (!used || used.reviewerId !== found.reviewerId) throw conflict(); } // el código ya está usado: solo vale para repetir ESTA solicitud
    else { const base = await ReviewShare.findOne({ where: { id: body.shareId, UserId: userId } }); if (!base || base.reviewerId !== found.reviewerId) throw conflict(); }
    return found;
  };
  const earlier = await replay();
  if (earlier) return shareView(earlier);
  // E262-1: primero lo PROPIO de la persona (evidencias) y solo después el revisor: con una evidencia inválida la respuesta es la misma para cualquier código o autorización.
  const refs = await shareableRefs(userId, evidenceIds);
  let reviewerId;
  if (viaInvite) reviewerId = (await reviewInvites.resolve(userId, rawCode, reviewerOf)).reviewer.id; // 404 invite_not_found uniforme
  else {
    const base = await ReviewShare.findOne({ where: { id: body.shareId, UserId: userId } });
    if (!base) throw shareNotFound();
    const latest = await ReviewShare.findOne({ where: { UserId: userId, reviewerId: base.reviewerId }, order: [['materialVersion', 'DESC']] });
    if (!latest || latest.status !== 'granted' || !await reviewerOf(base.reviewerId)) throw shareNotFound(); // retirada o revisor ya no utilizable: hace falta una invitación nueva
    reviewerId = base.reviewerId;
  }
  // E262-4: el permiso y la autorización se crean en UNA transacción: si falla la autorización no queda el permiso concedido NI se consume el código.
  for (let attempt = 1; ; attempt++) {
    try {
      const share = await sequelize.transaction(async (transaction) => {
        await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('review-share:' || :u || ':' || :r))", { replacements: { u: String(userId), r: String(reviewerId) }, transaction });
        if (viaInvite) { const reviewer = await reviewInvites.redeemIn(userId, rawCode, reviewerOf, transaction); if (reviewer.id !== reviewerId) throw new ReviewError(404, 'invite_not_found', 'No se encontró esa invitación.', 'That invitation was not found.'); }
        await consent.grantIn(userId, PURPOSE, consent.reviewerScope(reviewerId), transaction);
        // La autorización anterior a este revisor queda sustituida (sus revisiones se conservan y se ven con «el material cambió»).
        await ReviewShare.update({ status: 'superseded' }, { where: { UserId: userId, reviewerId, status: 'granted' }, transaction });
        const last = Number(await ReviewShare.max('materialVersion', { where: { UserId: userId, reviewerId }, transaction })) || 0;
        return ReviewShare.create({ UserId: userId, reviewerId, materialVersion: last + 1, evidenceRefs: refs, status: 'granted', requestId: body.requestId }, { transaction });
      });
      return shareView(share);
    } catch (error) {
      if (error instanceof consent.ConsentRequiredError) throw new ReviewError(403, 'consent_revoked', 'No se puede autorizar ahora.', 'Authorization is not possible right now.');
      if (error instanceof UniqueConstraintError) { const again = await replay(); if (again) return shareView(again); if (attempt === 1) continue; }
      throw error;
    }
  }
}

// Retirar: corta el acceso NUEVO del revisor al instante (el permiso se comprueba en cada acceso). No borra lo que la persona escribió (su objeción).
async function revoke(userId, shareId) {
  if (!isId(shareId)) throw notFound();
  const share = await ReviewShare.findOne({ where: { id: shareId, UserId: userId } });
  if (!share) throw notFound();
  await consent.setConsent(userId, PURPOSE, 'revoked', consent.reviewerScope(share.reviewerId));
  await ReviewShare.update({ status: 'revoked', revokedAt: new Date() }, { where: { UserId: userId, reviewerId: share.reviewerId, status: 'granted' } });
  return shareView(await ReviewShare.findByPk(share.id));
}

// ES-367: la persona DUEÑA ve el NOMBRE de a quién autorizó (ya lo vio al canjear la invitación). Solo el nombre: nada de correo, especialidad ni estado de la cuenta. Un revisor eliminado = null.
async function listShares(userId) {
  const rows = await ReviewShare.findAll({ where: { UserId: userId }, order: [['id', 'DESC']], limit: 200 });
  const ids = [...new Set(rows.map((row) => row.reviewerId))];
  const people = ids.length ? await User.findAll({ where: { id: ids }, attributes: ['id', 'name'] }) : [];
  const names = new Map(people.map((person) => [person.id, typeof person.name === 'string' && person.name.trim() ? person.name : null]));
  return rows.map((row) => ({ ...shareView(row), reviewerName: names.get(row.reviewerId) ?? null }));
}

// ───────────────────────── La persona: lo que recibió ─────────────────────────

async function evidenceTitles(userId, refs) {
  const out = new Map();
  const ids = [...new Set(refs.map((r) => r.evidenceId))];
  if (!ids.length) return out;
  const rows = await EvidenceVersion.findAll({ where: { UserId: userId, EvidenceId: ids } });
  for (const row of rows) { try { out.set(`${row.EvidenceId}:${row.version}`, String(decode(row).title || '')); } catch { /* contenido vaciado al borrar la evidencia */ } }
  return out;
}

async function listReviews(userId) {
  const reviews = await ProfessionalReview.findAll({ where: { UserId: userId }, order: [['id', 'DESC']], limit: 200 });
  if (!reviews.length) return [];
  const [objections, shares, reviewers] = await Promise.all([
    ReviewObjection.findAll({ where: { reviewId: reviews.map((r) => r.id), UserId: userId } }),
    ReviewShare.findAll({ where: { id: reviews.map((r) => r.shareId), UserId: userId } }),
    User.findAll({ where: { id: [...new Set(reviews.map((r) => r.reviewerId))] }, attributes: ['id', 'name'] }),
  ]);
  const responses = objections.length ? await ReviewResponse.findAll({ where: { objectionId: objections.map((o) => o.id), UserId: userId } }) : [];
  const allRefs = reviews.flatMap((r) => r.evidenceRefs);
  const [titles, live] = await Promise.all([evidenceTitles(userId, allRefs), liveVersions(userId, [...new Set(allRefs.map((r) => r.evidenceId))])]); // por lotes: sin una consulta por revisión
  const out = [];
  for (const review of reviews) {
    const objection = objections.find((o) => o.reviewId === review.id);
    const response = objection ? responses.find((r) => r.objectionId === objection.id) : null;
    const share = shares.find((s) => s.id === review.shareId);
    out.push({
      id: review.id,
      author: { displayName: (reviewers.find((u) => u.id === review.reviewerId) || {}).name || null },
      createdAt: review.createdAt,
      locale: review.locale,
      materialVersion: review.materialVersion,
      materialChanged: !share || share.status !== 'granted' || refsChanged(review.evidenceRefs, live), // se sustituyó, se retiró, o la persona editó/borró lo compartido: la revisión original se conserva
      evidence: review.evidenceRefs.map((ref) => ({ title: titles.get(`${ref.evidenceId}:${ref.version}`) || null, version: ref.version })),
      observation: desencriptar(review.observation),
      limits: desencriptar(review.limits),
      supersedesId: review.supersedesId,
      status: objection ? (response ? 'answered' : 'pending') : 'none',
      objection: objection ? { reason: desencriptar(objection.reason), locale: objection.locale, createdAt: objection.createdAt } : null,
      response: response ? { text: desencriptar(response.text), locale: response.locale, createdAt: response.createdAt, author: { displayName: (reviewers.find((u) => u.id === response.reviewerId) || {}).name || null } } : null,
    });
  }
  return out;
}

// UNA objeción por revisión, idempotente por requestId. Exige que la autorización de la persona a ese revisor siga vigente (si se retiró a mitad: 403 y no se guarda nada).
async function object(userId, reviewId, body) {
  if (!hasKeysOnly(body, ['reason', 'requestId', 'locale']) || !isRequestId(body.requestId)) throw invalid();
  const reason = cleanText(body.reason); const locale = cleanLocale(body.locale);
  if (!isId(reviewId)) throw notFound();
  const review = await ProfessionalReview.findOne({ where: { id: reviewId, UserId: userId } });
  if (!review) throw notFound();
  const same = async () => {
    const found = await ReviewObjection.findOne({ where: { UserId: userId, requestId: body.requestId } });
    if (found) {
      if (found.reviewId !== review.id) throw new ReviewError(409, 'request_conflict', 'Ese identificador de solicitud ya se usó con otros datos.', 'That request id was already used with different data.');
      return { id: found.id, reviewId: found.reviewId, createdAt: found.createdAt, replay: true };
    }
    return null;
  };
  const prior = await same();
  if (prior) return prior;
  try {
    const row = await withReviewConsent(userId, review.reviewerId, 'consent_revoked', async (transaction) => {
      if (await ReviewObjection.findOne({ where: { reviewId: review.id }, transaction })) throw new ReviewError(409, 'already_objected', 'Esta revisión ya tiene una objeción.', 'This review already has an objection.');
      return ReviewObjection.create({ reviewId: review.id, UserId: userId, reason: encriptar(reason), locale, requestId: body.requestId }, { transaction });
    });
    return { id: row.id, reviewId: row.reviewId, createdAt: row.createdAt, replay: false };
  } catch (error) {
    if (error instanceof ReviewError && error.code === 'already_objected') { const again = await same(); if (again) return again; } // la repetición con el mismo requestId no es una segunda objeción
    if (error instanceof UniqueConstraintError) { // carrera: gana una; la otra es repetición (mismo requestId) o segunda objeción
      const again = await same();
      if (again) return again;
      throw new ReviewError(409, 'already_objected', 'Esta revisión ya tiene una objeción.', 'This review already has an objection.');
    }
    throw error;
  }
}

// ───────────────────────── El revisor (lado mínimo, sin pantallas) ─────────────────────────

const pickMaterial = (payload) => Object.fromEntries(['title', 'situation', 'responsibility', 'actions', 'alternatives', 'goal', 'delivered', 'observedEffect', 'learning', 'autonomy'].filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));

async function reviewerShares(reviewerId) {
  const shares = await ReviewShare.findAll({ where: { reviewerId, status: 'granted' }, order: [['id', 'DESC']], limit: 100 });
  const ordinals = await ordinalsFor(reviewerId, shares.map((s) => s.UserId));
  const out = [];
  for (const share of shares) {
    let material;
    try {
      // Permiso vigente de ESA persona hacia ESTE revisor, comprobado al leer el material.
      material = await withReviewConsent(share.UserId, reviewerId, 'consent_required', async (transaction) => {
        const ids = share.evidenceRefs.map((r) => r.evidenceId);
        const rows = await EvidenceVersion.findAll({ where: { UserId: share.UserId, EvidenceId: ids, status: 'confirmed' }, transaction });
        const live = await liveVersions(share.UserId, ids, transaction);
        // Una evidencia BORRADA no aparece (ni vacía); una EDITADA se ve en la versión fijada con `changed` y el aviso `materialChanged`.
        const items = share.evidenceRefs.flatMap((ref) => { if (!live.has(ref.evidenceId)) return []; const row = rows.find((r) => r.EvidenceId === ref.evidenceId && r.version === ref.version); if (!row) return []; try { return [{ evidenceId: ref.evidenceId, version: ref.version, changed: live.get(ref.evidenceId) !== ref.version, ...pickMaterial(decode(row)) }]; } catch { return []; } });
        return { items, changed: refsChanged(share.evidenceRefs, live) };
      });
    } catch (error) { if (error instanceof ReviewError) continue; throw error; }
    out.push({ shareId: share.id, person: `Persona ${ordinals.get(Number(share.UserId))}`, materialVersion: share.materialVersion, materialChanged: material.changed, material: material.items });
  }
  return out;
}

async function createReview(reviewerId, body) {
  if (!hasKeysOnly(body, ['shareId', 'evidenceIds', 'observation', 'limits', 'locale', 'requestId', 'supersedesId']) || !isId(body.shareId) || !isRequestId(body.requestId)
    || !Array.isArray(body.evidenceIds) || body.evidenceIds.length < 1 || !body.evidenceIds.every(isId) || (body.supersedesId !== undefined && !isId(body.supersedesId))) throw invalid();
  const observation = cleanText(body.observation); const limits = cleanText(body.limits); const locale = cleanLocale(body.locale);
  const share = await ReviewShare.findOne({ where: { id: body.shareId, reviewerId } });
  if (!share) throw notFound();
  const replay = async () => {
    const found = await ProfessionalReview.findOne({ where: { reviewerId, requestId: body.requestId } });
    if (!found) return null;
    if (found.shareId !== share.id) throw new ReviewError(409, 'request_conflict', 'Ese identificador de solicitud ya se usó con otros datos.', 'That request id was already used with different data.');
    return { id: found.id, createdAt: found.createdAt, replay: true };
  };
  const earlier = await replay();
  if (earlier) return earlier;
  const shared = share.evidenceRefs.map((r) => r.evidenceId);
  const ids = [...new Set(body.evidenceIds)].sort((a, b) => a - b);
  if (!ids.every((id) => shared.includes(id))) throw new ReviewError(400, 'invalid_evidence', 'Solo puedes citar evidencias que la persona autorizó.', 'You can only cite evidence the person authorized.');
  try {
    const row = await withReviewConsent(share.UserId, reviewerId, 'consent_required', async (transaction) => {
      const fresh = await ReviewShare.findByPk(share.id, { transaction, lock: Transaction.LOCK.SHARE });
      if (!fresh || fresh.status !== 'granted') throw new ReviewError(409, 'share_not_current', 'La autorización ya no es la vigente.', 'The authorization is no longer the current one.');
      const live = await liveVersions(share.UserId, ids, transaction);
      if (ids.some((id) => !live.has(id))) throw new ReviewError(400, 'invalid_evidence', 'Esa evidencia ya no está disponible.', 'That evidence is no longer available.'); // E262-3: una borrada no se puede citar
      if (body.supersedesId !== undefined && !await ProfessionalReview.findOne({ where: { id: body.supersedesId, reviewerId, UserId: share.UserId }, transaction })) throw notFound();
      return ProfessionalReview.create({
        shareId: share.id, UserId: share.UserId, reviewerId, materialVersion: share.materialVersion, evidenceRefs: share.evidenceRefs.filter((r) => ids.includes(r.evidenceId)),
        observation: encriptar(observation), limits: encriptar(limits), locale, supersedesId: body.supersedesId ?? null, requestId: body.requestId,
      }, { transaction });
    });
    return { id: row.id, createdAt: row.createdAt, replay: false };
  } catch (error) {
    if (error instanceof UniqueConstraintError) { const again = await replay(); if (again) return again; }
    throw error;
  }
}

// Objeciones recibidas por este revisor: solo si la autorización de esa persona sigue vigente.
async function reviewerObjections(reviewerId) {
  const reviews = await ProfessionalReview.findAll({ where: { reviewerId }, order: [['id', 'DESC']], limit: 200 });
  if (!reviews.length) return [];
  const objections = await ReviewObjection.findAll({ where: { reviewId: reviews.map((r) => r.id) } });
  const answered = objections.length ? new Set((await ReviewResponse.findAll({ where: { objectionId: objections.map((o) => o.id) }, attributes: ['objectionId'] })).map((r) => r.objectionId)) : new Set();
  const ordinals = await ordinalsFor(reviewerId, objections.map((o) => o.UserId));
  const out = [];
  // Una comprobación de permiso por PERSONA (no por objeción): en la misma transacción se descifran todas sus objeciones.
  for (const personId of [...new Set(objections.map((o) => o.UserId))]) {
    let rows;
    try { rows = await withReviewConsent(personId, reviewerId, 'consent_required', async () => objections.filter((o) => o.UserId === personId).map((o) => [o, desencriptar(o.reason)])); } catch (error) { if (error instanceof ReviewError) continue; throw error; }
    for (const [objection, reason] of rows) out.push({ objectionId: objection.id, reviewId: objection.reviewId, person: `Persona ${ordinals.get(Number(objection.UserId))}`, reason, locale: objection.locale, createdAt: objection.createdAt, status: answered.has(objection.id) ? 'answered' : 'pending' });
  }
  out.sort((a, b) => b.objectionId - a.objectionId);
  return out;
}

async function respond(reviewerId, objectionId, body) {
  if (!hasKeysOnly(body, ['text', 'requestId', 'locale']) || !isRequestId(body.requestId)) throw invalid();
  const text = cleanText(body.text); const locale = cleanLocale(body.locale);
  if (!isId(objectionId)) throw notFound();
  const objection = await ReviewObjection.findByPk(objectionId);
  const review = objection ? await ProfessionalReview.findOne({ where: { id: objection.reviewId, reviewerId } }) : null;
  if (!objection || !review) throw notFound();
  const replay = async () => {
    const found = await ReviewResponse.findOne({ where: { reviewerId, requestId: body.requestId } });
    if (!found) return null;
    if (found.objectionId !== objection.id) throw new ReviewError(409, 'request_conflict', 'Ese identificador de solicitud ya se usó con otros datos.', 'That request id was already used with different data.');
    return { id: found.id, createdAt: found.createdAt, replay: true };
  };
  const earlier = await replay();
  if (earlier) return earlier;
  try {
    const row = await withReviewConsent(objection.UserId, reviewerId, 'consent_required', async (transaction) => {
      if (await ReviewResponse.findOne({ where: { objectionId: objection.id }, transaction })) throw new ReviewError(409, 'already_responded', 'Esta objeción ya tiene respuesta.', 'This objection already has a response.');
      return ReviewResponse.create({ objectionId: objection.id, UserId: objection.UserId, reviewerId, text: encriptar(text), locale, requestId: body.requestId }, { transaction });
    });
    return { id: row.id, createdAt: row.createdAt, replay: false };
  } catch (error) {
    if (error instanceof ReviewError && error.code === 'already_responded') { const again = await replay(); if (again) return again; }
    if (error instanceof UniqueConstraintError) {
      const again = await replay();
      if (again) return again;
      throw new ReviewError(409, 'already_responded', 'Esta objeción ya tiene respuesta.', 'This objection already has a response.');
    }
    throw error;
  }
}

module.exports = { _test: { setClock: (fn) => { clock = fn; }, reset: () => attempts.clear() }, ReviewError, reviewerOf, takeAttempt, authorize, revoke, listShares, listReviews, object, reviewerShares, createReview, reviewerObjections, respond, MAX_TEXT };
