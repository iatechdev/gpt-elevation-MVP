const countries = new Set(require('../../shared/participantCountries.json'));
const fields = {
  preferredLanguage: value => value === 'es' || value === 'en',
  residenceCountry: value => countries.has(value),
  targetMarket: value => countries.has(value),
  timeZone: value => {
    if (typeof value !== 'string' || value.length > 64 || (value !== 'UTC' && !value.includes('/'))) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  },
  profession: value => typeof value === 'string' && value.length <= 120,
  interests: value => typeof value === 'string' && value.length <= 500,
  availabilityMinutesPerWeek: value => Number.isInteger(value) && value >= 0 && value <= 10080,
  careerGoal: value => typeof value === 'string' && value.length <= 500,
  careerConstraints: value => typeof value === 'string' && value.length <= 500,
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validateContextRequest(body) {
  if (!object(body) || Object.keys(body).some(key => !['schemaVersion', 'expectedVersion', 'action', 'context'].includes(key))
    || body.schemaVersion !== 1 || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0
    || !['save_draft', 'continue'].includes(body.action) || !object(body.context)) return { error: 'invalid_request' };
  const errors = Object.keys(body.context).filter(key => !Object.hasOwn(fields, key));
  const context = {};
  for (const [key, check] of Object.entries(fields)) {
    const value = body.context[key];
    if (value === undefined || (value !== null && !check(value))) errors.push(key);
    else context[key] = typeof value === 'string' ? value.trim() || null : value;
  }
  if (body.action === 'continue' && !context.preferredLanguage) errors.push('preferredLanguage');
  return errors.length ? { error: 'invalid_context', fields: [...new Set(errors)].filter(key => Object.hasOwn(fields, key)) } : { context };
}
module.exports = { validateContextRequest };
