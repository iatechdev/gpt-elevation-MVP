const { define, integer, string, encrypted, command } = require('./utils/careerPlanModels');
module.exports = define('CareerPlanVersion', { experimentId: integer(), version: integer(), status: string(16), payload: encrypted(), basisHash: string(64), ...command() }, [
  { name: 'career_plan_version', unique: true, fields: ['experimentId', 'version'] },
  { name: 'career_plan_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'career_plan_one_accepted', unique: true, fields: ['experimentId'], where: { status: 'accepted' } },
]);
