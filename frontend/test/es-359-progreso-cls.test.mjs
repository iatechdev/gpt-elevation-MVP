// ES-359 (E393-1): CLS de Inicio. El registro de hoy se lee desde el primer pintado; si se pusiera en un efecto, la tarjeta «Estado emocional» saldría un instante con el formulario (161 px) y «Tu progreso» subiría.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/pages/UserDashboard.tsx', import.meta.url), 'utf8')

test('E393-1: checkedIn parte de localStorage (inicializador perezoso con try/catch), no de false', () => {
  assert.match(page, /const \[checkedIn, +setCheckedIn\] += useState\(\(\) => \{ try \{ return localStorage\.getItem\('elevation_checkin_date'\) === new Date\(\)\.toDateString\(\) \} catch \{ return false \} \}\)/)
  assert.doesNotMatch(page, /const \[checkedIn, +setCheckedIn\] += useState\(false\)/)
})
