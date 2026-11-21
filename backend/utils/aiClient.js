// backend/utils/aiClient.js
// Única puerta de salida hacia el proveedor de IA (ES-22): reserva de presupuesto, tiempo de espera y reintentos acotados,
// registro de uso sin contenido y liberación de la reserva si la llamada falla.

const anthropic = require('./anthropic');
const { stripInvisible } = require('./promptSafety');
const AiUsage = require('../AiUsage');
const pricingDefault = require('../config/aiPricing.json');
const {
  readConfig, periodKey, estimateTokens, reserve, settle, release,
  AiBudgetNotConfiguredError, AiBudgetExhaustedError,
} = require('./aiBudget');

class AiProviderError extends Error {
  constructor(errorCode) {
    super('El proveedor de IA no respondió correctamente.'); // sin texto del proveedor: podría contener contenido
    this.code = 'provider_unavailable';
    this.errorCode = errorCode;
  }
}

// Clasificación por estado o tipo de error; nunca se guarda el mensaje del proveedor.
function classifyError(error) {
  const status = error && Number(error.status);
  if (status === 429) return 'rate_limited';
  if (status === 408 || (error && /timeout/i.test(`${error.name || ''} ${error.constructor?.name || ''}`))) return 'timeout';
  if ([500, 502, 503, 504, 529].includes(status)) return 'provider_unavailable';
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401 || status === 403) return 'provider_auth';
  return 'unknown';
}

// Costo en millonésimas de la moneda del precio; solo con un precio versionado, completo y verificado. Si no, null.
function computeCost(model, inputTokens, outputTokens, pricing = pricingDefault, now = new Date()) {
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
  const filled = (value) => typeof value === 'string' && value.trim().length > 0;
  const price = (pricing.prices || []).find((entry) => entry
    && entry.model === model
    && ['version', 'currency', 'source', 'verifiedBy', 'verifiedAt'].every((key) => filled(entry[key]))
    && Number.isFinite(entry.inputPerMTok) && entry.inputPerMTok >= 0
    && Number.isFinite(entry.outputPerMTok) && entry.outputPerMTok >= 0
    && Date.parse(entry.verifiedAt) <= now.getTime());
  if (!price) return null;
  return {
    costMicros: Math.round(inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok),
    currency: price.currency,
    priceVersion: price.version,
  };
}

// Código corto del proveedor (end_turn, max_tokens...). Solo se guarda si parece un código: nunca texto libre.
function stopReasonOf(message) {
  const reason = message?.stop_reason;
  return typeof reason === 'string' && /^[a-z_]{1,24}$/.test(reason) ? reason : null;
}

const safe = async (fn) => {
  try { await fn(); } catch (error) { console.error('⚠️ Registro de uso de IA no guardado:', error.code || error.name); }
};

// ES-287: ÚLTIMA barrera antes del proveedor, para TODOS los flujos (chat, recomendaciones, análisis, fuentes, resumen): se quitan los caracteres invisibles
// (incluido el bloque Tags U+E0000–E007F y los selectores suplementarios) de TODO texto del cuerpo: `system`, mensajes, bloques anidados (tool_result → content → text),
// `tool_use.input` (valores y claves) y cualquier otro campo de texto. El texto visible no cambia. Devuelve una copia: no toca el objeto de quien llama.
// FALLA CERRADO (QA-416-01/02): no hay un «nivel a partir del cual se deja pasar». Se recorre en profundidad con un tope ALTO (64 niveles); si el cuerpo lo supera, o tiene un ciclo,
// se RECHAZA con AiInputRejectedError (nada llega al proveedor) en vez de dejarlo sin limpiar. Recorrido iterativo: ninguna entrada puede desbordar la pila.
const MAX_CONTENT_DEPTH = 64;
class AiInputRejectedError extends AiProviderError {
  constructor(reason) { super('bad_request'); this.message = 'El contenido enviado a la IA fue rechazado por la barrera de entrada.'; this.reason = reason; } // reason: 'too_deep' | 'cycle'; sin contenido
}
function sanitizeBody(body) {
  const clone = (value) => (Array.isArray(value) ? [] : {});
  const root = clone(body); const ancestors = new Set();
  // Pila explícita con marca de «salida» para saber qué objetos están en el camino actual (ciclo = un ancestro se repite).
  const work = [{ enter: true, source: body, target: root, depth: 0 }];
  while (work.length) {
    const step = work.pop();
    if (!step.enter) { ancestors.delete(step.source); continue; }
    if (step.depth > MAX_CONTENT_DEPTH) throw new AiInputRejectedError('too_deep');
    if (ancestors.has(step.source)) throw new AiInputRejectedError('cycle');
    ancestors.add(step.source); work.push({ enter: false, source: step.source });
    const entries = Array.isArray(step.source) ? step.source.map((v, k) => [k, v]) : Object.entries(step.source);
    for (const [key, value] of entries) {
      const outKey = Array.isArray(step.source) ? key : stripInvisible(key);
      if (typeof value === 'string') step.target[outKey] = stripInvisible(value);
      else if (value && typeof value === 'object') { const child = clone(value); step.target[outKey] = child; work.push({ enter: true, source: value, target: child, depth: step.depth + 1 }); }
      else step.target[outKey] = value;
    }
  }
  return root;
}

// body: { model, max_tokens, system?, messages }. Lanza AiBudgetNotConfiguredError, AiBudgetExhaustedError o AiProviderError.
async function callClaude({ userId, kind, requestId = null, body: rawBody, now = new Date() }) {
  const body = sanitizeBody(rawBody);
  const config = readConfig();
  const estimate = estimateTokens(body);
  const reservation = await reserve(userId, estimate, now); // puede rechazar sin llamar al proveedor
  const startedAt = Date.now();
  let usage = null;
  await safe(async () => {
    usage = await AiUsage.create({
      UserId: userId, kind, requestId, model: body.model, appVersion: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      periodKey: periodKey(now, config.period), status: 'reserved', reservedTokens: estimate,
    });
  });

  let message;
  try {
    // Tiempo de espera y reintentos acotados por llamada (límites duros en readConfig).
    message = await anthropic.messages.create(body, { timeout: config.timeoutMs, maxRetries: config.maxRetries });
  } catch (error) {
    const errorCode = classifyError(error);
    await safe(() => release(reservation));
    if (usage) await safe(() => usage.update({ status: 'failed', errorCode, latencyMs: Date.now() - startedAt }));
    throw new AiProviderError(errorCode);
  }

  const inputTokens = Number(message?.usage?.input_tokens);
  const outputTokens = Number(message?.usage?.output_tokens);
  const known = Number.isFinite(inputTokens) && Number.isFinite(outputTokens);
  // Si el proveedor no informa el uso, la reserva completa se da por consumida (conservador).
  if (known) await safe(() => settle(reservation, inputTokens + outputTokens));
  if (usage) {
    const cost = computeCost(body.model, inputTokens, outputTokens) ?? {};
    await safe(() => usage.update({
      status: 'completed',
      inputTokens: known ? inputTokens : null,
      outputTokens: known ? outputTokens : null,
      costMicros: cost.costMicros ?? null,
      currency: cost.currency ?? null,
      priceVersion: cost.priceVersion ?? null,
      latencyMs: Date.now() - startedAt,
      stopReason: stopReasonOf(message),
    }));
  }
  return message;
}

module.exports = { callClaude, sanitizeBody, AiInputRejectedError, MAX_CONTENT_DEPTH, computeCost, classifyError, AiProviderError, AiBudgetNotConfiguredError, AiBudgetExhaustedError };
