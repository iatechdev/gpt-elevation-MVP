// Operator-only maintenance command. Never load .env implicitly or print identifiers/content.
// Stop all web/worker/integration processes first; point DATABASE_URL at the intended environment.
// ES-275: la conexión sale SOLO de DATABASE_URL, escrita de forma explícita al ejecutar el comando. No se carga .env (ni dotenv, ni su banner) y no hay respaldo en las variables DB_*:
// sin DATABASE_URL el comando termina con error SIN tocar nada. El entorno elegido (host, puerto y base, sin credenciales) se muestra por stderr; stdout lleva solo el JSON de estado.
const [id, confirmation, replayFlag] = process.argv.slice(2);

function stop(message) { console.error(message); process.exit(2); }

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id || '') || confirmation !== '--producers-stopped-and-drained' ||
    (replayFlag !== undefined && replayFlag !== '--replay')) {
  stop('Expected request UUID and --producers-stopped-and-drained.');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) stop('DATABASE_URL is required: this command never reads .env or the DB_* variables. Set DATABASE_URL explicitly for the intended environment. / Falta DATABASE_URL explícita.');
let target;
try { target = new URL(databaseUrl); } catch { stop('DATABASE_URL is not a valid URL.'); }
if (!/^postgres(ql)?:$/.test(target.protocol) || !target.hostname) stop('DATABASE_URL must be a postgres:// URL with a host.');
console.error(`Environment: ${target.hostname}:${target.port || '5432'}${target.pathname || ''}`); // sin usuario ni contraseña

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres', logging: false, pool: { max: 2, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: process.env.DB_SSL === 'false' ? {} : { ssl: { require: true, rejectUnauthorized: false } },
});
// Los modelos importan `../database`: se les entrega ESTA conexión (y nunca la de database.js, que carga dotenv y puede caer en DB_*).
const databaseModule = require.resolve('../database');
require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: { sequelize, connectDB: async () => {} } };
// La purga reutiliza los módulos de la aplicación, que exigen las variables del servicio (p. ej. JWT_SECRET): se esperan en el entorno del comando (con `railway run` ya vienen). Sin ellas,
// un mensaje claro en vez de una traza.
let processDeletion;
try { ({ processDeletion } = require('../utils/deletionProcessor')); } catch (error) {
  stop(`Cannot start the purge: ${/must be configured|is required/i.test(String(error && error.message)) ? error.message : 'the application modules could not be loaded'}. Run it with the environment variables of the target service.`);
}

async function main() {
  await sequelize.authenticate();
  const result = await processDeletion(id, { quiescent: true, replay: replayFlag === '--replay' });
  // Only states, no request IDs, personal data or database diagnostics.
  console.log(JSON.stringify({ status: result.status, deadlinesVerified: false }));
}
main().catch(() => { console.error('Purge not completed. Review the protected request ledger.'); process.exitCode = 1; })
  .finally(() => sequelize.close());
