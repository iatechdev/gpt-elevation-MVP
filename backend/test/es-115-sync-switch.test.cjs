// ES-115 · Interruptor DB_SYNC_DISABLED: solo con 'true' exacto se omite sync(); cualquier otro valor o su ausencia no cambia nada.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const syncOptions = require('../utils/syncOptions');
const { syncDisabled } = syncOptions;

test('ES-115: sync() se omite únicamente con DB_SYNC_DISABLED=true', () => {
  assert.equal(syncDisabled({ DB_SYNC_DISABLED: 'true' }), true);
  for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true']) {
    assert.equal(syncDisabled({ DB_SYNC_DISABLED: value }), false, `valor ${JSON.stringify(value)}`);
  }
  assert.equal(syncDisabled({}), false);
});

test('ES-115: el interruptor no altera las opciones de sync() existentes', () => {
  assert.deepEqual(syncOptions({}), {});
  assert.deepEqual(syncOptions({ DB_SYNC_ALTER: 'true' }), { alter: true });
  assert.deepEqual(syncOptions({ DB_SYNC_DISABLED: 'true' }), {});
});

// El arranque migra primero: el CMD del Dockerfile encadena migrate-deploy y el servidor, y railway.json no puede
// pisarlo con un startCommand propio (si lo hiciera, el contenedor arrancaría sin migrar).
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');

test('ES-115: el CMD del Dockerfile aplica las migraciones y solo entonces arranca el servidor', () => {
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const cmd = dockerfile.split(/\r?\n/).filter((line) => line.startsWith('CMD ')).pop();
  assert.ok(cmd, 'el Dockerfile tiene CMD');
  const iMigrar = cmd.indexOf('migrate-deploy.cjs');
  const iServidor = cmd.indexOf('backend/server.js');
  assert.ok(iMigrar > -1 && iServidor > iMigrar, 'migrate-deploy va antes que el servidor');
  assert.match(cmd, /migrate-deploy\.cjs && exec node backend\/server\.js/, 'encadenado con && (si migrar falla, el servidor no arranca)');
});

test('ES-115: railway.json no define startCommand (pisaría el CMD y se omitirían las migraciones)', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'railway.json'), 'utf8'));
  assert.equal(config.deploy.startCommand, undefined);
  assert.equal(config.deploy.preDeployCommand, undefined);
});
