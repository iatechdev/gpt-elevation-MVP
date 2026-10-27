// backend/utils/aiProposals.js
// Utilidades comunes de las propuestas de la IA (ES-28). Contrato: docs/elevation-skillmap/22-CONTRATO-PROPUESTAS-IA.md.
// La IA solo PROPONE borradores. Todo pasa por callClaude (presupuesto, tiempo de espera y registro sin contenido de ES-22). El texto de la
// persona entra siempre dentro de un bloque delimitado como dato no confiable. La salida es JSON que se valida; lo inválido se descarta.

const anthropic = require('./anthropic');
const { callClaude, AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('./aiClient');
const { textOf } = require('./claudeText');
const { normalizeText } = require('./promptSafety');

class ProposalError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalidOutput = () => new ProposalError(502, 'invalid_model_output', 'La propuesta no es válida. Inténtalo de nuevo.', 'The proposal is not valid. Try again.');

// Llama a Claude y devuelve el JSON de la respuesta. Un JSON roto es una salida inválida (502 reintentable), nunca un 500.
async function askForJson({ userId, kind, prompt, maxTokens }) {
  const message = await callClaude({
    userId, kind, body: { model: anthropic.MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
  });
  try {
    return JSON.parse(textOf(message).replace(/```json|```/g, '').trim());
  } catch {
    throw invalidOutput();
  }
}

// Normaliza para comparar citas y números: sin acentos de control, espacios colapsados y minúsculas.
const flat = (s) => normalizeText(String(s)).replace(/\s+/g, ' ').toLowerCase();
const appearsIn = (needle, haystack) => { const n = flat(needle); return n.length > 0 && flat(haystack).includes(n); };

// Números de un texto sin separadores de miles ni espacios («10.000» = «10,000» = «10000»).
const numbersOf = (text) => new Set((String(text).match(/\d[\d.,]*/g) || []).map((n) => n.replace(/[.,\s]/g, '').replace(/^0+(?=\d)/, '')).filter(Boolean));

// Filtro de la SALIDA del modelo: sin diagnóstico, prescripción ni empleabilidad, y ningún porcentaje que la persona no haya escrito.
// Es un filtro por palabras, limitado: no entiende el sentido de una frase.
const FORBIDDEN = /empleabilidad|employab|diagn[oó]stic|diagnos|prescrib|prescripci|medicaci|medication|trastorno|disorder/i;
function outputIsClean(texts, sourceText) {
  const joined = texts.join(' | ');
  if (FORBIDDEN.test(joined)) return false;
  const source = flat(sourceText).replace(/\s+/g, '');
  return (joined.match(/\d+(?:[.,]\d+)?\s*%/g) || []).every((p) => source.includes(flat(p).replace(/\s+/g, '')));
}

// Respuesta HTTP común de las rutas de propuestas. Devuelve true si manejó el error.
function respondError(res, error) {
  if (error instanceof ProposalError) {
    const body = { code: error.code, error: error.message };
    if (error.warnings) body.warnings = error.warnings;
    res.status(error.status).json(body);
    return true;
  }
  if (error instanceof AiBudgetExhaustedError) {
    res.status(429).json({ code: 'ai_budget_exhausted', error: 'Límite de uso de IA alcanzado. / AI usage limit reached.', scope: error.scope, resetsAt: error.resetsAt });
    return true;
  }
  if (error instanceof AiBudgetNotConfiguredError) {
    res.status(503).json({ code: 'ai_budget_not_configured', error: 'IA no disponible por ahora. / AI not available right now.' });
    return true;
  }
  if (error && error.code === 'provider_unavailable') {
    console.error('Error del proveedor de IA (propuestas):', error.errorCode || error.code);
    res.status(502).json({ code: 'provider_unavailable', retryable: true, error: 'No se pudo generar la propuesta ahora. / Could not generate the proposal right now.' });
    return true;
  }
  return false;
}

module.exports = { ProposalError, invalidOutput, askForJson, flat, appearsIn, numbersOf, outputIsClean, respondError };
