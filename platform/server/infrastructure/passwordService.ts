/**
 * Password Service — Infrastructure Layer
 *
 * Wraps bcryptjs to provide a stable interface for hashing and
 * verifying passwords. Using bcrypt with a cost factor of 12
 * satisfies OWASP A02 (Cryptographic Failures) requirements.
 *
 * Why infrastructure: depends on an external library (bcryptjs).
 * Domain code calls this service through its interface, never
 * importing bcryptjs directly (Dependency Inversion).
 */

import bcrypt from "bcryptjs";

/** Cost factor for bcrypt. 12 is the recommended minimum for 2024+. */
const BCRYPT_ROUNDS = 12;

/**
 * Hashes a plaintext password.
 * Never store the raw password — only the returned hash.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 * Returns true only if they match.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
