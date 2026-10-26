// backend/utils/aiBudget.js
// Presupuesto de IA en tokens por persona y por cohorte, con reserva atómica previa (ES-22, RF-13, V-12/V-13).
// No hay montos definidos (V-12): sin configuración, las llamadas se rechazan. NO se interpreta la ausencia de topes como ilimitado.
//
// Variables de entorno (valores que carga Mauricio/Infra; no se inventan aquí):
//   AI_BUDGET_TOKENS_PER_USER  tope de tokens por persona y periodo (obligatoria)
//   AI_BUDGET_TOKENS_COHORT    tope de tokens de toda la cohorte por periodo (opcional; sin ella no hay tope de cohorte)
//   AI_BUDGET_PERIOD           day | week | month (por defecto month, en UTC)
//   AI_CALL_TIMEOUT_MS         tiempo de espera por llamada (1.000–120.000; por defecto 45.000)
//   AI_MAX_RETRIES             reintentos del SDK por llamada (0–2; por defecto 1)

const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const AiBudgetCounter = require('../AiBudgetCounter');

const COHORT_ID = 0;
const PERIODS = ['day', 'week', 'month'];

class AiBudgetNotConfiguredError extends Error {
  constructor() {
    super('El presupuesto de IA no está configurado.');
    this.code = 'ai_budget_not_configured';
  }
}

class AiBudgetExhaustedError extends Error {
  constructor(scope, resetsAt) {
    super('Se alcanzó el límite de uso de IA del periodo.');
    this.code = 'ai_budget_exhausted';
    this.scope = scope; // 'person' | 'cohort'
    this.resetsAt = resetsAt;
  }
}

const intEnv = (value) => {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return number > 0 ? number : null;
};
const clamp = (value, low, high, fallback) => {
  // Vacío o ausente = valor por defecto (Number('') sería 0).
  const number = value === undefined || value === null || String(value).trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? Math.min(high, Math.max(low, Math.trunc(number))) : fallback;
};

// -> null si falta el tope por persona (no configurado).
function readConfig(env = process.env) {
  const perUser = intEnv(env.AI_BUDGET_TOKENS_PER_USER);
  if (!perUser) return null;
  return {
    perUser,
    cohort: intEnv(env.AI_BUDGET_TOKENS_COHORT),
    period: PERIODS.includes(env.AI_BUDGET_PERIOD) ? env.AI_BUDGET_PERIOD : 'month',
    timeoutMs: clamp(env.AI_CALL_TIMEOUT_MS, 1000, 120000, 45000),
    maxRetries: clamp(env.AI_MAX_RETRIES, 0, 2, 1),
  };
}

const day = (date) => date.toISOString().slice(0, 10);
const startOfWeek = (now) => {
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 24 * 3600 * 1000); // lunes UTC
};

function periodKey(now, period) {
  if (period === 'day') return day(now);
  if (period === 'week') return `W${day(startOfWeek(now))}`;
  return now.toISOString().slice(0, 7);
}

function periodEnd(now, period) {
  if (period === 'day') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (period === 'week') return new Date(startOfWeek(now).getTime() + 7 * 24 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// Estimación conservadora (heurística de caracteres, no una tarifa): entrada ≈ caracteres / 3 más el máximo de salida.
function estimateTokens(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const chars = String(body.system ?? '').length
    + messages.reduce((total, message) => total + String(message && message.content ? message.content : '').length, 0);
  return Math.ceil(chars / 3) + (Number.isInteger(body.max_tokens) ? body.max_tokens : 1024);
}

// Ejecuta fn(transaction) y confirma; ante un choque de unicidad (dos primeras filas simultáneas) reintenta una vez.
async function withCounters(fn) {
  for (let attempt = 1; ; attempt++) {
    const transaction = await sequelize.transaction();
    let finished = false;
    try {
      const result = await fn(transaction);
      await transaction.commit();
      finished = true;
      return result;
    } catch (error) {
      if (!finished) await transaction.rollback().catch(() => {});
      if (error && error.name === 'SequelizeUniqueConstraintError' && attempt === 1) continue;
      throw error;
    }
  }
}

// Siempre se bloquea primero el contador de la cohorte y después el de la persona (mismo orden: sin interbloqueos).
async function lockedCounter(userId, key, transaction) {
  const row = await AiBudgetCounter.findOne({
    where: { UserId: userId, periodKey: key }, transaction, lock: Transaction.LOCK.UPDATE,
  });
  return row ?? AiBudgetCounter.create({ UserId: userId, periodKey: key, used: 0 }, { transaction });
}

// Reserva atómica previa. Lanza AiBudgetNotConfiguredError / AiBudgetExhaustedError sin reservar nada.
async function reserve(userId, tokens, now = new Date(), env = process.env) {
  const config = readConfig(env);
  if (!config) throw new AiBudgetNotConfiguredError();
  const key = periodKey(now, config.period);
  const resetsAt = periodEnd(now, config.period);
  if (!Number.isSafeInteger(tokens) || tokens <= 0) throw new Error('Reserva de tokens inválida.');
  if (tokens > config.perUser) throw new AiBudgetExhaustedError('person', resetsAt);
  await withCounters(async (transaction) => {
    const cohort = await lockedCounter(COHORT_ID, key, transaction);
    const person = await lockedCounter(userId, key, transaction);
    if (config.cohort && cohort.used + tokens > config.cohort) throw new AiBudgetExhaustedError('cohort', resetsAt);
    if (person.used + tokens > config.perUser) throw new AiBudgetExhaustedError('person', resetsAt);
    await cohort.update({ used: cohort.used + tokens }, { transaction });
    await person.update({ used: person.used + tokens }, { transaction });
  });
  return { userId, periodKey: key, tokens };
}

// Ajusta la reserva al uso real (0 = liberar por completo). Nunca deja un contador negativo.
async function settle(reservation, actualTokens) {
  const delta = actualTokens - reservation.tokens;
  if (delta === 0) return;
  await withCounters(async (transaction) => {
    const cohort = await lockedCounter(COHORT_ID, reservation.periodKey, transaction);
    const person = await lockedCounter(reservation.userId, reservation.periodKey, transaction);
    await cohort.update({ used: Math.max(0, cohort.used + delta) }, { transaction });
    await person.update({ used: Math.max(0, person.used + delta) }, { transaction });
  });
}

const release = (reservation) => settle(reservation, 0);

async function personUsage(userId, now = new Date(), env = process.env) {
  const config = readConfig(env);
  if (!config) return { configured: false };
  const key = periodKey(now, config.period);
  const row = await AiBudgetCounter.findOne({ where: { UserId: userId, periodKey: key } });
  const used = row ? row.used : 0;
  return {
    configured: true, period: config.period, periodKey: key, limit: config.perUser, used,
    remaining: Math.max(0, config.perUser - used), resetsAt: periodEnd(now, config.period),
  };
}

module.exports = {
  COHORT_ID, readConfig, periodKey, periodEnd, estimateTokens, reserve, settle, release, personUsage,
  AiBudgetNotConfiguredError, AiBudgetExhaustedError,
};
