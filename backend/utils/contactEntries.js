// ES-193: reglas de los datos de contacto y ayuda (línea de emergencia, etc.). Sin ningún número aquí: los valores viven en la base.
// La procedencia es la misma del registro de ES-21 (utils/safety.js): fuente + quién verificó + fecha vigente (CONTACT_MAX_AGE_DAYS, 180 por defecto).
const ContactEntry = require('../ContactEntry');

const maxAgeDays = () => { const n = Number(process.env.CONTACT_MAX_AGE_DAYS); return Number.isInteger(n) && n > 0 ? n : 180; };
const DAY = 24 * 3600 * 1000;
const today = (now = new Date()) => now.toISOString().slice(0, 10);

// El contacto es TEXTO de contacto: dígitos, +, espacios y separadores usuales, con al menos 3 dígitos. Nunca HTML.
const CONTACT = /^[0-9+()\-*#.\s]{3,32}$/;
const COUNTRY = /^[A-Z]{2}$/;
const { isBoundedDay } = require('./safeDate'); // E229-1
const noMarkup = (value) => !/[<>]/.test(value);
const filled = (value) => typeof value === 'string' && value.trim().length > 0;

// 'verified' (vigente), 'stale' (venció la verificación) o 'unverified' (falta fuente, quién o fecha). Solo 'verified' se publica.
function verificationStatus(entry, now = new Date()) {
  if (!entry || !filled(entry.source) || !filled(entry.verifiedBy) || !filled(entry.verifiedAt)) return 'unverified';
  const verified = Date.parse(`${String(entry.verifiedAt).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(verified) || verified > now.getTime() + DAY) return 'unverified';
  return now.getTime() - verified <= maxAgeDays() * DAY ? 'verified' : 'stale';
}

// Valida y normaliza los campos recibidos. Devuelve { values } o { error: { field, code } }. `partial` = edición (todo opcional).
function validateFields(body, { partial = false } = {}) {
  const values = {};
  const bad = (field, code = 'invalid') => ({ error: { field, code } });
  const text = (field, max, { required = false, allowEmpty = false } = {}) => {
    if (body[field] === undefined) return required && !partial ? bad(field, 'required') : null;
    if (typeof body[field] !== 'string') return bad(field);
    const value = body[field].trim();
    if (!value && !allowEmpty) return bad(field, 'required');
    if (value.length > max || !noMarkup(value) || /[\u0000-\u001f\u007f]/.test(value)) return bad(field);
    values[field] = value;
    return null;
  };
  for (const failure of [
    text('name', 80, { required: true }), text('descriptionEs', 300, { allowEmpty: true }), text('descriptionEn', 300, { allowEmpty: true }),
    text('source', 300, { allowEmpty: true }), text('verifiedBy', 120, { allowEmpty: true }),
  ]) if (failure) return failure;
  if (body.contact !== undefined || (!partial)) {
    if (typeof body.contact !== 'string') return bad('contact', body.contact === undefined ? 'required' : 'invalid');
    const contact = body.contact.trim();
    if (!CONTACT.test(contact) || (contact.match(/\d/g) || []).length < 3) return bad('contact');
    values.contact = contact;
  }
  if (body.country !== undefined || !partial) {
    if (typeof body.country !== 'string' || !COUNTRY.test(body.country.trim().toUpperCase())) return bad('country', body.country === undefined ? 'required' : 'invalid');
    values.country = body.country.trim().toUpperCase();
  }
  if (body.verifiedAt !== undefined) {
    if (body.verifiedAt === null || body.verifiedAt === '') values.verifiedAt = null;
    else if (!isBoundedDay(body.verifiedAt) || body.verifiedAt > today(new Date(Date.now() + DAY))) return bad('verifiedAt');
    else values.verifiedAt = body.verifiedAt;
  }
  if (body.active !== undefined) { if (typeof body.active !== 'boolean') return bad('active'); values.active = body.active; }
  for (const key of ['source', 'verifiedBy']) if (values[key] === '') values[key] = null;
  return { values };
}

// Lo que ve cualquier persona: solo entradas activas Y con verificación vigente. Una entrada vencida deja de mostrarse (nunca un número viejo).
const publicShape = (row) => ({ id: row.id, country: row.country, name: row.name, contact: row.contact, description: { es: row.descriptionEs, en: row.descriptionEn } });

async function publishedEntries({ country, now = new Date() } = {}) {
  const where = { active: true };
  if (country) where.country = country;
  const rows = await ContactEntry.findAll({ where, order: [['position', 'ASC'], ['id', 'ASC']] });
  return rows.filter((row) => verificationStatus(row, now) === 'verified');
}

// Para la respuesta de seguridad del chat (ES-21): mismo formato que config/supportResources.json. Si la base falla, devuelve el registro vacío
// (la respuesta genérica, sin números), nunca un número viejo.
async function loadSafetyRegistry(now = new Date()) {
  const empty = { maxAgeDays: maxAgeDays(), countries: {} };
  try {
    const rows = await publishedEntries({ now });
    const countries = {};
    for (const row of rows) {
      countries[row.country] = countries[row.country] || { name: row.country, resources: [] };
      countries[row.country].resources.push({ label: row.name, contact: row.contact, source: row.source, verifiedBy: row.verifiedBy, verifiedAt: String(row.verifiedAt).slice(0, 10) });
    }
    return { maxAgeDays: maxAgeDays(), countries };
  } catch {
    return empty;
  }
}

module.exports = { maxAgeDays, verificationStatus, validateFields, publicShape, publishedEntries, loadSafetyRegistry };
