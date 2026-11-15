// ES-314 · La cola de emparejamientos del equipo muestra la etiqueta legible ES/EN de cada respuesta (no la clave cruda del servidor).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerLabel, ANSWER_LABEL_KEYS, AREA_OPTIONS, STYLE_OPTIONS, LANGUAGE_OPTIONS } from '../src/progress/answerLabels.ts'
import { progressEs, progressEn } from '../src/pages/progressCopy.ts'

const tEs = (key) => progressEs[key] ?? key
const tEn = (key) => progressEn[key] ?? key
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// Catálogo cerrado del servidor, leído del código (no copiado a mano): si el servidor añade un valor, esta prueba exige su etiqueta.
function serverCatalog() {
  const source = read('../../backend/routes/matching.js')
  const block = source.match(/ANSWER_CATALOG\s*=\s*\{([\s\S]*?)\n\}/)
  assert.ok(block, 'no se encontró ANSWER_CATALOG en backend/routes/matching.js')
  const out = {}
  for (const kind of ['area', 'style', 'language']) {
    const list = block[1].match(new RegExp(kind + '\\s*:\\s*\\[([^\\]]*)\\]'))
    assert.ok(list, 'sin lista para ' + kind)
    out[kind] = [...list[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
  }
  return out
}

test('ES-314: el mapa cubre TODOS los valores del catálogo del servidor, en ES y en EN, con una etiqueta que no es la clave cruda', () => {
  const catalog = serverCatalog()
  assert.ok(catalog.area.length >= 8 && catalog.style.length >= 8 && catalog.language.length >= 6, 'catálogo leído completo')
  for (const kind of Object.keys(catalog)) {
    for (const value of catalog[kind]) {
      for (const [lang, t] of [['es', tEs], ['en', tEn]]) {
        const label = answerLabel(kind, value, t)
        assert.ok(label && label !== '—', `${kind}/${value}/${lang}: sin etiqueta`)
        assert.equal(label, t(ANSWER_LABEL_KEYS[kind][value]), `${kind}/${value}/${lang}: no sale el texto del catálogo`)
        assert.ok(!/^pr_/.test(label), 'clave interna visible')
        assert.ok(!(ANSWER_LABEL_KEYS[kind][value] === undefined), `${kind}/${value}: sin clave de texto`)
      }
    }
  }
  // Y el mapa no inventa valores que el servidor no acepta.
  for (const kind of Object.keys(catalog)) assert.deepEqual(Object.keys(ANSWER_LABEL_KEYS[kind]).sort(), [...catalog[kind]].sort(), 'mapa y catálogo coinciden en ' + kind)
})

test('ES-314: los casos reportados (anxiety, reflective and exploratory, No preference, Spanish, es/en/both) salen con su etiqueta', () => {
  assert.equal(answerLabel('area', 'anxiety', tEs), 'Estrés y carga')
  assert.equal(answerLabel('area', 'anxiety', tEn), 'Stress and workload')
  assert.equal(answerLabel('style', 'reflective and exploratory', tEs), 'Reflexivo y exploratorio')
  assert.equal(answerLabel('style', 'reflective and exploratory', tEn), 'Reflective and exploratory')
  assert.equal(answerLabel('language', 'No preference', tEs), 'Sin preferencia')
  assert.equal(answerLabel('language', 'No preference', tEn), 'No preference')
  assert.equal(answerLabel('language', 'Spanish', tEs), 'Español')
  assert.equal(answerLabel('language', 'Spanish', tEn), 'Spanish')
  assert.equal(answerLabel('language', 'es', tEs), 'Español')
  assert.equal(answerLabel('language', 'en', tEn), 'English')
  assert.equal(answerLabel('language', 'both', tEs), 'Español e inglés')
  assert.equal(answerLabel('language', 'both', tEn), 'Spanish and English')
})

test('ES-314: un valor desconocido se muestra tal cual y sin romper; falta de respuesta → «—»; un nombre heredado de Object no se confunde con una clave', () => {
  assert.equal(answerLabel('area', 'burnout', tEs), 'burnout')
  assert.equal(answerLabel('style', 'Zen <b>', tEn), 'Zen <b>')
  assert.equal(answerLabel('language', 'toString', tEs), 'toString')
  assert.equal(answerLabel('language', '__proto__', tEs), '__proto__')
  assert.equal(answerLabel('area', undefined, tEs), '—')
  assert.equal(answerLabel('area', null, tEs), '—')
  assert.equal(answerLabel('area', '', tEs), '—')
  // Si el catálogo de textos aún no carga (t devuelve la clave), se muestra el valor, no «pr_a_anxiety».
  assert.equal(answerLabel('area', 'anxiety', (key) => key), 'anxiety')
})

test('ES-314: el cuestionario de la persona sigue enviando los MISMOS valores al servidor (solo cambia lo que se ve)', () => {
  assert.deepEqual(AREA_OPTIONS.map((o) => o[0]), ['anxiety', 'depression', 'relationships', 'personal growth', 'stress', 'other'])
  assert.deepEqual(STYLE_OPTIONS.map((o) => o[0]), ['reflective and exploratory', 'structured with goals', 'empathetic and listening', 'any'])
  assert.deepEqual(LANGUAGE_OPTIONS.map((o) => o[0]), ['Spanish', 'English', 'No preference'])
  const matching = read('../src/progress/ProgressMatching.tsx')
  assert.match(matching, /const AREAS = AREA_OPTIONS/)
  assert.doesNotMatch(matching, /\['anxiety', 'pr_a_anxiety'\]/, 'el mapa ya no está duplicado en el componente')
  // Cada opción ofrecida existe en el catálogo del servidor.
  const catalog = serverCatalog()
  for (const [kind, options] of [['area', AREA_OPTIONS], ['style', STYLE_OPTIONS], ['language', LANGUAGE_OPTIONS]]) for (const [value] of options) assert.ok(catalog[kind].includes(value), `${kind}/${value} no es del catálogo`)
})

test('ES-314: la cola del equipo usa answerLabel en las tres respuestas y ya no imprime los valores crudos', () => {
  const queues = read('../src/pages/admin/AdminUsersQueues.tsx')
  assert.match(queues, /answerLabel\('area', item\.answers\?\.area, t\)/)
  assert.match(queues, /answerLabel\('style', item\.answers\?\.style, t\)/)
  assert.match(queues, /answerLabel\('language', item\.answers\?\.language, t\)/)
  assert.doesNotMatch(queues, /item\.answers\?\.(area|style|language) \?\? /)
  assert.match(queues, /import '\.\.\/progressCopy\.ts'/, 'los textos se registran aunque la pantalla de progreso no se haya visitado')
})

test('ES-314: todas las claves de texto del mapa existen en ES y EN (sin huecos)', () => {
  for (const kind of Object.keys(ANSWER_LABEL_KEYS)) for (const key of new Set(Object.values(ANSWER_LABEL_KEYS[kind]))) {
    assert.ok(progressEs[key], 'falta ES ' + key)
    assert.ok(progressEn[key], 'falta EN ' + key)
  }
})
