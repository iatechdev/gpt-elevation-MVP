import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwordService";

describe("Password Service", () => {
  it("hashes passwords correctly", async () => {
    const plaintext = "MiClaveSecreta123!";
    const hash = await hashPassword(plaintext);
    
    expect(hash).not.toBe(plaintext);
    expect(hash.startsWith("$2b$12$") || hash.startsWith("$2a$12$")).toBe(true);
  });

  it("verifies correct passwords", async () => {
    const plaintext = "OtraClaveSegura456";
    const hash = await hashPassword(plaintext);
    
    const isValid = await verifyPassword(plaintext, hash);
    expect(isValid).toBe(true);
  });

  it("rejects incorrect passwords", async () => {
    const plaintext = "ClaveOriginal";
    const hash = await hashPassword(plaintext);
    
    const isValid = await verifyPassword("ClaveEquivocada", hash);
    expect(isValid).toBe(false);
  });
});
