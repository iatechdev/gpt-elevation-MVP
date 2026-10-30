// backend/worker.js
// Worker de análisis de IA (ES-84/ES-87): proceso SIN pantalla ni puerto, misma imagen que el API, otro comando de arranque:
//     node backend/worker.js      (o `npm run worker` dentro de backend/)
// Lee el contexto profesional autorizado SOLO por las funciones SQL del rol `elevation_worker` (ES-85) y lo descifra con la clave del
// dominio profesional (ES-86). No arranca el API, no usa sync() y no importa módulos de chats, diario, consentimiento ni sesiones.
// Se niega a arrancar si el entorno rompe el aislamiento (p. ej. si recibe DATA_ENCRYPTION_KEY, JWT_SECRET o la URL de base del API).
//
// ORDEN IMPORTANTE: database.js abre su conexión al importarse (con la DATABASE_URL de ese momento) y varios módulos lo importan. Por eso
// primero se comprueban los nombres de variables (sin importar nada), luego se fija la URL propia del worker y solo después se cargan los demás.

const { createLogger } = require('./worker/log');
const { presenceProblems } = require('./worker/envNames');

const log = createLogger();
const refuse = (problems) => {
  log('worker_refused', { reason: 'entorno_invalido' });
  for (const problem of problems) console.error(`[worker] ${problem}`); // nombres de variables, nunca valores
  process.exit(2);
};

const early = presenceProblems(process.env);
if (early.length) refuse(early);

// database.js (compartido con el API) lee DATABASE_URL: se le da la URL PROPIA del worker y un pool pequeño. Después se borra la variable
// de origen para que no quede otra copia en el entorno del proceso. dotenv se silencia: un .env local no debe inyectar nada sin que se vea.
process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
delete process.env.WORKER_DATABASE_URL;
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '2';
process.env.DOTENV_CONFIG_QUIET = 'true';

const os = require('os');
const { sequelize } = require('./database');               // carga dotenv: puede inyectar variables desde un .env del directorio de trabajo
const { checkEnv, readWorkerConfig } = require('./worker/config');

// Comprobación completa ya con el entorno final (incluido lo que dotenv haya inyectado). DATABASE_URL es ahora la del worker.
const { DATABASE_URL: ownUrl, ...withoutUrl } = process.env;
const late = checkEnv({ ...withoutUrl, WORKER_DATABASE_URL: ownUrl });
if (late.length) refuse(late);

const { createWorkerDb } = require('./worker/db');
const { createRunner } = require('./worker/runner');
const { askForJson } = require('./utils/aiProposals');

const config = readWorkerConfig(process.env);
const owner = `${os.hostname()}-${process.pid}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 64);
const runner = createRunner({ db: createWorkerDb(sequelize), config, log, owner, ask: askForJson });

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('worker_stopping', { signal });
  const result = await runner.stop();
  await sequelize.close().catch(() => {});
  log('worker_stopped', { reason: result });
  process.exit(result === 'clean' ? 0 : 1);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Un error inesperado no se traga: se registra solo el tipo y el proceso termina para que Railway lo reinicie (el lease recupera el job).
process.on('uncaughtException', (error) => { log('worker_crashed', { code: (error && (error.code || error.name)) || 'unknown' }); process.exit(1); });
process.on('unhandledRejection', (error) => { log('worker_crashed', { code: (error && (error.code || error.name)) || 'unknown' }); process.exit(1); });

log('worker_started', { owner, pollMs: config.pollMs, leaseSeconds: config.leaseSeconds, maxAttempts: config.maxAttempts });
runner.loop().then(() => undefined);
