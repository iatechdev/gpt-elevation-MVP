const fs = require('node:fs'); const path = require('node:path');
const { run } = require('./run.cjs'); const { hash } = require('./validate.cjs');
const { reviewTemplate, consolidate } = require('./consolidate.cjs');
async function main(args) {
  if (args.some(arg => !/^--(mode=(validate|mock|integration|provider)|max-cases=\d{1,2}|max-calls=\d{1,3})$/.test(arg)) || new Set(args.map(arg => arg.split('=')[0])).size !== args.length) throw new Error('invalid_arguments');
  const option = key => args.find(arg => arg.startsWith(`--${key}=`))?.split('=')[1];
  const mode = option('mode') || 'validate';
  if (mode === 'provider') throw new Error('provider_execution_not_authorized');
  const corpus = require('./corpus.json'); const rubric = require('./rubric.json'); let adapter;
  try {
    if (mode === 'integration') adapter = await require('./local-adapter.cjs').createAdapter();
    const report = await run({ corpus, rubric, mode, adapter, maxCases: Number(option('max-cases') || 30), maxCalls: Number(option('max-calls') || 120) });
    const review = reviewTemplate(corpus, rubric, report); const result = consolidate({ corpus, rubric, report, review });
    const root = path.join(__dirname, 'reports'); fs.mkdirSync(root, { recursive: true });
    const prefix = `${mode}-${report.runId}`;
    for (const [suffix, data] of [['run', report], ['review-template', review], ['gate', result]]) fs.writeFileSync(path.join(root, `${prefix}.${suffix}.json`), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ mode, reportHash: hash(report), summary: report.summary, realProviderCalls: report.providerCalls, simulatedProviderCalls: report.simulatedProviderCalls || 0, gate: result.status, blockers: result.blockers, artifacts: `evaluation/es44/reports/${prefix}.*.json` }));
    if (report.summary.failed || report.summary.not_run) process.exitCode = 1;
  } finally { if (adapter) await adapter.close(); }
}
if (require.main === module) main(process.argv.slice(2)).then(() => { if (process.exitCode) process.exit(process.exitCode); }).catch(error => { console.error(['invalid_arguments', 'invalid_run_limits', 'provider_execution_not_authorized', 'local_evaluation_only'].includes(error.message) ? error.message : 'evaluation_failed'); process.exit(1); });
module.exports = { main };
