const policy = require('../../shared/registration-password-policy.json');
const common = new Set(policy.common);
function validRegistrationPassword(value) {
  return typeof value === 'string' && [...value].length >= policy.minCharacters
    && Buffer.byteLength(value, 'utf8') <= policy.maxUtf8Bytes && value.trim().length > 0
    && !common.has(value.trim().toLowerCase());
}
module.exports = { validRegistrationPassword, policy };
