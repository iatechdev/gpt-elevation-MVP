// ES-241 · «Próximas sesiones» del profesional: quien no autorizó compartir llega sin nombre (`patientName: null`) y con ordinal; se muestra «Persona n» con el MISMO
// ayudante que la lista de personas, nunca un nombre vacío ni «null». Prueba de código fuente + del ayudante (el servidor se prueba con PostgreSQL real).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/therapist/PanelSections.tsx', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../src/pages/therapist/panelText.ts', import.meta.url), 'utf8')

test('ES-241: las sesiones próximas se rotulan con personLabel (nombre o «Persona n»), también en el texto para lector de pantalla', () => {
  assert.match(source, /patientName: string \| null/)
  assert.match(source, /personLabel\(\{ name: session\.patientName, ordinal: session\.patientOrdinal \?\? 0 \}, t\('therapist_person'\)\)/)
  assert.equal(/\{session\.patientName\}/.test(source), false, 'ningún lugar pinta patientName directo')
  assert.equal((source.match(/\{who\}/g) ?? []).length, 2, 'el rótulo visible y el del botón usan lo mismo')
})

test('ES-267: la sesión en curso (phase = in_progress) se marca «ahora» aunque su hora ya pasara', () => {
  assert.match(source, /session\.phase === 'in_progress' \|\| sessionIsNow\(/)
})

test('personLabel sigue dando nombre o «Persona n»', () => {
  assert.match(helper, /person\.name \?\? `\$\{personWord\} \$\{person\.ordinal\}`/)
})
