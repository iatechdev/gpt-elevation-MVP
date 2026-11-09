// ES-154 tramo 2: E154-1 (interpolate no resuelve claves heredadas) y los textos de marcos, interfaz y sesión alcanzables por clave con t().
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { interpolate, prefixed } from '../src/i18n/format.ts'
import { shellCopy } from '../src/shell/copy.ts'
import { interfaceCopy } from '../src/access/interfaceCopy.ts'
import { sessionCopy } from '../src/access/sessionCopy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('E154-1: un marcador llamado como una propiedad heredada no se resuelve con Object.prototype', () => {
  for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    assert.equal(interpolate(`Hola {${name}}`, {}), `Hola {${name}}`, name) // sin valor propio: se deja el marcador, nunca «function Object()…»
  }
  assert.equal(interpolate('Hola {constructor}', { constructor: 'Ana' }), 'Hola Ana') // con valor propio sí
  assert.equal(interpolate('{n} de {max}', { n: 0, max: 5 }), '0 de 5')
})

test('ES-154 tramo 2: prefixed antepone el espacio de nombres sin tocar valores ni perder claves', () => {
  const out = prefixed('shell.', { skip: 'Saltar', retry: 'Reintentar' })
  assert.deepEqual(out, { 'shell.skip': 'Saltar', 'shell.retry': 'Reintentar' })
  assert.deepEqual(prefixed('x.', {}), {})
})

test('ES-154 tramo 2: marcos, interfaz y sesión tienen las mismas claves en ES y EN y todo texto no vacío', () => {
  for (const [name, source] of [['shell', shellCopy], ['interface', interfaceCopy], ['session', sessionCopy]]) {
    assert.deepEqual(Object.keys(source.es).sort(), Object.keys(source.en).sort(), name)
    for (const lang of ['es', 'en']) for (const [key, text] of Object.entries(source[lang])) assert.ok(typeof text === 'string' && text.trim(), `${name}.${lang}.${key}`)
  }
})

test('ES-154 tramo 2: es.ts y en.ts publican los tres espacios de nombres y ninguna clave suelta choca con ellos', () => {
  for (const lang of ['es', 'en']) {
    const source = read(`../src/i18n/${lang}.ts`)
    for (const [prefix, variable] of [['shell', 'shellCopy'], ['interface', 'interfaceCopy'], ['session', 'sessionCopy']]) {
      assert.ok(source.includes(`...prefixed('${prefix}.', ${variable}.${lang})`), `${lang}: falta ${prefix}.`)
    }
    // Una clave escrita a mano con esos prefijos taparía o sería tapada por la fachada.
    assert.doesNotMatch(source, /^\s*['"]?(shell|interface|session)\.[\w.]+['"]?\s*:/m, `${lang}: clave suelta con prefijo reservado`)
  }
  const keysEs = Object.keys(prefixed('shell.', shellCopy.es)); const keysEn = Object.keys(prefixed('shell.', shellCopy.en))
  assert.deepEqual(keysEs.sort(), keysEn.sort())
  assert.ok(keysEs.includes('shell.noAccess') && Object.keys(prefixed('interface.', interfaceCopy.es)).includes('interface.skip'))
})

test('ES-154 tramo 2: las claves nuevas no rompen el CI de claves de textos.json ni el texto mezclado en un idioma', () => {
  const es = read('../src/i18n/es.ts'); const en = read('../src/i18n/en.ts')
  assert.doesNotMatch(es, /admin_confirming: 'Confirming/) // E154-2: un texto en inglés dentro del diccionario en español
  assert.match(es, /admin_confirming: 'Confirmando\.\.\.'/); assert.match(en, /admin_confirming: 'Confirming\.\.\.'/)
})
