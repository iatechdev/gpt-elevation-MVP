// backend/utils/planLimits.js

/**
 * HU-077 — Configuración central de límites por plan
 *
 * Planes: basic (gratis) | essential | plus | pro
 * planId en BD corresponde al orden de inserción del seed.
 * Los límites se leen por plan.slug para no depender del ID.
 */

const PLAN_LIMITS = {
  basic: {
    slug:            'basic',
    chatMessagesDay: 10,       // mensajes de IA por día
    sessionsMonth:   0,        // sesiones con terapeuta por mes
    canAccessProgress: false,  // acceso a pantalla de progreso
    canMatchTherapist: false,  // puede hacer matching con terapeuta
  },
  essential: {
    slug:            'essential',
    chatMessagesDay: 30,
    sessionsMonth:   1,
    canAccessProgress: true,
    canMatchTherapist: true,
  },
  plus: {
    slug:            'plus',
    chatMessagesDay: 100,
    sessionsMonth:   4,
    canAccessProgress: true,
    canMatchTherapist: true,
  },
  pro: {
    slug:            'pro',
    chatMessagesDay: -1,       // -1 = ilimitado
    sessionsMonth:   -1,
    canAccessProgress: true,
    canMatchTherapist: true,
  },
};

/**
 * Retorna los límites de un usuario dado su plan.
 * Si no tiene plan asignado, se trata como basic.
 * @param {object|null} plan — instancia de PricingPlan (con campo slug) o null
 */
function getLimits(plan) {
  if (!plan || !plan.slug) return PLAN_LIMITS.basic;
  return PLAN_LIMITS[plan.slug] ?? PLAN_LIMITS.basic;
}

/**
 * Verifica si un valor está dentro del límite.
 * limit = -1 significa ilimitado → siempre true.
 * @param {number} current — uso actual
 * @param {number} limit   — límite del plan
 */
function withinLimit(current, limit) {
  if (limit === -1) return true;
  return current < limit;
}

module.exports = { PLAN_LIMITS, getLimits, withinLimit };