// Puertos de ES-33 hacia ES-32 (rutas) y ES-14 (contexto). Ambos ya están en main: se leen de sus fuentes reales; no hay fixtures de runtime ni modelos copiados.
const User = require('../User');
const ParticipantContext = require('../ParticipantContext');
const { deletionPending } = require('./deletionGuard');
const { desencriptar } = require('./crypto');
const { problem } = require('./careerPlanRules');

async function getRoute(userId, choiceId, { allowBasisChange = false } = {}) {
  let routes;
  try { require.resolve('./routes'); } catch { throw problem('route_contract_pending', 'ES-32 aún no está integrado.', 'ES-32 is not integrated yet.', 503); }
  routes = require('./routes');
  // QA-33-02: un experimento YA creado se compara por las capacidades de su ruta, no por el hash global de ES-32; por eso acepta una elección con basisChanged.
  // Un experimento NUEVO sigue exigiendo una elección sin basisChanged (allowBasisChange=false).
  const choice = await routes.getAcceptedChoice(userId, choiceId, { allowBasisChange });
  const basis = await routes.getRoutes(userId);
  const route = basis.routes.find(route => route.roleKey === choice.roleKey && route.slot === choice.slot);
  if (!route || basis.basisHash === null) throw problem('basis_changed', 'Revisa la ruta elegida.', 'Review the chosen route.', 409);
  // Segunda comprobación frente a cambios entre ambos helpers; sin prometer snapshot global.
  await routes.getAcceptedChoice(userId, choiceId, { allowBasisChange });
  return { basisHash: basis.basisHash, route, rules: { ruleVersion: basis.ruleVersion, catalogVersion: basis.catalogVersion, constraintsVersion: basis.constraintsVersion } };
}

// Lector mínimo del contexto canónico de ES-14 (disponibilidad, zona horaria e idioma). Solo del dueño que pide, nunca de otra persona.
// Reglas (aprobadas por Mauricio):
//  - Solo cuenta un contexto COMPLETADO (la persona pulsó «continuar»); un borrador no se usa.
//  - Una disponibilidad o una zona horaria desconocidas (null en ES-14) devuelven 409 con un mensaje que lleva a Mi contexto: no se inventa ningún
//    valor por defecto ni se convierte «desconocido» en cero.
//  - La versión del contexto viaja en el resultado: al editarlo cambia la huella (basisHash) y lo ya guardado pasa a «necesita revisión».
async function getContext(userId) {
  const owner = await User.findOne({ where: { id: userId, active: true, role: 'user' }, attributes: ['id'] });
  if (!owner) throw problem('owner_required', 'Solo la persona titular puede acceder.', 'Only the participant owner may access this.', 403);
  if (await deletionPending(userId)) throw problem('deletion_pending', 'La cuenta tiene una solicitud de eliminación.', 'The account has a deletion request.', 403);
  const row = await ParticipantContext.findOne({ where: { UserId: userId } });
  if (!row || !row.completedAt) {
    throw problem('context_incomplete', 'Completa tu contexto en Mi contexto antes de continuar.', 'Complete your context in My context before continuing.', 409);
  }
  const content = JSON.parse(desencriptar(row.content));
  if (!Number.isInteger(content.availabilityMinutesPerWeek)) {
    throw problem('availability_unknown', 'Confirma tu disponibilidad semanal en Mi contexto.', 'Confirm your weekly availability in My context.', 409);
  }
  if (typeof content.timeZone !== 'string' || !content.timeZone) {
    throw problem('timezone_unknown', 'Confirma tu zona horaria en Mi contexto.', 'Confirm your time zone in My context.', 409);
  }
  return { version: row.version, weeklyMinutes: content.availabilityMinutesPerWeek, timeZone: content.timeZone, locale: content.preferredLanguage };
}
module.exports = { getRoute, getContext };
