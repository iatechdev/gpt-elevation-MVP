import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createFixture, emptyConstraints, routesFor, preferenceFor, validActions, fixtureInstant, FixtureError } from '../src/career/fixture.ts'
import { copy } from '../src/career/copy.ts'
const constraints = () => ({ ...emptyConstraints(), markets: ['CO', 'DK'], languages: ['es', 'en'], origin: 'education', interests: ['analysis'] })
let sequence = 0
const send = (client, input) => client.send(input, `synthetic-${++sequence}`)
const code = (promise, expected) => assert.rejects(promise, error => error instanceof FixtureError && error.code === expected)
const date = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const actions = () => [7, 30, 90].map((key, i) => ({ key, date: date([3, 20, 70][i]), minutes: 20, resource: false, cost: '', completed: '' }))
async function fixture(scenario) { const c = createFixture(scenario); await c.load(); return c }
async function decided(c) {
  await send(c, { type: 'constraints', value: constraints() }); const route = routesFor(c.snapshot())[0]
  await send(c, { type: 'choice', route, decision: 'chosen' }); const id = await send(c, { type: 'experiment', routeId: route.id, minutes: 20 })
  await send(c, { type: 'change', id, expected: 1, phase: 'in_progress', value: {} })
  await send(c, { type: 'change', id, expected: 2, phase: 'submitted', value: { sample: 'SYNTHETIC SAMPLE', assistance: 'drafting', evidence: false } })
  await send(c, { type: 'change', id, expected: 3, phase: 'self_reviewed', value: { observation: 'Synthetic observation', interpretation: 'Synthetic interpretation' } })
  await send(c, { type: 'change', id, expected: 4, phase: 'decided', value: { decision: 'continue', reason: 'Synthetic reason' } })
  return id
}
test('ES-34 textos ES/EN completos y preview apagada salvo true literal; simulación sin red/almacenamiento', () => {
  for (const value of Object.values(copy)) assert.ok(value.length === 2 && value.every(v => typeof v === 'string' && v.trim()))
  const source = fs.readFileSync(new URL('../src/career/fixture.ts', import.meta.url), 'utf8')
  assert.ok(!/\bfetch\s*\(|localStorage|sessionStorage|Authorization|https:\/\/(?!example\.org)/.test(source))
  assert.match(fs.readFileSync(new URL('../src/career/CareerShell.tsx', import.meta.url), 'utf8'), /VITE_ENABLE_CAREER_PREVIEW === 'true'/)
})
test('ES-34 vacío, restricciones, tres casillas justificadas y regulación excluible sin rellenar', async () => {
  const c = await fixture(); assert.deepEqual(routesFor(c.snapshot()), [])
  await code(send(c, { type: 'constraints', value: emptyConstraints() }), 'validate')
  await send(c, { type: 'constraints', value: constraints() }); assert.deepEqual(routesFor(c.snapshot()).map(r => r.slot), ['continuity', 'adjacency', 'exploration'])
  const s = structuredClone(c.snapshot()), route = routesFor(s)[0]; s.constraints.interests = []; s.constraints.preferred = []; assert.equal(preferenceFor(s, route), 'unknown')
  await send(c, { type: 'constraints', value: { ...constraints(), regulated: 'no' } }); assert.equal(routesFor(c.snapshot()).length, 2)
})
test('ES-34 repetición exacta no duplica decisiones y cuerpo cambiado no reutiliza requestId', async () => {
  const c = await fixture(); await send(c, { type: 'constraints', value: constraints() }); const command = { type: 'choice', route: routesFor(c.snapshot())[0], decision: 'chosen' }
  await c.send(command, 'same-intent'); await c.send(command, 'same-intent'); assert.equal(c.snapshot().choices.length, 1)
  await code(c.send({ ...command, decision: 'rejected' }, 'same-intent'), 'conflict')
})
test('ES-34 entregar, reflexionar, decidir conserva asistencia y no inventa revisión humana', async () => {
  const c = await fixture(), id = await decided(c), e = c.snapshot().experiments.find(e => e.id === id)
  assert.equal(e.phase, 'decided'); assert.equal(e.assistance, 'drafting'); assert.notEqual(e.observation, e.interpretation)
  assert.ok(e.versions.some(v => v.sample === 'SYNTHETIC SAMPLE')); assert.equal(e.review, false)
  await code(send(c, { type: 'review', id, selected: false }), 'validate')
  await send(c, { type: 'review', id, selected: true }); assert.equal(c.snapshot().experiments[0].review, true)
  await send(c, { type: 'review', id }); assert.equal(c.snapshot().experiments[0].review, false)
})
test('ES-34 planes: fechas, dependencias, esfuerzo y costo desconocido no se convierten en viabilidad verificada', () => {
  assert.ok(validActions(actions(), '')); assert.equal(validActions(actions().slice(1), ''), false)
  assert.equal(validActions(actions().map(a => ({ ...a, date: date(3), minutes: 30 })), ''), false)
  assert.equal(validActions(actions(), '0'), false)
  assert.ok(validActions(actions().map(a => ({ ...a, cost: '0' })), '0'))
  const unknown = actions().map(a => ({ ...a, cost: '0', resource: true })); assert.equal(validActions(unknown, '0'), false)
  const invalid = actions(); invalid[0].date = '2026-02-30'; assert.equal(validActions(invalid, ''), false)
  assert.ok(validActions([{ ...actions()[0], date: '2026-11-03' }], '', new Date('2026-11-04T02:00:00Z')), 'today follows the fixture time zone, not UTC')
})
test('ES-34 plan confirmado, checkbox sin evidencia bloqueado y cambios de base obligan revisión', async () => {
  const c = await fixture(), id = await decided(c), planId = await send(c, { type: 'plan', experimentId: id, actions: actions(), budget: '', currency: 'USD' })
  await code(send(c, { type: 'complete', planId, expected: 1, key: 7, text: '' }), 'validate')
  await send(c, { type: 'complete', planId, expected: 1, key: 7, text: 'Synthetic completion' }); assert.equal(c.snapshot().plans[0].status, 'superseded')
  await send(c, { type: 'constraints', value: { ...constraints(), regulated: 'no' } })
  await code(send(c, { type: 'change', id, expected: 5, phase: 'submitted', value: { sample: 'new', assistance: 'none' } }), 'conflict')
  await send(c, { type: 'rebase', id }); assert.equal(c.snapshot().experiments[0].sample, ''); assert.ok(c.snapshot().experiments[0].versions.some(v => v.sample))
})
test('ES-34 permiso y aceptación de recordatorios son distintos; revocar/reotorgar no resucita', async () => {
  const c = await fixture(), id = await decided(c), planId = await send(c, { type: 'plan', experimentId: id, actions: actions(), budget: '', currency: 'USD' })
  const command = { type: 'reminder', planId, key: 7, localTime: `${date(3)}T09:00`, accepted: true }
  await code(send(c, command), 'reminderInvalid'); await send(c, { type: 'notifications', enabled: true }); await send(c, command)
  const r = c.snapshot().reminders[0]; assert.ok(fixtureInstant(command.localTime).endsWith('14:00:00.000Z'))
  await code(send(c, { type: 'ack', id: r.id }), 'reminderInvalid')
  await send(c, { type: 'notifications', enabled: false }); await send(c, { type: 'notifications', enabled: true }); assert.notEqual(c.snapshot().grant, r.grant)
  await send(c, { type: 'cancel', id: r.id }); assert.equal(c.snapshot().reminders[0].status, 'cancelled')
})
test('ES-34 ACK perdido no publica estado como guardado antes de recuperar; errores no mutan', async () => {
  const c = await fixture('lost-ack'); await code(send(c, { type: 'constraints', value: constraints() }), 'lostAck'); assert.equal(c.snapshot().basis, 0)
  await c.load(); assert.equal(c.snapshot().basis, 1)
  const replay = await fixture('lost-ack'), command = { type: 'constraints', value: constraints() }
  await code(replay.send(command, 'lost-intent'), 'lostAck'); await replay.send(command, 'lost-intent'); assert.equal(replay.snapshot().basis, 1)
  for (const scenario of ['save-error', 'conflict']) { const client = await fixture(scenario); await code(send(client, { type: 'constraints', value: constraints() }), scenario === 'save-error' ? 'saveError' : 'conflict'); assert.equal(client.snapshot().basis, 0) }
  await code(fixture('pending'), 'pending'); await code(fixture('load-error'), 'saveError')
})
test('ES-34 sesión nueva y recarga no recuperan datos de otra simulación', async () => {
  const a = await fixture(); await decided(a); const b = await fixture(); assert.deepEqual(b.snapshot().experiments, []); assert.equal(b.snapshot().basis, 0)
})
test('ES-34 contraste de texto, foco y límites de campos cumple en ambos temas', () => {
  const linear = channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  const luminance = hex => { const rgb = hex.match(/[a-f0-9]{2}/gi).map(value => linear(parseInt(value, 16) / 255)); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 }
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
  for (const [fg, bg] of [['#1c1917', '#f9f9f7'], ['#ffffff', '#4a6741'], ['#4a6741', '#faf8f4'], ['#7a3030', '#faf8f4'], ['#92400e', '#faf8f4'], ['#f5f6f1', '#242b22'], ['#182115', '#c1d5b5'], ['#ffb5b5', '#242b22'], ['#f4d9a8', '#242b22']]) assert.ok(ratio(fg, bg) >= 4.5, `${fg}/${bg}`)
  assert.ok(ratio('#6b7267', '#f9f9f7') >= 3); assert.ok(ratio('#899582', '#181c17') >= 3)
})
