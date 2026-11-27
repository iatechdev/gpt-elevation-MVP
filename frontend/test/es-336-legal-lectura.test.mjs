// ES-336 (F1): las páginas legales leen el texto PUBLICADO de la API y conservan siempre el texto empaquetado como respaldo (nunca una página vacía); la semilla del backend coincide con legalCopy.ts.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LEGAL } from '../src/legal/legalCopy.ts'
import { parseRemote, mergeLegal, remoteFromResponse } from '../src/legal/useLegalContent.ts'
import { buildSeed } from '../scripts/export-legal-seed.mjs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const valid = { title: 'Aviso nuevo', banner: 'Borrador · v9', updated: 'Última actualización: hoy', sections: [{ heading: 'Uno', paragraphs: ['Texto **claro**.'] }, { bullets: ['a', 'b'] }, { numbered: ['1', '2'] }] }

test('ES-336: la semilla del backend es exactamente lo que sirve hoy legalCopy.ts (si cambia legalCopy.ts, regenerar con scripts/export-legal-seed.mjs)', () => {
  const saved = JSON.parse(read('../../backend/seeds/legalSeed.json'))
  assert.deepEqual(saved, buildSeed())
  assert.equal(saved.documents.length, 4)
  assert.equal(saved.version, read('../src/legal/version.ts').match(/TERMS_VERSION = '([^']+)'/)[1])
})

test('ES-336: parseRemote acepta solo la forma exacta (texto estructurado) y rechaza todo lo demás', () => {
  assert.deepEqual(parseRemote(valid), valid)
  for (const bad of [null, undefined, 'x', 5, [], {}, { title: 'T' }, { title: 'T', sections: [] }, { title: '', sections: [{ paragraphs: ['a'] }] }, { title: 'T', sections: [{}] }, { title: 'T', sections: [{ paragraphs: [] }] },
    { title: 'T', sections: [{ paragraphs: [1] }] }, { title: 'T', sections: [{ paragraphs: 'a' }] }, { title: 'T', sections: ['a'] }, { title: 'T', banner: 5, sections: [{ paragraphs: ['a'] }] }, { title: 'T', updated: ' ', sections: [{ paragraphs: ['a'] }] }]) {
    assert.equal(parseRemote(bad), null, JSON.stringify(bad))
  }
})

test('ES-336: parseRemote descarta claves extra (no se cuela nada) y mergeLegal solo sustituye el texto del documento: enlaces y «Volver…» siguen siendo los del repo', () => {
  const parsed = parseRemote({ ...valid, html: '<script>x</script>', sections: [{ heading: 'H', paragraphs: ['p'], onclick: 'x' }] })
  assert.deepEqual(parsed.sections, [{ heading: 'H', paragraphs: ['p'] }]); assert.equal('html' in parsed, false)
  const repo = LEGAL.es.privacy
  const merged = mergeLegal(repo, parseRemote(valid))
  assert.equal(merged.title, 'Aviso nuevo'); assert.equal(merged.draft, 'Borrador · v9'); assert.equal(merged.updated, 'Última actualización: hoy'); assert.deepEqual(merged.sections, valid.sections)
  for (const key of ['also', 'alsoLink', 'backToRegister', 'newTab']) assert.equal(merged[key], repo[key], key)
  assert.equal(mergeLegal(repo, null), repo, 'sin contenido remoto: exactamente el texto del repo')
  assert.equal(mergeLegal(repo, parseRemote({ title: 'T', sections: [{ paragraphs: ['p'] }] })).draft, repo.draft, 'sin banner remoto: el del repo')
})

test('ES-336: remoteFromResponse exige origen «db» y el MISMO documento e idioma; si no, se conserva el texto del repo', () => {
  const ok = { source: 'db', docKey: 'terms', lang: 'en', content: valid }
  assert.deepEqual(remoteFromResponse(ok, 'terms', 'en'), valid)
  for (const [body, doc, lang] of [[ok, 'privacy', 'en'], [ok, 'terms', 'es'], [{ ...ok, source: 'repo' }, 'terms', 'en'], [{ ...ok, content: {} }, 'terms', 'en'], [{ error: 'x' }, 'terms', 'en'], [null, 'terms', 'en'], ['x', 'terms', 'en']]) {
    assert.equal(remoteFromResponse(body, doc, lang), null)
  }
})

test('ES-336: la página usa el hook (respaldo siempre), sin HTML en bruto, y los marcadores y noindex salen del contenido que se pinta', () => {
  const page = read('../src/legal/LegalPage.tsx'); const hook = read('../src/legal/useLegalContent.ts'); const markup = read('../src/legal/markup.tsx')
  assert.match(page, /const \{ content \} = useLegalContent\(doc, lang\)/)
  assert.match(page, /const markers = contentHasMarkers\(content\) \|\| hasMarkers\(doc, lang === 'es' \? 'en' : 'es'\)/)
  assert.match(hook, /const repo = LEGAL\[lang\]\[doc\]/)
  assert.match(hook, /return \{ content: mergeLegal\(repo, fromDb\), source: fromDb \? 'db' : 'repo' \}/)
  assert.match(hook, /credentials: 'omit'/) // lectura pública: no manda cookies ni sesión
  for (const file of [page, hook, markup]) assert.doesNotMatch(file, /dangerouslySetInnerHTML|innerHTML/)
  assert.match(markup, /export const contentHasMarkers = \(content: LegalContent\)/)
})

test('ES-336: ante error, 404, tiempo agotado o respuesta inválida el hook deja el texto del repo (nunca vacío)', () => {
  const hook = read('../src/legal/useLegalContent.ts')
  assert.ok(hook.includes('if (!res.ok) { void res.text().catch(() => {}); return }'), '404 not_published y 5xx: se queda el texto del repo (y el cuerpo se lee, ES-412)')
  assert.match(hook, /catch \{ \/\* sin respuesta o inválida: se queda el texto del repo \*\/ \}/)
  assert.match(hook, /window\.setTimeout\(\(\) => controller\.abort\(\), TIMEOUT_MS\)/)
  for (const lang of ['es', 'en']) for (const doc of ['privacy', 'terms']) { const c = LEGAL[lang][doc]; assert.ok(c.title && c.sections.length > 0, `${doc}/${lang} empaquetado y no vacío`) }
})
