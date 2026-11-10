// ES-252 · Una dirección de correo no puede llevar caracteres de control ni de formato Unicode.
// Motivo: U+202E (inversión bidireccional) y similares hacen que el correo se VEA distinto de lo que es (despiste visual a quien administra);
// los de ancho cero (U+200B…U+200D, U+FEFF) producen direcciones que parecen iguales y no lo son (cuentas duplicadas por apariencia).
// Se rechazan: Cc (control, incluye \n \r \t y NUL), Cf (formato: bidi, ancho cero, soft hyphen), Zl/Zp (separadores de línea y párrafo) y Co/Cn (uso privado/sin asignar).
// Se conservan los correos con acentos, eñes e IDN (letras, marcas combinadas y números no se tocan).
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}]/u;

function hasUnsafeChars(value) {
  return typeof value === 'string' && UNSAFE.test(value);
}

// ES-259 · Validación única de correo (forma y longitud) para invitaciones, registro y solicitud profesional.
// Sin espacios, sin <>"'`,;()[] ni segundo @; parte local ≤ 64, dominio con punto y total ≤ 254 (el límite de RFC 5321 y de las columnas).
const MAX_EMAIL = 254;
const EMAIL = /^[^\s@<>"'`,;()[\]\\]{1,64}@[^\s@<>"'`,;()[\]\\]{1,190}\.[^\s@<>"'`,;()[\]\\]{2,}$/;
function isValidEmail(value) {
  return typeof value === 'string' && value.length <= MAX_EMAIL && !hasUnsafeChars(value) && EMAIL.test(value);
}

module.exports = { hasUnsafeChars, isValidEmail, MAX_EMAIL };
