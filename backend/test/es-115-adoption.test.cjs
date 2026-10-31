// CLI real en VM; cliente PostgreSQL simulado para observar cada consulta, sin conexiones ni secretos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const script = path.resolve(__dirname, '../scripts/adopt-existing-schema.cjs');
const actualRequire = createRequire(script);
const tables = actualRequire('../migrations/baseline-20261028.json')
  .map(sql => (sql.match(/^CREATE TABLE IF NOT EXISTS "(\w+)"/) || [])[1]).filter(Boolean);

async function run({ missingIndex = false, missingTable = false, apply = true, metaExists = true } = {}) {
  const queries = []; const output = []; const errors = [];
  let finish;
  const ended = new Promise(resolve => { finish = resolve; });
  class Client {
    async connect() {}
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('to_regclass')) return { rows: [{ t: metaExists ? 'SequelizeMeta' : null }] };
      if (sql.startsWith('SELECT "name"')) return { rows: [{ name: 'already-registered.js' }] };
      if (sql.includes('FROM pg_tables')) return { rows: [...new Set([...tables, 'ProfessionalApplications', 'ProfessionalApplicationFiles'])].filter(t => !missingTable || t !== 'Users').map(tablename => ({ tablename })) };
      if (sql.includes('FROM pg_indexes')) return { rows: missingIndex ? [] : [{ indexname: 'professional_applications_email_open_unique' }] };
      return { rows: [] };
    }
    async end() { finish(); }
  }
  const module = { exports: {} };
  const require = name => name === 'pg' ? { Client } : actualRequire(name);
  require.main = module;
  const process = { env: { DATABASE_URL: 'postgres://unused.invalid/test', DB_SSL: 'false' }, argv: ['node', script, ...(apply ? ['--apply'] : [])], exitCode: 0 };
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), { require, module, process, console: { log: message => output.push(message), error: (...args) => errors.push(args.join(' ')) } }, { filename: script });
  await ended;
  return { queries, output: output.join('\n'), errors: errors.join('\n'), code: process.exitCode };
}

test('ES-115 P2: ES-95 parcial bloquea --apply antes de cualquier escritura, exista o no SequelizeMeta', async () => {
  for (const metaExists of [true, false]) {
    const result = await run({ missingIndex: true, metaExists });
    assert.equal(result.code, 1);
    assert.match(result.output, /no_adoptable\s+20261029000000-es95-professional-applications\.js/);
    assert.match(result.output, /professional_applications_email_open_unique/);
    assert.match(result.errors, /Adopción bloqueada.*No se registra nada/);
    assert.ok(result.queries.every(({ sql }) => sql.startsWith('SELECT')), 'ni BEGIN, CREATE TABLE ni INSERT: cero escrituras');
  }
});

test('ES-115: cualquier no_adoptable bloquea, diagnóstico sigue sin escribir y esquema completo sí se adopta', async () => {
  const incomplete = await run({ missingTable: true });
  assert.equal(incomplete.code, 1);
  assert.ok(incomplete.queries.every(({ sql }) => sql.startsWith('SELECT')));
  const dry = await run({ apply: false, missingIndex: true });
  assert.equal(dry.code, 0);
  assert.ok(dry.queries.every(({ sql }) => sql.startsWith('SELECT')));
  const valid = await run();
  assert.equal(valid.code, 0);
  assert.deepEqual(valid.queries.filter(({ sql }) => sql.startsWith('INSERT')).map(({ values }) => values[0]), ['20261001000000-baseline.js', '20261029000000-es95-professional-applications.js']);
  assert.equal(valid.queries.at(-1).sql, 'COMMIT');
});
