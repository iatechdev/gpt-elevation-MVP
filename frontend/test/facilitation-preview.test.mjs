import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFixture, enabled, scenarioOf, PreviewError } from '../src/facilitation/fixture.ts'
import { copy } from '../src/facilitation/copy.ts'
import { readFileSync } from 'node:fs'
const review = (person = 'A') => ({ kind: 'review', participantId: 'synthetic-' + person, shareId: 'synthetic-share-' + person, materialVersion: 1, evidenceRefs: ['synthetic-evidence-' + person], observation: 'Synthetic professional observation', limits: 'Synthetic limitation', locale: 'en' })
const expect = (code, fn) => assert.throws(fn, error => error instanceof PreviewError && error.code === code)
const record = f => f.apply('request-review-01', review(), 0, 'reviewer')
test('ES-35 preview is explicit opt-in; unknown scenarios never grant extra access', () => {
  for (const flag of [undefined, null, true, 'TRUE', '1', 'false', '']) assert.equal(enabled(flag), false)
  assert.equal(enabled('true'), true); assert.equal(scenarioOf('admin'), 'normal')
})
test('ES-35 synthetic view has six aliases, no personal attributes or private aggregates', () => {
  const data = createFixture().read()
  assert.equal(data.participants.length, 6)
  assert.equal(new Set(data.participants.map(p => p.alias)).size, 6)
  assert.deepEqual(Object.keys(data).sort(), ['events', 'participants', 'reviews', 'revision'])
  assert.doesNotMatch(JSON.stringify(data), /email|therapist|mood|crisis|score|language|cohort|aggregate/i)
})
test('ES-35 simulated review preserves examined evidence, author and timestamp', () => {
  const f = createFixture('normal', () => '2026-10-28T15:00:00.000Z')
  const id = record(f), row = f.current().reviews[0]
  assert.equal(id, row.id); assert.equal(row.author, 'reviewer'); assert.equal(row.at, '2026-10-28T15:00:00.000Z')
  assert.deepEqual(row.evidenceRefs, review().evidenceRefs); assert.equal(row.materialVersion, 1)
  const returned = f.current(); returned.reviews[0].observation = 'MUTATED'
  assert.equal(f.current().reviews[0].observation, review().observation)
})
test('ES-35 simulated actor/material boundaries reject foreign IDs and withdrawn versions', () => {
  for (const cmd of [review('C'), review('Z'), { ...review(), shareId: 'synthetic-share-B' }]) expect('revoked', () => createFixture().apply('request-deny-001', cmd, 0, 'reviewer'))
  expect('revoked', () => createFixture().apply('request-deny-002', review(), 0, 'participant'))
  expect('conflict', () => createFixture().apply('request-deny-003', { ...review(), materialVersion: 2 }, 0, 'reviewer'))
})
test('ES-35 invalid review content and unselected/foreign evidence never creates a review', () => {
  for (const change of [{ observation: ' ' }, { limits: '' }, { observation: 'a'.repeat(4001) }, { limits: 'a'.repeat(2001) }, { evidenceRefs: [] }, { evidenceRefs: ['synthetic-evidence-B'] }, { evidenceRefs: ['synthetic-evidence-A', 'synthetic-evidence-A'] }, { locale: 'fr' }]) {
    const f = createFixture(); expect('invalid', () => f.apply('request-invalid-01', { ...review(), ...change }, 0, 'reviewer')); assert.equal(f.current().reviews.length, 0)
  }
})
test('ES-35 exact replay is idempotent and request/body or revision changes conflict', () => {
  const f = createFixture(), cmd = review(), id = record(f)
  assert.equal(f.apply('request-review-01', cmd, 0, 'reviewer'), id)
  assert.equal(f.current().reviews.length, 1)
  expect('conflict', () => f.apply('request-review-01', { ...cmd, observation: 'other' }, 0, 'reviewer'))
  expect('conflict', () => f.apply('request-second-01', cmd, 0, 'reviewer'))
})
test('ES-35 lost ACK publishes no saved review until exact request replay', () => {
  const f = createFixture('lost-ack'); expect('save-error', () => record(f))
  assert.equal(f.current().reviews.length, 0); assert.equal(f.current().revision, 0)
  record(f); assert.equal(f.current().reviews.length, 1); assert.equal(f.current().revision, 1)
})
test('ES-35 transient failed write leaves draft operation retryable without duplicates', () => {
  const f = createFixture('save-error'); expect('save-error', () => record(f))
  assert.equal(f.read().reviews.length, 0); record(f); assert.equal(f.current().reviews.length, 1)
})
test('ES-35 conflict keeps previous public state until reload and requires new version', () => {
  const f = createFixture('conflict'); expect('conflict', () => record(f))
  assert.equal(f.current().participants[0].materials[0].version, 1)
  const next = f.read(); assert.equal(next.participants[0].materials[0].version, 2)
  f.apply('request-second-02', { ...review(), materialVersion: 2 }, next.revision, 'reviewer')
  assert.equal(f.current().reviews[0].materialVersion, 2)
})
test('ES-35 participant can object, reviewer responds once, original review remains immutable', () => {
  const f = createFixture(), id = record(f), original = f.current().reviews[0]
  const objection = { kind: 'objection', reviewId: id, reason: 'Synthetic objection', locale: 'es' }
  expect('revoked', () => f.apply('request-object-00', objection, 1, 'reviewer'))
  const eventId = f.apply('request-object-01', objection, 1, 'participant')
  const response = { kind: 'response', reviewId: id, objectionId: eventId, response: 'Synthetic professional response', locale: 'en' }
  expect('revoked', () => f.apply('request-answer-00', response, 2, 'participant'))
  f.apply('request-answer-01', response, 2, 'reviewer')
  assert.deepEqual(f.current().reviews[0], original)
  assert.equal(f.current().events.length, 2)
  expect('invalid', () => f.apply('request-answer-02', response, 3, 'reviewer'))
})
test('ES-35 own preview cannot object to another synthetic participant review', () => {
  const f = createFixture(), id = f.apply('request-review-02', review('B'), 0, 'reviewer')
  expect('revoked', () => f.apply('request-object-02', { kind: 'objection', reviewId: id, reason: 'Synthetic', locale: 'en' }, 1, 'participant'))
})
test('ES-35 withdrawn material denies new reviews and replay, own objection stays available', () => {
  const f = createFixture(), id = record(f); f.revoke('synthetic-A')
  expect('revoked', () => record(f))
  expect('revoked', () => f.apply('request-new-001', review(), 2, 'reviewer'))
  f.apply('request-object-03', { kind: 'objection', reviewId: id, reason: 'Synthetic', locale: 'en' }, 2, 'participant')
  const eventId = f.current().events[0].id
  expect('revoked', () => f.apply('request-answer-03', { kind: 'response', reviewId: id, objectionId: eventId, response: 'Synthetic', locale: 'en' }, 3, 'reviewer'))
})
test('ES-35 invitations only simulate eligible state; reload and new session start independently', () => {
  const f = createFixture(); f.apply('request-invite-01', { kind: 'invitation', participantId: 'synthetic-E' }, 0, 'reviewer')
  assert.equal(f.current().participants[4].invitation, 'pending')
  assert.equal(createFixture().read().participants[4].invitation, 'expired')
  expect('revoked', () => f.apply('request-invite-02', { kind: 'invitation', participantId: 'synthetic-A' }, 1, 'reviewer'))
  assert.equal(createFixture('empty').read().participants.length, 0)
  expect('revoked', () => createFixture('revoked').read())
  const broken = createFixture('load-error'); expect('load-error', () => broken.read()); assert.equal(broken.read().participants.length, 6)
})
test('ES-35 copy is complete in both languages; preview models contain no real transport or persisted data', () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
  assert.ok(Object.keys(copy.es).every(key => key.startsWith('facilitation.')))
  for (const lang of ['es', 'en']) for (const text of Object.values(copy[lang])) assert.ok(text.trim())
  const source = readFileSync(new URL('../src/facilitation/fixture.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|XMLHttpRequest|indexedDB/)
})
test('ES-35 approved local palette meets AA text and control contrast in both modes', () => {
  const l = h => { const c = h.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
  const ratio = (a, b) => (Math.max(l(a), l(b)) + .05) / (Math.min(l(a), l(b)) + .05)
  for (const [bg, text, muted, primary, buttonText, border] of [['#FAF8F4', '#1C1917', '#57534e', '#4A6741', '#FAF8F4', '#6b7267'], ['#252c26', '#f4f3ed', '#d0d5ce', '#b8d2ad', '#1c211d', '#899582']]) {
    assert.ok(ratio(bg, text) >= 4.5); assert.ok(ratio(bg, muted) >= 4.5); assert.ok(ratio(primary, buttonText) >= 4.5)
    assert.ok(ratio(bg, primary) >= 3); assert.ok(ratio(bg, border) >= 3)
  }
})

