// backend/utils/therapistLink.js
// Desvincular a una persona de su terapeuta (ES-96, ES93-A1/A3). Lo usan la propia persona («dejar de compartir») y la solicitud de eliminación
// de cuenta (ES-23). Todo en la transacción del llamador. Quitar el vínculo corta de inmediato el acceso del terapeuta a esa persona (las rutas del
// terapeuta exigen `User.therapistId`); las sesiones futuras agendadas entre ambos se cancelan con motivo; lo ya terminado se conserva.
// Las notas que el terapeuta escribió son su registro profesional: no se borran aquí (retención: decisión de Mauricio, ES-23 `requiresReview`).

const User = require('../User');
const TherapySession = require('../TherapySession');

// -> { unlinked: boolean, therapistId: number | null }
async function unlinkTherapist(userId, reason, transaction) {
  const user = await User.findByPk(userId, { attributes: ['id', 'therapistId'], transaction });
  if (!user || !user.therapistId) return { unlinked: false, therapistId: null };
  const therapistId = user.therapistId;
  await TherapySession.update(
    { status: 'cancelled', cancelReason: reason },
    { where: { patientId: userId, therapistId, status: 'scheduled' }, transaction },
  );
  await user.update({ therapistId: null }, { transaction });
  return { unlinked: true, therapistId };
}

module.exports = { unlinkTherapist };
