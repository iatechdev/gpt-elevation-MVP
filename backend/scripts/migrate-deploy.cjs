// ES-115 (ES-59, fase 2) · Comando previo al despliegue en Railway: aplica las migraciones pendientes antes de arrancar el servidor.
// Si falla (o si la base tiene esquema sin adoptar), sale con código distinto de 0 y Railway NO continúa con el despliegue:
// la versión anterior sigue sirviendo. Nunca imprime la URL de conexión ni credenciales.
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { needsAdoption } = require('./adopt-existing-schema.cjs');

async function main() {
  if (!process.env.DATABASE_URL) { console.error('migrate-deploy: falta DATABASE_URL.'); process.exit(2); }
  const ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  await client.connect();
  let sinAdoptar;
  try { sinAdoptar = await needsAdoption(client); } finally { await client.end(); }
  if (sinAdoptar) {
    console.error('migrate-deploy: la base tiene el esquema de la aplicación pero la línea base no está registrada (creada por sync() y sin adoptar).');
    console.error('Ejecute una vez, con respaldo y confirmación: node backend/scripts/adopt-existing-schema.cjs  (diagnóstico) y luego con --apply.');
    process.exit(1);
  }
  const backend = path.resolve(__dirname, '..');
  const r = spawnSync('npx', ['--no-install', 'sequelize-cli', 'db:migrate'], {
    cwd: backend, stdio: 'inherit', shell: process.platform === 'win32', env: process.env,
  });
  if (r.status !== 0) { console.error('migrate-deploy: las migraciones fallaron; el despliegue no continúa.'); process.exit(r.status || 1); }
  console.log('migrate-deploy: migraciones al día.');
}

main().catch((e) => { console.error('migrate-deploy: error:', e.message); process.exit(1); });
