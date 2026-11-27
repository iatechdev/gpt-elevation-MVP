// ES-410 · Plantilla del catálogo de rutas y validador local. Sin base de datos ni red.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildWorkbook, validateWorkbook, SHEETS, header } = require('../scripts/catalog-template/catalog.cjs');
const { readWorkbook, writeWorkbook, zip, unzip } = require('../scripts/catalog-template/xlsx.cjs');
const { main, OUTPUTS, DOCS } = require('../scripts/catalog-template/cli.cjs');
const EXAMPLE = require('../scripts/catalog-template/example.cjs');
const server = require('../utils/routeCatalog');
const seed = require('../seeds/routeCatalogSynthetic.cjs').build('2026-11-27');

const NOW = new Date('2026-11-27T12:00:00Z');
const run = (data, options = {}) => validateWorkbook(buildWorkbook(data), { allowExample: true, now: NOW, ...options });
const errors = (result) => result.problems.filter((p) => p.level === 'error');
const clone = (value) => JSON.parse(JSON.stringify(value));
const withCell = (sheet, columnPath, value, row = 0) => { const data = clone(EXAMPLE); data[sheet][row][columnPath] = value; return data; };
const columnName = (sheet, columnPath) => SHEETS.find((s) => s.name === sheet).columns.find((c) => c.path === columnPath).es;
const assertError = (result, sheet, pattern) => assert.ok(errors(result).some((p) => p.sheet === sheet && pattern.test(`${p.column || ''} ${p.message}`)), `se esperaba un error en ${sheet} ${pattern}: ${JSON.stringify(errors(result))}`);

// Un elemento del servidor escrito como lo escribiría una persona en la plantilla.
function toRow(sheet, record) {
  const row = {};
  for (const col of sheet.columns) {
    const value = col.path.replace('$self.', '').split('.').reduce((node, part) => (node === undefined || node === null ? node : node[part]), record);
    if (col.path === 'country' && value === null) row[col.path] = 'NO APLICA';
    else if (value === undefined) continue;
    else if (Array.isArray(value)) row[col.path] = value.join('; ');
    else if (typeof value === 'boolean') row[col.path] = value ? 'SI' : 'NO';
    else row[col.path] = String(value);
  }
  return row;
}

test('ES-410: los archivos publicados en docs son los que genera el código (si cambian las columnas, hay que regenerarlos)', () => {
  for (const [name, build] of Object.entries(OUTPUTS)) assert.deepEqual([...readWorkbook(fs.readFileSync(path.join(DOCS, name)))], [...readWorkbook(build())], `${name}: npm run catalog:template`);
});

test('ES-410: la plantilla no pierde ningún campo — el catálogo sintético del servidor entra por la plantilla y sale idéntico', () => {
  // La semilla no usa todos los campos opcionales: se añaden para que la ida y vuelta cubra TODOS los que el servidor acepta.
  Object.assign(seed.sources.src_oficial_a, { publishedAt: '2026-01-15' });
  Object.assign(seed.offers.oferta_formador_vigente, { postedAt: '2026-11-01', extract: 'Extracto de prueba' });
  seed.contexts.ctx_contabilidad_analisis.note = { es: 'Nota', en: 'Note' };
  const data = Object.fromEntries(SHEETS.map((s) => [s.name, []]));
  const sheet = (kind) => SHEETS.find((s) => s.kind === kind);
  for (const kind of server.KINDS) {
    for (const [key, item] of Object.entries(seed[kind])) {
      data[sheet(kind).name].push({ ...toRow(sheet(kind), item), $key: key });
      for (const child of kind === 'roles' ? ['tasks', 'barriers', 'capabilities'] : []) for (const entry of item[child]) data[sheet(child).name].push({ ...toRow(sheet(child), entry), $parent: key });
    }
  }
  const result = run(data);
  assert.deepEqual(errors(result), []);
  let compared = 0;
  for (const kind of server.KINDS) {
    assert.equal(result.items[kind].size, Object.keys(seed[kind]).length);
    for (const [key, item] of Object.entries(seed[kind])) {
      const { synthetic, ...expected } = server.normalizeItem(kind, item);
      assert.deepEqual(result.items[kind].get(key), expected, `${kind}/${key}`);
      compared += 1;
    }
  }
  assert.ok(compared >= 25);
});

