// ES-329 (hallazgos de staging, 20-nov-2026): «Mi panel» contaba mal «sesiones esta semana» y desplazaba la tendencia; el nombre del menú de usuario salía enorme.
// Las fechas de los registros son AAAA-MM-DD (UTC, columna DATEONLY): la semana y la tendencia se calculan con ese mismo día, sin horas locales.
process.env.TZ = 'America/Bogota' // la zona de las personas del piloto (UTC−5): con ella fallaba la lógica anterior; la lógica nueva no depende de la zona
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { entriesThisWeek, lastSevenDays, todayKey, weekStartKey } from '../src/pages/dashboardWeek.ts'

const dashboard = readFileSync(new URL('../src/pages/UserDashboard.tsx', import.meta.url), 'utf8')
const shellCss = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
const logs = (...dates) => dates.map((date) => ({ date }))

test('el lunes de la semana: de lunes a domingo, y el domingo pertenece a la semana que empezó seis días antes', () => {
  for (const [today, monday] of [['2026-11-16', '2026-11-16'], ['2026-11-18', '2026-11-16'], ['2026-11-20', '2026-11-16'], ['2026-11-21', '2026-11-16'], ['2026-11-22', '2026-11-16'], ['2026-11-23', '2026-11-23']]) {
    assert.equal(weekStartKey(today), monday, today)
  }
  assert.equal(weekStartKey('2026-03-01'), '2026-02-23') // domingo que cruza de mes
  assert.equal(weekStartKey('2027-01-01'), '2026-12-28') // cruza de año
})

test('el caso visto en staging: viernes 20-nov con registros del lunes, miércoles y jueves cuenta 3 (antes 2: el lunes se descartaba en UTC−5)', () => {
  assert.equal(entriesThisWeek(logs('2026-11-16', '2026-11-18', '2026-11-19'), '2026-11-20'), 3)
  assert.equal(entriesThisWeek(logs('2026-11-15', '2026-11-16'), '2026-11-20'), 1) // el domingo anterior ya es otra semana
})

test('el domingo la semana no cuenta 0 (antes empezaba «mañana»): cuenta de lunes a domingo', () => {
  assert.equal(entriesThisWeek(logs('2026-11-16', '2026-11-17', '2026-11-22'), '2026-11-22'), 3)
  assert.equal(entriesThisWeek(logs('2026-11-15'), '2026-11-22'), 0)
  assert.equal(entriesThisWeek([], '2026-11-22'), 0)
})

test('el día de hoy sale del mismo criterio que el de los registros (UTC): pasadas las 19:00 en Colombia ya es el día siguiente, igual que para el servidor', () => {
  assert.equal(todayKey(new Date('2026-11-21T02:00:00Z')), '2026-11-21')
  assert.equal(todayKey(new Date('2026-11-20T23:59:59Z')), '2026-11-20')
})

test('la tendencia son los 7 últimos días terminando hoy, con el día de la semana de ESE día (no el local)', () => {
  const days = lastSevenDays('2026-11-20')
  assert.deepEqual(days.map((d) => d.dateStr), ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'])
  assert.deepEqual(days.map((d) => d.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  assert.deepEqual(lastSevenDays('2026-03-02').map((d) => d.dateStr), ['2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  assert.equal(lastSevenDays('2026-11-20').length, 7)
})

test('el componente usa esas funciones y ya no mezcla horas locales con el día UTC', () => {
  assert.ok(dashboard.includes('entriesThisWeek(data.moodLogs ?? [], todayKey(new Date()))'))
  assert.ok(dashboard.includes('lastSevenDays(todayKey(new Date()))'))
  assert.ok(dashboard.includes("timeZone: 'UTC'"))
  assert.doesNotMatch(dashboard, /new Date\(m\.date\)/)
  assert.doesNotMatch(dashboard, /monday\.setDate|setHours\(0, 0, 0, 0\)/)
})

test('el nombre del menú de usuario mide 1,1 rem: la regla es más específica que .cg-name (cartografia.css), que es del tamaño de un título', () => {
  assert.match(shellCss, /^\.cg-usermenu \.cg-usermenu__who \{ font-size: 1\.1rem; \}/m)
  assert.doesNotMatch(shellCss, /^\.cg-usermenu__who \{ font-size/m)
})
