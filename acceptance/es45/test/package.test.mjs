import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { validatePackage, dateMs, safeOrigin } from '../lib/validate.mjs'
import { consolidate, markdown, recordKey } from '../lib/consolidate.mjs'
import { loadBundle, verifyEvidence, readJson, writeReports, argumentsOf, ROOT } from '../lib/files.mjs'
import { POLICY } from '../lib/policy.mjs'
const NOW = Date.parse('2026-11-30T12:00:00.000Z'), SHA = 'a'.repeat(40)
const bundle = () => structuredClone(loadBundle())
const target = b => {
  b.readiness.target = { environmentKind: 'staging', origin: 'https://synthetic.example.invalid', commit: SHA, deploymentRef: 'ES-10:1', isolationRef: 'ES-11:1', accessRef: 'ES-10:2' }
  b.readiness.blockers.forEach(row => { row.status = 'satisfied'; row.reference = 'ES-45:1' })
  return b
}
const record = (changes = {}) => ({
  caseId: 'E45-02', variantId: 'es-journey', runId: 'synthetic-run-1', layer: 'staging_browser', environmentKind: 'staging',
  origin: 'https://synthetic.example.invalid', commit: SHA, status: 'passed', simulation: true, simulatedBoundaries: [],
  startedAt: '2026-10-28T12:00:00.000Z', finishedAt: '2026-10-28T12:01:00.000Z', reasonCode: 'check_passed',
  commandId: ({ unit_doubles: 'unit_test', http_doubles: 'http_test', db_real: 'db_check', browser_fixtures: 'browser_journey', staging_api: 'api_check', human_review: 'human_review', followup: 'followup_observation' })[changes.layer] || 'browser_journey',
  evidence: [{ path: 'receipt.txt', sha256: 'b'.repeat(64), mediaType: 'text/plain' }], reviewerRole: null, reviewRef: null, ...changes,
})
const errors = (b) => validatePackage(b, NOW).map(e => e.code)
const temp = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es45-test-'))
  t.after(() => {
    const resolved = path.resolve(dir)
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()))
    assert.match(path.basename(resolved), /^es45-test-/)
    fs.rmSync(resolved, { recursive: true, force: true })
  })
  return dir
}
const cleanOutput = (t, dir) => t.after(() => {
  const base = path.join(ROOT, '.output'), resolved = path.resolve(dir)
  assert.equal(path.dirname(resolved), base); assert.match(path.basename(resolved), /^test-/)
  fs.rmSync(resolved, { recursive: true, force: true })
})
test('ES-45 committed package: 28 families, 102 variants, 6 synthetic journeys, no executed product', () => {
  const b = bundle(); assert.deepEqual(errors(b), [])
  const r = consolidate(b, { now: NOW })
  assert.equal(r.preparationReady, true); assert.equal(r.coverage.families, 28); assert.equal(r.coverage.variants, 102)
  assert.equal(b.journeys.journeys.length, 6); assert.equal(b.results.records.length, 0)
  assert.equal(r.integratedAcceptance, 'blocked'); assert.equal(r.pilotReady, false); assert.equal(r.followup.state, 'not_started')
})
test('ES-45 removed family or weakened required layer cannot reduce coverage', () => {
  let b = bundle(); b.cases.families.pop(); assert.ok(errors(b).includes('family_coverage'))
  b = bundle(); b.cases.families[1].requiredLayers = ['http_doubles']; assert.ok(errors(b).includes('required_layers_changed'))
  b = bundle(); b.cases.families[0].id = 'E45-02'; assert.ok(errors(b).includes('duplicate_id'))
})
test('ES-45 actor/timing/viewport variants and destructive marker cannot silently disappear', () => {
  let b = bundle(); b.cases.families[17].variants.pop(); assert.ok(errors(b).includes('variant_coverage'))
  b = bundle(); b.cases.families[18].variants[0].edge = 'skip'; assert.ok(errors(b).includes('unknown_variant'))
  b = bundle(); b.cases.families[22].destructive = false; assert.ok(errors(b).includes('destructive_marker'))
})
test('ES-45 closed schemas reject extra fields and malformed values without echoing payload', () => {
  for (const mutate of [b => { b.cases.secret = 'CANARY_SECRET' }, b => { b.readiness.blockers = null }, b => { b.results.records = [null] }, b => { b.journeys.journeys[0] = [] }]) {
    const b = bundle(); mutate(b); assert.ok(errors(b).length); assert.doesNotMatch(JSON.stringify(validatePackage(b, NOW)), /CANARY_SECRET/)
  }
})
test('ES-45 bilingual steps and expectations are mandatory', () => {
  let b = bundle(); b.cases.families[0].variants[0].steps.en = []; assert.ok(errors(b).includes('bilingual_steps'))
  b = bundle(); b.cases.families[0].variants[0].expected.en = ''; assert.ok(errors(b).includes('bilingual_text'))
})
test('ES-45 six journeys preserve both entries, language ratio and optional emotional-only use', () => {
  let b = bundle(); b.journeys.journeys[5].locale = 'es'; assert.ok(errors(b).includes('six_bilingual_journeys'))
  b = bundle(); b.journeys.journeys[0].steps[0].variantId = 'en-journey'; assert.ok(errors(b).includes('journey_reference'))
  b = bundle(); b.journeys.journeys[4].steps.push({ caseId: 'E45-15', variantId: 'es-journey' }); assert.ok(errors(b).includes('optional_career'))
  b = bundle(); b.journeys.journeys[1].steps = b.journeys.journeys[1].steps.filter(s => s.caseId !== 'E45-17'); assert.ok(errors(b).includes('full_journey'))
})
test('ES-45 malformed dates, future execution, short hashes and missing evidence fail validation', () => {
  for (const change of [{ startedAt: '2026-02-30T12:00:00.000Z' }, { finishedAt: '2027-01-01T00:00:00.000Z' }, { finishedAt: '2026-10-28T11:00:00.000Z' }, { commit: 'abcdef0' }, { evidence: [] }]) {
    const b = target(bundle()); b.results.records.push(record(change)); assert.ok(errors(b).length)
  }
  assert.ok(Number.isNaN(dateMs('2026-02-30T12:00:00.000Z')))
})
test('ES-45 status semantics reject skipped-as-pass and mismatching reasons', () => {
  for (const change of [{ status: 'skipped' }, { status: 'passed', reasonCode: 'not_executed' }, { status: 'blocked', reasonCode: 'check_passed' }]) {
    const b = target(bundle()); b.results.records.push(record(change)); assert.ok(errors(b).length)
  }
  const b = target(bundle()); b.results.records.push(record({ status: 'not_run', reasonCode: 'not_executed', startedAt: null, finishedAt: null, evidence: [] }))
  assert.deepEqual(errors(b), []); assert.equal(consolidate(b, { now: NOW }).coverage.integratedEvidenceForReview, 0)
})
test('ES-45 HTTP, unit doubles and fixture browser never satisfy real staging browser requirements', () => {
  for (const layer of ['unit_doubles', 'http_doubles', 'browser_fixtures']) {
    const b = target(bundle()), r = record({ layer, origin: null, environmentKind: 'local', simulation: false, simulatedBoundaries: ['api'] })
    b.results.records.push(r); assert.deepEqual(errors(b), [])
    assert.equal(consolidate(b, { now: NOW, verified: new Set([recordKey(r)]) }).coverage.integratedEvidenceForReview, 0)
  }
})
test('ES-45 hidden mocks, fake DB and wrong environment cannot be promoted', () => {
  for (const change of [
    { simulatedBoundaries: ['provider'] },
    { layer: 'db_real', environmentKind: 'local', origin: null, simulatedBoundaries: ['database'] },
    { layer: 'http_doubles', simulatedBoundaries: [] },
    { environmentKind: 'local', origin: null },
  ]) {
    const b = target(bundle()); b.results.records.push(record(change)); assert.ok(errors(b).length)
  }
})
test('ES-45 API or HTML check cannot be labelled as a browser journey', () => {
  const b = target(bundle()); b.results.records.push(record({ commandId: 'api_check' }))
  assert.ok(errors(b).includes('command_layer'))
})
test('ES-45 simulation, other commit, unverified hash and other origin never count as integrated evidence', () => {
  for (const change of [{ simulation: true }, { simulation: false, commit: 'c'.repeat(40) }]) {
    const b = target(bundle()), r = record(change); b.results.records.push(r)
    assert.deepEqual(errors(b), []); assert.equal(consolidate(b, { now: NOW, verified: new Set([recordKey(r)]) }).coverage.integratedEvidenceForReview, 0)
  }
  let b = target(bundle()); b.results.records.push(record({ simulation: false })); assert.equal(consolidate(b, { now: NOW }).coverage.integratedEvidenceForReview, 0)
  b = target(bundle()); b.results.records.push(record({ origin: 'https://other.example.invalid' })); assert.ok(errors(b).includes('result_origin'))
})
test('ES-45 matching real-shape record and verified artifact only creates evidence awaiting human review', () => {
  const b = target(bundle()), r = record({ simulation: false }); b.results.records.push(r)
  const report = consolidate(b, { now: NOW, verified: new Set([recordKey(r)]) })
  assert.equal(report.coverage.integratedEvidenceForReview, 1); assert.equal(report.integratedAcceptance, 'blocked')
  assert.equal(report.pilotReady, false); assert.equal(report.invitationDecision, 'pending_human_decision')
})
test('ES-45 duplicate results and arbitrary commands/reviewers are rejected', () => {
  let b = target(bundle()); b.results.records.push(record(), record()); assert.ok(errors(b).includes('duplicate_result'))
  b = target(bundle()); b.results.records.push(record({ commandId: 'node -e CANARY_SECRET' })); assert.ok(errors(b).includes('result_enum'))
  b = target(bundle()); b.results.records.push(record({ layer: 'human_review', reviewerRole: 'administrator', reviewRef: 'ES-45:1' })); assert.ok(errors(b).includes('human_reference'))
})
test('ES-45 empty or omitted blocker is not a satisfied dependency', () => {
  let b = bundle(); b.readiness.blockers.pop(); assert.ok(errors(b).includes('missing_blocker'))
  b = bundle(); b.readiness.blockers[0].status = 'satisfied'; assert.ok(errors(b).includes('blocker_reference'))
  b = bundle(); b.readiness.blockers[0].status = 'not_applicable'; assert.ok(errors(b).includes('blocker_reference'))
})
test('ES-45 origin and references reject credentials, queries and unverified hashes', () => {
  for (const origin of ['https://user:CANARY_SECRET@synthetic.example.invalid', 'https://synthetic.example.invalid?key=CANARY_SECRET', 'http://synthetic.example.invalid', 'https://synthetic.example.invalid/path', 'https://localhost']) assert.equal(safeOrigin(origin), false)
  const b = target(bundle()); b.readiness.target.deploymentRef = 'approved'; assert.ok(errors(b).includes('unverified_target_shape'))
})
test('ES-45 future pilot dates and early 7/30-day reports cannot invent observations', () => {
  let b = target(bundle()); b.readiness.pilotStartedAt = '2027-01-01T00:00:00.000Z'; assert.ok(errors(b).includes('pilot_date'))
  for (const edge of ['day-7', 'day-30']) {
    b = target(bundle()); b.readiness.pilotStartedAt = '2026-10-28T12:00:00.000Z'
    b.results.records.push(record({ caseId: 'E45-28', variantId: 'es-' + edge, layer: 'followup', environmentKind: 'followup', reviewerRole: 'PO', reviewRef: 'ES-45:1' }))
    assert.ok(errors(b).includes('followup_not_due'))
  }
  b = target(bundle()); b.readiness.pilotStartedAt = '2026-10-01T12:00:00.000Z'
  b.results.records.push(record({ caseId: 'E45-28', variantId: 'es-day-7', layer: 'followup', environmentKind: 'followup', reviewerRole: 'PO', reviewRef: 'ES-45:1' }))
  assert.deepEqual(errors(b), [])
})
function allEvidence() {
  const b = target(bundle())
  for (const p of POLICY.filter(p => p.id !== 'E45-28')) for (const v of p.variants) for (const layer of p.layers) b.results.records.push(record({
    caseId: p.id, variantId: v.id, runId: 'synthetic-' + b.results.records.length, layer, simulation: false,
    environmentKind: layer === 'db_real' ? 'local' : 'staging', origin: layer === 'db_real' ? null : b.readiness.target.origin,
    simulatedBoundaries: layer === 'db_real' ? ['provider'] : [],
    reviewerRole: layer === 'human_review' ? 'QA' : null, reviewRef: layer === 'human_review' ? 'ES-45:1' : null,
  }))
  return b
}
test('ES-45 even an adversarial all-pass manifest cannot authorize invitations or assert pilot approval', () => {
  const b = allEvidence(); assert.deepEqual(errors(b), [])
  const report = consolidate(b, { now: NOW, verified: new Set(b.results.records.map(recordKey)) })
  assert.equal(report.coverage.integratedNotVerified, 0); assert.equal(report.integratedAcceptance, 'awaiting_human_review')
  assert.equal(report.pilotReady, false); assert.equal(report.invitationDecision, 'pending_human_decision')
  assert.equal(report.followup.state, 'not_started')
})
test('ES-45 unresolved critical or ordinary failure blocks despite later pass; no average hides it', () => {
  for (const family of ['E45-18', 'E45-02']) {
    const b = allEvidence(), existing = b.results.records.find(r => r.caseId === family)
    b.results.records.push({ ...existing, runId: 'synthetic-failed', status: 'failed', reasonCode: 'assertion_failed' })
    const report = consolidate(b, { now: NOW, verified: new Set(b.results.records.map(recordKey)) })
    assert.equal(report.integratedAcceptance, 'blocked'); assert.equal(report.failures.length, 1)
  }
  const b = allEvidence(), r = b.results.records.find(r => r.caseId === 'E45-18')
  b.results.records.push({ ...r, runId: 'synthetic-old-critical', status: 'failed', reasonCode: 'assertion_failed', commit: 'd'.repeat(40) })
  assert.equal(consolidate(b, { now: NOW, verified: new Set(b.results.records.map(recordKey)) }).integratedAcceptance, 'blocked')
})
test('ES-45 artifact hashes are checked on disk; tampering cannot count as evidence', t => {
  const dir = temp(t), bytes = 'Synthetic validator self-test receipt; not a product run.\n'
  fs.writeFileSync(path.join(dir, 'receipt.txt'), bytes)
  const r = record({ evidence: [{ path: 'receipt.txt', sha256: createHash('sha256').update(bytes).digest('hex'), mediaType: 'text/plain' }] })
  assert.equal(verifyEvidence({ records: [r] }, dir).verified.has(recordKey(r)), true)
  fs.appendFileSync(path.join(dir, 'receipt.txt'), 'tampered')
  const checked = verifyEvidence({ records: [r] }, dir); assert.equal(checked.verified.size, 0); assert.equal(checked.errors.length, 1)
  assert.equal(verifyEvidence({ records: [r] }, null).verified.size, 0)
})
test('ES-45 path traversal, absolute paths, remote paths and links are refused', t => {
  const dir = temp(t)
  for (const artifact of ['../receipt.txt', '/receipt.txt', 'file:///receipt.txt', 'https://synthetic.example.invalid/receipt.txt', 'x/../../receipt.txt']) {
    const r = record({ evidence: [{ path: artifact, sha256: 'b'.repeat(64), mediaType: 'text/plain' }] })
    assert.equal(verifyEvidence({ records: [r] }, dir).verified.size, 0)
  }
  assert.throws(() => readJson('https://synthetic.example.invalid/file.json'))
  assert.throws(() => readJson(path.join(ROOT, '../outside.json')))
  const outside = path.join(dir, 'outside'), link = path.join(dir, 'linked'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'receipt.txt'), 'synthetic')
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
  const r = record({ evidence: [{ path: 'linked/receipt.txt', sha256: createHash('sha256').update('synthetic').digest('hex'), mediaType: 'text/plain' }] })
  assert.equal(verifyEvidence({ records: [r] }, dir).verified.size, 0)
})
test('ES-45 report writes only under its own ignored output directory and refuses links', t => {
  const dir = path.join(ROOT, '.output', 'test-' + randomUUID()); cleanOutput(t, dir)
  writeReports(dir, '{}\n', '# Synthetic report\n'); assert.equal(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'), '{}\n')
  const hardlink = path.join(dir, 'original.txt')
  fs.writeFileSync(hardlink, 'original content'); fs.unlinkSync(path.join(dir, 'report.json')); fs.linkSync(hardlink, path.join(dir, 'report.json'))
  writeReports(dir, '{}\n', '# Synthetic report\n')
  assert.equal(fs.readFileSync(hardlink, 'utf8'), 'original content')
  assert.throws(() => writeReports(path.join(ROOT, 'outside'), '{}', '# no'))
  fs.unlinkSync(path.join(dir, 'report.json'))
  const outside = temp(t); fs.writeFileSync(path.join(outside, 'victim.txt'), 'untouched')
  // Directory links need no elevated file-symlink permission on Windows.
  fs.symlinkSync(outside, path.join(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => writeReports(path.join(dir, 'link'), '{}', '# no'))
  assert.equal(fs.readFileSync(path.join(outside, 'victim.txt'), 'utf8'), 'untouched')
})
test('ES-45 CLI defaults generate blocked report; errors never print supplied secrets or execute commands', t => {
  const dir = path.join(ROOT, '.output', 'test-' + randomUUID()); cleanOutput(t, dir)
  const run = (script, args = []) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  let r = run('check.mjs'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).productExecuted, false)
  r = run('report.mjs', ['--out-dir', dir]); assert.equal(r.status, 0, r.stderr)
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')); assert.equal(report.integratedAcceptance, 'blocked')
  assert.equal(report.pilotReady, false); assert.equal(report.coverage.integratedEvidenceForReview, 0)
  r = run('check.mjs', ['--unknown', 'CANARY_SECRET']); assert.equal(r.status, 2); assert.doesNotMatch(r.stdout + r.stderr, /CANARY_SECRET/)
  r = run('check.mjs', ['--results', 'https://user:CANARY_SECRET@synthetic.example.invalid']); assert.equal(r.status, 2); assert.doesNotMatch(r.stderr, /CANARY_SECRET/)
  assert.throws(() => argumentsOf(['--cases'])); assert.throws(() => argumentsOf(['--cases', 'a', '--cases', 'b']))
})
test('ES-45 consolidation is deterministic and public summary does not echo evidence payloads', () => {
  const b = bundle(), a = consolidate(b, { now: NOW }), c = consolidate(b, { now: NOW })
  assert.deepEqual(a, c); assert.match(markdown(a), /blocked/); assert.match(markdown(a), /pending_human_decision/)
  b.results.records = [{ secret: 'CANARY_SECRET' }]
  const invalid = consolidate(b, { now: NOW }); assert.equal(invalid.preparationReady, false); assert.doesNotMatch(JSON.stringify(invalid) + markdown(invalid), /CANARY_SECRET/)
})
