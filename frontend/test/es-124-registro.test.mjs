// ES-124: un solo registro en español (tuteo). Ningún texto de la interfaz usa voseo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const path = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SRC = path('../src/')
// Frontend (.ts/.tsx, sin en.ts) y los textos de usuario del servidor: rutas y contenido (QA ES-124: auth.js, pricing.js y legacyPricingCopy.json).
const ROOTS = [{ dir: SRC, ext: /\.(ts|tsx)$/ }, { dir: path('../../backend/routes/'), ext: /\.js$/ }, { dir: path('../../backend/content/'), ext: /\.(js|json)$/ }]
const walk = (dir, ext) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  return e.isDirectory() ? walk(p, ext) : ext.test(p) && !/[\\/]en\.ts$/.test(p) ? [p] : []
})

// Formas de voseo: «vos» y verbos en -ás/-és/-ís o imperativos con tilde final que no existen en tuteo.
const VOSEO = /(?<![\p{L}])(vos|tenés|querés|podés|sabés|sentís|llegás|preferís|aprobás|rechazás|hacés|decís|Seleccioná|Generá|Escribí|escribí|Explicá|Comunicá|Agregá|Creá|Encontrá|Establecé|Reflexioná|Seguí|Intentá|Volvé|Esperá|Tomá|Mirá|Contá|Elegí|Revisá|Probá|necesitás|Necesitás|Pensá|Fijate|Registrate|Contanos|Escribinos|Avisanos|Dejá|Usá|Sumá|Poné|Pedí|Vení|Decí|Hacé|Andá|Ingresá|Descargá|Cargá|Subí|Guardá|Borrá|Cambiá|Confirmá|Cerrá|Abrí|Enviá|Compartí|Buscá|Mostrá|Activá|Respondé|Completá|Empezá|Continuá|Descubrí|Conocé|Explorá|Iniciá)(?![\p{L}])/u

test('ES-124: ningún texto en español del frontend ni de los mensajes del servidor usa voseo', () => {
  const hits = []
  for (const { dir, ext } of ROOTS) {
    for (const file of walk(dir, ext)) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        const m = line.match(VOSEO)
        if (m) hits.push(`${file.slice(dir.length)}:${i + 1} «${m[0]}»`)
      })
    }
  }
  assert.deepEqual(hits, [])
})

test('ES-124: el panel del dashboard usa tuteo', () => {
  const dash = readFileSync(join(SRC, 'pages/UserDashboard.tsx'), 'utf8')
  assert.match(dash, /¿Cómo llegas hoy\?/)
  assert.match(dash, /Selecciona cómo llegas hoy/)
  assert.match(dash, /Aún no tienes recomendaciones\. ¡Genera las primeras!/)
  assert.match(dash, /Recomendaciones para ti/)
})
