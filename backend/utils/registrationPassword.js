// ES-128: política de contraseña del registro. Misma definición (shared/registration-password-policy.json) y mismas
// reglas en el cliente (frontend/src/access/registrationPassword.ts). El servidor es la fuente de verdad.
const policy = require('../../shared/registration-password-policy.json');
const common = new Set(policy.common);

// Carácter especial: ni letra, ni número, ni marca combinante, ni espacio en blanco (símbolos, puntuación y emojis cuentan; el espacio no).
const RULES = {
  length: value => [...value].length >= policy.minCharacters,
  upper: value => /\p{Lu}/u.test(value),
  lower: value => /\p{Ll}/u.test(value),
  digit: value => /[0-9]/.test(value),
  special: value => /[^\p{L}\p{N}\p{M}\s]/u.test(value),
};

// Ids estables de los requisitos que NO se cumplen: length, upper, lower, digit, special, max_bytes, common.
function passwordProblems(value) {
  if (typeof value !== 'string') return [...policy.rules];
  const missing = policy.rules.filter(id => !RULES[id](value));
  if (Buffer.byteLength(value, 'utf8') > policy.maxUtf8Bytes) missing.push('max_bytes');
  if (value.trim().length > 0 && common.has(value.trim().toLowerCase())) missing.push('common');
  return missing;
}

function validRegistrationPassword(value) {
  return passwordProblems(value).length === 0;
}

module.exports = { validRegistrationPassword, passwordProblems, policy };
