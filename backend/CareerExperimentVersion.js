const { define, integer, string, encrypted, command } = require('./utils/careerPlanModels');
module.exports = define('CareerExperimentVersion', { experimentId: integer(), version: integer(), lifecycle: string(16), payload: encrypted(), basisHash: string(64), ...command() }, [
  { name: 'career_experiment_version', unique: true, fields: ['experimentId', 'version'] },
  { name: 'career_experiment_version_request', unique: true, fields: ['UserId', 'requestId'] },
]);
