/**
 * Email Encryption Service — Infrastructure Layer
 *
 * Provides bidirectional AES-256-GCM encryption for email addresses.
 * Unlike hashing, AES-256-GCM allows decryption when needed (e.g.,
 * sending password-reset emails), while keeping the data unreadable
 * at rest in the database.
 *
 * Requirements (OWASP A02):
 * - EMAIL_ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
 * - Each encryption uses a fresh random IV (12 bytes for GCM).
 * - The ciphertext is stored as "iv:authTag:ciphertext" (all hex).
 *
 * Why infrastructure: depends on Node.js crypto module and env config.
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

function getKey(): Buffer {
  const hex = process.env.EMAIL_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts an email address.
 * Returns a string in the format "iv:authTag:ciphertext" (all hex-encoded).
 */
export function encryptEmail(email: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts an email address previously encrypted with `encryptEmail`.
 * Throws if the data has been tampered with (GCM authentication failure).
 */
export function decryptEmail(encryptedValue: string): string {
  const key = getKey();
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted email format");
  }
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted email: wrong IV or tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Returns true if the given string looks like an encrypted email
 * (iv:tag:ciphertext format), false if it is plaintext.
 */
export function isEncryptedEmail(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
