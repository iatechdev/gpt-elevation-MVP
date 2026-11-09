// ES-154 (tramo 2): ningún componente NUEVO lleva texto fijo en un idioma. Es un «trinquete»: cada archivo .tsx tiene un tope de textos fijos detectados
// (JSX con letras y atributos aria-label / placeholder / title / alt) fijado en test/fixtures/es-154-texto-fijo.json con lo que ya existía. Un archivo nuevo
// tiene tope 0; uno existente no puede superar su tope. Al migrar una pantalla a claves, el tope baja (npm run i18n:baseline) y ya no puede volver a subir.
// Es una heurística (no entiende el código): sirve para frenar texto nuevo, no para demostrar que no queda ninguno.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const baselineFile = fileURLToPath(new URL('./fixtures/es-154-texto-fijo.json', import.meta.url))
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
const LETTERS = /[A-Za-zÀ-ÿ]{3,}/
const JSX_TEXT = />([^<>{}=;\n()]*[A-Za-zÀ-ÿ]{3,}[^<>{}=;\n()]*)</g
const ATTRIBUTE = /\b(?:aria-label|placeholder|title|alt)="([^"{}]*[A-Za-zÀ-ÿ]{3,}[^"{}]*)"/g
const noComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

/** Textos fijos detectados en un archivo .tsx. */
export function hardcodedTexts(source) {
  const clean = noComments(source)
  return [...clean.matchAll(JSX_TEXT), ...clean.matchAll(ATTRIBUTE)].map((match) => match[1].trim()).filter((text) => LETTERS.test(text))
}
const scan = () => Object.fromEntries(walk(root).filter((file) => file.endsWith('.tsx')).map((file) => [path.relative(root, file).split(path.sep).join('/'), hardcodedTexts(fs.readFileSync(file, 'utf8')).length]).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)))

if (process.env.WRITE_BASELINE === '1') {
  fs.mkdirSync(path.dirname(baselineFile), { recursive: true })
  fs.writeFileSync(baselineFile, JSON.stringify(scan(), null, 1) + '\n')
}

test('ES-154: el detector reconoce texto fijo en JSX y en atributos, y deja pasar claves y código', () => {
  assert.equal(hardcodedTexts('<p>Hola mundo</p>').length, 1)
  assert.equal(hardcodedTexts('<button aria-label="Cerrar menú">x</button>').length, 1)
  assert.equal(hardcodedTexts('<input placeholder="Escribe aquí" />').length, 1)
  assert.equal(hardcodedTexts('<p>{t(\'hero_title\')}</p>').length, 0)
  assert.equal(hardcodedTexts('<p>{c.title}</p><button aria-label={c.close}>{c.ok}</button>').length, 0)
  assert.equal(hardcodedTexts('const [a, setA] = useState<string>(\'\'); // <p>Comentario fijo</p>').length, 0)
  assert.equal(hardcodedTexts('<span>•</span><b>12</b>').length, 0)
})

test('ES-154: ningún archivo .tsx supera su tope de textos fijos y los archivos nuevos no tienen ninguno', () => {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
  const current = scan()
  const over = Object.entries(current).filter(([file, count]) => count > (baseline[file] ?? 0)).map(([file, count]) => `${file}: ${count} (tope ${baseline[file] ?? 0})`)
  assert.deepEqual(over, [], `Texto fijo nuevo. Usa claves con t() / el diccionario del idioma (es.ts y en.ts) en vez de escribir el texto en el componente.`)
})

test('ES-154: los topes solo bajan: no quedan archivos en el tope que ya no existen o ya no tienen texto fijo', () => {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
  const current = scan()
  const stale = Object.keys(baseline).filter((file) => !(file in current))
  assert.deepEqual(stale, [], 'Quita del tope los archivos migrados: npm run i18n:baseline')
})
