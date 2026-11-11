// ES-261 · Las suites antiguas (ES-15, ES-16, ES-113) arrancan su propio PostgreSQL con `embedded-postgres`, cuyo binario Linux no corre en ubuntu-latest (pide libicuuc.so.60).
// Si se define la variable de entorno de la suite con la URL de un PostgreSQL desechable en loopback (el servicio de CI o el clúster local), la suite crea en él una base aleatoria
// propia y la borra al terminar; sin la variable, sigue usando embedded-postgres como antes. Devuelve null cuando no hay variable.
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');

async function openExternalPostgres(envVar, tag) {
  const raw = process.env[envVar];
  if (!raw) return null;
  const target = new URL(raw);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error(`${envVar}: solo se aceptan servidores en loopback`);
  const name = `${tag}_test_${randomBytes(8).toString('hex')}`;
  const admin = new Client({ connectionString: target.toString(), ssl: false });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(target.toString()); url.pathname = `/${name}`;
  let dropped = false;
  return {
    url: url.toString(),
    // Misma forma que EmbeddedPostgres para las partes que la suite usa: initialise/start no hacen nada y stop borra la base.
    shim: {
      async initialise() {}, async start() {},
      async stop() {
        if (dropped) return; dropped = true;
        await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
        await admin.end().catch(() => {});
      },
    },
  };
}

module.exports = { openExternalPostgres };
