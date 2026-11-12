// ES-200 (PERF-06): ayudas del inventario de peticiones, y que el panel de la persona lance sus lecturas a la vez y las cancele al salir.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requestKey, summarize } from '../scripts/perf-requests.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dashboard = readFileSync(resolve(here, '../src/pages/UserDashboard.tsx'), 'utf8')

test('ES-200: la clave de una petición ordena la query; el resumen cuenta duplicados y oleadas (cascadas)', () => {
  assert.equal(requestKey('GET', 'http://x/api/diary?limit=100&a=1'), 'GET /api/diary?a=1&limit=100')
  const rows = [
    { key: 'GET /api/session', start: 0, end: 100, bytes: 10 },
    { key: 'GET /api/a', start: 150, end: 250, bytes: 5 }, { key: 'GET /api/b', start: 152, end: 252, bytes: 5 },
    { key: 'GET /api/a', start: 160, end: 260, bytes: 5 }, // duplicada
    { key: 'GET /api/c', start: 300, end: 400, bytes: 1 }, // cascada: empieza cuando terminó la oleada anterior
  ]
  const summary = summarize(rows)
  assert.equal(summary.total, 5); assert.equal(summary.unique, 4)
  assert.deepEqual(summary.duplicates, [{ key: 'GET /api/a', count: 2 }])
  assert.deepEqual(summary.waves, [1, 3, 1]); assert.equal(summary.cascadeDepth, 3)
  assert.equal(summary.dataStart, 150); assert.equal(summary.dataEnd, 400); assert.equal(summary.bytes, 26)
})

test('ES-200: el panel de la persona lanza las cinco lecturas a la vez, con una señal de cancelación, y las cancela al desmontar', () => {
  for (const loader of ['loadProgress', 'loadUpcomingSession', 'loadTherapist', 'loadRecommendations', 'loadUserPlan']) {
    assert.ok(dashboard.includes(`void ${loader}(signal)`), loader)
    assert.ok(dashboard.includes(`const ${loader} = async (signal: AbortSignal)`), loader)
  }
  assert.match(dashboard, /const controller = new AbortController\(\)/)
  assert.match(dashboard, /return \(\) => controller\.abort\(\)/)
  assert.equal((dashboard.match(/\{ signal \}\)/g) ?? []).length, 5) // cada lectura pasa la señal a fetch
})

test('ES-200: la lectura del profesional ya no está encadenada a la de la próxima sesión (sin cascada), y tras emparejar se refrescan las dos', () => {
  const upcoming = dashboard.slice(dashboard.indexOf('const loadUpcomingSession'), dashboard.indexOf('const loadTherapist'))
  assert.doesNotMatch(upcoming, /my-therapist/)
  assert.match(dashboard, /void loadUpcomingSession\(signal\) \/\/ antes la segunda lectura[^\n]*\n\s*void loadTherapist\(signal\)/)
})

test('ES-200: ninguna lectura actualiza estado si la señal se canceló', () => {
  for (const setter of ['setMoodLogs', 'setUpcomingSession', 'setTherapistId', 'setRecommendations', 'setUserPlan']) {
    const idx = dashboard.indexOf(`${setter}(`)
    assert.ok(idx > 0, setter)
    assert.match(dashboard.slice(Math.max(0, idx - 200), idx), /signal\.aborted/, `${setter} va tras comprobar signal.aborted`)
  }
})
