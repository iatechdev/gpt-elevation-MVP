// ES-383: suite de RENDIMIENTO, aparte de la de corrección. Ejecuta las mismas pruebas que tienen techos de tiempo con PERF_STRICT=1:
// ahí los techos (escalados por la velocidad medida en la misma corrida, ver test/perf-gate.cjs) SÍ fallan. En `npm test` y en los scripts :pg solo informan.
// Uso: npm run test:perf   (pruebas unitarias; las de Postgres se añaden solo si están sus variables *_TEST_DATABASE_URL: ES85, ES179, ES180, ES216, ES29, ES282)
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const UNIT = ['es-384-barrera-seguimiento', 'es-312-confusables', 'es-304-detector-normalization', 'es-191-review', 'es-214-phone-detector', 'es-109-sanitizer', 'es-97-terapeuta-ia'].map((n) => `test/${n}.test.cjs`);
const PG = [['ES85_TEST_DATABASE_URL', 'es-85'], ['ES179_TEST_DATABASE_URL', 'es-179'], ['ES180_TEST_DATABASE_URL', 'es-180'], ['ES216_TEST_DATABASE_URL', 'es-216'], ['ES29_TEST_DATABASE_URL', 'es-29'], ['ES282_TEST_DATABASE_URL', 'es-282']];
const files = [...UNIT];
for (const [variable, name] of PG) { if (process.env[variable]) files.push(`test/integration/${name}-postgres.cjs`); else console.log(`# test:perf: se omite ${name}-postgres (falta ${variable})`); }
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, PERF_STRICT: '1' } });
process.exit(result.status === null ? 1 : result.status);
