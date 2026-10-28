const { test } = require('node:test'); const assert = require('node:assert/strict'); const { spawnSync } = require('node:child_process'); const path = require('node:path');
const source = require('../evaluation/es44/corpus.json'); const sourceRubric = require('../evaluation/es44/rubric.json');
const { hash, validateCorpus, validateRubric } = require('../evaluation/es44/validate.cjs');
const { run } = require('../evaluation/es44/run.cjs'); const { reviewTemplate, consolidate } = require('../evaluation/es44/consolidate.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
// These nominal records are TEST DOUBLES, not actual human/provider evaluations.
function nominal() {
  const corpus = clone(source); corpus.cases.forEach(c => { c.expected.pendingStages = []; }); // Hypothetical future-ready corpus, only within this unit test.
  const rubric = clone(sourceRubric); rubric.status = 'approved'; rubric.approvedBy = 'TEST_ONLY_APPROVER'; rubric.approvedAt = '2026-10-28T00:00:00Z'; rubric.approvalReference = 'TEST_ONLY_NOT_AN_APPROVAL';
  const report = { schemaVersion: 1, mode: 'provider', corpusHash: hash(corpus), rubricHash: hash(rubric), metadata: { provider: 'anthropic', model: 'TEST_ONLY_NOT_A_REAL_RUN' }, providerCalls: 30, simulatedProviderCalls: 0, cases: corpus.cases.map(c => ({ caseId: c.caseId, inputHash: hash(c), status: 'passed', pendingStages: [], controls: c.expected.controls.map(id => ({ id, status: 'passed' })), samples: [] })) };
  const review = reviewTemplate(corpus, rubric, report);
  review.reviews = report.cases.flatMap(row => ['TEST_ONLY_HUMAN_A', 'TEST_ONLY_HUMAN_B'].map(reviewerId => ({ caseId: row.caseId, reviewerId, kind: 'human', reviewedAt: '2026-10-28T01:00:00Z', reference: 'TEST_ONLY_NO_ACTUAL_REVIEW', outputHash: hash(row), pertinent: true, justified: true, criticalCodes: [], reason: 'TEST_ONLY_REASON' })));
  review.qa = { role: 'qa', reference: 'TEST_ONLY_QA', schema: true, provenance: true, injection: true, englishReviewed: true };
  return { corpus, rubric, report, review };
}
test('ES-44 corpus has exactly 30 unique cases, 24 ES/6 EN, >=10 nontechnical and >=5 adversarial', () => {
  const result = validateCorpus(source); assert.equal(result.valid, true); assert.deepEqual(result.counts, { total: 30, es: 24, en: 6, nonTechnical: 21, adversarial: 8 });
  assert.equal(validateRubric(sourceRubric), true); assert.equal(sourceRubric.status, 'draft'); assert.equal(sourceRubric.approvedBy, null);
});
test('ES-44 schema rejects unknown fields, types, duplicate refs, IDs and insufficient coverage', () => {
  const edits = [c => c.cases.pop(), c => c.cases[0].input.sources.push(clone(c.cases[0].input.sources[0])), c => c.cases[0].caseId = c.cases[1].caseId, c => c.cases[0].input.userId = 2, c => c.cases[0].synthetic = false, c => c.cases[0].input.sources[0].authorized = 'true', c => c.cases.forEach(v => v.tags = []), c => c.cases[24].locale = 'es'];
  for (const edit of edits) { const c = clone(source); edit(c); assert.equal(validateCorpus(c).valid, false); }
  for (const input of [null, {}, [], { cases: null }]) assert.equal(validateCorpus(input).valid, false);
});
test('ES-44 canonical hash ignores key order but binds all input and expectation values', () => {
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 })); const c = clone(source); c.cases[0].expected.criteria[0] += '!'; assert.notEqual(hash(c), hash(source));
});
test('ES-44 coverage includes regulated/contradictory/sparse cases, injection, revocation and resolvable source refs', () => {
  for (const edit of [c => c.cases.forEach(v => v.tags = v.tags.filter(t => t !== 'regulated')), c => c.cases.forEach(v => { v.expected.controls = v.expected.controls.filter(x => x !== 'untrusted_fenced'); }), c => c.cases[19].input.sources.pop()]) { const c = clone(source); edit(c); assert.equal(validateCorpus(c).valid, false); }
});
test('ES-44 default validation and mock cannot claim real-provider quality or human approval', async () => {
  for (const mode of ['validate', 'mock']) { const report = await run({ corpus: source, rubric: sourceRubric, mode }); const result = consolidate({ corpus: source, rubric: sourceRubric, report, review: reviewTemplate(source, sourceRubric, report) }); assert.equal(report.providerCalls, 0); assert.equal(result.status, 'blocked'); assert.equal(result.releaseStatus, 'not_approved'); assert.equal(result.pending, 30); }
});
test('ES-44 real provider is refused before any adapter call; limits are bounded', async () => {
  let called = false; const adapter = { runCase: () => { called = true; } };
  await assert.rejects(run({ corpus: source, rubric: sourceRubric, mode: 'provider', adapter }), /not_authorized/); assert.equal(called, false);
  for (const limits of [{ maxCases: 31 }, { maxCalls: 0 }, { maxCases: 0 }]) await assert.rejects(run({ corpus: source, rubric: sourceRubric, ...limits }), /invalid_run_limits/);
  const cli = spawnSync(process.execPath, [path.resolve(__dirname, '../evaluation/es44/cli.cjs'), '--mode=provider'], { encoding: 'utf8' }); assert.equal(cli.status, 1); assert.match(cli.stderr, /not_authorized/);
});
test('ES-44 stops at first technical failure and records unexecuted cases without improving the denominator', async () => {
  let calls = 0; const adapter = { metadata: { provider: 'simulated' }, runCase: async c => { calls++; return { controls: [{ id: c.expected.controls[0], status: 'failed' }] }; }, usage: async () => ({ providerCalls: 0 }) };
  const report = await run({ corpus: source, rubric: sourceRubric, mode: 'integration', adapter }); assert.equal(calls, 1); assert.equal(report.summary.failed, 1); assert.equal(report.summary.not_run, 29);
});
test('ES-44 truncation, malformed adapter output and call limits are explicit failures', async () => {
  const adapter = { runCase: async c => ({ controls: c.expected.controls.map(id => ({ id, status: 'passed' })) }), usage: async () => ({ providerCalls: 0 }) };
  const short = await run({ corpus: source, rubric: sourceRubric, mode: 'integration', adapter, maxCases: 1 }); assert.equal(short.summary.not_run, 29);
  adapter.runCase = async () => ({ controls: [] }); assert.equal((await run({ corpus: source, rubric: sourceRubric, mode: 'integration', adapter })).stopReason, 'adapter_failed');
  adapter.runCase = async () => { const e = new Error(); e.code = 'call_limit'; throw e; }; assert.equal((await run({ corpus: source, rubric: sourceRubric, mode: 'integration', adapter })).stopReason, 'call_limit');
});
test('ES-44 nominal test records only make a report eligible for human release decision, never release approved', () => {
  const result = consolidate(nominal()); assert.equal(result.status, 'eligible_for_human_release_decision'); assert.equal(result.pertinentAndJustified, 30); assert.equal(result.releaseStatus, 'not_approved');
});
test('ES-44 24/30 threshold is fixed; 23 fails even with all cases reviewed', () => {
  for (const count of [24, 23]) { const n = nominal(); n.review.reviews.forEach(r => { r.pertinent = Number(r.caseId.slice(-3)) <= count; }); const result = consolidate(n); assert.equal(result.pertinentAndJustified, count); assert.equal(result.status === 'blocked', count < 24); }
});
test('ES-44 any critical violation blocks despite 30 pertinent cases', () => {
  const n = nominal(); n.review.reviews[0].criticalCodes = ['fabricated_evidence']; const result = consolidate(n); assert.equal(result.pertinentAndJustified, 30); assert.ok(result.blockers.includes('critical_violation'));
});
test('ES-44 missing review, duplicate/case-varied reviewer, author reviewer and LLM reviewer cannot approve', () => {
  for (const edit of [n => n.review.reviews.pop(), n => n.review.reviews[1].reviewerId = n.review.reviews[0].reviewerId.toLowerCase(), n => n.review.reviews[0].reviewerId = 'dev-codex', n => n.review.reviews[0].kind = 'agent']) { const n = nominal(); edit(n); assert.equal(consolidate(n).status, 'blocked'); }
});
test('ES-44 disagreements require a separate tech lead and bound resolution; cannot override a critical finding', () => {
  const n = nominal(); n.review.reviews[0].pertinent = false; assert.equal(consolidate(n).pending, 1);
  const row = n.report.cases[0]; n.review.resolutions.push({ caseId: row.caseId, resolverId: 'TEST_ONLY_LEAD', role: 'tech_lead', reference: 'TEST_ONLY_RESOLUTION', reason: 'TEST_ONLY_REASON', outputHash: hash(row), pertinent: true, justified: true }); assert.equal(consolidate(n).pending, 0);
  n.review.reviews[0].criticalCodes = ['private_data_exposure']; assert.equal(consolidate(n).status, 'blocked');
});
test('ES-44 changed corpus, rubric, run output or unknown controls invalidate approval bindings', () => {
  for (const edit of [n => n.corpus.cases[0].scenario += ' changed', n => n.rubric.dimensions[0].es += ' changed', n => n.report.cases[0].samples.push('changed'), n => n.report.cases[0].controls[0].id = 'unknown_control']) { const n = nominal(); edit(n); assert.equal(consolidate(n).status, 'blocked'); }
});
test('ES-44 incomplete run, pending routes, mock relabeled as provider, missing QA and malformed files remain blocked', () => {
  for (const edit of [n => n.report.cases.pop(), n => n.report.cases[0].pendingStages = ['routes'], n => n.report.simulatedProviderCalls = 1, n => n.review.qa = null, n => n.report.cases = null, n => n.review.reviews = null]) { const n = nominal(); edit(n); assert.equal(consolidate(n).status, 'blocked'); }
});
test('ES-44 a report cannot erase a pending stage declared in the corpus', () => {
  const n = nominal(); n.corpus.cases[0].expected.pendingStages = ['routes']; n.report.corpusHash = hash(n.corpus); n.report.cases[0].inputHash = hash(n.corpus.cases[0]);
  n.review.corpusHash = hash(n.corpus); n.review.runHash = hash(n.report); n.review.reviews.filter(r => r.caseId === n.corpus.cases[0].caseId).forEach(r => { r.outputHash = hash(n.report.cases[0]); }); assert.equal(consolidate(n).status, 'blocked');
});
