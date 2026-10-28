const { define, integer, string, encrypted, command } = require('./utils/careerPlanModels');
// Solo solicitudes del dueño. No almacena feedback/autor de terceros sin contrato canónico de revisión.
module.exports = define('CareerExperimentReview', { experimentId: integer(), submissionVersion: integer(), status: string(24), payload: encrypted(), ...command() }, [
  { name: 'career_review_request', unique: true, fields: ['UserId', 'requestId'] },
]);
