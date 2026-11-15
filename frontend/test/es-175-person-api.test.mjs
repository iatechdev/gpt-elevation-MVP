// ES-175 (HU-P24) · «Mis revisiones» conectada: forma de la respuesta del servidor, mapeo de errores, requestId estable en el reintento y la franja VERDADERA (nunca «datos ficticios» con datos reales).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { copy } from '../src/facilitation/copy.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
let code = ts.transpileModule(read('../src/facilitation/personApi.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
code = code.replaceAll("'../routeCatalog/schema'", JSON.stringify(new URL('../src/routeCatalog/schema.ts', import.meta.url).href))
const { parseReviews, failureOf, ReviewsError } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const good = { id: 7, author: { displayName: 'Revisora' }, createdAt: '2026-11-12T20:00:00.000Z', locale: 'es', materialVersion: 1, materialChanged: false, evidence: [{ title: 'Mi evidencia', version: 1 }, { title: null, version: 2 }],
  observation: '<b>x</b>', limits: 'l', supersedesId: null, status: 'pending', objection: { reason: 'r', locale: 'es', createdAt: '2026-11-12T21:00:00.000Z' }, response: null }

test('ES-175 conexión: parseReviews acepta la forma del servidor y conserva el texto LITERAL (sin interpretar HTML)', () => {
  const [row] = parseReviews({ reviews: [good] })
  assert.equal(row.observation, '<b>x</b>'); assert.equal(row.author, 'Revisora'); assert.equal(row.evidence[1].title, null); assert.equal(row.status, 'pending'); assert.equal(row.response, null)
  assert.deepEqual(parseReviews({ reviews: [] }), [])
  assert.equal(parseReviews({ reviews: [{ ...good, author: { displayName: null } }] })[0].author, null)
})

test('ES-175 conexión: una respuesta con forma inesperada se rechaza ENTERA (nunca se muestra a medias)', () => {
  for (const bad of [null, {}, { reviews: 'no' }, { reviews: [null] }, { reviews: [{ ...good, id: 0 }] }, { reviews: [{ ...good, locale: 'fr' }] }, { reviews: [{ ...good, status: 'x' }] }, { reviews: [{ ...good, observation: 7 }] },
    { reviews: [{ ...good, materialChanged: 'no' }] }, { reviews: [{ ...good, createdAt: 'no-es-fecha' }] }, { reviews: [{ ...good, objection: { reason: 1, locale: 'es', createdAt: good.createdAt } }] }, { reviews: [good, { ...good, id: -3 }] }]) assert.throws(() => parseReviews(bad), String(JSON.stringify(bad)).slice(0, 60))
})

test('ES-175 conexión: failureOf mapea cada respuesta del servidor; red caída y 5xx = «uncertain» (se reintenta con el MISMO requestId)', () => {
  const e = (status, code) => new ReviewsError(status, { code })
  assert.deepEqual(failureOf(e(401, 'x')), { kind: 'session' }); assert.deepEqual(failureOf(e(403, 'consent_revoked')), { kind: 'consent' }); assert.deepEqual(failureOf(e(403, 'otro')), { kind: 'session' })
  assert.deepEqual(failureOf(e(404, 'not_found')), { kind: 'gone' }); assert.deepEqual(failureOf(e(409, 'already_objected')), { kind: 'already' }); assert.deepEqual(failureOf(e(409, 'request_conflict')), { kind: 'conflict' })
  assert.deepEqual(failureOf(e(400, 'required')), { kind: 'invalid', field: 'required' }); assert.deepEqual(failureOf(e(400, 'too_long')), { kind: 'invalid', field: 'tooLong' }); assert.deepEqual(failureOf(e(400, 'control_chars')), { kind: 'invalid', field: 'controlChars' })
  assert.deepEqual(failureOf(e(400, 'invalid_input')), { kind: 'conflict' })
  for (const uncertain of [new TypeError('Failed to fetch'), e(500, 'x'), e(502, ''), e(503, ''), new Error('x'), e(418, 'x')]) assert.equal(failureOf(uncertain).kind, 'uncertain')
})

test('ES-175 conexión: el reintento reutiliza el requestId del MISMO texto y uno nuevo si el texto cambia; sin caché ni almacenamiento del navegador', () => {
  const screen = read('../src/facilitation/PersonReviews.tsx'); const api = read('../src/facilitation/personApi.ts')
  assert.match(screen, /pending\.current\?\.reason === text \? pending\.current : \{ requestId: crypto\.randomUUID\(\), reason: text \}/)
  assert.match(api, /cache: 'no-store'/); assert.doesNotMatch(screen + api, /localStorage\.setItem|sessionStorage|indexedDB|caches\./)
  assert.match(screen, /result\.kind === 'invalid'/); assert.match(screen, /setFailure\(result\)/) // un error nunca borra el texto escrito
  assert.doesNotMatch(screen, /setText\(''\)[^\n]*catch|catch[^\n]*setText\(''\)/)
})

test('ES-175 conexión (decisión 10): la franja es VERDADERA mientras no se firme, desaparece al firmar y NUNCA dice «datos ficticios/sintéticos» con datos reales', () => {
  const config = read('../src/facilitation/personConfig.ts'); const screen = read('../src/facilitation/PersonReviews.tsx')
  assert.match(config, /export const PERSON_REVIEWS_SIGNED = false/)
  assert.match(screen, /\{!PERSON_REVIEWS_SIGNED && <Banner title=\{t\('validationBanner'\)\} \/>\}/)
  for (const lang of ['es', 'en']) {
    const banner = copy[lang]['facilitation.validationBanner']; assert.ok(banner && banner.length > 10)
    assert.doesNotMatch(banner, /sint[eé]tic|ficticio|synthetic|fictitious|dummy|demo|simulaci|simulat/i, lang)
  }
  // la pantalla conectada no usa los textos de la vista previa sintética ni el fixture
  assert.doesNotMatch(screen, /t\('preview'\)|t\('participantDemo'\)|t\('synthetic'\)|fixture|createFixture|synthetic-A/)
})

test('ES-175 conexión: la ruta /app/professional-reviews usa la pantalla conectada; la vista del profesional sigue en el fixture y su flag', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /path="\/app\/professional-reviews" element=\{<PersonReviews \/>\}/)
  assert.doesNotMatch(app.split('<Route element={<FacilitationPreview />}>')[1].split('</Route>')[0], /professional-reviews/)
  assert.match(read('../src/facilitation/FacilitationPreview.tsx'), /VITE_ENABLE_FACILITATION_PREVIEW/)
})

