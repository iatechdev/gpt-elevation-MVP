import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyAnswers, validAnswers, hasAnswers, makeIntent, parseMetrics, previewEnabled } from '../src/pilot/model.ts'
import { createFixtureRepository, FixtureError } from '../src/pilot/fixtures.ts'
import { copy } from '../src/pilot/copy.ts'
test('ES-36: only literal true publishes preview; empty/declined is distinct from negative and uncertain', () => {
  for (const v of [undefined, null, '', 'false', 'TRUE', true, '1']) assert.equal(previewEnabled(v), false)
  assert.equal(previewEnabled('true'), true); assert.equal(hasAnswers(emptyAnswers()), false)
  assert.equal(hasAnswers({ ...emptyAnswers(), listened: 'no' }), true)
  assert.equal(validAnswers({ ...emptyAnswers(), professionalClarity: 'not_explored' }), true)
  for (const patch of [{ UserId: 2 }, { notes: 'private text' }, { mood: 1 }, { listened: 0 }, { helpedBy: ['other', 'other'] }, { initialValue: 'no', valueArea: 'personal' }]) assert.equal(validAnswers({ ...emptyAnswers(), ...patch }), false)
})
test('ES-36: body is immutable, IDs identify separate intents and empty responses never submit', () => {
  const a = { ...emptyAnswers(), listened: 'yes', helpedBy: ['ideas'] }; const intent = makeIntent(a, 0)
  a.helpedBy.push('other'); assert.deepEqual(intent.answers.helpedBy, ['ideas']); assert.throws(() => intent.answers.helpedBy.push('other'), TypeError)
  assert.notEqual(makeIntent(a, 0).requestId, intent.requestId); assert.throws(() => makeIntent(emptyAnswers(), 0)); assert.throws(() => makeIntent(a, -1))
})
test('ES-36: RAM-only fixture save/readback/replay, stale versions and independent repositories', async () => {
  const r = createFixtureRepository(); const intent = makeIntent({ ...emptyAnswers(), listened: 'yes' }, 0)
  const a = await r.save(intent); assert.equal(a.version, 1); assert.deepEqual(await r.save(intent), a)
  await assert.rejects(r.save({ ...intent, answers: { ...intent.answers, listened: 'no' } }), e => e instanceof FixtureError && e.code === 'mismatch')
  await assert.rejects(r.save(makeIntent({ ...emptyAnswers(), respected: 'yes' }, 0)), e => e.code === 'conflict')
  assert.equal((await createFixtureRepository().read()).answers, null)
  a.answers.listened = 'no'; assert.equal((await r.read()).answers.listened, 'yes')
  assert.equal((await r.withdraw(1)).answers, null)
})
test('ES-36: lost ACK is uncertain until an explicit read; known failure never persists', async () => {
  const intent = makeIntent({ ...emptyAnswers(), listened: 'yes' }, 0); const r = createFixtureRepository('lost-ack')
  await assert.rejects(r.save(intent), e => e.code === 'unknown'); assert.equal((await r.read()).lastRequestId, intent.requestId); assert.equal((await r.save(intent)).version, 1)
  const fail = createFixtureRepository('save-error'); await assert.rejects(fail.save(intent)); assert.equal((await fail.read()).answers, null)
})
test('ES-36: unconfigured permission prevents simulation save and no real grant is assumed', async () => {
  const r = createFixtureRepository('unconfigured'); assert.equal((await r.read()).permission, 'not_configured')
  await assert.rejects(r.save(makeIntent({ ...emptyAnswers(), initialValue: 'yes' }, 0)), e => e.code === 'unconfigured')
})
test('ES-36: suppressed/unavailable DTO cannot smuggle hidden counts, owners or language segmentation', async () => {
  const fixture = await createFixtureRepository().metrics(); assert.equal(JSON.stringify(fixture).includes('counts'), false)
  for (const patch of [{ counts: { eligible: 6 } }, { UserId: 4 }, { language: 'en' }]) { const value = structuredClone(fixture); Object.assign(value.metrics[0], patch); assert.throws(() => parseMetrics(value)) }
  const ready = structuredClone(fixture); ready.metrics[0] = { key: 'activation', status: 'ready', counts: { eligible: 20, responded: 15, missing: 5, positive: 10 } }; assert.equal(parseMetrics(ready).metrics[0].counts.eligible, 20)
  for (const counts of [{ eligible: 4, responded: 4, missing: 0, positive: 2 }, { eligible: 20, responded: 15, missing: 6, positive: 10 }]) { const v = structuredClone(ready); v.metrics[0].counts = counts; assert.throws(() => parseMetrics(v)) }
})
test('ES-36: every label is bilingual and clearly distinguishes preview from persistence and targets', () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
  for (const lang of ['es', 'en']) for (const value of Object.values(copy[lang])) assert.ok(value.trim())
  assert.match(copy.es.saved, /simulación/); assert.match(copy.en.saved, /simulation/); assert.match(copy.es.targetWarning, /no son resultados/)
})
