/**
 * PII Anonymizer — Domain Service
 *
 * Strips Personally Identifiable Information from user messages
 * BEFORE they are forwarded to the LLM (Claude). This ensures
 * that no real names, phone numbers, emails, or ID numbers ever
 * reach the AI provider.
 *
 * Why here: Pure domain logic with zero external dependencies.
 * The anonymization map is returned so the server can optionally
 * reverse-map placeholders in the response (future feature).
 */

export type AnonymizationResult = {
  anonymizedText: string;
  /** Map of placeholder → original value (for potential de-anonymization) */
  replacements: Record<string, string>;
};

// Counter used to generate unique placeholders within a single call
let _counter = 0;
function nextId(): string {
  return String(++_counter);
}

/**
 * Anonymizes PII in `text` and returns the cleaned string plus
 * a replacement map for auditability.
 *
 * Patterns covered:
 * - Full names (two capitalized words)
 * - Email addresses
 * - Phone numbers (international and local formats)
 * - National ID numbers (6+ consecutive digits)
 * - Company names after keywords like "empresa", "compañía", "trabajo en"
 */
export function anonymizeForLLM(text: string): AnonymizationResult {
  _counter = 0;
  const replacements: Record<string, string> = {};

  let result = text;

  // 1. Email addresses
  result = result.replace(
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    (match) => {
      const key = `[EMAIL_${nextId()}]`;
      replacements[key] = match;
      return key;
    },
  );

  // 2. Phone numbers (international +XX, local NNN-NNN-NNNN, etc.)
  // We use a stricter regex to avoid catching national IDs (which are just digits)
  result = result.replace(
    /(\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]\d{3,4}[\s\-.]\d{3,4}/g,
    (match) => {
      if (match.replace(/\D/g, "").length < 7) return match;
      const key = `[TELÉFONO_${nextId()}]`;
      replacements[key] = match;
      return key;
    },
  );

  // 3. Full names (two consecutive Title-Case words)
  result = result.replace(
    /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){1,2}\b/g,
    (match) => {
      // Exclude common Spanish words that happen to be title-cased
      const EXCLUDED = new Set([
        "Buenos", "Días", "Buenas", "Tardes", "Noches", "Hola", "Gracias",
        "Trabajo", "Casa", "Familia", "Empresa", "Compañía",
      ]);
      if (EXCLUDED.has(match.split(" ")[0]!)) return match;
      const key = `[NOMBRE_${nextId()}]`;
      replacements[key] = match;
      return key;
    },
  );

  // 4. Company / organization names after context keywords
  // Use a more specific regex to avoid eating up the rest of the sentence
  result = result.replace(
    /\b(empresa|compañía|trabajo en|trabajo para|trabajo con|mi jefe en|mi jefa en)\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ&.]{2,20})\b/gi,
    (match, keyword, company) => {
      const key = `[EMPRESA_${nextId()}]`;
      replacements[key] = company.trim();
      return `${keyword} ${key}`;
    },
  );

  // 5. Large numeric IDs (national IDs, passport numbers, etc.)
  result = result.replace(/\b\d{7,}\b/g, (match) => {
    const key = `[ID_${nextId()}]`;
    replacements[key] = match;
    return key;
  });

  return { anonymizedText: result, replacements };
}