test('ES-410: el ejemplo ficticio está completo con permiso explícito y se rechaza como catálogo real', () => {
  assert.deepEqual(errors(run(EXAMPLE)), []);
  const real = run(EXAMPLE, { allowExample: false });
  assert.equal(real.ok, false);
  for (const sheet of ['Contextos', 'Fuentes', 'Rutas', 'Tareas', 'Ofertas', 'Recursos']) assertError(real, sheet, /ejemplo o de prueba/);
  const onlyUrl = clone(EXAMPLE); onlyUrl.Fuentes[0] = { ...onlyUrl.Fuentes[0], title: 'Documento', consultedBy: 'Alguien' };
  assertError(run(onlyUrl, { allowExample: false }), 'Fuentes', /Dirección web.*ejemplo/); // el dominio de ejemplo basta
});

test('ES-410: quitar CUALQUIER dato obligatorio del ejemplo produce un error en su hoja', () => {
  let cases = 0;
  for (const sheet of SHEETS) {
    for (const col of sheet.columns.filter((c) => c.required)) {
      if (!EXAMPLE[sheet.name][0][col.path]) continue;
      const data = clone(EXAMPLE); delete data[sheet.name][0][col.path];
      const found = errors(run(data));
      assert.ok(found.length > 0, `${sheet.name} sin ${col.path} debe fallar`);
      cases += 1;
    }
  }
  assert.ok(cases > 55, `casos: ${cases}`);
});

test('ES-410: los datos obligatorios «en algunos casos» se exigen cuando toca', () => {
  const regulated = withCell('Rutas', 'regulated.isRegulated', 'SI');
  assertError(run(regulated), 'Rutas', /habilitación/);
  assertError(run(withCell('Ofertas', 'salary.published', 'SI')), 'Ofertas', /salario/);
  assertError(run(withCell('Recursos', 'price.published', 'SI')), 'Recursos', /importe/);
  const sourced = clone(EXAMPLE); delete sourced.Tareas[0]['aiExposure.sourceKey'];
  assertError(run(sourced), 'Tareas', /sourced/);
  const noDuration = clone(EXAMPLE); delete noDuration.Recursos[0]['duration.minutes'];
  assertError(run(noDuration), 'Recursos', /duración/);
});

test('ES-410: cada valor que el servidor rechaza se señala con hoja, fila y columna', () => {
  const cases = [
    ['Fuentes', 'url', 'http://sitio.org/a'], ['Fuentes', 'url', 'https://usuario:clave@sitio.org'], ['Fuentes', 'type', 'blog'], ['Fuentes', 'country', 'co'], ['Fuentes', 'language', 'esp'],
    ['Fuentes', 'consultedAt', '2027-01-01'], ['Fuentes', 'consultedAt', '20/11/2026'], ['Fuentes', 'accessible', 'quizá'], ['Fuentes', 'title', 'x'.repeat(201)],
    ['Rutas', 'market', 'Colombia'], ['Rutas', 'modality', 'casa'], ['Rutas', 'languagesRequired', 'es;en;da;fr;de'], ['Rutas', 'labels.es', 'x'.repeat(101)],
    ['Tareas', 'aiExposure.status', 'seguro'], ['Capacidades', 'importance', 'media'], ['Capacidades', 'skillKey', 'Comunicación'],
    ['Ofertas', 'modality', 'mixta'], ['Recursos', 'level', 'experto'], ['Recursos', 'duration.minutes', '0'], ['Recursos', 'duration.minutes', 'media hora'],
  ];
  for (const [sheet, columnPath, value] of cases) {
    const found = errors(run(withCell(sheet, columnPath, value)));
    assert.ok(found.some((p) => p.sheet === sheet && p.row === 4 && p.column === columnName(sheet, columnPath)), `${sheet}.${columnPath}=${value}: ${JSON.stringify(found)}`);
  }
});

