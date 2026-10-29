// backend/utils/sessionSchedule.js
// Choques de horario de las sesiones de terapia (ES-98, ES93-B5) y reglas de estado de la edición (ES93-M2).

const { Op } = require('sequelize');

const ACTIVE = ['scheduled', 'in_progress'];
const MAX_DURATION_MIN = 120; // tope de duración (la ruta lo exige): acota la ventana de búsqueda
const MIN_MS = 60 * 1000;

// Sesión activa del terapeuta o de la persona que se solape con [start, start + durationMin). `excludeId` evita chocar consigo misma al reprogramar.
async function findConflict(TherapySession, { therapistId, patientId, start, durationMin, excludeId = null, transaction }) {
  const startMs = start.getTime();
  const endMs = startMs + durationMin * MIN_MS;
  const candidates = await TherapySession.findAll({
    where: {
      status: { [Op.in]: ACTIVE },
      [Op.or]: [{ therapistId }, { patientId }],
      scheduledAt: { [Op.gt]: new Date(startMs - MAX_DURATION_MIN * MIN_MS), [Op.lt]: new Date(endMs) },
    },
    transaction,
  });
  return candidates.find((row) => {
    if (excludeId !== null && Number(row.id) === Number(excludeId)) return false;
    const rowStart = new Date(row.scheduledAt).getTime();
    const rowEnd = rowStart + (Number(row.duration) || 50) * MIN_MS;
    return rowStart < endMs && rowEnd > startMs;
  }) ?? null;
}

// Por PUT solo se puede reprogramar y CANCELAR una sesión agendada; iniciar y terminar tienen sus propias rutas (con sala y cierre).
// Devuelve null si el cambio es válido, o un código de error.
function editProblem(session, { status, scheduledAt, duration }) {
  if (['completed', 'cancelled'].includes(session.status)) return 'session_final';
  if (session.status !== 'scheduled') return (status || scheduledAt || duration) ? 'session_in_progress' : null;
  if (status !== undefined && status !== 'scheduled' && status !== 'cancelled') return 'invalid_status';
  return null;
}

module.exports = { ACTIVE, MAX_DURATION_MIN, findConflict, editProblem };
