// Puertos de contratos pendientes. No fixtures de runtime ni modelos copiados desde PRs sin fusionar.
const { problem } = require('./careerPlanRules');
async function getRoute(userId, choiceId) {
  let routes;
  try { require.resolve('./routes'); } catch { throw problem('route_contract_pending', 'ES-32 aún no está integrado.', 'ES-32 is not integrated yet.', 503); }
  routes = require('./routes');
  const choice = await routes.getAcceptedChoice(userId, choiceId);
  const basis = await routes.getRoutes(userId);
  const route = basis.routes.find(route => route.roleKey === choice.roleKey && route.slot === choice.slot);
  if (!route || basis.basisHash === null) throw problem('basis_changed', 'Revisa la ruta elegida.', 'Review the chosen route.', 409);
  // Segunda comprobación frente a cambios entre ambos helpers; sin prometer snapshot global.
  if ((await routes.getAcceptedChoice(userId, choiceId)).basisChanged) throw problem('basis_changed', 'La base cambió.', 'The basis changed.', 409);
  return { basisHash: basis.basisHash, route };
}
async function getContext() {
  // Mauricio debe proporcionar el lector mínimo del contexto canónico. Nunca recrear preferencias aquí.
  throw problem('context_contract_pending', 'Falta el contrato de disponibilidad y zona horaria.', 'The availability and time-zone contract is pending.', 503);
}
module.exports = { getRoute, getContext };
