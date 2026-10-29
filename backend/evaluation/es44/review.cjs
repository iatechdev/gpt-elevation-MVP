const fs = require('node:fs'); const path = require('node:path');
const { consolidate } = require('./consolidate.cjs');
function readArtifact(name) {
  if (typeof name !== 'string' || !/^(validate|mock|integration|provider)-[a-f0-9-]{36}\.(run|review-template|reviews)\.json$/.test(name)) throw new Error('invalid_artifact_name');
  const target = path.join(__dirname, 'reports', name);
  if (fs.statSync(target).size > 2 * 1024 * 1024) throw new Error('artifact_too_large');
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}
if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('two_artifact_names_required');
    const result = consolidate({ corpus: require('./corpus.json'), rubric: require('./rubric.json'), report: readArtifact(process.argv[2]), review: readArtifact(process.argv[3]) });
    console.log(JSON.stringify(result)); if (result.status === 'blocked') process.exitCode = 1;
  } catch { console.error('invalid_review_artifacts'); process.exitCode = 1; }
}
module.exports = { readArtifact };
