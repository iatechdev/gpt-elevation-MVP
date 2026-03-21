/**
 * Tests for PromptVaultService
 * HU-028: Validates encryption, decryption, and cache behavior
 *
 * Run: pnpm test (or pnpm vitest run)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptPrompt,
  decryptPrompt,
  validatePromptVaultConfig,
  invalidatePromptCache,
  clearPromptCache,
} from "./promptVaultService";

// Use a valid test key (64-char hex = 32 bytes)
const TEST_KEY = "a".repeat(64);

describe("PromptVaultService — encryption", () => {
  beforeEach(() => {
    process.env.PROMPT_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.PROMPT_ENCRYPTION_KEY;
    clearPromptCache();
  });

  it("encrypts a prompt and returns iv:authTag:ciphertext format", () => {
    const plaintext = "Eres un acompa\u00f1ante de reflexi\u00f3n basado en ACT.";
    const encrypted = encryptPrompt(plaintext);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    parts.forEach(p => expect(p).toMatch(/^[0-9a-f]+$/i));
  });

  it("decrypts back to the original plaintext", () => {
    const plaintext = "Protocolo de crisis: si detectas riesgo, activa el protocolo.";
    const encrypted = encryptPrompt(plaintext);
    const decrypted = decryptPrompt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("each encryption produces a different ciphertext (random IV)", () => {
    const plaintext = "Mismo texto, diferente resultado cada vez.";
    const enc1 = encryptPrompt(plaintext);
    const enc2 = encryptPrompt(plaintext);
    expect(enc1).not.toBe(enc2); // different IV each time
    expect(decryptPrompt(enc1)).toBe(plaintext); // both decrypt correctly
    expect(decryptPrompt(enc2)).toBe(plaintext);
  });

  it("throws on tampered ciphertext (GCM auth tag fails)", () => {
    const encrypted = encryptPrompt("contenido del prompt");
    const [iv, tag, cipher] = encrypted.split(":");
    // Flip a byte in the ciphertext
    const tampered = iv + ":" + tag + ":" + "ff" + cipher!.slice(2);
    expect(() => decryptPrompt(tampered)).toThrow();
  });

  it("throws on invalid encrypted format", () => {
    expect(() => decryptPrompt("not-a-valid-format")).toThrow(
      "[PromptVault] Invalid encrypted format"
    );
  });

  it("throws if PROMPT_ENCRYPTION_KEY is missing", () => {
    delete process.env.PROMPT_ENCRYPTION_KEY;
    expect(() => encryptPrompt("test")).toThrow("PROMPT_ENCRYPTION_KEY");
  });

  it("throws if PROMPT_ENCRYPTION_KEY is wrong length", () => {
    process.env.PROMPT_ENCRYPTION_KEY = "tooshort";
    expect(() => validatePromptVaultConfig()).toThrow("PROMPT_ENCRYPTION_KEY");
  });

  it("cache invalidation removes the key from cache", () => {
    // Just tests the function doesn't throw — full cache test requires DB mock
    expect(() => invalidatePromptCache("act_base")).not.toThrow();
    expect(() => clearPromptCache()).not.toThrow();
  });
});
