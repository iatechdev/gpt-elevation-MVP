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
