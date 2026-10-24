// Signing and verification must use the same explicitly configured secret.
const JWT_SECRET = process.env.JWT_SECRET;
if (typeof JWT_SECRET !== 'string' || !JWT_SECRET.trim()) {
  throw new Error('JWT_SECRET must be configured before starting the backend.');
}

module.exports = JWT_SECRET;
