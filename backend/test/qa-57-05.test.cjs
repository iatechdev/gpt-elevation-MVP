const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const syncOptions = require('../utils/syncOptions');

test('QA-57-05: alter solo con DB_SYNC_ALTER=true, sin importar NODE_ENV', () => {
  for (const nodeEnv of [undefined, '', 'production', 'staging', 'development', 'test']) {
    const base = nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv };
    assert.deepEqual(syncOptions(base), {}, `NODE_ENV=${nodeEnv}`);
    for (const value of ['', 'false', 'TRUE', '1', 'yes', ' true']) {
      assert.deepEqual(syncOptions({ ...base, DB_SYNC_ALTER: value }), {}, `DB_SYNC_ALTER=${JSON.stringify(value)}`);
    }
    assert.deepEqual(syncOptions({ ...base, DB_SYNC_ALTER: 'true' }), { alter: true });
  }
});

test('QA-57-05: server.js usa syncOptions y no decide alter por NODE_ENV', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');
  assert.match(source, /sequelize\.sync\(syncOptions\(\)\)/);
  assert.doesNotMatch(source, /alter:\s*true/);
});
