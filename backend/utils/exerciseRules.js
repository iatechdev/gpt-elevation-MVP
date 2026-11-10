// ES-194 · Reglas de contenido de los ejercicios: forma, límites, texto como texto y heurística NO clínica al publicar.
// La heurística es una lista corta y auditable (porcentajes y términos de diagnóstico, tratamiento, curación, medicación, prescripción y promesas de empleo/garantía,
// en ES y EN). Es una red de seguridad, NO sustituye la revisión editorial del especialista.
const KEY_RE = /^[a-z][a-z0-9_]{2,47}$/;
const FIELDS = ['title', 'purpose', 'question', 'help'];
const MAX = { title: 120, purpose: 300, question: 300, help: 300 };
const MINUTES_MAX = 60;

class ExerciseInputError extends Error {
  constructor(field, code) { super(code); this.name = 'ExerciseInputError'; this.field = field; this.code = code; }
}

const isControl = (code) => code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0x7f;
const hasControl = (text) => { for (let i = 0; i < text.length; i++) if (isControl(text.charCodeAt(i))) return true; return false; };

// Contenido en edición (borrador): campos opcionales, pero lo que venga debe ser texto plano dentro del límite.
function normalizeContent(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new ExerciseInputError('body', 'invalid');
  const out = { es: {}, en: {} };
  for (const lang of ['es', 'en']) {
    const block = body[lang] ?? {};
    if (block === null || typeof block !== 'object' || Array.isArray(block)) throw new ExerciseInputError(lang, 'invalid');
    for (const key of Object.keys(block)) if (!FIELDS.includes(key)) throw new ExerciseInputError(`${lang}.${key}`, 'unknown_field');
    for (const field of FIELDS) {
      const value = block[field];
      if (value === undefined || value === null || value === '') { out[lang][field] = ''; continue; }
      if (typeof value !== 'string') throw new ExerciseInputError(`${lang}.${field}`, 'invalid');
      if (hasControl(value)) throw new ExerciseInputError(`${lang}.${field}`, 'control_chars');
      if (/[<>]/.test(value)) throw new ExerciseInputError(`${lang}.${field}`, 'markup_not_allowed'); // texto como texto: nada de marcado
      const clean = value.trim();
      if (clean.length > MAX[field]) throw new ExerciseInputError(`${lang}.${field}`, 'too_long');
      out[lang][field] = clean;
    }
  }
  const { minutes } = body;
  if (minutes === undefined || minutes === null) { out.minutesMin = null; out.minutesMax = null; return out; }
  if (!Array.isArray(minutes) || minutes.length !== 2 || !minutes.every((n) => Number.isInteger(n) && n >= 1 && n <= MINUTES_MAX) || minutes[0] > minutes[1]) {
    throw new ExerciseInputError('minutes', 'invalid');
  }
  [out.minutesMin, out.minutesMax] = minutes;
  return out;
}

// Campos que faltan para publicar: los cuatro textos en AMBOS idiomas y los minutos.
function missingForPublish(row) {
  const missing = [];
  for (const lang of ['es', 'en']) for (const field of FIELDS) if (!String(row[lang]?.[field] ?? '').trim()) missing.push(`${lang}.${field}`);
  if (!Number.isInteger(row.minutesMin) || !Number.isInteger(row.minutesMax)) missing.push('minutes');
  return missing;
}

const RULES = {
  es: [
    [/\d\s*%|%\s*\d|\bpor\s*ciento\b/i, 'porcentaje'], [/diagn[oó]stic/i, 'diagnóstico'], [/tratamient/i, 'tratamiento'], [/\bcura(r|rá|rte|rse)?\b|curaci[oó]n|\bsanar\b|\bsanará\b/i, 'curación'],
    [/medicaci[oó]n|medicament|f[aá]rmaco/i, 'medicación'], [/prescrib|prescripci[oó]n|\breceta(r|s)?\b/i, 'prescripción'], [/trastorno|enfermedad|patolog/i, 'trastorno'],
    [/garantiz|asegura(mos|rá)? (que )?(conseguir|encontrar)|conseguir[aá]s? (un )?(empleo|trabajo)|te dar[aá] (un )?(empleo|trabajo)/i, 'promesa de empleo o garantía'],
  ],
  en: [
    [/\d\s*%|%\s*\d|\bpercent\b|\bper cent\b/i, 'percentage'], [/diagnos/i, 'diagnosis'], [/treatment|\btreat(s|ed|ing)?\b/i, 'treatment'], [/\bcure[sd]?\b|\bcuring\b|\bheal(s|ed|ing)?\b/i, 'cure'],
    [/medicat|\bdrugs?\b|pharmac/i, 'medication'], [/prescri/i, 'prescription'], [/disorder|\billness\b|disease|patholog/i, 'disorder'],
    [/guarantee|you will (get|find|land) (a )?(job|work|employment)|will get you (a )?(job|work)/i, 'job promise or guarantee'],
  ],
};

// Devuelve [{ field, lang, term }] con cada incumplimiento (lista vacía = pasa la heurística).
function nonClinicalViolations(row) {
  const found = [];
  for (const lang of ['es', 'en']) for (const field of FIELDS) {
    const text = String(row[lang]?.[field] ?? '');
    for (const [pattern, term] of RULES[lang]) if (pattern.test(text)) found.push({ field: `${lang}.${field}`, lang, term });
  }
  return found;
}

// Cambió el CONTENIDO (no el estado): título, propósito, pregunta, ayuda o minutos, en cualquier idioma.
function contentChanged(before, after) {
  if (before.minutesMin !== after.minutesMin || before.minutesMax !== after.minutesMax) return true;
  return ['es', 'en'].some((lang) => FIELDS.some((f) => String(before[lang]?.[f] ?? '') !== String(after[lang]?.[f] ?? '')));
}

module.exports = { KEY_RE, FIELDS, MAX, MINUTES_MAX, ExerciseInputError, normalizeContent, missingForPublish, nonClinicalViolations, contentChanged };
