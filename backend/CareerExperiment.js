const { define, integer, command } = require('./utils/careerPlanModels');
module.exports = define('CareerExperiment', { choiceId: integer(), currentVersion: integer(), ...command() }, [
  { name: 'career_experiment_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'career_experiment_owner_id', unique: true, fields: ['UserId', 'id'] },
]);
