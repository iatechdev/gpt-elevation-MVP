// Arnés de pruebas con Postgres REAL (ES-81). Cada archivo de prueba crea su propia base desechable en el servidor local
// de `npm run db:local` (ES-80), usa conexiones reales y la borra al terminar.
//
// Seguridad: se NIEGA a correr si el servidor no es local (127.0.0.1, localhost o ::1), si NODE_ENV=production o si el nombre
// de la base que va a borrar no empieza por `es_harness_`. Nunca toca la base de staging ni la de producción.
//
// Uso (en backend/):
//   LOCAL_PG_PORT=54339 npm run db:local          (terminal 1: deja la base local en marcha)
//   TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/elevation_dev npm run test:db   (terminal 2)
// Las credenciales de la base local no son secretos (ver docs/DB-LOCAL.md).

const crypto = require('node:crypto');
const { Client } = require('pg');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const PREFIX = 'es_harness_';
let created = null;

function baseUrl() {
  if (process.env.NODE_ENV === 'production') throw new Error('El arnés de Postgres real no corre con NODE_ENV=production.');
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error('Define TEST_DATABASE_URL con la base local de `npm run db:local` '
      + '(p. ej. postgres://elevation:elevation_local@127.0.0.1:54329/elevation_dev). No se usa DATABASE_URL a propósito.');
  }
  const url = new URL(raw);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Este arnés solo corre contra una base LOCAL; se negó a usar el servidor "${url.hostname}".`);
  }
  return url;
}

const adminClient = (url) => {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  return new Client({ connectionString: admin.toString() });
};

// QA-81-01: una ejecución interrumpida deja su base `es_harness_*`. Se borran las huérfanas, pero SOLO las que no tienen
// ninguna conexión abierta (así nunca se toca la base de otra ejecución en curso) y siempre con el prefijo del arnés.
async function dropOrphans(admin) {
  const { rows } = await admin.query(
    `SELECT d.datname FROM pg_database d
      WHERE d.datname LIKE $1 AND NOT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE a.datname = d.datname)`, [PREFIX.split(String.fromCharCode(95)).join(String.fromCharCode(92,95)) + "%"]);
  for (const { datname } of rows) {
    if (datname.startsWith(PREFIX)) await admin.query(`DROP DATABASE IF EXISTS "${datname}"`);
  }
}

// Crea una base desechable, apunta DATABASE_URL a ella (lo lee backend/database.js) y devuelve su nombre.
async function create() {
  const base = baseUrl();
  const name = PREFIX + crypto.randomBytes(5).toString('hex');
  const admin = adminClient(base);
  await admin.connect();
  try {
    await dropOrphans(admin).catch(() => {}); // limpieza de mejor esfuerzo: no impide correr las pruebas
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally { await admin.end(); }
  const url = new URL(base);
  url.pathname = '/' + name;
  process.env.DATABASE_URL = url.toString();
  process.env.DB_SSL = 'false';
  process.env.DB_POOL_MAX = '10'; // varias conexiones reales simultáneas
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_PORT']) delete process.env[key];
  created = { name, base: base.toString() };
  return name;
}

// Número de conexiones reales abiertas contra la base desechable (para demostrar que hay más de una).
async function connections() {
  const admin = adminClient(created.base);
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1', [created.name]);
    return rows[0].n;
  } finally { await admin.end(); }
}

async function versionInfo() {
  const admin = adminClient(created.base);
  await admin.connect();
  try { return (await admin.query('SHOW server_version')).rows[0].server_version; } finally { await admin.end(); }
}

// Borra la base desechable (cerrar antes el pool de Sequelize).
async function drop() {
  if (!created || !created.name.startsWith(PREFIX)) return;
  const admin = adminClient(created.base);
  await admin.connect();
  try { await admin.query(`DROP DATABASE IF EXISTS "${created.name}" WITH (FORCE)`); } finally { await admin.end(); }
  created = null;
}

module.exports = { create, drop, connections, versionInfo, PREFIX };
