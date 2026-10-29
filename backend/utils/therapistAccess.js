// ES-101 (ES93-A1): el terapeuta no accede a una persona con la cuenta inactiva o con una solicitud de eliminación aceptada (ES-23).
// Un tombstone de eliminación bloquea el acceso aunque un administrador deje active=true; el purgado de datos es un paso aparte.
// Los errores de base de datos se propagan: un registro de eliminaciones no disponible nunca concede acceso.
const User = require('../User');
const DeletionRequest = require('../DeletionRequest');

// -> Set con los ids bloqueados (inactivos o con eliminación pendiente) de entre `ids`.
async function blockedPatientIds(ids) {
  const list = [...new Set((ids ?? []).filter(Number.isSafeInteger))];
  if (!list.length) return new Set();
  const [inactive, deleting] = await Promise.all([
    User.findAll({ where: { id: list, active: false }, attributes: ['id', 'active'] }),
    DeletionRequest.findAll({ where: { UserId: list }, attributes: ['UserId'] }),
  ]);
  return new Set([...inactive.filter(user => user.active === false).map(user => user.id), ...deleting.map(row => row.UserId)]);
}

const patientBlocked = async (id) => (await blockedPatientIds([Number(id)])).has(Number(id));

module.exports = { blockedPatientIds, patientBlocked };
