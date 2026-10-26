// backend/utils/aiClient.js
// Única puerta de salida hacia el proveedor de IA (ES-22): reserva de presupuesto, tiempo de espera y reintentos acotados,
// registro de uso sin contenido y liberación de la reserva si la llamada falla.

const anthropic = require('./anthropic');
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

const safe = async (fn) => {
  try { await fn(); } catch (error) { console.error('⚠️ Registro de uso de IA no guardado:', error.code || error.name); }
};

// body: { model, max_tokens, system?, messages }. Lanza AiBudgetNotConfiguredError, AiBudgetExhaustedError o AiProviderError.
async function callClaude({ userId, kind, requestId = null, body, now = new Date() }) {
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
    }));
  }
  return message;
}

module.exports = { callClaude, computeCost, classifyError, AiProviderError, AiBudgetNotConfiguredError, AiBudgetExhaustedError };