test('ES-175 conexión: textos ES/EN completos para cada estado nuevo', () => {
  for (const key of ['validationBanner', 'reviewsEmpty', 'reviewerFallback', 'evidenceUnavailable', 'sessionExpired', 'login', 'objectionUncertain', 'checkAgain', 'consentRevoked', 'reviewGone', 'alreadyObjected', 'requestConflict', 'objectionSaved', 'reloadError', 'reloadList'])
    for (const lang of ['es', 'en']) assert.ok(copy[lang][`facilitation.${key}`]?.length > 2, `${lang}.${key}`)
})

test('ES-175 conexión (E268-1): la tarjeta muestra SOLO datos del servidor o textos fijos de la pantalla; ningún texto de la vista previa sintética (título de ejemplo, «Facilitador sintético», muestra, etc.)', () => {
  const screen = read('../src/facilitation/PersonReviews.tsx')
  const used = [...screen.matchAll(/\bt\('([A-Za-z]+)'\)/g)].map((m) => m[1])
  for (const key of ['sampleTitle', 'sample', 'evidenceTitle', 'evidence', 'source', 'reviewer', 'participantDemo', 'synthetic', 'preview', 'pendingAuth', 'person'.replace('person', 'privacy')]) assert.ok(!used.includes(key), 'texto del fixture en la pantalla: ' + key)
  assert.match(screen, /t\('reviewHeading'\)\} · \{t\('materialVersionLabel'\)\} \{review\.materialVersion\}/)
  // y el texto del fixture no puede colarse por una clave nueva: ningún valor de las claves que usa la pantalla lleva el título de ejemplo
  for (const lang of ['es', 'en']) for (const key of new Set(used)) assert.ok(!/Explicar una tarea|Explain a task|sint[eé]tic|synthetic/i.test(copy[lang]['facilitation.' + key] ?? ''), lang + '.' + key)
})

test('ES-175 conexión (E268-5): el texto de revisores y objeciones no se interpreta como HTML; el 403 y los errores conservan el texto; hay aviso al recargar y guarda del botón «Atrás»', () => {
  const screen = read('../src/facilitation/PersonReviews.tsx')
  assert.doesNotMatch(screen, /dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write/)
  const confirm = screen.slice(screen.indexOf('async function confirm()'), screen.indexOf('function submit('))
  assert.equal((confirm.match(/reset\(\)/g) ?? []).length, 3, 'reset() solo en éxito, already y gone')
  const consent = confirm.slice(confirm.indexOf("result.kind === 'conflict'"))
  assert.doesNotMatch(consent, /reset\(\)|setText\(''\)/, 'conflicto, consentimiento e incierto NO borran el texto')
  assert.match(screen, /addEventListener\('beforeunload', unload\)/); assert.match(screen, /addEventListener\('popstate', pop\)/); assert.match(screen, /window\.history\.go\(-2\)/)
})

test('ES-175 conexión (cobertura): el autor de la revisión y de la respuesta salen del servidor, con «Persona revisora» solo si es null; nunca un literal', () => {
  const screen = read('../src/facilitation/PersonReviews.tsx')
  assert.ok(screen.includes("{review.author ?? t('reviewerFallback')}"), 'autor de la revisión')
  assert.ok(screen.includes("{review.response.author ?? t('reviewerFallback')}"), 'autor de la respuesta')
  assert.doesNotMatch(screen, /Revisor fijo|Facilitador|Reviewer[^F]/)
})
