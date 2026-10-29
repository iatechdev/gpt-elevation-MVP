const { randomUUID } = require('node:crypto');
const { hash, validateCorpus, validateRubric } = require('./validate.cjs');
async function run({ corpus, rubric, mode = 'validate', adapter, maxCases = 30, maxCalls = 120 }) {
  const validation = validateCorpus(corpus);
  if (!validation.valid || !validateRubric(rubric)) throw new Error('invalid_evaluation_inputs');
  if (!['validate', 'mock', 'integration'].includes(mode)) throw new Error('provider_execution_not_authorized');
  if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 30 || !Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 120) throw new Error('invalid_run_limits');
  if (mode === 'integration' && !adapter) throw new Error('integration_adapter_required');
  const started = Date.now();
  const report = { schemaVersion: 1, runId: randomUUID(), mode, synthetic: true, startedAt: new Date().toISOString(), corpusHash: hash(corpus), rubricHash: hash(rubric), metadata: adapter?.metadata || { provider: 'none', model: null }, limits: { maxCases, maxCalls }, cases: [], providerCalls: 0, tokens: null, cost: null, stopReason: null, releaseStatus: 'not_approved' };
  let halted = false;
  for (const c of corpus.cases) {
    if (halted || report.cases.filter(r => r.status !== 'not_run').length >= maxCases) { report.cases.push({ caseId: c.caseId, inputHash: hash(c), status: 'not_run', controls: [], pendingStages: c.expected.pendingStages }); continue; }
    if (mode !== 'integration') {
      report.cases.push({ caseId: c.caseId, inputHash: hash(c), status: mode === 'mock' ? 'simulated' : 'validated', controls: c.expected.controls.map(id => ({ id, status: 'not_run' })), pendingStages: c.expected.pendingStages }); continue;
    }
    const before = Date.now();
    try {
      const result = await adapter.runCase(c, { maxCalls });
      const ids = result.controls.map(control => control.id);
      if (new Set(ids).size !== ids.length || ids.some(id => !c.expected.controls.includes(id)) || result.controls.some(x => !['passed', 'failed'].includes(x.status)) || (ids.length !== c.expected.controls.length && !result.controls.some(x => x.status === 'failed'))) throw new Error('invalid_adapter_result');
      const failed = result.controls.some(x => x.status === 'failed');
      report.cases.push({ caseId: c.caseId, inputHash: hash(c), status: failed ? 'failed' : c.expected.pendingStages.length ? 'pending' : 'passed', controls: result.controls, pendingStages: c.expected.pendingStages, durationMs: Date.now() - before, samples: result.samples || [] });
      if (failed) { halted = true; report.stopReason = 'control_failed'; }
    } catch (error) {
      report.cases.push({ caseId: c.caseId, inputHash: hash(c), status: 'failed', controls: [], pendingStages: c.expected.pendingStages, errorCode: error.code === 'call_limit' ? 'call_limit' : 'adapter_failed' });
      halted = true; report.stopReason = error.code === 'call_limit' ? 'call_limit' : 'adapter_failed';
    }
  }
  if (adapter) { const usage = await adapter.usage(); Object.assign(report, usage); }
  report.durationMs = Date.now() - started;
  report.summary = Object.fromEntries(['validated', 'simulated', 'passed', 'pending', 'failed', 'not_run'].map(status => [status, report.cases.filter(c => c.status === status).length]));
  return report;
}
module.exports = { run };
