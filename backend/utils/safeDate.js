// ES-262 (E227-1) · Fechas que llegan del cliente: `Date.parse` acepta años como «+275760» (el máximo de JavaScript) que PostgreSQL y Sequelize no pueden guardar y que
// terminaban en un 500 de la base. Una fecha de usuario solo vale entre 1900-01-01 y 2999-12-31 (UTC); fuera de ahí es una entrada inválida (400), nunca un error del servidor.
const MIN_MS = Date.UTC(1900, 0, 1);
const MAX_MS = Date.UTC(2999, 11, 31, 23, 59, 59, 999); // con holgura de zona horaria: la columna de fecha de la base rechaza 9999-12-31T23:59 desplazado al año 10000

// -> Date | null. Solo cadenas no vacías; null si no se puede interpretar o está fuera de rango.
function parseBoundedDate(value) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 64) return null;
  // Solo formato ISO 8601 (AAAA-MM-DD, con hora y zona opcionales): el intérprete laxo de V8 acepta cosas como «0» (año 2000) o «2026-02-30» (lo «corrige» a marzo, y la
  // columna de fecha de la base lo rechaza con un 500). Además el día debe existir en el calendario.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!iso) return null;
  const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (m < 1 || m > 12 || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) && ms >= MIN_MS && ms <= MAX_MS ? new Date(ms) : null;
}

module.exports = { parseBoundedDate, MIN_MS, MAX_MS };
