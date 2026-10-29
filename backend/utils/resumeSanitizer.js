// ES-109 (criterio 8): depuración de datos de contacto del texto de una hoja de vida ANTES de enviarlo a la IA.
// Reglas deterministas y de MEJOR ESFUERZO (no promete eliminar el 100 % de lo que alguien escriba en texto libre). Quita: correos, teléfonos,
// direcciones postales, enlaces y perfiles en redes, y números de documento de identidad. No toca nombres, cargos, organizaciones ni habilidades.
// Falla CERRADO: si tras limpiar aún se detecta contacto, o el texto no sirve, lanza ResumeSanitizeError y NO se llama a la IA.
// Nunca registra el texto (ni el original ni el depurado).
const { normalizeText } = require('./promptSafety');

class ResumeSanitizeError extends Error {
  constructor(code) { super('No se pudo depurar el texto de la hoja de vida.'); this.code = code; }
}
const MAX_CHARS = 100000; // acota el tiempo de las reglas y el costo de IA
const MIN_CHARS = 40;     // menos que esto no es una hoja de vida legible (p. ej. un PDF escaneado sin texto)

const YEAR = '(?:19|20)\\d{2}';
const isYearToken = (token) => new RegExp(`^${YEAR}$`).test(token);
// Etiquetas de contacto: se quita la etiqueta y el resto de la línea («LinkedIn: juanperez», «Tel.: …», «Dirección: …»).
const LABELS = /^[^\S\n]*(?:e-?mail|correo(?: electr[oó]nico)?|tel[eé]fono|tel\.?|cel(?:ular)?\.?|m[oó]vil|whats\s?app|phone|mobile|linkedin|github|gitlab|behance|dribbble|twitter|instagram|facebook|telegram|skype|portafolio|portfolio|website|web|sitio web|p[aá]gina web|direcci[oó]n|domicilio|address|home address|vivo en)\b[^\n]*$/gim;
// Datos personales que no hacen falta para leer la trayectoria y que sesgan: edad, nacimiento, estado civil, nacionalidad, sexo/género, religión.
// Con etiqueta se quita la línea («Fecha de nacimiento: 12/03/1990»); sin etiqueta, solo formas inequívocas («34 años», «Soltera», «Nacido el …»).
const PERSONAL_LABEL = /^[^\S\n]*(?:fecha de nacimiento|f\.? ?de nacimiento|lugar de nacimiento|nacimiento|nacido(?:\/a)?|nacida|edad|estado civil|nacionalidad|sexo|g[eé]nero|religi[oó]n|date of birth|birth ?date|birthplace|place of birth|dob|born|age|marital status|civil status|nationality|citizenship|gender|sex|religion)[^\S\n]*(?::|-|–|—)[^\n]*$/gim;
const PERSONAL_LINE = /^[^\S\n]*(?:(?:\d{2}\s{0,3}(?:a[ñn]os|years old|yo)\b)|(?:soltero|soltera|casado|casada|divorciado|divorciada|viudo|viuda|uni[oó]n libre|single|married|divorced|widowed)(?![a-z])|(?:nacido|nacida|born)\s{1,3}(?:el|en|on|in)\b)[^\n]{0,60}$/gim;
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
// Dominios sin esquema (p. ej. «linkedin.com/in/ana», «ana-gomez.dev»). Se detectan por TOKENS (separados por espacios) en tiempo lineal:
// una expresión regular anidada sobre texto hostil se vuelve cuadrática.
const TLDS = new Set(['com', 'net', 'org', 'io', 'dev', 'me', 'co', 'app', 'ai', 'info', 'biz', 'edu', 'gov', 'xyz', 'site', 'online', 'tech', 'design', 'studio', 'page', 'link', 'pro', 'cloud', 'ly', 'gl', 'to', 'cc', 'ee', 'sh', 'is', 'es', 'mx', 'ar', 'cl', 'pe', 'br', 'uk', 'us', 'de', 'fr', 'it']);
const LABEL = /^[a-z0-9][a-z0-9-]*$/i;
function isDomainToken(raw) {
  if (raw.length > 300) return true; // un «token» de más de 300 caracteres no es una palabra: se trata como enlace y se quita
  const core = raw.replace(/^[("'<\[¿¡]+/, '').replace(/[)"'>\],;:!?]+$/, '').replace(/\.+$/, '');
  const host = core.split(/[/?#]/, 1)[0];
  if (!host.includes('.')) return false;
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return false;
  return TLDS.has(labels[labels.length - 1].toLowerCase());
}
const stripDomains = (text) => text.replace(/\S+/g, (token) => (isDomainToken(token) ? '' : token));
const hasDomain = (text) => { for (const m of text.matchAll(/\S+/g)) if (isDomainToken(m[0])) return true; return false; };
const EMAIL = /(?<![a-z0-9._%+-])[a-z0-9._%+-]{1,64}\s{0,5}(?:@|\(\s{0,3}at\s{0,3}\)|\[\s{0,3}at\s{0,3}\]|\s{1,3}arroba\s{1,3})\s{0,5}[a-z0-9-]{1,63}(?:\s{0,5}(?:\.|\(\s{0,3}dot\s{0,3}\)|\[\s{0,3}dot\s{0,3}\]|\s{1,3}punto\s{1,3})\s{0,5}[a-z0-9-]{1,63}){1,6}/gi;
const HANDLE = /(?<![\w@])@[a-z0-9_.]{3,30}\b/gi;
// Teléfonos: secuencias de 7–15 dígitos con separadores; se descartan años y rangos de años.
const PHONE = /(?<![\w.])(?:\+|00)?\(?\d[\d\s().‐-―-]{5,22}\d(?![\w])/g;
// Calle/carrera/avenida/street + número, o «Cl. 45 # 12-34». Se quita la línea completa.
const STREET = /\b(?:calle|carrer|rua|rúa|passeig|paseo|rue|cll?\.?|carrera|cra?\.?|kr|avenida|av\.?|diagonal|dg\.?|transversal|tv\.?|autopista|circular|manzana|mz|street|st\.|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|apartado a[eé]reo|apto\.?|barrio)\b[^\n]{0,40}?(?:#|n[°ºo]\.?|no\.?)?\s*\d+[a-z]?\b[^\n]*/gi;
// Estilo anglosajón: el número va ANTES del nombre de la calle («123 Main Street, Springfield»).
const STREET_US = /\b\d{1,5}[a-z]?\s{1,3}(?:[a-z.]{1,20}\s{1,3}){1,3}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|court|ct\.?|plaza|place|pl\.?)(?![a-z])[^\n]*/gi;
const POSTAL = /\b(?:c\.?p\.?|zip|c[oó]digo postal|postal code)\s*:?\s*[a-z0-9-]{4,10}\b/gi;
// Documentos de identidad: con etiqueta (cualquier valor alfanumérico razonable) y formatos autoexplicativos.
const ID_LABEL = /\b(?:c\.?\s?c\.?|c[eé]dula(?: de ciudadan[ií]a)?|c[eé]dula de extranjer[ií]a|c\.?\s?e\.?|tarjeta de identidad|t\.?\s?i\.?|dni|nie|nit|rut|curp|rfc|cpf|cnpj|ssn|passport|pasaporte|documento(?: de identidad)?|identificaci[oó]n|id number|n[uú]mero de documento|licencia de conducir)(?![a-z0-9])\s*(?:n[°ºo]\.?|no\.?|num\.?|n[uú]mero|#|:)?\s*[a-z0-9][a-z0-9.\- ]{4,20}[a-z0-9]/gi;
const ID_SHAPES = [
  /\b\d{3}-\d{2}-\d{4}\b/g,                  // SSN
  /\b\d{1,3}(?:\.\d{3}){3}\b/g,              // cédula colombiana de 10 dígitos con puntos
  /\b\d{2}\.\d{3}\.\d{3}-[\dk]\b/gi,         // RUT chileno
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,          // CPF
  /\b\d{8}[a-z]\b/gi,                        // DNI español
  /\b[xyz]\d{7}[a-z]\b/gi,                   // NIE
  /\b[a-z]{4}\d{6}[a-z]{6}[a-z0-9]\d\b/gi,   // CURP
];

const digitsOf = (value) => value.replace(/\D/g, '');
function phoneLike(candidate) {
  const digits = digitsOf(candidate);
  if (digits.length < 7 || digits.length > 15) return false;
  const tokens = candidate.split(/[^\d]+/).filter(Boolean);
  if (tokens.every(isYearToken)) return false;                                  // «2018 2021», «2021-2026»
  if (/^\(?\d{1,2}\)?\s*[-–—]\s*\d{1,2}$/.test(candidate.trim())) return false;
  if (/^\d{1,3}(?:\.\d{3})+$/.test(candidate.trim())) return false;              // cifras con puntos de miles («1.200.000»)
  return true;
}

function strip(text) {
  let out = text;
  out = out.replace(LABELS, '').replace(PERSONAL_LABEL, '').replace(PERSONAL_LINE, '');
  out = out.replace(EMAIL, '');
  out = out.replace(URL, '');
  out = stripDomains(out);
  out = out.replace(HANDLE, '');
  out = out.replace(ID_LABEL, '');
  for (const shape of ID_SHAPES) out = out.replace(shape, '');
  out = out.replace(POSTAL, '').replace(STREET, '').replace(STREET_US, '');
  out = out.replace(PHONE, (match) => (phoneLike(match) ? '' : match));
  return out;
}

// Señales que NO deben sobrevivir a la limpieza (el servidor las comprueba de nuevo y falla cerrado).
function leftover(text) {
  if (new RegExp(EMAIL.source, 'i').test(text) || /\b(?:https?:\/\/|www\.)\S/i.test(text)) return true;
  if (hasDomain(text)) return true;
  if (new RegExp(PERSONAL_LABEL.source, 'im').test(text) || new RegExp(PERSONAL_LINE.source, 'im').test(text)) return true;
  for (const match of text.matchAll(PHONE)) if (phoneLike(match[0])) return true;
  return ID_SHAPES.some((shape) => new RegExp(shape.source, shape.flags.replace('g', '')).test(text));
}

// -> { text, removed } con `removed` = número de fragmentos quitados (sin contenido). Lanza ResumeSanitizeError si no es seguro continuar.
function sanitizeResumeText(raw) {
  if (typeof raw !== 'string') throw new ResumeSanitizeError('no_text');
  if (raw.length > MAX_CHARS * 2) throw new ResumeSanitizeError('too_long');
  // NFKC primero: «＠» y los dígitos de ancho completo se vuelven «@» y 0-9 y las reglas los ven (QA ES-109).
  let text = normalizeText(raw.normalize('NFKC'));
  if (text.length > MAX_CHARS) throw new ResumeSanitizeError('too_long');
  let removed = 0;
  // Dos pasadas: lo que una regla deja al quitar otra (p. ej. un teléfono tras quitar su etiqueta) se limpia en la segunda.
  for (let pass = 0; pass < 2; pass++) {
    const before = text;
    text = strip(text);
    if (text !== before) removed += 1;
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (leftover(text)) throw new ResumeSanitizeError('contact_remaining');
  if (text.length < MIN_CHARS) throw new ResumeSanitizeError('no_text');
  return { text, removed };
}
module.exports = { sanitizeResumeText, ResumeSanitizeError, containsContact: leftover, MAX_CHARS, MIN_CHARS };
