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

// RELOJ MONÓTONO DE ESTE PROCESO (ms). La validación revoca todo token con iatMs <= corte (en el mismo milisegundo no se sabe el orden, así que se revoca).
//  · Un token emitido DESPUÉS de un corte lleva iatMs > último corte (QA-18-05; intermitencia 401 en el CI de main, ES-365).
//  · Un corte lleva instante >= el iatMs de TODO token que este proceso emitió (QA-419-1): si el reloj retrocede (NTP, VM), un token emitido en esa ventana puede llevar un iatMs «futuro» y el corte de esa persona igualmente lo cubre.
// ES-366: estas dos marcas siguen siendo POR PROCESO y solo valen para los tokens SIN `sv` (anteriores al despliegue de ES-366, que expiran a las 8 h). Los tokens con `sv` se validan por versión de sesión en la base (AuthRevocation.sessionVersion): correcto con varias instancias y relojes distintos (QA-419-2).
let lastCutMs = 0;
let lastIssuedMs = 0;

// Cada token lleva un identificador único (jti) para poder revocarlo.
// ES-366: `sessionVersion` (opcional) es la versión de sesión vigente de la persona, leída de la base justo antes de firmar (currentSessionVersion). Sin ella el token no lleva `sv` y se valida con la regla por tiempo (compatibilidad).
const issueToken = (user, sessionVersion) => jwt.sign(
  // iatMs: instante de emisión en milisegundos (el claim estándar iat solo llega al segundo); permite que un inicio de sesión
  // inmediatamente posterior a un corte de sesiones no quede revocado (QA-18-05).
  { id: user.id, name: user.name, role: user.role, iatMs: (lastIssuedMs = Math.max(Date.now(), lastCutMs + 1, lastIssuedMs)), ...(Number.isInteger(sessionVersion) ? { sv: sessionVersion } : {}) },
  JWT_SECRET,
  { expiresIn: SESSION_TTL, jwtid: crypto.randomBytes(16).toString('hex') },
);

// Devuelve null si la sesión vale, o el motivo ('legacy' | 'revoked').
// Los errores de base de datos se propagan: quien llama debe rechazar (cierra en falla).
const sessionProblem = async (payload, { allowDeletionReceipt = false } = {}) => {
  if (typeof payload.jti !== 'string' || !payload.jti) return 'legacy'; // token anterior a ES-18
  if (await RevokedToken.findByPk(payload.jti)) return 'revoked';
  const cutoff = await AuthRevocation.findByPk(payload.id); // una lectura por petición, a la base (nunca caché por proceso: otra instancia seguiría aceptando un token revocado)
  if (payload.sv !== undefined) {
    // ES-366: token con versión de sesión: vale solo si es EXACTAMENTE la vigente (menor = cortado; mayor = imposible, se rechaza). Sin relojes.
    if (!Number.isInteger(payload.sv) || payload.sv !== Number(cutoff?.sessionVersion ?? 0)) return 'revoked';
  } else if (cutoff) {
    // Con iatMs la comparación es exacta; sin él (tokens de pruebas o emisores antiguos) se usa el inicio del segundo de iat (revoca de más, nunca de menos).
    const issuedMs = Number.isFinite(payload.iatMs) ? payload.iatMs : payload.iat * 1000;
    if (issuedMs <= new Date(cutoff.revokedBefore).getTime()) return 'revoked';
  }
  if (!allowDeletionReceipt && await deletionPending(payload.id)) return 'deletion_pending';
  return null;
};

// Versión de sesión vigente (se firma en el token al iniciar sesión).
const currentSessionVersion = async (userId) => Number((await AuthRevocation.findByPk(userId))?.sessionVersion ?? 0);

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
  const cut = new Date(Math.max(Date.now(), lastIssuedMs)); lastCutMs = Math.max(lastCutMs, cut.getTime());
  await AuthRevocation.advanceCut(userId, cut); // el corte solo avanza (GREATEST): dos cortes simultáneos de la misma persona no se pisan (QA-419-3)
};

module.exports = { issueToken, currentSessionVersion, sessionProblem, revokeToken, revokeUserSessions, SESSION_TTL };