test('ES-410: porcentajes y lenguaje de reemplazo se rechazan igual que en el servidor, en español y en inglés', () => {
  for (const [sheet, columnPath, value] of [['Tareas', 'text.es', 'El 70 % se automatiza'], ['Tareas', 'text.en', 'This role will be replaced by AI'], ['Rutas', 'labels.es', 'Rol sin futuro'], ['Fuentes', 'title', 'Los analistas serán reemplazados']]) {
    assertError(run(withCell(sheet, columnPath, value)), sheet, /no permitido/);
  }
});

test('ES-410: un precio escrito con separador de miles no se convierte en otro número', () => {
  const data = withCell('Recursos', 'price.published', 'SI'); data.Recursos[0]['price.currency'] = 'COP';
  for (const amount of ['1.500', '1,500,000', '$ 20']) assertError(run({ ...data, Recursos: [{ ...data.Recursos[0], 'price.amount': amount }] }), 'Recursos', /número/);
  const ok = run({ ...data, Recursos: [{ ...data.Recursos[0], 'price.amount': '1500000' }] });
  assert.deepEqual(errors(ok), []);
  assert.equal(ok.items.resources.get('ejemplo_recurso').price.amount, 1500000);
});

test('ES-410: un recurso sin rutas es error — el servidor lo publica, pero el cálculo de rutas falla con él', () => {
  const data = clone(EXAMPLE); delete data.Recursos[0].roleKeys;
  assertError(run(data), 'Recursos', /al menos una ruta/);
  const resource = server.normalizeItem('resources', { ...seed.resources.rec_analisis, roleKeys: undefined });
  assert.deepEqual(server.missingFor('resources', resource), [], 'si esto cambia, el servidor ya lo exige y la regla local sobra');
});

test('ES-410: claves repetidas, referencias rotas, rutas inexistentes y topes', () => {
  const duplicated = clone(EXAMPLE); duplicated.Contextos.push(clone(duplicated.Contextos[0]));
  assertError(run(duplicated), 'Contextos', /repetida \(fila 4\)/);
  assertError(run(withCell('Rutas', 'sourceKeys', 'fuente_que_no_existe')), 'Rutas', /no existe/);
  assertError(run(withCell('Ofertas', 'roleKey', 'ruta_que_no_existe')), 'Ofertas', /no existe/);
  assertError(run(withCell('Tareas', '$parent', 'otra_ruta')), 'Tareas', /ninguna ruta/);
  assertError(run(withCell('Contextos', '$key', 'Con Espacios')), 'Contextos', /no sirve/);
  const many = clone(EXAMPLE); for (let i = 0; i < 6; i++) many.Contextos.push({ $key: `contexto_${i}`, 'labels.es': `c ${i}`, 'labels.en': `c ${i}` });
  assertError(run(many), 'Contextos', /Máximo 6/);
  const tasks = clone(EXAMPLE); for (let i = 0; i < 12; i++) tasks.Tareas.push({ ...tasks.Tareas[0] });
  assertError(run(tasks), 'Rutas', /más de 12 tareas/);
  const offers = clone(EXAMPLE); for (let i = 0; i < 10; i++) offers.Ofertas.push({ ...offers.Ofertas[0], $key: `oferta_${i}` });
  assertError(run(offers), 'Rutas', /más de 10 ofertas/);
});

