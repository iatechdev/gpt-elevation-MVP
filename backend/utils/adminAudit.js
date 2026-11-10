// ES-186 (parte B) · Escritura de la auditoría de administración. Se llama DENTRO de la transacción de la acción (pasar `transaction`).
// Solo ids y claves de acción: nunca contraseñas, tokens, enlaces ni correos.
const AdminAuditEntry = require('../AdminAuditEntry');

const ACTIONS = new Set([
  'user.update', 'user.delete', 'user.assign_therapist', 'user.set_plan', 'user.unlock', 'user.reset_link',
  'invitation.create', 'invitation.revoke', 'matching.confirm', 'plan_request.approve', 'plan_request.reject',
]);
const RESULTS = new Set(['ok', 'denied', 'failed']);

async function recordAdminAction({ actor, action, targetType = null, targetId = null, result = 'ok' }, { transaction } = {}) {
  if (!ACTIONS.has(action)) throw new Error(`Acción de auditoría desconocida: ${action}`);
  if (!RESULTS.has(result)) throw new Error(`Resultado de auditoría desconocido: ${result}`);
  return AdminAuditEntry.create({
    actorId: Number.isInteger(actor?.id) ? actor.id : null, actorRole: typeof actor?.role === 'string' ? actor.role.slice(0, 16) : null,
    action, targetType, targetId: Number.isInteger(targetId) ? targetId : null, result,
  }, { transaction });
}

module.exports = { recordAdminAction, ACTIONS };
