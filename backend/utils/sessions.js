// backend/utils/sessions.js
// Sesiones JWT con revocación en servidor (ES-18): emisión con jti, comprobación y cierre.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const JWT_SECRET = require('../config/jwt');
const RevokedToken = require('../RevokedToken');
const AuthRevocation = require('../AuthRevocation');

const SESSION_TTL = '8h';

// Cada token lleva un identificador único (jti) para poder revocarlo.
const issueToken = (user) => jwt.sign(
  // iatMs: instante de emisión en milisegundos (el claim estándar iat solo llega al segundo); permite que un inicio de sesión
  // inmediatamente posterior a un corte de sesiones no quede revocado (QA-18-05).
  { id: user.id, name: user.name, role: user.role, iatMs: Date.now() },
  JWT_SECRET,
  { expiresIn: SESSION_TTL, jwtid: crypto.randomBytes(16).toString('hex') },
);

// Devuelve null si la sesión vale, o el motivo ('legacy' | 'revoked').
// Los errores de base de datos se propagan: quien llama debe rechazar (cierra en falla).
const sessionProblem = async (payload) => {
  if (typeof payload.jti !== 'string' || !payload.jti) return 'legacy'; // token anterior a ES-18
  if (await RevokedToken.findByPk(payload.jti)) return 'revoked';
  const cutoff = await AuthRevocation.findByPk(payload.id);
  if (cutoff) {
    // Con iatMs la comparación es exacta; sin él (tokens de pruebas o emisores antiguos) se usa el inicio del segundo de iat (revoca de más, nunca de menos).
    const issuedMs = Number.isFinite(payload.iatMs) ? payload.iatMs : payload.iat * 1000;
    if (issuedMs <= new Date(cutoff.revokedBefore).getTime()) return 'revoked';
  }
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
  await AuthRevocation.upsert({ UserId: userId, revokedBefore: new Date() });
};

module.exports = { issueToken, sessionProblem, revokeToken, revokeUserSessions, SESSION_TTL };
