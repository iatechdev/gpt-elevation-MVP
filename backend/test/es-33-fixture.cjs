// DTOs sintéticos de los contratos ES-14/ES-32 pendientes. No disponibles en runtime.
const context = () => ({ version: 1, weeklyMinutes: 60, timeZone: 'America/Bogota', locale: 'es' });
const route = () => ({ roleKey: 'synthetic_training', tasks: [{ text: { es: '[SINTÉTICO] Preparar una explicación.', en: '[SYNTHETIC] Prepare an explanation.' }, aiExposure: { status: 'unknown' } }], regulated: { isRegulated: false },
  resources: [{ resourceKey: 'synthetic_reading', roleKeys: ['synthetic_training'], linkedSkillKey: 'communication', title: '[SYNTHETIC]', url: 'https://example.org/synthetic', duration: { minutes: 20 }, price: { published: false }, language: 'es' }] });
function proposalInput() { return { choiceId: 1, route: route(), taskIndex: 0, minutes: 20, context: context(), basisHash: 'a'.repeat(64) }; }
function decided() {
  const rules = require('../utils/careerPlanRules');
  let value = rules.experimentProposal(proposalInput());
  value = rules.changeExperiment(value, { action: 'start' });
  value = rules.changeExperiment(value, { action: 'submit', sample: 'SYNTHETIC SAMPLE', evidenceRefs: [], assistance: 'drafting' });
  value = rules.changeExperiment(value, { action: 'reflect', observation: 'Synthetic observation', interpretation: 'Synthetic interpretation' });
  return rules.changeExperiment(value, { action: 'decide', decision: 'continue', reason: 'Synthetic reason' });
}
const selections = () => [7, 30, 90].map((days, i) => ({ actionKey: `step_${days}`, chosenDate: ['2026-11-03', '2026-11-17', '2027-01-05'][i], estimatedMinutes: 20, resourceRefs: [] }));
module.exports = { context, route, proposalInput, decided, selections };
