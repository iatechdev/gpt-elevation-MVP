const { define, integer, string, encrypted, command } = require('./utils/careerPlanModels');
module.exports = define('CareerReminder', { planVersionId: integer(), actionKey: string(24), status: string(12), payload: encrypted(), ...command() }, [
  { name: 'career_reminder_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'career_reminder_one_active', unique: true, fields: ['UserId', 'planVersionId', 'actionKey'], where: { status: 'active' } },
]);