test('ES-410: avisos (no bloquean) de fuente antigua, oferta vencida y claves de capacidad por confirmar', () => {
  const data = clone(EXAMPLE); data.Fuentes[0].consultedAt = '2026-01-01'; data.Ofertas[0]['verification.at'] = '2026-10-01';
  const result = run(data, { skillKeys: ['otra'] });
  assert.equal(result.ok, true);
  const warnings = result.problems.map((p) => p.message).join(' | ');
  assert.match(warnings, /desactualizada/); assert.match(warnings, /vencida/); assert.match(warnings, /«comunicacion» no está en la lista/);
});

// Reescribe una hoja del ejemplo cambiando sus filas, como si la persona la hubiera tocado.
function tamper(sheetName, change) {
  const workbook = readWorkbook(buildWorkbook(EXAMPLE));
  return writeWorkbook([...workbook].flatMap(([name, rows]) => {
    const cells = rows.map((r) => [...r.cells]);
    const next = name === sheetName ? change(cells) : cells;
    return next === null ? [] : [{ name, rows: next, widths: [10] }];
  }));
}
const check = (buffer) => validateWorkbook(buffer, { allowExample: true, now: NOW });

test('ES-410: hoja borrada, encabezado cambiado, columna ajena y columnas reordenadas', () => {
  assertError(check(tamper('Ofertas', () => null)), 'Ofertas', /Falta esta hoja/);
  assertError(check(tamper('Fuentes', (rows) => { rows[1][2] = 'Nombre cambiado'; return rows; })), 'Fuentes', /Falta esta columna/);
  assertError(check(tamper('Fuentes', (rows) => rows.map((r, i) => (i === 1 ? [...r, 'Teléfono'] : i === 3 ? [...r, '123'] : r)))), 'Fuentes', /Columna desconocida/);
  assert.deepEqual(errors(check(tamper('Fuentes', (rows) => rows.map((r, i) => (i === 0 ? r : [...Array.from({ length: 10 }, (_, n) => r[n] || '')].reverse()))))), []);
  assert.deepEqual(errors(check(tamper('Fuentes', (rows) => rows.filter((_, i) => i !== 2)))), [], 'borrar la fila de ayuda no hace perder datos');
});

test('ES-410: archivos que no son .xlsx, demasiado grandes o con una parte que se infla sin límite se rechazan', () => {
  assert.throws(() => readWorkbook(Buffer.from('hola, esto es un csv')), /no es un \.xlsx/);
  assert.throws(() => readWorkbook(Buffer.alloc(6 * 1024 * 1024)), /5 MB/);
  const bomb = zip([['xl/workbook.xml', 'a'.repeat(6 * 1024 * 1024)], ['xl/_rels/workbook.xml.rels', '<Relationships/>']]);
  assert.ok(bomb.length < 100000);
  assert.throws(() => unzip(bomb)('xl/workbook.xml'));
  assert.throws(() => readWorkbook(bomb));
});

test('ES-410: el validador no abre ninguna base de datos (módulo vacío y sin driver pg) y la línea de comandos informa con 0, 1 y 2', () => {
  // Los modelos cargan «sequelize» por los tipos de datos; lo que importa es que no haya driver de Postgres ni una conexión real.
  assert.deepEqual(Object.keys(require.cache).filter((id) => /node_modules[\/]pg[\/]/.test(id)), []);
  assert.deepEqual(Object.keys(require('../database').sequelize), ['define']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es410-'));
  try {
    const file = path.join(dir, 'ejemplo.xlsx'); fs.writeFileSync(file, buildWorkbook(EXAMPLE));
    const output = []; const out = (line) => output.push(line);
    assert.equal(main(['validate', file, '--permitir-ejemplo'], out), 0);
    assert.match(output.join('\n'), /MODO EJEMPLO\. No lo cargues/);
    assert.match(output.join('\n'), /No se escribió nada/);
    assert.equal(main(['validate', file], out), 1);
    assert.equal(main(['validate', path.join(dir, 'no-existe.xlsx')], out), 2);
    assert.equal(main(['validate'], out), 2);
    assert.equal(main(['validate', file, '--publicar'], out), 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(header({ es: 'a', en: 'b' }), 'a / b');
});
