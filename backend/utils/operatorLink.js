// ES-376 · Enlace de restablecimiento emitido por quien OPERA el servidor, sin correo (mientras no haya proveedor, ES-371).
// Solo lo usa backend/scripts/issue-link.cjs: no hay ruta ni pantalla. Reutiliza PasswordReset (hash SHA-256, un solo uso, vence, el último enlace invalida al anterior)
// y la ruta pública de confirmación, que no cambia. El token solo existe en memoria del proceso del script; en la base solo queda su hash.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const PasswordReset = require('../PasswordReset');
const AdminAuditEntry = require('../AdminAuditEntry');
const { findUserByEmail } = require('./emailNormalize');
const { deletionPending } = require('./deletionGuard');
const { recordAdminAction } = require('./adminAudit');

const ALLOWED_ROLES = ['user', 'therapist']; // persona y profesional; nunca board, admin ni superadmin
const OPERATOR_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/; // identificador de operador: no secreto, sin datos personales (ej. «ops-ana»); lista cerrada de caracteres
const DEFAULT_TTL_MINUTES = 15;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 60;
const DEFAULT_PER_ACCOUNT_HOUR = 3;

class OperatorLinkError extends Error {
  // `code` sale de una lista cerrada; el mensaje nunca lleva correo, id, enlace ni token.
  constructor(code) { super(`No se emitió el enlace (${code}).`); this.name = 'OperatorLinkError'; this.code = code; }
}

// ES-386: cuota PROPIA del operador (OPERATOR_LINK_PER_ACCOUNT_HOUR, 1–10): se cuenta en la auditoría de operador, no en PasswordResets, para que las solicitudes anónimas de la ruta pública
// (que comparten esa tabla) no puedan agotarla y bloquear al operador.
function perAccountPerHour(env = process.env) {
  const raw = Number(env.OPERATOR_LINK_PER_ACCOUNT_HOUR);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PER_ACCOUNT_HOUR;
  return Math.min(10, Math.max(1, Math.trunc(raw)));
}

function ttlMinutes(env = process.env) {
  const raw = Number(env.OPERATOR_LINK_TTL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_MINUTES;
  return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, Math.trunc(raw)));
}

// La base del enlace debe ser https (o localhost en desarrollo): un enlace con token por http viajaría en claro.
function checkBase(value) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  let url;
  try { url = new URL(base); } catch { throw new OperatorLinkError('config'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) throw new OperatorLinkError('config');
  return base;
}

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

async function issueOperatorLink({ email, base, operatorId, env = process.env }) {
  const given = operatorId === undefined ? env.OPERATOR_ID : operatorId; // solo una cadena vale: null, números u objetos no se convierten en «null» ni «42»
  const label = typeof given === 'string' ? given.trim() : '';
  if (!OPERATOR_ID.test(label)) throw new OperatorLinkError('operator_id'); // sin saber QUIÉN opera no se emite nada
  const OPERATOR = { id: null, role: 'operator', label };
  const limit = perAccountPerHour(env);
  const safeBase = checkBase(base || env.APP_BASE_URL || env.FRONTEND_URL);
  const minutes = ttlMinutes(env);
  if (typeof email !== 'string' || !email.trim() || email.length > 254) throw new OperatorLinkError('not_found');
  const user = await findUserByEmail(User, email);
  if (!user) throw new OperatorLinkError('not_found');

  const token = crypto.randomBytes(32).toString('base64url');
  const transaction = await sequelize.transaction();
  let expiresAt;
  try {
    // Bajo el bloqueo de la fila se vuelve a mirar todo: el rol, la baja y el estado pudieron cambiar entre la lectura y aquí.
    const locked = await User.findOne({ where: { id: user.id }, transaction, lock: true });
    if (!locked) throw new OperatorLinkError('not_found');
    if (!ALLOWED_ROLES.includes(locked.role)) {
      await transaction.rollback();
      await recordAdminAction({ actor: OPERATOR, action: 'user.operator_link', targetType: 'user', targetId: locked.id, result: 'denied' });
      throw new OperatorLinkError('role_not_allowed');
    }
    if (locked.active === false) throw new OperatorLinkError('inactive');
    if (await deletionPending(locked.id, transaction)) throw new OperatorLinkError('deletion_pending');
    // Se cuenta bajo el bloqueo de la fila: emisiones simultáneas del operador se ponen en fila y el tope se respeta exactamente.
    const recent = await AdminAuditEntry.count({ where: { action: 'user.operator_link', targetType: 'user', targetId: locked.id, result: 'ok', createdAt: { [Op.gt]: new Date(Date.now() - 60 * 60 * 1000) } }, transaction });
    if (recent >= limit) throw new OperatorLinkError('rate_limited');
    await PasswordReset.update({ usedAt: new Date() }, { where: { UserId: locked.id, usedAt: null }, transaction }); // solo vale el último enlace
    expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    await PasswordReset.create({ UserId: locked.id, tokenHash: hashToken(token), expiresAt }, { transaction });
    // La auditoría va en la MISMA transacción: si no se puede registrar, no sale ningún enlace.
    await recordAdminAction({ actor: OPERATOR, action: 'user.operator_link', targetType: 'user', targetId: locked.id }, { transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback().catch(() => {});
    if (error instanceof OperatorLinkError) throw error;
    throw new OperatorLinkError('failed');
  }
  return { link: `${safeBase}/reset-password#token=${token}`, expiresAt, minutes };
}

module.exports = { issueOperatorLink, OperatorLinkError, ALLOWED_ROLES, ttlMinutes, perAccountPerHour, checkBase, OPERATOR_ID };
