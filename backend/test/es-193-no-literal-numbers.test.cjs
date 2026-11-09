// ES-193: ningún número de emergencia ni de contacto va escrito en el código, la configuración ni los textos que llegan al paquete del cliente.
// Es una búsqueda heurística (no demuestra la ausencia): mira cada línea con una palabra de ayuda o emergencia y un número que parezca de teléfono.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const SCAN = ['backend', 'frontend/src', 'frontend/public', 'shared'];
// migrations: SQL y datos de esquema (la migración base trae texto de columnas), no textos de pantalla; la de ES-193 no siembra ningún número y lo prueba la integración.
const SKIP_DIRS = new Set(['node_modules', 'test', 'test-db', 'dist', '.pgdata', 'scripts', 'migrations']);
const EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json', '.html', '.css']);
const KEYWORD = /(l[ií]nea|helpline|hotline|emergenc|urgenc|crisis|suicid|ayuda|\bcall\b|\bllama)/i;
// 7+ dígitos con separadores, +CC, o un número corto de servicio de 3 dígitos que empieza por 1 pegado a la palabra clave.
const PHONE = /(\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}|\b\d{7,}\b|(l[ií]nea|helpline|hotline|emergenc\w*|call|llama)\W{0,12}1\d\d\b/i;

function* files(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) yield* files(path.join(dir, entry.name)); }
    else if (EXTENSIONS.has(path.extname(entry.name)) && !/package(-lock)?\.json$/.test(entry.name)) yield path.join(dir, entry.name);
  }
}

test('ES-193: ninguna línea del código, la configuración ni los textos del cliente junta una palabra de ayuda con un número de teléfono', () => {
  const hits = [];
  for (const base of SCAN) for (const file of files(path.join(root, base))) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => { if (line.length < 4000 && KEYWORD.test(line) && PHONE.test(line)) hits.push(`${path.relative(root, file)}:${i + 1}`); });
  }
  assert.deepEqual(hits, [], `posible número literal en: ${hits.join(', ')}`);
});

test('ES-193: el registro de recursos de apoyo de ES-21 sigue vacío en el repositorio (los valores viven en la base)', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'backend/config/supportResources.json'), 'utf8'));
  assert.deepEqual(registry.countries, {});
});
