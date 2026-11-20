// ES-332 (punto 5): «Mi panel» con la API caída. Lógica pura del estado por lectura + estructura del componente (npm test, sin navegador).
// El comportamiento en el navegador (500 y corte de red por cada lectura, «Reintentar» solo de lo fallido, foco, axe) lo prueba scripts/es332-dashboard-errores.cjs, que corre en el CI (job a11y-guard).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CARD_HEADING, CARD_READS, INITIAL_READS, READS, cardStateOf, failedReads, visibleReads } from '../src/pages/dashboardReads.ts'

const source = readFileSync(new URL('../src/pages/UserDashboard.tsx', import.meta.url), 'utf8')
const withReads = (patch) => ({ ...Object.fromEntries(READS.map((read) => [read, 'ok'])), ...patch })

test('ES-332: al inicio ninguna tarjeta tiene datos: todas están cargando (nunca se pinta un «0» como dato)', () => {
  for (const card of Object.keys(CARD_READS)) assert.equal(cardStateOf(INITIAL_READS, false, card), 'loading', card)
  for (const read of READS) assert.equal(INITIAL_READS[read], 'loading', read)
})

test('ES-332: una lectura caída pone en error SOLO su tarjeta; las demás conservan sus datos', () => {
  for (const [read, card] of [['progress', 'progress'], ['plan', 'plan'], ['recommendations', 'recs'], ['upcoming', 'session']]) {
    const state = withReads({ [read]: 'error' })
    for (const other of Object.keys(CARD_READS)) assert.equal(cardStateOf(state, false, other), other === card ? 'error' : 'ok', `${read} → ${other}`)
  }
})

test('ES-332: «Próxima sesión» agrupa dos lecturas; la del profesional solo cuenta si no hay sesión próxima', () => {
  assert.deepEqual(visibleReads('session', false), ['upcoming', 'therapist'])
  assert.deepEqual(visibleReads('session', true), ['upcoming'])
  assert.equal(cardStateOf(withReads({ therapist: 'error' }), false, 'session'), 'error') // sin sesión: se necesita saber si hay profesional
  assert.equal(cardStateOf(withReads({ therapist: 'error' }), true, 'session'), 'ok') // con sesión: no se ve, no se avisa
  assert.equal(cardStateOf(withReads({ upcoming: 'error', therapist: 'loading' }), false, 'session'), 'error') // el error gana a «cargando»
  assert.equal(cardStateOf(withReads({ therapist: 'loading' }), false, 'session'), 'loading')
})

test('ES-332: «Reintentar» repite SOLO las lecturas fallidas de la tarjeta', () => {
  assert.deepEqual(failedReads(withReads({ upcoming: 'error' }), 'session'), ['upcoming'])
  assert.deepEqual(failedReads(withReads({ upcoming: 'error', therapist: 'error' }), 'session'), ['upcoming', 'therapist'])
  assert.deepEqual(failedReads(withReads({ plan: 'error', progress: 'error' }), 'progress'), ['progress']) // no toca las de otras tarjetas
  assert.deepEqual(failedReads(withReads({ plan: 'error' }), 'recs'), [])
  assert.deepEqual(failedReads(withReads({ plan: 'loading' }), 'plan'), []) // lo que aún carga no se repite
  assert.deepEqual(failedReads(withReads({}), 'plan'), [])
})

test('ES-332: «Reintentar» del componente solo vuelve a pedir las lecturas fallidas de su tarjeta', () => {
  assert.ok(source.includes('const failed = failedReads(readState, card)'))
  assert.ok(source.includes('for (const r of failed) void loaders[r](signal)'))
  assert.ok(source.includes("failed.forEach(r => setRead(r, 'loading'))"))
})

test('ES-332: cada tarjeta tiene un título al que se devuelve el foco tras recuperarse', () => {
  for (const card of Object.keys(CARD_READS)) {
    assert.match(CARD_HEADING[card], /^dash-/)
    assert.ok(source.includes(`id="${CARD_HEADING[card]}"`) && source.includes('tabIndex={-1}'), card)
  }
  for (const id of Object.values(CARD_HEADING)) assert.match(source, new RegExp(`<h2 id="${id}"[^>]*tabIndex=\\{-1\\}`), id)
})

test('ES-332: ninguna de las cinco lecturas se traga el fallo (ni respuesta no válida ni corte de red) ni pinta datos sin respuesta', () => {
  for (const [loader, read] of [['loadProgress', 'progress'], ['loadUpcomingSession', 'upcoming'], ['loadTherapist', 'therapist'], ['loadRecommendations', 'recommendations'], ['loadUserPlan', 'plan']]) {
    const start = source.indexOf(`const ${loader} = useCallback`)
    const body = source.slice(start, source.indexOf('}, [setRead])', start))
    assert.ok(start > 0 && body.length > 0, loader)
    assert.ok(body.includes(`if (!res.ok) { setRead('${read}', 'error'); return }`), `${loader}: respuesta no válida → error`)
    assert.ok(body.includes(`setRead('${read}', 'ok')`), `${loader}: con respuesta → ok`)
    assert.ok(body.includes(`catch { if (!signal.aborted) setRead('${read}', 'error') }`), `${loader}: corte de red → error`)
    assert.doesNotMatch(body, /catch \{ \/\* silent \*\/ \}/, loader)
  }
})

test('ES-332: las tarjetas con lectura muestran «Cargando…» o el aviso con «Reintentar» (role=alert) en lugar de datos', () => {
  for (const state of ['progressState', 'sessionState', 'planState', 'recsState']) {
    assert.ok(source.includes(`${state} === 'loading'`) && source.includes(`${state} === 'error'`), state)
  }
  assert.match(source, /<Banner kind="error" title=\{message\}>/) // Banner de Cartografía: role=alert
  assert.match(source, /t\('pr_retry'\)/)
  for (const key of ['dash_err_session', 'dash_err_plan', 'dash_err_recs']) assert.ok(source.includes(`t('${key}')`), key)
  assert.ok(source.includes("cardError('progress', t('pr_error'))"))
})

test('ES-332: el efecto de lecturas declara sus dependencias (sin eslint-disable) y los cargadores son estables', () => {
  assert.doesNotMatch(source, /eslint-disable[^\n]*exhaustive-deps/)
  assert.match(source, /\}, \[navigate, loadProgress, loadUpcomingSession, loadTherapist, loadRecommendations, loadUserPlan\]\)/)
  assert.match(source, /const setRead = useCallback\(/)
})
