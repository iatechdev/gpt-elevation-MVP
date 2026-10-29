// backend/utils/therapistAccess.js
// Acceso del terapeuta a los datos de una persona vinculada (ES-96; hallazgos ES93-A1 y ES93-A3 del informe de QA de ES-93).
// Decisión 2a de Mauricio (28-oct-2026): el terapeuta ve SOLO lo que la persona autorizó, por el propósito de consentimiento `therapist_sharing`
// (ES-19) ligado a ESE terapeuta (alcance `therapist-<id>`). Sin él no ve correo, ánimo, valoraciones, alertas ni escribe notas sobre ella.
// Además, una persona con eliminación de cuenta solicitada, desactivada o desvinculada deja de ser accesible al instante.
// El propietario y el vínculo se verifican en el servidor en CADA acceso; un id ajeno responde el mismo 404 que uno inexistente.

const { Op } = require('sequelize');
const User = require('../User');
const Consent = require('../Consent');
const consent = require('./consent');
const { deletionPending } = require('./deletionGuard');
const DeletionRequest = require('../DeletionRequest');

const PURPOSE = 'therapist_sharing';

const SHARING_REQUIRED = Object.freeze({
  code: 'consent_required',
  error: 'La persona no ha autorizado compartir sus datos con su terapeuta. / The person has not authorized sharing their data with their therapist.',
});
const NOT_FOUND = Object.freeze({ error: 'Patient not found or not assigned to you.' });

// Persona vinculada a este terapeuta, activa y sin eliminación solicitada. null si no (ajena, inexistente, desvinculada, inactiva o borrándose).
async function linkedPatient(therapistId, patientId, attributes = ['id', 'name', 'email', 'createdAt']) {
  const patient = await User.findOne({ where: { id: patientId, therapistId, role: 'user', active: true }, attributes: [...new Set([...attributes, 'id'])] });
  if (!patient) return null;
  if (await deletionPending(patient.id)) return null;
  return patient;
}

// Ids (de una lista de personas vinculadas a ESTE terapeuta) cuyo consentimiento vigente cubre a este terapeuta.
async function sharingSet(therapistId, patientIds) {
  if (!patientIds.length) return new Set();
  const rows = await Consent.findAll({
    where: { UserId: { [Op.in]: patientIds }, purpose: PURPOSE, scope: consent.therapistScope(therapistId), status: 'granted' },
  });
  return new Set(rows.filter((row) => consent.isEffective(row, PURPOSE)).map((row) => row.UserId));
}

// Ejecuta fn(patient, transaction) con el consentimiento comprobado DENTRO de una transacción y con bloqueo compartido: una revocación concurrente espera a
// que termine la lectura y ninguna lectura nueva ve un consentimiento retirado (ADR-003 de ES-19). Responde 404 si no hay vínculo y 403 si no hay consentimiento.
// QA (ES-96, Alto): fn DEBE hacer sus consultas con la `transaction` que recibe. Si usara otra conexión, cada lectura retendría dos del pool y con N lecturas
// simultáneas mayores que el pool (5) todas esperarían una segunda conexión que nadie libera (esperas de decenas de segundos y 5xx).
async function withPatientData(req, res, patientId, fn, attributes) {
  const patient = await linkedPatient(req.user.id, patientId, attributes);
  if (!patient) return res.status(404).json(NOT_FOUND);
  try {
    return await consent.withConsent(patient.id, PURPOSE, (transaction) => fn(patient, transaction), consent.therapistScope(req.user.id));
  } catch (error) {
    if (error instanceof consent.ConsentRequiredError) return res.status(403).json(SHARING_REQUIRED);
    throw error;
  }
}


// ES-101 (convive con ES-96: linkedPatient ya filtra por activo y eliminación; estas funciones siguen sirviendo a las rutas que no pasan por withPatientData)
// ES-101 (ES93-A1): el terapeuta no accede a una persona con la cuenta inactiva o con una solicitud de eliminación aceptada (ES-23).
// Un tombstone de eliminación bloquea el acceso aunque un administrador deje active=true; el purgado de datos es un paso aparte.
// Los errores de base de datos se propagan: un registro de eliminaciones no disponible nunca concede acceso.

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

// Sin autorización de compartir NO se crean ni gestionan sesiones con esa persona (decisión de Mauricio): el terapeuta no tiene su información para agendar.
// -> true si autorizó; si no, responde 403 consent_required (ES/EN) y devuelve false. Lectura sin bloqueo: no abre una transacción larga.
async function requireSharing(req, res, patientId) {
  if (await consent.hasConsent(patientId, PURPOSE, consent.therapistScope(req.user.id))) return true;
  res.status(403).json(SHARING_REQUIRED);
  return false;
}
const hasSharing = (therapistId, patientId) => consent.hasConsent(patientId, PURPOSE, consent.therapistScope(therapistId));

module.exports = { requireSharing, hasSharing, PURPOSE, SHARING_REQUIRED, linkedPatient, sharingSet, withPatientData, blockedPatientIds, patientBlocked };
