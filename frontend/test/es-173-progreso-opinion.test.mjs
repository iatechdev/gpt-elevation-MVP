// ES-173 (HU-P22): «Tu progreso» y «Tu opinión» con Cartografía. Lógica pura (nivel, «N de 5», tendencia) y estructura (sin estilos en línea, sin emojis, textos ES/EN por clave,
// la clave interna 'anxiety' no cambia pero su etiqueta es «Estrés y carga»). El comportamiento en navegador lo mide scripts/es173-pantalla-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fill, formatDay, level, trendOf, TREND_SYMBOL } from '../src/progress/format.ts'
import { progressEs, progressEn } from '../src/pages/progressCopy.ts'
import { copy } from '../src/pilot/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const files = { page: '../src/pages/UserProgress.tsx', panel: '../src/progress/ProgressPanel.tsx', matching: '../src/progress/ProgressMatching.tsx', feedback: '../src/pilot/FeedbackPage.tsx' }
const source = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, read(path)]))
const pictographic = /\p{Extended_Pictographic}|★|☆/u

test('ES-173: level lleva cualquier valor a 1–5 y redondea', () => {
  assert.deepEqual([0, 0.4, 1.4, 1.5, 3.6, 4.5, 5, 9, -3].map(level), [1, 1, 1, 2, 4, 5, 5, 5, 1])
})

test('ES-173: la tendencia compara niveles redondeados de UNA sesión (sube, igual, baja)', () => {
  assert.equal(trendOf(2, 4), 'up'); assert.equal(trendOf(3, 3), 'same'); assert.equal(trendOf(4, 2), 'down')
  assert.equal(trendOf(2.4, 1.6), 'same') // 2 y 2
  assert.deepEqual(TREND_SYMBOL, { up: '↑', same: '=', down: '↓' })
})

test('ES-173: fill sustituye claves, repite y conserva «$» en el valor', () => {
  assert.equal(fill('{n} de 5', { n: 3.6 }), '3.6 de 5')
  assert.equal(fill('{a}-{a}', { a: 'x' }), 'x-x')
  assert.equal(fill('{n} de 5', { n: "$&$'" }), "$&$' de 5")
  assert.equal(fill('sin claves', { n: 1 }), 'sin claves')
})

test('ES-173: ninguna pantalla nueva usa estilos en línea ni emojis', () => {
  for (const [name, text] of Object.entries(source)) {
    assert.doesNotMatch(text, /style=\{\{/, name + ': sin estilos en línea')
    assert.doesNotMatch(text.replace(/[↑↓←→✓○]/g, ''), pictographic, name + ': sin emojis ni estrellas')
    assert.doesNotMatch(text, /lang === 'es' \? '(?!es-CO)/, name + ': sin ternarios por idioma (el locale de fechas no es texto)')
  }
})

test('ES-173: «Ansiedad» pasó a «Estrés y carga» / «Stress and workload» y la clave interna sigue siendo anxiety', () => {
  assert.match(source.matching, /\['anxiety', 'pr_a_anxiety'\]/)
  assert.equal(progressEs.pr_a_anxiety, 'Estrés y carga'); assert.equal(progressEn.pr_a_anxiety, 'Stress and workload')
  for (const text of [...Object.values(progressEs), ...Object.values(progressEn)]) assert.doesNotMatch(text, /Ansiedad|Anxiety/)
})

test('ES-173 textos: mismas claves ES/EN, sin emojis y cada clave usada en las pantallas existe', () => {
  assert.deepEqual(Object.keys(progressEs).sort(), Object.keys(progressEn).sort())
  for (const value of [...Object.values(progressEs), ...Object.values(progressEn)]) assert.doesNotMatch(value, pictographic)
  const used = new Set([...(source.page + source.panel + source.matching).matchAll(/\bt\('([a-z0-9_]+)'\)/g)].map(match => match[1]))
  for (const key of used) assert.ok(progressEs[key] && progressEn[key], 'falta ' + key)
  for (const key of ['pr_mood_1', 'pr_a_anxiety', 'pr_rec_cat_other']) assert.ok(progressEs[key])
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
})

test('ES-173: «Opinión» sigue siendo una simulación (franja y fixtures) hasta que se firme el contrato real', () => {
  assert.match(source.feedback, /<Banner title=\{c\.preview\}>/); assert.match(source.feedback, /createFixtureRepository/)
  assert.doesNotMatch(source.feedback, /fetch\(|\/api\//) // no envía nada a un servidor
  assert.equal(copy.es.preview, 'Vista de revisión · datos ficticios')
})

test('ES-173: el emparejamiento conserva el contrato con el servidor (rutas y cuerpo)', () => {
  assert.match(source.matching, /\/api\/matching\/request/); assert.match(source.matching, /JSON\.stringify\(\{ answers \}\)/)
  assert.match(source.matching, /\/api\/matching\/choose/); assert.match(source.matching, /JSON\.stringify\(\{ requestId, therapistId \}\)/)
  for (const value of ['depression', 'relationships', 'personal growth', 'stress', 'other', 'reflective and exploratory', 'structured with goals', 'empathetic and listening', 'any', 'Spanish', 'English', 'No preference']) assert.ok(source.matching.includes(`'${value}'`), value)
})

test('ES-173 (E272-2): una fecha de solo día no sale un día antes en Colombia (America/Bogota) ni en otras zonas', () => {
  const script = "import { formatDay } from './src/progress/format.ts'; console.log(JSON.stringify([formatDay('2026-11-12', 'es-CO'), formatDay('2026-11-12', 'en-US'), formatDay('2026-01-01', 'es-CO')]))"
  const expected = [['12 nov 2026', 'Nov 12, 2026', '1 ene 2026']]
  for (const TZ of ['America/Bogota', 'Pacific/Honolulu', 'UTC', 'Asia/Tokyo']) {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const [es, en, january] = JSON.parse(run.stdout)
    assert.match(es, /^12 (de )?nov/i, TZ + ': ' + es); assert.match(en, /Nov 12, 2026/, TZ + ': ' + en); assert.match(january, /^0?1 (de )?ene/i, TZ + ': 1 de enero ' + january)
  }
  assert.ok(expected.length === 1)
  // con hora se respeta la zona de la persona: 2026-11-12T03:00:00Z son las 22:00 del 11 en Bogotá
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', "import { formatDay } from './src/progress/format.ts'; console.log(formatDay('2026-11-12T03:00:00Z', 'en-US'))"], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'America/Bogota' }, encoding: 'utf8' })
  assert.match(run.stdout, /Nov 11, 2026/)
  assert.match(formatDay('2026-11-12', 'en-US'), /Nov 1[12], 2026/)
})
