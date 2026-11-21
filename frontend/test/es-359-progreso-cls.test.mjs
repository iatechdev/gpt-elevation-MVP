// ES-359 (E393-1): CLS de Inicio. El registro de hoy se lee desde el primer pintado; si se pusiera en un efecto, la tarjeta «Estado emocional» saldría un instante con el formulario (161 px) y «Tu progreso» subiría.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/pages/UserDashboard.tsx', import.meta.url), 'utf8')

test('E393-1: checkedIn parte de la marca del navegador (inicializador perezoso), no de false; la lectura tolera almacenamiento bloqueado (ES-369)', () => {
  assert.match(page, /const \[checkedIn, +setCheckedIn\] += useState\(\(\) => checkinDone\(getToken\(\)\)\)/)
  assert.doesNotMatch(page, /const \[checkedIn, +setCheckedIn\] += useState\(false\)/)
})
