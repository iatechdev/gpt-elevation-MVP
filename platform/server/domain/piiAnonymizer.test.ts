import { describe, expect, it } from "vitest";
import { anonymizeForLLM } from "./piiAnonymizer";

describe("PII Anonymizer", () => {
  it("anonymizes email addresses", () => {
    const text = "Hola, mi correo es juan.perez@ejemplo.com.mx y necesito ayuda.";
    const result = anonymizeForLLM(text);
    
    expect(result.anonymizedText).not.toContain("juan.perez@ejemplo.com.mx");
    expect(result.anonymizedText).toContain("[EMAIL_1]");
    expect(result.replacements["[EMAIL_1]"]).toBe("juan.perez@ejemplo.com.mx");
  });

  it("anonymizes phone numbers", () => {
    const text = "Llámame al +52 55 1234 5678 o al 300-123-4567";
    const result = anonymizeForLLM(text);
    
    expect(result.anonymizedText).not.toContain("+52 55 1234 5678");
    expect(result.anonymizedText).not.toContain("300-123-4567");
    expect(result.anonymizedText).toContain("[TELÉFONO_1]");
    expect(result.anonymizedText).toContain("[TELÉFONO_2]");
  });

  it("anonymizes full names but ignores common words", () => {
    const text = "Buenos Días, me llamo Carlos Andrés Ruiz y trabajo con María Gómez.";
    const result = anonymizeForLLM(text);
    
    expect(result.anonymizedText).toContain("Buenos Días"); // Ignored
    expect(result.anonymizedText).not.toContain("Carlos Andrés Ruiz");
    expect(result.anonymizedText).not.toContain("María Gómez");
    expect(result.anonymizedText).toContain("[NOMBRE_1]");
    expect(result.anonymizedText).toContain("[NOMBRE_2]");
  });

  it("anonymizes company names after context keywords", () => {
    const text = "Estoy estresado porque trabajo en Microsoft y mi jefa en Apple me presiona.";
    const result = anonymizeForLLM(text);
    
    expect(result.anonymizedText).not.toContain(" Microsoft");
    expect(result.anonymizedText).not.toContain(" Apple");
    expect(result.anonymizedText).toContain("trabajo en [EMPRESA_1]");
    expect(result.anonymizedText).toContain("mi jefa en [EMPRESA_2]");
  });

  it("anonymizes national ID numbers", () => {
    const text = "Mi número de cédula es 1020304050.";
    const result = anonymizeForLLM(text);
    
    expect(result.anonymizedText).not.toContain("1020304050");
    expect(result.anonymizedText).toContain("[ID_1]");
  });
});
