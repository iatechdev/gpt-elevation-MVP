// ES-252 · Una dirección de correo no puede llevar caracteres de control ni de formato Unicode.
// Motivo: U+202E (inversión bidireccional) y similares hacen que el correo se VEA distinto de lo que es (despiste visual a quien administra);
// los de ancho cero (U+200B…U+200D, U+FEFF) producen direcciones que parecen iguales y no lo son (cuentas duplicadas por apariencia).
// Se rechazan: Cc (control, incluye \n \r \t y NUL), Cf (formato: bidi, ancho cero, soft hyphen), Zl/Zp (separadores de línea y párrafo) y Co/Cn (uso privado/sin asignar).
// Se conservan los correos con acentos, eñes e IDN (letras, marcas combinadas y números no se tocan).
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}]/u;

function hasUnsafeChars(value) {
  return typeof value === 'string' && UNSAFE.test(value);
}

module.exports = { hasUnsafeChars };
