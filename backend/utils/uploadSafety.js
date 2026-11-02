// backend/utils/uploadSafety.js
// Documentos del alta del profesional (ES-99, ES93-M4 y S11 del plan de QA): el tipo declarado por el navegador no se cree; se comprueba
// que el CONTENIDO sea de verdad un PDF, JPEG, PNG o WEBP. Y el nombre que se guarda nunca trae rutas ni caracteres de control.

const SIGNATURES = Object.freeze({
  'application/pdf': (b) => b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
});
const ALLOWED_TYPES = Object.freeze(Object.keys(SIGNATURES));

// ¿El contenido corresponde al tipo declarado?
const contentMatches = (mimetype, buffer) => typeof mimetype === 'string' && Object.hasOwn(SIGNATURES, mimetype) && Buffer.isBuffer(buffer) && SIGNATURES[mimetype](buffer);

// Nombre para mostrar: sin directorios (ni «/» ni «\»), sin caracteres de control, acotado. Nunca vacío.
function safeDocumentName(original) {
  const base = String(original ?? '').split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/^\.+/, '').trim().slice(0, 150);
  return clean || 'documento';
}

// Segmento seguro para la ruta en el almacenamiento.
const storageName = (original) => safeDocumentName(original).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

module.exports = { ALLOWED_TYPES, contentMatches, safeDocumentName, storageName };
