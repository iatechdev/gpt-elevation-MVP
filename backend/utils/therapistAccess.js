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

// Ejecuta fn(patient) con el consentimiento comprobado DENTRO de una transacción y con bloqueo compartido: una revocación concurrente espera a
// que termine la lectura y ninguna lectura nueva ve un consentimiento retirado (ADR-003 de ES-19). Responde 404 si no hay vínculo y 403 si no hay consentimiento.
async function withPatientData(req, res, patientId, fn, attributes) {
  const patient = await linkedPatient(req.user.id, patientId, attributes);
  if (!patient) return res.status(404).json(NOT_FOUND);
  try {
    return await consent.withConsent(patient.id, PURPOSE, () => fn(patient), consent.therapistScope(req.user.id));
  } catch (error) {
    if (error instanceof consent.ConsentRequiredError) return res.status(403).json(SHARING_REQUIRED);
    throw error;
  }
}

module.exports = { PURPOSE, SHARING_REQUIRED, linkedPatient, sharingSet, withPatientData };
