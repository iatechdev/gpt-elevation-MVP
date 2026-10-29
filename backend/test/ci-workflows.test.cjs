// ES-108: los workflows de GitHub Actions deben ser YAML válido y citar scripts que existen. Sin red ni base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkWorkflow, checkAll } = require('../scripts/check-workflows.cjs');

const SCRIPTS = { backend: new Set(['test', 'db:drift']), frontend: new Set(['build']), '': new Set() };
const wrap = (steps, extra = '') => `name: CI\non: push\njobs:\n  backend:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: backend\n${extra}    steps:\n${steps}`;

test('ES-108: los workflows del repositorio son válidos (si falla, GitHub los rechazaría en 0 s sin correr pruebas)', () => {
  const { files, problems } = checkAll();
  assert.ok(files.includes('ci.yml'), 'debe existir .github/workflows/ci.yml');
  assert.deepEqual(problems, []);
});

test('ES-108: el defecto de #70 (nombre de paso con «: » sin comillas) se detecta con archivo y línea; entre comillas pasa', () => {
  const broken = wrap('      - name: ES-95 solicitudes: carrera de envíos\n        run: npm test\n');
  const [problem] = checkWorkflow(broken, 'ci.yml', SCRIPTS);
  assert.match(problem, /^ci\.yml:\d+: YAML inválido/);
  assert.match(problem, /entre comillas/);
  const fixed = wrap('      - name: "ES-95 solicitudes: carrera de envíos"\n        run: npm test\n');
  assert.deepEqual(checkWorkflow(fixed, 'ci.yml', SCRIPTS), []);
});

test('ES-108: pasos mal formados, scripts inexistentes y documentos que no son workflows se señalan', () => {
  assert.match(checkWorkflow(wrap('      - name: sin acción\n'), 'w.yml', SCRIPTS)[0], /exactamente uno de «run» o «uses»/);
  assert.match(checkWorkflow(wrap('      - run: npm test\n        uses: actions/checkout@v4\n'), 'w.yml', SCRIPTS)[0], /exactamente uno/);
  assert.match(checkWorkflow(wrap('      - run: npm run no-existe\n'), 'w.yml', SCRIPTS)[0], /«npm run no-existe» no existe/);
  assert.deepEqual(checkWorkflow(wrap('      - run: npm run db:drift && npm test\n'), 'w.yml', SCRIPTS), []);
  assert.match(checkWorkflow('- a\n- b\n', 'w.yml', SCRIPTS)[0], /no es un mapa de workflow/);
  assert.match(checkWorkflow('name: CI\non: push\n', 'w.yml', SCRIPTS)[0], /falta el bloque «jobs»/);
  assert.match(checkWorkflow('', 'w.yml', SCRIPTS)[0], /no es un mapa de workflow/);
  assert.match(checkWorkflow('name: CI\njobs:\n  a:\n    runs-on: x\n    steps: []\n', 'w.yml', SCRIPTS)[0], /no tiene pasos/);
});

test('ES-108 (QA): el directorio se normaliza (./frontend, frontend/, ./frontend/) y un run numérico o booleano se señala', () => {
  for (const dir of ['./frontend', 'frontend/', './frontend/', 'frontend', '././frontend//']) {
    const ok = wrap('      - run: npm run build\n').replace('working-directory: backend', `working-directory: ${dir}`);
    assert.deepEqual(checkWorkflow(ok, 'w.yml', SCRIPTS), [], dir);
    const bad = wrap('      - run: npm run no-existe\n').replace('working-directory: backend', `working-directory: ${dir}`);
    assert.match(checkWorkflow(bad, 'w.yml', SCRIPTS)[0], /no existe en el package\.json de «frontend»/, dir);
  }
  for (const value of ['123', 'true', '1.5']) assert.match(checkWorkflow(wrap(`      - run: ${value}\n`), 'w.yml', SCRIPTS)[0], /«run» debe ser texto/, value);
  assert.deepEqual(checkWorkflow(wrap('      - run: "123"\n'), 'w.yml', SCRIPTS), []);
});

test('ES-108: el directorio de trabajo del job decide en qué package.json se buscan los scripts', () => {
  const frontend = wrap('      - run: npm run build\n').replace('working-directory: backend', 'working-directory: frontend');
  assert.deepEqual(checkWorkflow(frontend, 'w.yml', SCRIPTS), []);
  const wrongDir = wrap('      - run: npm run build\n'); // «build» no está en backend
  assert.match(checkWorkflow(wrongDir, 'w.yml', SCRIPTS)[0], /«npm run build» no existe/);
});
