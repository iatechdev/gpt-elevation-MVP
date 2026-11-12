// backend/scripts/runPgSuites.cjs
// ES-245 · Corre TODAS las suites de PostgreSQL de backend/test/integration/ con un solo comando: una suite nueva `*.cjs` en esa carpeta entra sola; NO hay que tocar
// .github/workflows/ci.yml ni backend/package.json (antes cada historia añadía su paso y su script, y los PR abiertos chocaban entre sí en esas dos listas).
//
// Convención de cada suite: declara en su propio archivo la variable `ESxx_TEST_DATABASE_URL` (o `<NOMBRE>_TEST_DATABASE_URL`) que lee (el runner la detecta y le da la URL del PostgreSQL desechable).
// Si necesita algo más: una línea `// @pg-env CLAVE=valor` (p. ej. `// @pg-env DATA_RIGHTS_ENABLED=true`).
//
//   PG_TEST_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres npm run test:pg
//   npm run test:pg -- --list            qué correría (no ejecuta nada)
//   npm run test:pg -- --only es-28      solo los archivos cuyo nombre contiene ese texto (uso local)
// Cada suite crea y borra su propia base con nombre aleatorio; solo se admite PostgreSQL de bucle local o de un servicio desechable de CI.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DIR = path.join(__dirname, '..', 'test', 'integration');
const DEFAULT_URL = 'postgres://postgres@127.0.0.1:5432/postgres';
// Archivos que NO corren aquí y el motivo (cada exclusión se justifica; la prueba es-245 la revisa).
const EXCLUDE = Object.freeze({
  'es-14-postgres.cjs': 'corre en el job `backend` con su propia base (elevation_ci) junto a la verificación de esquema',
  'es-15-postgres.cjs': 'levanta su propio PostgreSQL embebido y un navegador (Playwright); su lugar en CI está pendiente de decisión (ES-261)',
});
const VAR_PATTERN = /\b([A-Z][A-Z0-9_]*_TEST_DATABASE_URL)\b/;
const ENV_DIRECTIVE = /^\s*\/\/\s*@pg-env\s+([A-Z][A-Z0-9_]*)=(.*?)\s*$/gm;

function discover(dir = DIR) {
  return fs.readdirSync(dir).filter((name) => name.endsWith('.cjs') && !name.startsWith('zz-')).sort();
}

// -> { file, variable, env, excluded } por archivo. `variable` es null si el archivo no declara ninguna (error de convención).
function describe(file, dir = DIR) {
  if (EXCLUDE[file]) return { file, variable: null, env: {}, excluded: EXCLUDE[file] };
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  const match = VAR_PATTERN.exec(text);
  const env = {}; for (const m of text.matchAll(ENV_DIRECTIVE)) env[m[1]] = m[2];
  return { file, variable: match ? match[1] : null, env, excluded: null };
}

function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const url = process.env.PG_TEST_URL || DEFAULT_URL;
  const all = discover().map((file) => describe(file));
  const bad = all.filter((s) => !s.excluded && !s.variable);
  if (bad.length) {
    console.error('Suites sin variable ESxx_TEST_DATABASE_URL declarada en el archivo (convención de ES-245):\n  ' + bad.map((s) => s.file).join('\n  '));
    return 2;
  }
  const suites = all.filter((s) => !s.excluded && (!only || s.file.includes(only)));
  if (argv.includes('--list')) {
    for (const s of all) console.log(`${s.excluded ? 'excluida' : 'corre    '} ${s.file}${s.excluded ? `  — ${s.excluded}` : `  (${s.variable}${Object.keys(s.env).length ? ', ' + Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join(', ') : ''})`}`);
    return 0;
  }
  if (!suites.length) { console.error('Ninguna suite coincide.'); return 2; }
  const results = [];
  const started = Date.now();
  for (const s of suites) {
    const t0 = Date.now();
    const gh = process.env.GITHUB_ACTIONS === 'true';
    console.log(gh ? `::group::${s.file}` : `\n=== ${s.file} (${s.variable}) ===`);
    const run = spawnSync(process.execPath, ['--test', path.join('test', 'integration', s.file)], {
      cwd: path.join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, [s.variable]: url, ...s.env },
    });
    if (gh) console.log('::endgroup::');
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);
    results.push({ file: s.file, ok: run.status === 0, seconds, status: run.status, signal: run.signal });
    if (run.status !== 0 && gh) console.log(`::error title=Suite PostgreSQL fallida::${s.file} terminó con código ${run.status ?? run.signal}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n── Resumen de suites PostgreSQL: ${results.length - failed.length}/${results.length} en verde (${((Date.now() - started) / 1000).toFixed(0)} s) ──`);
  for (const r of results) console.log(`${r.ok ? 'ok    ' : 'FALLÓ '} ${r.file}  ${r.seconds} s`);
  if (failed.length) console.log(`\nFALLARON ${failed.length}: ${failed.map((r) => r.file).join(', ')}`);
  return failed.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { discover, describe, EXCLUDE, VAR_PATTERN, ENV_DIRECTIVE };
