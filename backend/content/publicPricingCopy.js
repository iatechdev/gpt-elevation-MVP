const legacy = require('./legacyPricingCopy.json');
const reviewed = require('./reviewedPricingCopy');
// Read-only compatibility for the exact old seed. Custom admin edits remain authoritative.
// Prices, names, periods, highlighting and entitlements never pass through this fallback.
module.exports = row => {
  const value = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  if (!Object.hasOwn(legacy, value.slug) || !Object.hasOwn(reviewed, value.slug)) return value;
  for (const field of Object.keys(reviewed[value.slug])) {
    if (JSON.stringify(value[field]) === JSON.stringify(legacy[value.slug][field])) value[field] = reviewed[value.slug][field];
  }
  return value;
};
