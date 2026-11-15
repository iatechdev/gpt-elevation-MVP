// ES-186 (parte B) · Escritura de la auditoría de administración. Se llama DENTRO de la transacción de la acción (pasar `transaction`).
// Solo ids y claves de acción: nunca contraseñas, tokens, enlaces ni correos.
const AdminAuditEntry = require('../AdminAuditEntry');

const ACTIONS = new Set([
  'user.update', 'user.delete', 'user.delete_request', 'user.assign_therapist', 'user.set_plan', 'user.unlock', 'user.reset_link',
  'invitation.create', 'invitation.revoke', 'matching.confirm', 'plan_request.approve', 'plan_request.reject',
]);
const RESULTS = new Set(['ok', 'denied', 'failed']);
// ES-264: ningún campo de la auditoría es texto libre: acción, tipo de objetivo y resultado salen de listas cerradas (ids numéricos para el resto).
const TARGET_TYPES = new Set(['user', 'invitation', 'matching_request', 'plan_request']);

async function recordAdminAction({ actor, action, targetType = null, targetId = null, result = 'ok' }, { transaction } = {}) {
  if (!ACTIONS.has(action)) throw new Error(`Acción de auditoría desconocida: ${action}`);
  if (!RESULTS.has(result)) throw new Error(`Resultado de auditoría desconocido: ${result}`);
  if (targetType !== null && !TARGET_TYPES.has(targetType)) throw new Error('Tipo de objetivo de auditoría desconocido.');
  return AdminAuditEntry.create({
    actorId: Number.isInteger(actor?.id) ? actor.id : null, actorRole: typeof actor?.role === 'string' ? actor.role.slice(0, 16) : null,
    action, targetType, targetId: Number.isInteger(targetId) ? targetId : null, result,
  }, { transaction });
}

// Una acción NEGADA no cambia nada que revertir: se registra aparte y sin bloquear la respuesta (un fallo de auditoría aquí no convierte el 403 en 500).
async function recordDenied(actor, action, targetType, targetId) {
  try { await recordAdminAction({ actor, action, targetType, targetId, result: 'denied' }); } catch { console.error('No se pudo registrar la denegación en la auditoría.'); }
}

module.exports = { recordAdminAction, recordDenied, ACTIONS, TARGET_TYPES };
