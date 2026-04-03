import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { encryptEmail, decryptEmail, isEncryptedEmail } from "./emailEncryption";

describe("Email Encryption Service", () => {
  const originalEnv = process.env.EMAIL_ENCRYPTION_KEY;

  beforeEach(() => {
    // 32 bytes (64 hex chars) key for testing
    process.env.EMAIL_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    process.env.EMAIL_ENCRYPTION_KEY = originalEnv;
  });

  it("encrypts and decrypts an email address", () => {
    const email = "usuario@test.com";
    const encrypted = encryptEmail(email);
    
    expect(encrypted).not.toBe(email);
    expect(isEncryptedEmail(encrypted)).toBe(true);
    
    const decrypted = decryptEmail(encrypted);
    expect(decrypted).toBe(email);
  });

  it("produces different ciphertexts for the same email (random IV)", () => {
    const email = "seguro@test.com";
    const encrypted1 = encryptEmail(email);
    const encrypted2 = encryptEmail(email);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptEmail(encrypted1)).toBe(email);
    expect(decryptEmail(encrypted2)).toBe(email);
  });

  it("identifies plain text as non-encrypted", () => {
    expect(isEncryptedEmail("usuario@test.com")).toBe(false);
    expect(isEncryptedEmail("invalid:format")).toBe(false);
    expect(isEncryptedEmail("not:hex:values")).toBe(false);
  });

  it("throws error when trying to decrypt tampered data", () => {
    const email = "tamper@test.com";
    const encrypted = encryptEmail(email);
    
    // Modify the ciphertext part
    const parts = encrypted.split(":");
    parts[2] = "0000000000000000"; // Fake ciphertext
    const tampered = parts.join(":");
    
    expect(() => decryptEmail(tampered)).toThrow();
  });
});
