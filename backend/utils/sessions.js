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
  { id: user.id, name: user.name, role: user.role },
  JWT_SECRET,
  { expiresIn: SESSION_TTL, jwtid: crypto.randomBytes(16).toString('hex') },
);

// Devuelve null si la sesión vale, o el motivo ('legacy' | 'revoked').
// Los errores de base de datos se propagan: quien llama debe rechazar (cierra en falla).
const sessionProblem = async (payload) => {
  if (typeof payload.jti !== 'string' || !payload.jti) return 'legacy'; // token anterior a ES-18
  if (await RevokedToken.findByPk(payload.jti)) return 'revoked';
  const cutoff = await AuthRevocation.findByPk(payload.id);
  // iat tiene resolución de segundos: el corte incluye el segundo en que se revocó.
  if (cutoff && payload.iat <= Math.floor(new Date(cutoff.revokedBefore).getTime() / 1000)) return 'revoked';
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
