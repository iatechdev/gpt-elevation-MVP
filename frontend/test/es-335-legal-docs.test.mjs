// ES-335: borradores legales ES/EN en docs/legal/. No cambian el producto; esta prueba protege su coherencia:
// cada documento existe en ES y EN con la marca de borrador, los marcadores coinciden entre idiomas y con POR-COMPLETAR.md,
// no hay datos de empresa inventados, el texto de «Tu opinión» es el aprobado (ES-173), y las cifras citadas coinciden con el código.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { copy } from '../src/pilot/copy.ts'
import { TERMS_VERSION } from '../src/legal/version.ts'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n')
const PAIRS = [
  ['01-aviso-de-privacidad.md', '01-privacy-notice.md'], ['02-terminos-de-uso.md', '02-terms-of-use.md'], ['03-aviso-de-producto-no-clinico.md', '03-non-clinical-product-notice.md'],
  ['04-cookies-y-almacenamiento.md', '04-cookies-and-browser-storage.md'], ['05-consentimientos-de-compartir.md', '05-sharing-consents.md'], ['06-permiso-tu-opinion.md', '06-feedback-permission.md'],
  ['07-conservacion-y-supresion.md', '07-retention-and-deletion.md'],
]
const MARKER = /\[(?:POR COMPLETAR|TO BE COMPLETED|VERIFICAR|VERIFY|REVISAR LEGAL|LEGAL REVIEW) ((?:PC|VF|RL)-\d{2})/g
const idsOf = text => new Set([...text.matchAll(MARKER)].map(match => match[1]))
const sorted = set => [...set].sort()

test('ES-335: cada documento existe en ES y EN, con la marca «borrador sin revisión legal» y la referencia al ticket', () => {
  for (const [es, en] of PAIRS) {
    const spanish = read(`docs/legal/es/${es}`), english = read(`docs/legal/en/${en}`)
    assert.match(spanish, /BORRADOR SIN REVISIÓN LEGAL/, es); assert.match(english, /DRAFT WITHOUT LEGAL REVIEW/, en)
    assert.match(spanish, /ES-335/, es); assert.match(english, /ES-335/, en)
    assert.ok(spanish.length > 1200 && english.length > 1200, `${es}/${en} no están vacíos`)
  }
  for (const file of ['README.md', 'POR-COMPLETAR.md', 'PREGUNTAS-ABOGADO.md', 'VERIFICACION-CONTRA-CODIGO.md']) assert.ok(read(`docs/legal/${file}`).length > 800, file)
})

test('ES-335: los marcadores (PC/VF/RL) coinciden entre ES y EN en cada documento y con POR-COMPLETAR.md, sin marcadores sin identificador', () => {
  const all = { es: new Set(), en: new Set() }
  for (const [es, en] of PAIRS) {
    const spanish = idsOf(read(`docs/legal/es/${es}`)), english = idsOf(read(`docs/legal/en/${en}`))
    assert.deepEqual(sorted(spanish), sorted(english), `${es} vs ${en}`)
    spanish.forEach(id => all.es.add(id)); english.forEach(id => all.en.add(id))
  }
  const listed = new Set([...read('docs/legal/POR-COMPLETAR.md').matchAll(/^\| ((?:PC|VF|RL)-\d{2}) \|/gm)].map(match => match[1]))
  assert.deepEqual(sorted(all.es), sorted(listed), 'cada marcador de los documentos está en POR-COMPLETAR.md y viceversa')
  assert.deepEqual(sorted(all.en), sorted(listed))
  for (const [es, en] of PAIRS) for (const text of [read(`docs/legal/es/${es}`), read(`docs/legal/en/${en}`)]) {
    assert.doesNotMatch(text.replace(/`[^`]*`/g, ''), /\[(?:POR COMPLETAR|TO BE COMPLETED|VERIFICAR|VERIFY)(?! (?:PC|VF)-\d{2})/, 'marcador sin identificador (se ignora la leyenda entre comillas invertidas)')
    assert.doesNotMatch(text, /\[\[|\]\]/, 'sin marcadores de la app')
  }
  assert.ok(listed.size >= 30, `hay ${listed.size} marcadores listados`)
})

test('ES-335: no se inventaron datos de la empresa (NIT, correos, teléfonos, direcciones)', () => {
  for (const [es, en] of PAIRS) for (const text of [read(`docs/legal/es/${es}`), read(`docs/legal/en/${en}`)]) {
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/, 'sin correos')
    assert.doesNotMatch(text, /\b\d{3}\.?\d{3}\.?\d{3}-\d\b/, 'sin NIT')
    assert.doesNotMatch(text, /\d{7,}|\+\d{1,3}[\s-]?\d/, 'sin números largos ni teléfonos')
    assert.doesNotMatch(text, /https?:\/\//i, 'sin URL inventadas')
  }
})

test('ES-335: los documentos de privacidad y términos citan la versión vigente de la aceptación', () => {
  assert.equal(TERMS_VERSION, '2026-11-v1')
  for (const file of ['es/01-aviso-de-privacidad.md', 'es/02-terminos-de-uso.md', 'en/01-privacy-notice.md', 'en/02-terms-of-use.md']) assert.ok(read(`docs/legal/${file}`).includes(TERMS_VERSION), file)
})

test('ES-335: el permiso «Tu opinión» reutiliza el texto aprobado en ES-173 (no se reescribió)', () => {
  const keys = ['grantTitle', 'grantText', 'grantIfTitle', 'grantIf1', 'grantIf2', 'grantIf3', 'grantIf4', 'grantIf5', 'grantAfterTitle', 'grantAfter1', 'grantAfter2', 'grantAfter3', 'grantNote']
  const documents = { es: read('docs/legal/es/06-permiso-tu-opinion.md'), en: read('docs/legal/en/06-feedback-permission.md') }
  for (const lang of ['es', 'en']) for (const key of keys) assert.ok(documents[lang].includes(copy[lang][key]), `${lang}.${key}`)
})

test('ES-335: las claves del navegador de la política de cookies existen en el código, y no hay cookies propias', () => {
  const walk = (dir, out = []) => { for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) { const path = `${dir}${entry.name}`; if (entry.isDirectory()) walk(`${path}/`, out); else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path) } return out }
  const source = walk('frontend/src/').map(read).join('\n')
  const keys = ['elevation_token', 'elevation_role', 'elevation_name', 'elv_lang', 'elv_theme', 'elevation_chat_enter_sends', 'elevation_checkin_date', 'elevation_pending_chat', 'elevation_space_paused', 'elevation_return_to']
  for (const doc of ['es/04-cookies-y-almacenamiento.md', 'en/04-cookies-and-browser-storage.md']) {
    const text = read(`docs/legal/${doc}`); const documented = new Set([...text.matchAll(/`((?:elevation|elv)_[a-z_]+)`/g)].map(match => match[1]))
    assert.deepEqual(sorted(documented), sorted(new Set(keys)), doc)
  }
  for (const key of keys) assert.ok(source.includes(`'${key}'`) || source.includes(`"${key}"`), `clave ${key} usada en el código`)
  assert.doesNotMatch(source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /document\.cookie/, 'el frontend no usa cookies')
})

test('ES-335: las cifras citadas coinciden con el código (sesión 8 h, restablecer 30 min, enlaces firmados 15 min, 20 mensajes, 5 personas)', () => {
  assert.match(read('backend/utils/sessions.js'), /SESSION_TTL = '8h'/)
  assert.match(read('backend/routes/passwordReset.js'), /PASSWORD_RESET_TTL_MINUTES\) \|\| 30/)
  assert.match(read('backend/utils/storage.js'), /DEFAULT_TTL_SECONDS = 900/)
  assert.match(read('backend/routes/chat.js'), /HISTORY_LIMIT = 20/)
  assert.match(read('frontend/src/bridge/copy.ts'), /hasta 20 de tus mensajes/); assert.match(read('frontend/src/bridge/copy.ts'), /hasta 10 de tus entradas/)
  for (const [file, patterns] of [['es/01-aviso-de-privacidad.md', [/8 horas/, /30 minutos/, /últimos 20/]], ['en/01-privacy-notice.md', [/8 hours/, /30 minutes/, /last 20/]],
    ['es/07-conservacion-y-supresion.md', [/\*\*8 horas\*\*/, /\*\*30 minutos\*\*/, /15 minutos/]], ['en/07-retention-and-deletion.md', [/\*\*8 hours\*\*/, /\*\*30 minutes\*\*/, /15 minutes/]]]) {
    const text = read(`docs/legal/${file}`); for (const pattern of patterns) assert.match(text, pattern, `${file} ${pattern}`)
  }
})

test('ES-335: no se tocó el producto: legalCopy.ts sigue siendo el texto vigente y el aviso publicado no se editó', () => {
  const published = read('frontend/src/legal/legalCopy.ts')
  assert.match(published, /Borrador sin revisión legal/); assert.match(published, /\[\[POR COMPLETAR: razón social\]\]/)
})

test('ES-335 (L-1/L-2): §7 del aviso enumera los mismos flujos hacia el modelo que el texto aprobado de ES-337, y la supresión se describe como manual', () => {
  const es = read('docs/legal/es/01-aviso-de-privacidad.md'), en = read('docs/legal/en/01-privacy-notice.md')
  for (const pattern of [/últimos 20 mensajes/, /Recomendaciones de bienestar/, /últimos 7 registros de ánimo/, /Análisis de habilidades/, /Lectura de tus fuentes/, /Emparejamiento con un profesional/, /etiqueta de tu ánimo/, /promedio de ánimo y promedio de valoraciones/]) assert.match(es, pattern, String(pattern))
  for (const pattern of [/last 20 messages/, /Wellbeing suggestions/, /last 7 mood entries/, /Skills analysis/, /Reading your sources/, /Matching with a professional/, /label of your mood/, /average mood and average rating/]) assert.match(en, pattern, String(pattern))
  assert.match(read('docs/legal/es/07-conservacion-y-supresion.md'), /NO es automática ni inmediata[\s\S]*manualmente el equipo/); assert.match(read('docs/legal/en/07-retention-and-deletion.md'), /NOT automatic or immediate[\s\S]*the team runs manually/)
  assert.doesNotMatch(read('docs/legal/es/07-conservacion-y-supresion.md'), /bloquean de inmediato/); assert.doesNotMatch(read('docs/legal/en/07-retention-and-deletion.md'), /blocked immediately/)
})

test('ES-335: los documentos no prometen una re-aceptación inexistente; «cambios» describe versión, fecha y registro, con la notificación como marcador PC-17', () => {
  for (const file of ['es/01-aviso-de-privacidad.md', 'es/02-terminos-de-uso.md', 'en/01-privacy-notice.md', 'en/02-terms-of-use.md']) {
    const text = read(`docs/legal/${file}`)
    assert.doesNotMatch(text, /pediremos aceptar|ask you to accept/, file); assert.match(text, /PC-17/, file)
  }
  assert.match(read('docs/legal/PREGUNTAS-ABOGADO.md'), /Q21 · Cambios de versión y notificación/)
})
