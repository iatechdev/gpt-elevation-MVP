/**
 * Crisis Detector — Domain Service
 *
 * Classifies incoming messages by crisis severity and returns the
 * appropriate regional support resource. This logic lives in the
 * domain layer because it encodes pure business rules with no
 * external dependencies.
 *
 * Severity levels:
 *   "high"   — immediate risk to life; bypass LLM entirely
 *   "medium" — distress signals; add support note alongside LLM response
 *   null     — no crisis detected
 */

export type CrisisSeverity = "high" | "medium" | null;

export type CrisisDetectionResult = {
  severity: CrisisSeverity;
  resource: string;
};

// ─── Keyword lists ────────────────────────────────────────────────────────────

const HIGH_RISK_KEYWORDS: readonly string[] = [
  "suicid",
  "matarme",
  "quitarme la vida",
  "no quiero vivir",
  "acabar con todo",
  "no tiene sentido vivir",
  "mejor muerto",
  "mejor muerta",
  "quiero morir",
  "deseo morir",
];

const MEDIUM_RISK_KEYWORDS: readonly string[] = [
  "hacerme daño",
  "autolesion",
  "cortarme",
  "lastimarme",
  "no puedo más",
  "desaparecer",
  "no aguanto",
  "todo está perdido",
  "ya no puedo",
  "me quiero hacer daño",
];

// ─── Regional crisis resources ────────────────────────────────────────────────

const CRISIS_RESOURCE_HIGH =
  "Líneas de crisis disponibles 24/7:\n" +
  "• Colombia: 106 (Línea 106)\n" +
  "• México: 800-290-0024 (SAPTEL)\n" +
  "• Argentina: 135 (Centro de Asistencia al Suicida)\n" +
  "• España: 024\n" +
  "• Internacional: https://findahelpline.com";

const CRISIS_RESOURCE_MEDIUM =
  "Línea de apoyo emocional:\n" +
  "• Colombia: 106\n" +
  "• México: 800-290-0024 (SAPTEL)\n" +
  "• Argentina: 135\n" +
  "• España: 024";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyzes `text` for crisis indicators.
 * Returns severity level and the appropriate resource string.
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  const lower = text.toLowerCase();

  if (HIGH_RISK_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { severity: "high", resource: CRISIS_RESOURCE_HIGH };
  }

  if (MEDIUM_RISK_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { severity: "medium", resource: CRISIS_RESOURCE_MEDIUM };
  }

  return { severity: null, resource: "" };
}
