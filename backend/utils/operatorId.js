// ES-393 · Identificador de quien OPERA el servidor (OPERATOR_ID del script issue-link). Va a la auditoría (AdminAuditEntries.actorLabel), a la vista del superadmin.
// Es un ROL o TURNO DE GUARDIA («ops-guardia-1», «soporte-n1»), nunca el nombre de una persona ni un secreto. Lo que el código puede hacer:
//   · forma cerrada: letras, números, punto, guion y guion bajo; empieza por letra o número; hasta 32 caracteres;
//   · convención: empieza por un prefijo de rol de la lista (ops, guardia, oncall, soporte, infra) → «juan.perez» no pasa;
//   · rechazar lo que tiene forma de clave o token conocido (sk-…, ghp_…, xoxb-…, AKIA…, JWT «eyJ…», «token-…», «secret…») o es una cadena larga de alta entropía.
// Lo que NO puede hacer: saber si «ops-juan» lleva el nombre de alguien. Eso se documenta en el runbook (docs/RUNBOOK-OPERADOR-ENLACES.md): se usa el rol o el turno, no un nombre.
const ROLE_PREFIXES = ['ops', 'guardia', 'oncall', 'soporte', 'infra'];
const SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const KNOWN_SECRET = [
  /^(sk|pk|rk)[-_]/i, /^(ghp|gho|ghu|ghs|ghr)_/i, /^github_pat_/i, /^xox[abeprs]-/i, /^AKIA[0-9A-Z]{8,}/, /^eyJ/,
  /^(bearer|basic)[-_. ]/i, /(^|[-_.])(sk|pk)[-_](ant|live|test|proj)/i, /(api[-_.]?key|secret|token|passw)/i,
];

function looksLikeSecret(value) {
  if (KNOWN_SECRET.some((pattern) => pattern.test(value))) return true;
  return value.split(/[-_.]/).some((segment) => (
    segment.length >= 24
    || (segment.length >= 20 && /^[0-9a-f]+$/i.test(segment))
    || (segment.length >= 14 && /[a-z]/.test(segment) && /[A-Z]/.test(segment) && /\d/.test(segment))
  ));
}

function isValidOperatorId(value) {
  if (typeof value !== 'string' || !SHAPE.test(value)) return false;
  const prefix = value.split(/[-._]/)[0].toLowerCase();
  return ROLE_PREFIXES.includes(prefix) && !looksLikeSecret(value);
}

module.exports = { isValidOperatorId, looksLikeSecret, ROLE_PREFIXES };
