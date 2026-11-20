// backend/utils/reviewInvites.js
// ES-303 (PR A) · Invitación de una persona REVISORA con código de un solo uso. Decisión de Mauricio (16-nov-2026, opción A): la persona NO elige a un profesional de una lista ni envía un `reviewerId`;
// canjea el código que le dio el propio revisor. Sin directorio ni enumeración. Condiciones de Infra (ES-303, 12640):
//   - código de un solo uso con consumo ATÓMICO (dos canjes simultáneos: gana uno; ver `redeemIn`, que lo marca usado DENTRO de la transacción de la autorización);
//   - solo el sha256 se guarda; el código nunca va a logs ni a errores; se muestra una sola vez al emitirlo;
//   - 404 uniforme `invite_not_found` (inexistente, usado, vencido, anulado, propio, revisor inactivo o borrándose) y tope de intentos POR USUARIO (el de #262) y POR IP, aplicados ANTES de buscar el código;
//   - el emisor puede anular un código activo; el canje verifica en servidor que el revisor sigue activo; ningún dato de diario ni de crisis en ninguna respuesta;
//   - el revisor NO sabe quién canjeó (no se le devuelve `usedByUserId`).
// 80 bits (Crockford base32, 16 caracteres, con guiones cada 4); vence a los 7 días; máximo 10 activas por revisor. Los límites de intentos son en memoria de este proceso (declarado, como loginRateLimit).
const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../database');
const ReviewerInvite = require('../ReviewerInvite');

const REVIEW_INVITER_ROLES = ['therapist']; // ampliable después (superadmin, profesionales por solicitud) sin tocar el resto, como INVITER_ROLES de ES-192
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_ACTIVE_INVITES = 10;
const KEEP_AFTER_MS = 30 * 24 * 3600 * 1000; // las vencidas, usadas o anuladas se limpian 30 días después
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: sin I, L, O, U
const CODE_LENGTH = 16;
const MAX_IP_ATTEMPTS_PER_HOUR = 60;

class InviteError extends Error {
  constructor(status, code, es, en, extra = {}) { super(`${es} / ${en}`); this.status = status; this.code = code; Object.assign(this, extra); }
}
const invalid = () => new InviteError(400, 'invalid_input', 'Datos inválidos.', 'Invalid data.');
const inviteNotFound = () => new InviteError(404, 'invite_not_found', 'No se encontró esa invitación.', 'That invitation was not found.');
const isRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const isId = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const hasKeysOnly = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key));

let clock = () => Date.now();

// ── Código ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function newCode() {
  const bytes = crypto.randomBytes(10); let bits = ''; for (const byte of bytes) bits += byte.toString(2).padStart(8, '0'); // 80 bits
  let raw = ''; for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return raw;
}
const display = (raw) => raw.match(/.{4}/g).join('-');
/** Código escrito por la persona → los 16 caracteres canónicos, o null si no tiene la forma (se toleran mayúsculas/minúsculas, espacios, guiones y la confusión O/0, I/L/1 de Crockford). */
function normalizeCode(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const raw = value.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return raw.length === CODE_LENGTH && [...raw].every((c) => ALPHABET.includes(c)) ? raw : null;
}
const hashCode = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// ── Topes de intentos ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ipAttempts = new Map();
/** Tope por IP y hora: cuenta todo intento válido en forma, acierte o no; la respuesta es la misma 429 para cualquier código. La IP no se guarda en ningún registro, solo en este mapa acotado. */
function takeIpAttempt(ip) {
  const key = typeof ip === 'string' && ip ? ip : 'unknown'; const cutoff = clock() - 3600 * 1000;
  const recent = (ipAttempts.get(key) || []).filter((at) => at > cutoff);
  if (recent.length >= MAX_IP_ATTEMPTS_PER_HOUR) { ipAttempts.set(key, recent); throw new InviteError(429, 'rate_limited', 'Demasiados intentos seguidos. Inténtalo más tarde.', 'Too many attempts in a row. Try again later.'); }
  recent.push(clock()); ipAttempts.set(key, recent);
  if (ipAttempts.size > 20000) for (const [k, list] of ipAttempts) { if (!list.some((at) => at > cutoff)) ipAttempts.delete(k); }
}

// ── Vistas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const statusOf = (row, now = clock()) => (row.usedAt ? 'used' : row.revokedAt ? 'revoked' : new Date(row.expiresAt).getTime() <= now ? 'expired' : 'active');
// El revisor ve estado y fechas; NUNCA quién la canjeó ni el código.
const inviteView = (row) => ({ id: row.id, status: statusOf(row), createdAt: row.createdAt, expiresAt: row.expiresAt, usedAt: row.usedAt, revokedAt: row.revokedAt });

