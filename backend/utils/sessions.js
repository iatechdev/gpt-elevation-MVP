// backend/utils/sessions.js
// Sesiones JWT con revocación en servidor (ES-18): emisión con jti, comprobación y cierre.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const JWT_SECRET = require('../config/jwt');
const RevokedToken = require('../RevokedToken');
const AuthRevocation = require('../AuthRevocation');
const { deletionPending } = require('./deletionGuard');

const SESSION_TTL = '8h';

// Último corte de sesiones hecho por ESTE proceso (ms). La validación revoca todo token con iatMs <= corte (en el mismo milisegundo no se sabe el orden, así que se revoca). Para que un inicio de sesión POSTERIOR al corte nunca
// quede revocado por caer en ese mismo milisegundo (QA-18-05; intermitencia 401 en el CI de main), un token emitido por este proceso lleva siempre iatMs > último corte.
let lastCutMs = 0;

// Cada token lleva un identificador único (jti) para poder revocarlo.
const issueToken = (user) => jwt.sign(
  // iatMs: instante de emisión en milisegundos (el claim estándar iat solo llega al segundo); permite que un inicio de sesión
  // inmediatamente posterior a un corte de sesiones no quede revocado (QA-18-05).
  { id: user.id, name: user.name, role: user.role, iatMs: Math.max(Date.now(), lastCutMs + 1) },
  JWT_SECRET,
  { expiresIn: SESSION_TTL, jwtid: crypto.randomBytes(16).toString('hex') },
);

// Devuelve null si la sesión vale, o el motivo ('legacy' | 'revoked').
// Los errores de base de datos se propagan: quien llama debe rechazar (cierra en falla).
const sessionProblem = async (payload, { allowDeletionReceipt = false } = {}) => {
  if (typeof payload.jti !== 'string' || !payload.jti) return 'legacy'; // token anterior a ES-18
  if (await RevokedToken.findByPk(payload.jti)) return 'revoked';
  const cutoff = await AuthRevocation.findByPk(payload.id);
  if (cutoff) {
    // Con iatMs la comparación es exacta; sin él (tokens de pruebas o emisores antiguos) se usa el inicio del segundo de iat (revoca de más, nunca de menos).
    const issuedMs = Number.isFinite(payload.iatMs) ? payload.iatMs : payload.iat * 1000;
    if (issuedMs <= new Date(cutoff.revokedBefore).getTime()) return 'revoked';
  }
  if (!allowDeletionReceipt && await deletionPending(payload.id)) return 'deletion_pending';
  return null;
};

const revokeToken = async (payload) => {
  await RevokedToken.upsert({
    jti: payload.jti,
    UserId: payload.id,
    expiresAt: new Date(payload.exp * 1000),
  });
  // Limpieza oportunista de registros vencidos; un fallo aquí no afecta al cierre de sesión.
  try { await RevokedToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } }); } catch { /* sin efecto */ }
};

const revokeUserSessions = async (userId) => {
  const cut = new Date(Date.now()); lastCutMs = Math.max(lastCutMs, cut.getTime());
  await AuthRevocation.upsert({ UserId: userId, revokedBefore: cut });
};

module.exports = { issueToken, sessionProblem, revokeToken, revokeUserSessions, SESSION_TTL };
