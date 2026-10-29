const countries = new Set(require('../../shared/participantCountries.json'));
const { normalizeText } = require('./promptSafety');

// Esquema del contexto. v1 (ES-14): 9 campos. v2 (ES-109): añade lo que puede respaldar una hoja de vida. Todo lo nuevo es opcional:
// null o lista vacía = «el documento no lo respalda»; nunca se completa por deducción.
const SCHEMA_VERSION = 2;
const MIN_YEAR = 1950;
const yearNow = () => new Date().getUTCFullYear();

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (max, min = 0) => value => typeof value === 'string' && value.trim().length >= min && normalizeText(value).trim().length <= max;
const nullable = check => value => value === null || check(value);
const year = value => Number.isInteger(value) && value >= MIN_YEAR && value <= yearNow();
const clean = value => (typeof value === 'string' ? normalizeText(value).trim() || null : value);

// Elemento de lista: claves exactas, cada una con su comprobación; devuelve el elemento limpio o null si no vale.
function item(shape, value) {
  if (!object(value) || Object.keys(value).some(key => !Object.hasOwn(shape, key))) return null;
  const out = {};
  for (const [key, check] of Object.entries(shape)) {
    if (!Object.hasOwn(value, key) || !check(value[key])) return null;
    out[key] = clean(value[key]);
  }
  return out;
}
// Lista acotada de elementos válidos; `extra` valida reglas entre elementos o campos. null si algo no vale.
function list(max, shape, extra = () => true) {
  return value => {
    if (!Array.isArray(value) || value.length > max) return null;
    const out = [];
    for (const raw of value) {
      const entry = item(shape, raw);
      if (!entry || !extra(entry)) return null;
      out.push(entry);
    }
    return out;
  };
}
const periodOk = entry => (!entry.isCurrent || entry.endYear === null) && (entry.startYear === null || entry.endYear === null || entry.startYear <= entry.endYear);
const skillsOk = (skills) => new Set(skills.map(skill => skill.name.toLowerCase())).size === skills.length ? skills : null;

const collections = {
  experience: list(15, {
    role: text(120, 1), organization: nullable(text(120)), startYear: nullable(year), endYear: nullable(year), isCurrent: value => typeof value === 'boolean',
  }, periodOk),
  education: list(15, {
    kind: value => value === 'education' || value === 'certification', title: text(160, 1), institution: nullable(text(120)), year: nullable(year),
  }),
  declaredSkills: value => { const skills = list(40, { name: text(60, 1), support: nullable(text(200)), resumeVersion: nullable(v => Number.isSafeInteger(v) && v > 0) })(value); return skills && skillsOk(skills); },
  languages: list(10, { name: text(40, 1), level: nullable(text(40)) }),
};
const scalars = {
  preferredLanguage: value => value === 'es' || value === 'en',
  residenceCountry: value => countries.has(value),
  targetMarket: value => countries.has(value),
  timeZone: value => {
    if (typeof value !== 'string' || value.length > 64 || (value !== 'UTC' && !value.includes('/'))) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  },
  profession: value => typeof value === 'string' && value.length <= 120,
  interests: value => typeof value === 'string' && value.length <= 500,
  availabilityMinutesPerWeek: value => Number.isInteger(value) && value >= 0 && value <= 10080,
  careerGoal: value => typeof value === 'string' && value.length <= 500,
  careerConstraints: value => typeof value === 'string' && value.length <= 500,
  sector: value => typeof value === 'string' && value.length <= 80,
  totalYearsExperience: value => Number.isInteger(value) && value >= 0 && value <= 60,
};
const KEYS = [...Object.keys(scalars), ...Object.keys(collections)];
const emptyV2 = () => ({
  preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null,
  careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [],
});

// Un contexto guardado en v1 se presenta como v2 con lo nuevo vacío; no se migra el dato cifrado (se actualiza al guardar).
const upgradeContext = stored => ({ ...emptyV2(), ...(object(stored) ? stored : {}) });

function validateContextRequest(body) {
  if (!object(body) || Object.keys(body).some(key => !['schemaVersion', 'expectedVersion', 'action', 'context'].includes(key))) return { error: 'invalid_request' };
  // Una pestaña abierta antes de ES-109 manda v1: no se acepta (podría borrar lo nuevo al guardar); se le pide recargar.
  if (body.schemaVersion === 1) return { error: 'schema_outdated' };
  if (body.schemaVersion !== SCHEMA_VERSION || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0
    || !['save_draft', 'continue'].includes(body.action) || !object(body.context)) return { error: 'invalid_request' };
  const errors = Object.keys(body.context).filter(key => !KEYS.includes(key));
  const context = {};
  for (const [key, check] of Object.entries(scalars)) {
    const value = body.context[key];
    if (value === undefined || (value !== null && !check(value))) errors.push(key);
    else context[key] = typeof value === 'string' ? normalizeText(value).trim() || null : value;
  }
  for (const [key, parse] of Object.entries(collections)) {
    const parsed = parse(body.context[key]);
    if (!parsed) errors.push(key); else context[key] = parsed;
  }
  if (body.action === 'continue' && !context.preferredLanguage) errors.push('preferredLanguage');
  return errors.length ? { error: 'invalid_context', fields: [...new Set(errors)].filter(key => KEYS.includes(key)) } : { context };
}
module.exports = { SCHEMA_VERSION, KEYS, emptyV2, upgradeContext, validateContextRequest };
