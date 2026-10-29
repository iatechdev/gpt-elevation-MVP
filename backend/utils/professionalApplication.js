// ES-95: solicitud pública de profesionales de psicología. Validación pura (sin base de datos ni red).
// La persona aún no tiene cuenta: nada de aquí crea usuarios, roles ni contraseñas.
const { normalizeText } = require('./promptSafety');

const MAX_CV_BYTES = 5 * 1024 * 1024;
const REJECTED_RETENTION_DAYS = 180; // cifra propuesta (no es un dato legal verificado); la fija el PO
const STATUSES = ['pending', 'approved', 'rejected'];
const LOCALES = ['es', 'en'];
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

// Campo → [obligatorio, máximo de caracteres]
const FIELDS = {
  name: [true, 120], email: [true, 254], country: [true, 80], profession: [true, 120],
  licenseNumber: [false, 60], profileUrl: [false, 300], message: [false, 1000],
};

// %PDF- al inicio: no se confía en el tipo MIME ni en la extensión que declara el cliente.
const isPdf = (buffer) => Buffer.isBuffer(buffer) && buffer.length > 8 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';

function validProfileUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// -> { ok: true, values } | { ok: false, fields: [nombres con problema] }. Nunca devuelve ni repite los valores recibidos.
function validateApplication(body, file) {
  const fields = []; const values = {};
  const input = body && typeof body === 'object' ? body : {};
  for (const [key, [required, max]] of Object.entries(FIELDS)) {
    const raw = input[key];
    if (raw !== undefined && typeof raw !== 'string') { fields.push(key); continue; }
    const text = normalizeText(raw ?? '').trim();
    if (!text) { if (required) fields.push(key); values[key] = null; continue; }
    if (text.length > max) { fields.push(key); continue; }
    values[key] = text;
  }
  if (values.email && !EMAIL.test(values.email)) fields.push('email');
  if (values.email) values.email = values.email.toLowerCase();
  if (values.profileUrl && !validProfileUrl(values.profileUrl)) fields.push('profileUrl');
  if (input.consent !== 'true' && input.consent !== true) fields.push('consent');
  const locale = typeof input.locale === 'string' ? input.locale.trim().toLowerCase() : 'es';
  values.locale = LOCALES.includes(locale) ? locale : 'es';
  if (!file || !isPdf(file.buffer) || file.buffer.length > MAX_CV_BYTES) fields.push('cv');
  return fields.length ? { ok: false, fields: [...new Set(fields)] } : { ok: true, values };
}

const ack = { es: 'Recibimos tu solicitud. El equipo de Elevation la revisará y te escribirá al correo que indicaste.', en: 'We received your request. The Elevation team will review it and write to the email you provided.' };

module.exports = { MAX_CV_BYTES, REJECTED_RETENTION_DAYS, STATUSES, FIELDS, isPdf, validateApplication, ack };
