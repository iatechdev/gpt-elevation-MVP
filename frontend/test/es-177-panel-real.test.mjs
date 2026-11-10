// ES-177 (PR A): el panel profesional nombra a las personas y muestra los avisos a partir de la respuesta REAL del servidor (fixtures generados por la prueba con
// Postgres real del backend, que falla si la forma cambia): «Persona n» sin nombre ni id interno, avisos con palabra (sin porcentaje) y el 409 de propuesta por código.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const fixture = (n) => JSON.parse(read(`fixtures/${n}`))
const out = resolve(here, '.tmp-es177')
let mod
before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(here, '../src/pages/therapist/panelText.ts'), platform: 'node', output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn' })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

test('ES-177: quien no comparte se muestra «Persona n» con el ordinal del servidor; quien comparte conserva su nombre', () => {
  const { body } = fixture('es-177-pacientes.json')
  const hidden = body.filter((p) => p.sharing === false); const shown = body.filter((p) => p.sharing === true)
  assert.ok(hidden.length >= 1 && shown.length >= 1, 'el fixture trae ambos casos')
  for (const p of hidden) {
    assert.equal(p.name, null); assert.ok(Number.isInteger(p.ordinal) && p.ordinal >= 1)
    assert.equal(mod.personLabel(p, 'Persona'), `Persona ${p.ordinal}`); assert.equal(mod.personLabel(p, 'Person'), `Person ${p.ordinal}`)
    assert.equal(mod.personInitial(p), String(p.ordinal).charAt(0))
  }
  for (const p of shown) assert.equal(mod.personLabel(p, 'Persona'), p.name)
  assert.equal(new Set(body.map((p) => p.ordinal)).size, body.length, 'el ordinal no se repite')
})

test('ES-177: ni /pacientes ni /alerts traen porcentajes, crisis, diario ni chats', () => {
  for (const name of ['es-177-pacientes.json', 'es-177-alerts.json']) {
    const text = JSON.stringify(fixture(name).body)
    assert.doesNotMatch(text, /improvementPercent|crisis|diary|diario|chat/i, name)
    assert.doesNotMatch(text, /[0-9]%/, name)
  }
  for (const entry of fixture('es-177-alerts.json').body.notableProgress) assert.equal(entry.improved, true)
})

test('ES-177: el 409 de propuesta trae código y la pantalla lo muestra en ES/EN (no el texto en inglés del servidor)', () => {
  const { status, body } = fixture('es-177-propose-409.json')
  assert.equal(status, 409); assert.equal(body.code, 'pending_exists')
  const screen = read('../src/pages/therapist/TherapistDashboard.tsx')
  assert.match(screen, /data\.code === 'pending_exists' \? t\('therapist_prompt_pending_exists'\)/)
  for (const lang of ['es', 'en']) assert.match(read(`../src/i18n/${lang}.ts`), /therapist_prompt_pending_exists:/)
})

test('ES-177: la pantalla ya no pinta ni tipa el porcentaje y usa la palabra de ambos idiomas', () => {
  const screen = read('../src/pages/therapist/TherapistDashboard.tsx')
  assert.doesNotMatch(screen, /improvementPercent/); assert.doesNotMatch(screen, /\+\{[^}]*\}%/)
  assert.match(screen, /t\('therapist_progress_improved'\)/)
  assert.match(read('../src/i18n/es.ts'), /therapist_progress_improved: 'El ánimo mejoró en los registros recientes'/)
  assert.match(read('../src/i18n/en.ts'), /therapist_progress_improved: 'Mood improved in recent entries'/)
})
