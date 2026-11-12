// ES-172 (HU-P21): lógica pura de la vista de la persona del catálogo de rutas (filtros, fechas, estados con palabra + símbolo, nombres de habilidad con D1=B).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

let code = ts.transpileModule(readFileSync(new URL('../src/routeCatalog/person.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
code = code.replaceAll("'./schema'", JSON.stringify(new URL('../src/routeCatalog/schema.ts', import.meta.url).href))
const { filterRoles, dateText, offerStatus, exposureStatus, roleNotice, sourceNotice, skillLabels } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const roles = [
  { roleKey: 'a', market: 'CO', contexts: ['c1'], languagesRequired: ['es'] },
  { roleKey: 'b', market: 'US', contexts: ['c1', 'c2'], languagesRequired: ['en', 'es'] },
  { roleKey: 'c', market: 'CO', contexts: [], languagesRequired: ['en'] },
]

test('ES-172 filtros: vacíos no restringen; combinan mercado, contexto e idioma del ROL', () => {
  const keys = filters => filterRoles(roles, { market: '', context: '', language: '', ...filters }).map(r => r.roleKey)
  assert.deepEqual(keys({}), ['a', 'b', 'c'])
  assert.deepEqual(keys({ market: 'CO' }), ['a', 'c'])
  assert.deepEqual(keys({ context: 'c2' }), ['b'])
  assert.deepEqual(keys({ language: 'es' }), ['a', 'b'])
  assert.deepEqual(keys({ market: 'CO', language: 'en' }), ['c'])
  assert.deepEqual(keys({ market: 'ZZ' }), [])
})

test('ES-172 fechas: legibles ES/EN, sin correr el día por huso; lo inválido es null («Por confirmar»)', () => {
  assert.match(dateText('2026-10-27', 'es'), /27 de octubre de 2026/)
  assert.match(dateText('2026-10-27', 'en'), /October 27, 2026/)
  assert.match(dateText('2026-11-01T03:00:00Z', 'es'), /1 de noviembre de 2026/)
  for (const bad of ['', '   ', 'no es fecha', '2026-02-30', '2026-13-01', null, undefined, 42]) assert.equal(dateText(bad, 'es'), null, String(bad))
})

test('ES-172 estados: cada uno lleva símbolo y palabra, nunca solo color', () => {
  assert.deepEqual(offerStatus('current'), { tone: 'ok', symbol: '✓', key: 'checked' })
  assert.deepEqual(offerStatus('expired'), { tone: 'bad', symbol: '⚠', key: 'expired' })
  assert.deepEqual(offerStatus('lo-que-sea'), { tone: 'wait', symbol: '?', key: 'unverified' })
  assert.equal(exposureStatus('sourced').key, 'sourced'); assert.equal(exposureStatus('hypothesis').key, 'hypothesis'); assert.equal(exposureStatus(undefined).key, 'unknown')
  assert.equal(roleNotice({ verificationTask: true }).key, 'verificationTask'); assert.equal(roleNotice({}).key, 'sources_current')
  assert.equal(sourceNotice({ stale: true }).key, 'stale'); assert.equal(sourceNotice({}), null)
  for (const view of [offerStatus('current'), offerStatus('expired'), offerStatus(null), exposureStatus('sourced'), exposureStatus('x'), roleNotice({}), sourceNotice({ stale: true })]) assert.ok(view.symbol && view.key)
})

test('ES-172 D1=B: de GET /api/skill-map solo se leen skillKey y labels[idioma]; nada más del mapa pasa; forma inesperada → vacío', () => {
  const body = { skills: [{ skillKey: 'sk1', labels: { es: 'Comunicación', en: 'Communication' }, level: 4, evidence: ['secreto'], rubric: 'x' }, { skillKey: 'sk2', labels: { es: '  ' } }, { labels: { es: 'sin clave' } }] }
  const es = skillLabels(body, 'es')
  assert.deepEqual([...es], [['sk1', 'Comunicación']])
  assert.deepEqual([...skillLabels(body, 'en')], [['sk1', 'Communication']])
  assert.ok(!JSON.stringify([...es]).includes('secreto'))
  for (const bad of [null, undefined, 'x', 7, [], {}, { skills: 'no' }, { skills: [null, 3] }]) assert.equal(skillLabels(bad, 'es').size, 0)
})

test('ES-172 D1=B: la pantalla no guarda nada del mapa (sin storage ni caché) y su fallo es silencioso', () => {
  const screen = readFileSync(new URL('../src/routeCatalog/PersonCatalog.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(screen, /localStorage\.setItem|sessionStorage|indexedDB|caches\./)
  assert.match(screen, /\.catch\(\(\) => undefined\)/)
  assert.match(screen, /AbortController/)
  assert.match(screen, /skillLabels\(body, lang\)/)
})
