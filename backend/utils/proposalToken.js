// backend/utils/proposalToken.js
// Tokens firmados y sin estado de las propuestas de la IA (ES-28). Ligan una propuesta a la persona, a un propósito y (si hay) a su
// contenido, y vencen a los 10 minutos. Nada se guarda en base de datos: así no queda texto derivado del chat en reposo.

const { createHmac, timingSafeEqual } = require('crypto');
const JWT_SECRET = require('../config/jwt');

const TTL_MS = 10 * 60 * 1000;

const mac = (purpose, userId, expiresAtMs, content) => createHmac('sha256', JWT_SECRET)
  .update(`ES-28-${purpose}-v1\0`).update(String(userId)).update('\0').update(String(expiresAtMs)).update('\0')
  .update(content === undefined ? '' : JSON.stringify(content)).digest('hex');

function sign(purpose, userId, content) {
  const expiresAtMs = Date.now() + TTL_MS;
  return { token: `${expiresAtMs}.${mac(purpose, userId, expiresAtMs, content)}`, expiresAt: new Date(expiresAtMs) };
}

// Devuelve 'ok' | 'invalid' | 'expired'. Con `content`, el token solo vale para ese contenido exacto.
function check(purpose, userId, token, content) {
  const [expiresPart, given] = typeof token === 'string' ? token.split('.') : [];
  const expiresAtMs = Number(expiresPart);
  if (!Number.isSafeInteger(expiresAtMs) || !/^[0-9a-f]{64}$/.test(given || '')) return 'invalid';
  const expected = Buffer.from(mac(purpose, userId, expiresAtMs, content), 'hex');
  const actual = Buffer.from(given, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid';
  return expiresAtMs <= Date.now() ? 'expired' : 'ok';
}

module.exports = { sign, check, TTL_MS };
