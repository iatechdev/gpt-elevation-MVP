// Base Postgres local y desechable para Dev y QA (ES-80). No usa Docker ni permisos de administrador.
// Uso: npm run db:local          -> arranca y deja la base lista hasta Ctrl+C
//      npm run db:local -- --reset -> borra los datos locales y empieza de cero
// Solo para desarrollo: usuario y clave locales NO son secretos y la base no sale del equipo.
const fs = require('fs');
const net = require('net');
const path = require('path');

// Comprueba que el puerto esté libre en IPv4 e IPv6. Sin esto, si solo una familia está ocupada,
// Postgres arranca en la otra y la URL de conexión apunta a un servicio que no es Postgres.
const puertoLibre = (port, host) => new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', (err) => resolve(err.code === 'EADDRINUSE' ? false : true)); // sin IPv6: no cuenta como ocupado
  srv.once('listening', () => srv.close(() => resolve(true)));
  srv.listen(port, host);
});

const dir = path.join(__dirname, '..', '.pgdata');
const port = parseInt(process.env.LOCAL_PG_PORT, 10) || 54329;
const dbName = 'elevation_dev';
const user = 'elevation';
const password = 'elevation_local';

(async () => {
  if (!(await puertoLibre(port, '127.0.0.1')) || !(await puertoLibre(port, '::1'))) {
    console.error(`El puerto ${port} está ocupado (otra base local u otro programa). Detén esa y vuelve a intentar, o usa LOCAL_PG_PORT=<otro puerto>.`);
    process.exit(1);
  }
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
})().catch((e) => {
  // La librería a veces rechaza sin objeto de error (p. ej. puerto ocupado): se explica la causa probable.
  const detalle = (e && e.message) ||
    `el puerto ${port} puede estar ocupado (otra base local en marcha). Detén la otra o usa LOCAL_PG_PORT=<otro puerto>.`;
  console.error('No se pudo arrancar la base local:', detalle);
  process.exit(1);
});
