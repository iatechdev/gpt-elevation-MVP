// backend/utils/legalContent.js
// ES-336 (F1) · Forma y límites del contenido de un documento legal. Una sola función de validación para la semilla y para el editor de la fase 2.
// El contenido es TEXTO ESTRUCTURADO, nunca HTML: { title, banner?, updated?, sections: [{ heading?, paragraphs?, bullets?, numbered? }] }. Las marcas permitidas dentro de un texto son
// `**negrita**` y `[[marcador visible]]`; el cliente las pinta con React (sin dangerouslySetInnerHTML). Aquí se rechaza lo que no sea texto plano con esas marcas.
const crypto = require('node:crypto');

const DOC_KEYS = Object.freeze(['privacy', 'terms', 'non_clinical', 'cookies', 'sharing', 'feedback', 'retention']);
const LANGS = Object.freeze(['es', 'en']);
const LIMITS = Object.freeze({ title: 200, banner: 500, updated: 200, heading: 200, text: 20000, sections: 200, items: 100, totalBytes: 200 * 1024 });

// Controles C0/C1 (incluye NUL y saltos de línea dentro de un párrafo: cada párrafo es una sola línea) y separadores de línea/párrafo U+2028/2029. La utilidad de ES-352
// ampliará esta lista (dirección, ZWSP, etiquetas) para todos los textos de persona; ZWNJ (U+200C) y ZWJ (U+200D) NO se rechazan aquí: son legítimos (persa, emoji compuestos).
const CONTROL = /[\p{Cc}\u2028\u2029]/u;
const HTML = /<\s*\/?\s*[a-zA-Z!?]/;
// Solo esquemas ejecutables como enlace. «data:» a secas es texto normal en inglés («personal data: …»): se rechaza solo cuando es un URI de datos (data:text/…, data:image/…, data:application/…).
const SCRIPT_URL = /\b(?:javascript|vbscript)\s*:|\bdata\s*:\s*(?:text|image|application)\//i;
// Un atributo como onerror= solo es peligroso dentro de una etiqueta HTML, y las etiquetas ya se rechazan arriba: no hace falta (y daría falsos positivos en texto normal).

const isString = (value) => typeof value === 'string';
const fail = (field, reason) => ({ ok: false, field, reason });

function checkText(value, field, max) {
  if (!isString(value) || value.trim() === '') return fail(field, 'empty_or_not_text');
  if ([...value].length > max) return fail(field, 'too_long');
  if (CONTROL.test(value)) return fail(field, 'control_character');
  if (HTML.test(value)) return fail(field, 'html_not_allowed');
  if (SCRIPT_URL.test(value)) return fail(field, 'script_not_allowed');
  return null;
}

function checkList(list, field) {
  if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.items) return fail(field, 'invalid_list');
  for (let i = 0; i < list.length; i += 1) { const bad = checkText(list[i], `${field}[${i}]`, LIMITS.text); if (bad) return bad; }
  return null;
}

// -> { ok: true, value } con la forma normalizada (solo las claves permitidas, textos recortados) o { ok: false, field, reason }.
function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return fail('content', 'not_object');
  let bad = checkText(content.title, 'title', LIMITS.title); if (bad) return bad;
  const value = { title: content.title.trim() };
  for (const [key, max] of [['banner', LIMITS.banner], ['updated', LIMITS.updated]]) {
    if (content[key] === undefined || content[key] === null) continue;
    bad = checkText(content[key], key, max); if (bad) return bad;
    value[key] = content[key].trim();
  }
  if (!Array.isArray(content.sections) || content.sections.length === 0 || content.sections.length > LIMITS.sections) return fail('sections', 'invalid_list');
  value.sections = [];
  for (let i = 0; i < content.sections.length; i += 1) {
    const section = content.sections[i];
    if (!section || typeof section !== 'object' || Array.isArray(section)) return fail(`sections[${i}]`, 'not_object');
    const clean = {};
    if (section.heading !== undefined) { bad = checkText(section.heading, `sections[${i}].heading`, LIMITS.heading); if (bad) return bad; clean.heading = section.heading.trim(); }
    for (const kind of ['paragraphs', 'bullets', 'numbered']) {
      if (section[kind] === undefined) continue;
      bad = checkList(section[kind], `sections[${i}].${kind}`); if (bad) return bad;
      clean[kind] = section[kind].map((text) => text.trim());
    }
    if (!clean.heading && !clean.paragraphs && !clean.bullets && !clean.numbered) return fail(`sections[${i}]`, 'empty_section');
    value.sections.push(clean);
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > LIMITS.totalBytes) return fail('content', 'too_large');
  return { ok: true, value };
}

// Contiene algún marcador `[[…]]` (dato por completar): en la fase 2 el editor lo usará para bloquear la publicación en producción.
function hasMarkers(value) {
  const texts = [value.title, value.banner ?? '', value.updated ?? '', ...value.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.numbered ?? [])])];
  return texts.some((text) => text.includes('[['));
}

// Hash estable (claves en orden fijo) para detectar cambios y auditar «quién publicó qué».
function contentHash(value) {
  const canonical = JSON.stringify({ title: value.title, banner: value.banner ?? null, updated: value.updated ?? null,
    sections: value.sections.map((s) => ({ heading: s.heading ?? null, paragraphs: s.paragraphs ?? null, bullets: s.bullets ?? null, numbered: s.numbered ?? null })) });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { DOC_KEYS, LANGS, LIMITS, validateContent, hasMarkers, contentHash };
