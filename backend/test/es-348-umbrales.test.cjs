// ES-348: los umbrales de privacidad de /api/admin/metrics salen de UNA constante (utils/minAverageSample.js); ni la ruta ni la prueba de PostgreSQL llevan 5 o 3 escritos a mano.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MIN_AVERAGE_SAMPLE, MIN_DISTINCT_PEOPLE, averageOf } = require('../utils/minAverageSample');
const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

test('ES-348: valores y exports de los umbrales (ES-273 los reutiliza)', () => {
  assert.equal(MIN_AVERAGE_SAMPLE, 5); assert.equal(MIN_DISTINCT_PEOPLE, 3);
  assert.equal(averageOf([1, 2, 3, 4]), null); assert.equal(averageOf([1, 2, 3, 4, 5]), 3);
});

test('ES-348: la ruta aplica los umbrales por reemplazo (:min y :people) desde las constantes, sin 5 ni 3 escritos en el SQL', () => {
  const route = read('../routes/adminMetrics.js');
  assert.match(route, /replacements: \{ min: MIN_AVERAGE_SAMPLE, people: MIN_DISTINCT_PEOPLE, \.\.\.replacements \}/);
  assert.equal((route.match(/>= :min/g) || []).length, 3, 'avgMood, avgRating general y avgRating por profesional');
  assert.equal((route.match(/>= :people/g) || []).length, 3);
  assert.doesNotMatch(route.replace(/\/\/.*$/gm, ''), />=\s*[0-9]/, 'ningún umbral numérico escrito a mano');
});

test('ES-348: la prueba de PostgreSQL de es-180 usa las constantes y no números escritos a mano para los umbrales', () => {
  const pg = read('./integration/es-180-postgres.cjs');
  assert.match(pg, /require\('\.\.\/\.\.\/utils\/minAverageSample'\)/);
  assert.doesNotMatch(pg, /own\.length >= 5|\.size >= 3|n >= 5|owners\.length >= 3/);
  assert.match(pg, /own\.length >= MIN_AVERAGE_SAMPLE && new Set\(ownRows\.map\(\(r\) => r\.UserId\)\)\.size >= MIN_DISTINCT_PEOPLE/);
});
