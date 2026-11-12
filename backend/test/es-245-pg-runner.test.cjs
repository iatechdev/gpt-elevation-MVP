// ES-245 · El runner de las suites PostgreSQL: una suite nueva entra sola y no puede quedar fuera en silencio.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discover, describe, EXCLUDE } = require('../scripts/runPgSuites.cjs');

const root = path.join(__dirname, '..', '..');

test('ES-245: toda suite de backend/test/integration declara su variable de base de datos, o está excluida con motivo', () => {
  const problems = [];
  for (const file of discover()) {
    const suite = describe(file);
    if (suite.excluded) { if (!suite.excluded.trim()) problems.push(`${file}: exclusión sin motivo`); continue; }
    if (!suite.variable) problems.push(`${file}: no declara ninguna variable *_TEST_DATABASE_URL (el runner no puede darle la base)`);
  }
  for (const file of Object.keys(EXCLUDE)) if (!fs.existsSync(path.join(__dirname, 'integration', file))) problems.push(`${file}: está en la lista de exclusión pero ya no existe`);
  assert.deepEqual(problems, []);
});

test('ES-245: el runner reconoce la variable, ignora zz-* y lee las directivas @pg-env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es245-'));
  try {
    fs.writeFileSync(path.join(dir, 'es-9001-postgres.cjs'), "// @pg-env DATA_RIGHTS_ENABLED=true\n// @pg-env OTRA=un valor\nconst url = process.env.ES9001_TEST_DATABASE_URL;\n");
    fs.writeFileSync(path.join(dir, 'zz-sonda.cjs'), 'x');
    fs.writeFileSync(path.join(dir, 'sin-variable.cjs'), 'const nada = 1;');
    fs.writeFileSync(path.join(dir, 'LEEME.md'), 'no es una suite');
    assert.deepEqual(discover(dir), ['es-9001-postgres.cjs', 'sin-variable.cjs']);
    assert.deepEqual(describe('es-9001-postgres.cjs', dir), { file: 'es-9001-postgres.cjs', variable: 'ES9001_TEST_DATABASE_URL', env: { DATA_RIGHTS_ENABLED: 'true', OTRA: 'un valor' }, excluded: null });
    assert.equal(describe('sin-variable.cjs', dir).variable, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ES-245: la CI corre las suites con UN solo paso del runner (sin un paso por historia) y el script existe', () => {
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.equal((ci.match(/npm run test:pg\b/g) || []).length, 1, 'un solo paso del runner');
  const job = ci.slice(ci.indexOf('  data-rights-postgres:'));
  assert.equal((job.match(/_TEST_DATABASE_URL:/g) || []).length, 0, 'el job de PostgreSQL ya no lista una variable por suite: la pone el runner');
  assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).scripts['test:pg'], 'node scripts/runPgSuites.cjs');
});
