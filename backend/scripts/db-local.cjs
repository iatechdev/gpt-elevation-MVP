// Base Postgres local y desechable para Dev y QA (ES-80). No usa Docker ni permisos de administrador.
// Uso: npm run db:local          -> arranca y deja la base lista hasta Ctrl+C
//      npm run db:local -- --reset -> borra los datos locales y empieza de cero
// Solo para desarrollo: usuario y clave locales NO son secretos y la base no sale del equipo.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '.pgdata');
const port = parseInt(process.env.LOCAL_PG_PORT, 10) || 54329;
const dbName = 'elevation_dev';
const user = 'elevation';
const password = 'elevation_local';

(async () => {
  if (process.argv.includes('--reset')) fs.rmSync(dir, { recursive: true, force: true });
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({ databaseDir: dir, user, password, port, persistent: true,
    // QA-80-01: en Windows initdb toma la codificación del sistema (WIN1252) y falla con emojis; se fuerza UTF8.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase(dbName);

  console.log(`Postgres local listo en el puerto ${port} (base ${dbName}).`);
  console.log('Variables para backend/.env (no se versiona):');
  console.log(`DATABASE_URL=postgres://${user}:${password}@127.0.0.1:${port}/${dbName}`);
  console.log('DB_SSL=false');
  console.log('Ctrl+C para detenerla. Los datos quedan en backend/.pgdata.');

  const stop = async () => { try { await pg.stop(); } finally { process.exit(0); } };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((e) => { console.error('No se pudo arrancar la base local:', e.message); process.exit(1); });
