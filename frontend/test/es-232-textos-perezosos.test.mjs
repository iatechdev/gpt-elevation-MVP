// ES-232: los catálogos de compass, evidencias, mapa de habilidades, contexto y hoja de vida ya NO viajan en el arranque: cada módulo que los usa los registra al evaluarse
// (import con efecto), antes del primer pintado. Estas pruebas cuidan que (1) el arranque no los lleve, (2) el registro devuelva exactamente lo mismo que antes y
// (3) ningún módulo que use esas claves se quede sin registrarlos (clave cruda en pantalla).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lazyText, registerCopy } from '../src/i18n/lazyCopy.ts'
import { compassEs, compassEn } from '../src/compass/copy.ts'
import { evidenceEs, evidenceEn } from '../src/evidence/copy.ts'
import { skillMapEs, skillMapEn } from '../src/skill-map/copy.ts'
import { contextEs, contextEn } from '../src/context/contextCopy.ts'
import { resumeEs, resumeEn } from '../src/context/resume/resumeCopy.ts'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const walk = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [] })
const files = walk(SRC).map(p => ({ path: relative(SRC, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }))

const catalogs = {
  compass: { es: compassEs, en: compassEn, register: 'compass/register', prefix: /['"`]compass\./ },
  evidence: { es: evidenceEs, en: evidenceEn, register: 'evidence/register', prefix: /['"`]evidence\./ },
  'skill-map': { es: skillMapEs, en: skillMapEn, register: 'skill-map/register', prefix: /['"`]skill_map\./ },
  context: { es: contextEs, en: contextEn, register: 'context/register', prefix: /['"`]context_/ },
  resume: { es: resumeEs, en: resumeEn, register: 'context/resume/register', prefix: /['"`]resume_/ },
}

test('ES-232: el diccionario del arranque (es.ts / en.ts) ya no importa ni reparte esos catálogos', () => {
  for (const lang of ['es', 'en']) {
    const text = files.find(f => f.path === `i18n/${lang}.ts`).text
    for (const name of ['compass', 'evidence', 'skillMap', 'context', 'resume']) {
      const id = name + (lang === 'es' ? 'Es' : 'En')
      assert.ok(!text.includes(id), `${lang}.ts todavía menciona ${id}`)
    }
    assert.ok(text.includes("...prefixed('shell.'")) // lo demás (marcos, interfaz, sesión) sigue en el arranque
  }
  const provider = files.find(f => f.path === 'i18n/LanguageProvider.tsx').text
  assert.ok(provider.includes('translations[lang][key] ?? lazyText(lang, key) ?? catalog?.[key] ?? key')) // orden: arranque → registro perezoso → catálogo descargado → clave
})

test('ES-232: registrar un catálogo devuelve exactamente los mismos textos que antes, en ES y EN, e idempotente', () => {
  for (const [name, c] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(c.es).sort(), Object.keys(c.en).sort(), `${name}: mismas claves ES y EN`)
    registerCopy(c.es, c.en); registerCopy(c.es, c.en)
    for (const key of Object.keys(c.es)) { assert.equal(lazyText('es', key), c.es[key], `${name} es ${key}`); assert.equal(lazyText('en', key), c.en[key], `${name} en ${key}`) }
  }
  assert.equal(lazyText('es', 'clave.que.no.existe'), undefined) // lo desconocido cae al catálogo descargado o a la clave, como antes
})

test('ES-232: cada módulo que escribe claves de un catálogo perezoso importa su registro (si no, se vería la clave cruda)', () => {
  // Falsos positivos conocidos: aparecen como identificadores de datos, no como claves de texto.
  // resumeApi.ts: códigos de error («resume_limit») y propósitos de consentimiento («resume_ai_reading»), no claves de texto.
  // territories.ts y aiProposalApi.ts: lógica pura del mapa que las pruebas cargan por separado (data:); solo las usa SkillMapPage y sus paneles, que sí registran el catálogo.
  const notKeys = new Set(['bridge/sources.ts', 'compass/model.ts', 'bridge/copy.ts', 'evidence/model.ts', 'context/resume/resumeApi.ts', 'skill-map/territories.ts', 'skill-map/aiProposalApi.ts'])
  const owners = new Set(Object.values(catalogs).flatMap(c => [c.register + '.ts']))
  const problems = []
  for (const [name, c] of Object.entries(catalogs)) {
    for (const f of files) {
      if (owners.has(f.path) || /(^|\/)(copy|contextCopy|resumeCopy)\.ts$/.test(f.path) || f.path.startsWith('i18n/') || notKeys.has(f.path)) continue
      if (!c.prefix.test(f.text)) continue
      if (!new RegExp(`^import '[./]+/?(?:[\\w-]+/)*${c.register.split('/').pop()}(?:\\.ts)?'`, 'm').test(f.text)) problems.push(`${f.path} usa claves de «${name}» sin importar ${c.register}`)
    }
  }
  assert.deepEqual(problems, [])
})

test('ES-232: el enlace «Saltar al contenido» del arranque no arrastra los textos del chat y del diario', () => {
  const session = files.find(f => f.path === 'space/SpaceSession.tsx').text
  assert.match(session, /from '\.\/SpaceSkip'/); assert.doesNotMatch(session, /SpaceNav|\.\/copy/)
  const skip = files.find(f => f.path === 'space/SpaceSkip.tsx').text
  assert.doesNotMatch(skip, /from '\.\/copy'/); assert.match(skip, /import '\.\/space\.css'/) // mismos estilos que antes
})
