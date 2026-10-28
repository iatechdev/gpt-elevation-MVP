// QA-34 obs. 2-4: los controles deshabilitados explican por qué; el envío vacío muestra el aviso de la aplicación.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { blockReason } from '../src/career/reason.ts'
import { copy } from '../src/career/copy.ts'
import { createFixture, emptyConstraints, FixtureError } from '../src/career/fixture.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('QA-34: el motivo de bloqueo respeta el orden guardando, incierto, sin guardar y luego el motivo propio', () => {
  const idle = { busy: false, uncertain: false, dirty: false }
  assert.equal(blockReason(idle), null)
  assert.equal(blockReason(idle, 'ackLater'), 'ackLater')
  assert.equal(blockReason({ ...idle, dirty: true }, 'ackLater'), 'unsaved')
  assert.equal(blockReason({ ...idle, uncertain: true, dirty: true }, 'ackLater'), 'recover')
  assert.equal(blockReason({ busy: true, uncertain: true, dirty: true }, 'ackLater'), 'saving')
})

test('QA-34: todo motivo posible existe en ES y EN', () => {
  for (const key of ['saving', 'recover', 'unsaved', 'otherDraft', 'needsReview', 'invalidPlan', 'reminderInvalid', 'pickExperiment', 'ackLater', 'validate']) {
    assert.ok(copy[key], key)
    assert.ok(copy[key][0].trim() && copy[key][1].trim(), key)
    assert.notEqual(copy[key][0], copy[key][1], key)
  }
})

test('QA-34: un envío vacío del experimento llega a la aplicación (sin validación nativa) y se rechaza con el aviso validate', async () => {
  assert.match(read('../src/career/CareerPages.tsx'), /<form noValidate onSubmit=\{submit\}>/)
  const client = createFixture(); await client.load()
  await client.send({ type: 'constraints', value: { ...emptyConstraints(), markets: ['CO'], languages: ['es'], origin: 'education', interests: ['analysis'] } }, 'r-0000001')
  const empty = { type: 'change', id: 1, expected: 1, phase: 'submitted', value: { sample: '', evidence: false, assistance: '' } }
  await assert.rejects(client.send(empty, 'r-0000002'), error => error instanceof FixtureError)
})

test('QA-34: sin bandera o sin sesión las pestañas del recorrido no se muestran antes del aviso', () => {
  assert.match(read('../src/career/CareerShell.tsx'), /\{session && token\(\) === session && enabled && <nav /)
})

test('QA-34: todo <button> propio con disabled enlaza su motivo con aria-describedby (solo Button y Submit los usan)', () => {
  const tags = [...read('../src/career/CareerPages.tsx').matchAll(/<button[^>]*>/g)].map(m => m[0]).filter(tag => /disabled=/.test(tag))
  assert.equal(tags.length, 2, 'solo los <button> de Button y de Submit pueden deshabilitarse: ' + tags.length)
  for (const tag of tags) assert.match(tag, /aria-describedby=/, tag)
})
