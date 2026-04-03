import { describe, expect, it } from "vitest";
import { detectCrisis } from "./crisisDetector";

describe("Crisis Detector", () => {
  it("detects high severity crisis keywords", () => {
    const text = "A veces pienso que no tiene sentido vivir y quiero acabar con todo.";
    const result = detectCrisis(text);
    
    expect(result.severity).toBe("high");
    expect(result.resource).toContain("Líneas de crisis disponibles 24/7");
    expect(result.resource).toContain("SAPTEL");
  });

  it("detects medium severity crisis keywords", () => {
    const text = "Siento que no puedo más y a veces quiero hacerme daño.";
    const result = detectCrisis(text);
    
    expect(result.severity).toBe("medium");
    expect(result.resource).toContain("Línea de apoyo emocional");
  });

  it("returns null for non-crisis messages", () => {
    const text = "Hoy tuve un día muy estresante en el trabajo y me siento cansado.";
    const result = detectCrisis(text);
    
    expect(result.severity).toBeNull();
    expect(result.resource).toBe("");
  });
});