// ── Lado del revisor ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Emite una invitación. El código sale UNA vez en esta respuesta; un reintento con el mismo requestId NO puede devolverlo (solo se guarda su hash): responde la invitación existente sin código. */
async function issue(reviewer, body) {
  if (!hasKeysOnly(body, ['requestId']) || !isRequestId(body.requestId)) throw invalid();
  if (!reviewer || !REVIEW_INVITER_ROLES.includes(reviewer.role)) throw new InviteError(403, 'not_allowed', 'No puedes emitir invitaciones.', 'You cannot issue invitations.');
  const now = new Date(clock());
  return sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('review-invite:' || :r))", { replacements: { r: String(reviewer.id) }, transaction });
    const again = await ReviewerInvite.findOne({ where: { reviewerId: reviewer.id, requestId: body.requestId }, transaction });
    if (again) return { replay: true, invite: inviteView(again) };
    await ReviewerInvite.destroy({ where: { reviewerId: reviewer.id, [Op.or]: [{ expiresAt: { [Op.lt]: new Date(now.getTime() - KEEP_AFTER_MS) } }, { usedAt: { [Op.lt]: new Date(now.getTime() - KEEP_AFTER_MS) } }, { revokedAt: { [Op.lt]: new Date(now.getTime() - KEEP_AFTER_MS) } }] }, transaction });
    const active = await ReviewerInvite.count({ where: { reviewerId: reviewer.id, usedAt: null, revokedAt: null, expiresAt: { [Op.gt]: now } }, transaction });
    if (active >= MAX_ACTIVE_INVITES) throw new InviteError(409, 'too_many_active', `Ya tienes ${MAX_ACTIVE_INVITES} invitaciones activas. Anula alguna o espera a que venzan.`, `You already have ${MAX_ACTIVE_INVITES} active invitations. Cancel one or wait for them to expire.`, { max: MAX_ACTIVE_INVITES });
    const raw = newCode();
    const row = await ReviewerInvite.create({ reviewerId: reviewer.id, tokenHash: hashCode(raw), requestId: body.requestId, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) }, { transaction });
    return { replay: false, invite: inviteView(row), code: display(raw) };
  });
}

async function listForReviewer(reviewerId) {
  return (await ReviewerInvite.findAll({ where: { reviewerId }, order: [['id', 'DESC']], limit: 50 })).map(inviteView);
}

/** Anula una invitación ACTIVA propia. Una ajena o inexistente = el mismo 404; una ya usada, vencida o anulada = 409 (no hay nada que anular). */
async function revoke(reviewerId, id) {
  if (!isId(id)) throw new InviteError(404, 'not_found', 'No se encontró.', 'Not found.');
  return sequelize.transaction(async (transaction) => {
    const row = await ReviewerInvite.findOne({ where: { id, reviewerId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new InviteError(404, 'not_found', 'No se encontró.', 'Not found.');
    if (statusOf(row) !== 'active') throw new InviteError(409, 'not_active', 'Esta invitación ya no está activa.', 'This invitation is no longer active.', { state: statusOf(row) }); // «state», no «status»: Object.assign pisaría el código HTTP
    await row.update({ revokedAt: new Date(clock()) }, { transaction });
    return inviteView(row);
  });
}

// ── Lado de la persona ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Busca la invitación ACTIVA de un código y valida que el revisor siga siendo utilizable. `reviewerOf` lo inyecta reviews.js (rol therapist, activo, sin borrado pendiente). Siempre el mismo 404. */
async function findActive(userId, rawCode, reviewerOf, { transaction, lock = false } = {}) {
  const row = await ReviewerInvite.findOne({ where: { tokenHash: hashCode(rawCode) }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!row || statusOf(row) !== 'active' || row.reviewerId === userId) throw inviteNotFound();
  const reviewer = await reviewerOf(row.reviewerId, transaction); // misma conexión que el bloqueo de la fila
  if (!reviewer) throw inviteNotFound();
  return { row, reviewer };
}

/** Paso 1 de la persona: ¿de quién es este código? Solo devuelve el NOMBRE del revisor y el vencimiento; no consume el código, no devuelve ids. */
async function lookup(userId, body, { ip, takeUserAttempt, reviewerOf }) {
  if (!hasKeysOnly(body, ['code'])) throw invalid();
  const raw = normalizeCode(body.code); if (!raw) throw invalid();
  takeUserAttempt(userId); takeIpAttempt(ip); // ANTES de buscar: el mismo tope para cualquier código
  const { row, reviewer } = await findActive(userId, raw, reviewerOf);
  return { reviewer: { name: reviewer.name }, expiresAt: row.expiresAt };
}

/** Paso 2 (dentro de la transacción de la autorización): bloquea la fila, la revisa de nuevo y la marca usada. Si algo posterior falla, la transacción entera se deshace y el código NO se consume. */
async function redeemIn(userId, rawCode, reviewerOf, transaction) {
  const { row, reviewer } = await findActive(userId, rawCode, reviewerOf, { transaction, lock: true });
  await row.update({ usedAt: new Date(clock()), usedByUserId: userId }, { transaction });
  return reviewer;
}

/** Para repetir una autorización con el mismo requestId: ¿este código es el que canjeó esta persona? (el código ya está usado, así que se busca sin exigir que esté activo). */
async function redeemedBy(userId, rawCode) {
  const row = await ReviewerInvite.findOne({ where: { tokenHash: hashCode(rawCode) } });
  return row && row.usedByUserId === userId ? row : null;
}

module.exports = {
  _test: { setClock: (fn) => { clock = fn; }, reset: () => ipAttempts.clear(), hashCode, normalizeCode, newCode, display },
  InviteError, REVIEW_INVITER_ROLES, INVITE_TTL_MS, MAX_ACTIVE_INVITES,
  issue, listForReviewer, revoke, lookup, resolve: findActive, redeemIn, redeemedBy, normalizeCode, takeIpAttempt,
};
