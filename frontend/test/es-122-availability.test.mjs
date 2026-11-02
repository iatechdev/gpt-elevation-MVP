// ES-122: disponibilidad semanal en HORAS en la pantalla; lo guardado sigue en minutos (el plan de carrera consume minutos).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MAX_HOURS_PER_WEEK, minutesToHours, parseHours } from '../src/context/availability.ts'
import { contextEs, contextEn } from '../src/context/contextCopy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-122 horas → minutos: enteros y decimales, coma o punto, vacío = por confirmar', () => {
  assert.deepEqual(parseHours('10'), { valid: true, minutes: 600 })
  assert.deepEqual(parseHours('7,5'), { valid: true, minutes: 450 }); assert.deepEqual(parseHours('7.5'), { valid: true, minutes: 450 })
  assert.deepEqual(parseHours(' 0 '), { valid: true, minutes: 0 }); assert.deepEqual(parseHours('1.67'), { valid: true, minutes: 100 })
  assert.deepEqual(parseHours('0.25'), { valid: true, minutes: 15 }); assert.deepEqual(parseHours(''), { valid: true, minutes: null }); assert.deepEqual(parseHours('   '), { valid: true, minutes: null })
  assert.equal(MAX_HOURS_PER_WEEK, 168); assert.deepEqual(parseHours('168'), { valid: true, minutes: 10080 })
  for (const bad of ['168.01', '169', '200', '-1', 'abc', '7,5h', '1.234', '1e2', '7.', '.5', '1,2,3', '0x10', '１２']) assert.equal(parseHours(bad).valid, false, bad)
  for (const text of ['0', '1', '7.5', '40', '168']) assert.ok(Number.isInteger(parseHours(text).minutes)) // al servidor siempre llegan minutos enteros
})

test('ES-122 minutos → horas: lo ya guardado se muestra convertido, con hasta 2 decimales y sin ceros de sobra', () => {
  assert.equal(minutesToHours(null), ''); assert.equal(minutesToHours(undefined), ''); assert.equal(minutesToHours(0), '0'); assert.equal(minutesToHours(60), '1')
  assert.equal(minutesToHours(450), '7.5'); assert.equal(minutesToHours(100), '1.67'); assert.equal(minutesToHours(2400), '40'); assert.equal(minutesToHours(10080), '168')
  for (const bad of [-1, 10081, 1.5, Number.NaN, '60']) assert.equal(minutesToHours(bad), '')
  // Ida y vuelta: lo que se muestra y se vuelve a escribir sin cambios no altera lo guardado (salvo el redondeo a minuto que ya implicaba el decimal).
  for (const minutes of [0, 15, 30, 45, 60, 90, 450, 600, 2400, 10080]) assert.equal(parseHours(minutesToHours(minutes)).minutes, minutes, String(minutes))
  assert.equal(parseHours(minutesToHours(100)).minutes, 100)
})

test('ES-122 textos: el campo se rotula en horas por semana, de 0 a 168, en ES y EN; ya no habla de minutos', () => {
  assert.equal(contextEs.context_availabilityMinutesPerWeek, 'Disponibilidad (horas por semana)'); assert.equal(contextEn.context_availabilityMinutesPerWeek, 'Availability (hours per week)')
  assert.match(contextEs.context_minutes_help, /0 a 168/); assert.match(contextEn.context_minutes_help, /0 to 168/)
  for (const text of [contextEs.context_availabilityMinutesPerWeek, contextEs.context_minutes_help, contextEn.context_availabilityMinutesPerWeek, contextEn.context_minutes_help]) assert.doesNotMatch(text, /minut|10080|10,080/i)
  assert.deepEqual(Object.keys(contextEs).sort(), Object.keys(contextEn).sort())
})

test('ES-122 formulario: se escribe en horas, se guarda en minutos, el texto se valida antes de guardar y no hay migración ni cambio de servidor', () => {
  const form = read('../src/context/ParticipantContextForm.tsx')
  assert.match(form, /id="availabilityMinutesPerWeek" type="text" inputMode="decimal"/) // texto: admite coma decimal y no se reformatea mientras se escribe
  assert.match(form, /parseHours\(text\)/); assert.match(form, /change\('availabilityMinutesPerWeek', parsed\.minutes\)/) // al borrador llegan minutos
  assert.match(form, /!parseHours\(hoursText\)\.valid/) // un texto inválido bloquea el guardado
  assert.doesNotMatch(form, /valueAsNumber/)
  const model = read('../src/context/participantContext.ts'); assert.match(model, /availabilityMinutesPerWeek: number \| null/) // el modelo guardado no cambia
})
