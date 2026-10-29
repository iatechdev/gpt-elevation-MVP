const { Op } = require('sequelize');
const { desencriptar } = require('./crypto');
const DataRightsError = require('./dataRightsError');

// Closed registry: adding a personal-data model requires an explicit export/purge decision.
const CORE = [
  ['messages', 'message', 'UserId', ['id', 'role', 'content', 'createdAt', 'updatedAt'], ['content']],
  ['chatTurns', 'ChatTurn', 'UserId', ['id', 'requestId', 'status', 'userContent', 'replyContent', 'failureCode', 'createdAt', 'updatedAt'], ['userContent', 'replyContent']],
  ['diary', 'DiaryEntry', 'UserId', ['id', 'entryDate', 'content', 'createdAt', 'updatedAt'], ['content']],
  ['moods', 'MoodLog', 'UserId', ['id', 'checkin_mood', 'checkout_mood', 'date', 'createdAt', 'updatedAt']],
  ['ratings', 'SessionRating', 'UserId', ['id', 'rating', 'date', 'createdAt', 'updatedAt']],
  ['recommendations', 'WellnessRecommendation', 'UserId', ['id', 'content', 'category', 'generatedAt', 'seenByUser', 'seenByTherapist', 'createdAt', 'updatedAt'], ['content']],
  ['consents', 'Consent', 'UserId', ['id', 'purpose', 'scope', 'status', 'version', 'decidedAt', 'createdAt', 'updatedAt']],
  ['consentHistory', 'ConsentEvent', 'UserId', ['id', 'purpose', 'scope', 'status', 'version', 'decidedAt', 'createdAt']],
  ['planRequests', 'PlanRequest', 'userId', ['id', 'planId', 'status', 'adminNote', 'resolvedAt', 'createdAt', 'updatedAt']],
  // ES-22: metadatos de uso de IA (sin mensajes, prompts ni respuestas) y el contador de presupuesto de la persona.
  // El contador de la cohorte (UserId = 0) no es de nadie y nunca se purga: el gasto ya ocurrido sigue contando.
  ['aiUsage', 'AiUsage', 'UserId', ['id', 'kind', 'requestId', 'model', 'periodKey', 'status', 'inputTokens', 'outputTokens', 'costMicros', 'currency', 'latencyMs', 'errorCode', 'createdAt']],
  ['aiBudget', 'AiBudgetCounter', 'UserId', ['id', 'periodKey', 'used', 'createdAt', 'updatedAt']],
  // ES-25: versiones del puente profesional. `payload` (los campos que la persona aprobó) va cifrado v2: se entrega descifrado y como lista
  // al dueño. No se exportan `origins` ni `requestId` (referencias técnicas internas, sin texto) y se purga todo con el resto.
  ['careerContext', 'CareerContextVersion', 'UserId', ['id', 'version', 'status', 'payload', 'consentVersion', 'approvedAt', 'revokedAt', 'createdAt'], ['payload'], ['payload']],
  // ES-25: auditoría de lo que leyó el motor profesional (solo claves y consumidor; nunca texto). Es información sobre la propia persona.
  ['bridgeTransfers', 'BridgeTransfer', 'UserId', ['id', 'version', 'keys', 'consumer', 'createdAt']],
  // ES-27: evidencia profesional. El contenedor solo se exporta si no está borrado; cada versión lleva su contenido cifrado v2, que se entrega
  // descifrado y como objeto al dueño. Al borrar una evidencia se vacía el contenido de todas sus versiones: esas versiones vacías no se exportan.
  // No se exportan `origins` (referencias privadas sin texto) ni `requestId`.
  ['evidence', 'Evidence', 'UserId', ['id', 'currentVersion', 'createdAt', 'updatedAt']],
  ['evidenceVersions', 'EvidenceVersion', 'UserId', ['id', 'EvidenceId', 'version', 'status', 'authoring', 'payload', 'hasChatOrigin', 'consentVersion', 'createdAt'], ['payload'], ['payload'], (row) => Object.keys(row.payload).length > 0],
  // ES-14: contexto privado y versionado del participante. `content` es el DTO validado, cifrado v2: se entrega descifrado y como objeto al
  // dueño y se purga con el resto. El FK con CASCADE solo cubriría el borrado físico del usuario; ES-23 pseudonimiza la fila y no la borra.
  ['participantContext', 'ParticipantContext', 'UserId', ['id', 'version', 'content', 'completedAt', 'createdAt', 'updatedAt'], ['content'], ['content']],
  // ES-109: histórico de hojas de vida. Solo se exportan los metadatos (versión, tamaño, huella, fecha): el PDF cifrado se descarga desde «Mis hojas de vida»
  // y no se incluye en el JSON (hasta 25 MB). Se purga con el resto (la columna `data` no se exporta nunca).
  ['participantResumes', 'ParticipantResume', 'UserId', ['id', 'version', 'size', 'sha256', 'createdAt']],
  // ES-29: evaluaciones de habilidad del Skill Map. `rationale` (la justificación de la persona) va cifrado v2 y se entrega descifrado. No se exportan
  // `rubricHash`, `requestId` ni la versión de la regla (referencias técnicas internas); `evidenceRefs` son solo ids y versiones, sin texto. El catálogo
  // (SkillCatalog/SkillDefinition) lo administra el cliente y no es dato personal: no se registra.
  ['skillAssessments', 'SkillAssessment', 'UserId', ['id', 'skillKey', 'track', 'level', 'state', 'catalogVersion', 'evidenceRefs', 'confidence', 'confidenceReasonCode', 'rationale', 'authoring', 'status', 'createdAt'], ['rationale']],
  // ES-32: extensión declarativa autorizada en Jira 10250 y en el chat. Sin cambios del procesador ni de retención.
  ['routeConstraints', 'RouteConstraintsVersion', 'UserId', ['id', 'version', 'status', 'payload', 'createdAt'], ['payload'], ['payload']],
  ['routeChoices', 'RouteChoice', 'UserId', ['id', 'roleKey', 'slot', 'decision', 'catalogVersion', 'constraintsVersion', 'status', 'createdAt']],
  ['routeReviewRequests', 'RouteReviewRequest', 'UserId', ['id', 'status', 'note', 'createdAt'], ['note']],
  ['invalidations', 'DerivedInvalidation', 'UserId', ['id', 'sourceType', 'sourceId', 'reason', 'handledAt', 'createdAt']],
  // ES-33: autorización de extensión declarativa (Jira 10260/10261). Hijos antes del contenedor por sus FK.
  ['careerReminders', 'CareerReminder', 'UserId', ['id', 'planVersionId', 'actionKey', 'status', 'payload', 'createdAt'], ['payload'], ['payload']],
  ['careerPlans', 'CareerPlanVersion', 'UserId', ['id', 'experimentId', 'version', 'status', 'payload', 'createdAt'], ['payload'], ['payload']],
  ['careerReviews', 'CareerExperimentReview', 'UserId', ['id', 'experimentId', 'submissionVersion', 'status', 'payload', 'createdAt'], ['payload'], ['payload']],
  ['careerExperimentVersions', 'CareerExperimentVersion', 'UserId', ['id', 'experimentId', 'version', 'lifecycle', 'payload', 'createdAt'], ['payload'], ['payload']],
  ['careerExperiments', 'CareerExperiment', 'UserId', ['id', 'choiceId', 'currentVersion', 'createdAt']],
];
const PROFILE = ['id', 'name', 'email', 'role', 'active', 'onboardingCompleted', 'motivation', 'planId', 'createdAt', 'updatedAt'];
const model = name => require('../' + name);
const pick = (row, fields) => Object.fromEntries(fields.map(field => [field, row[field] ?? null]));

// These records mix people, files or professional obligations. Never silently omit them
// from a purportedly complete export, or erase them without Mauricio's retention contract.
async function requiresReview(userId, transaction) {
  const refs = [
    ['ClinicalNote', { [Op.or]: [{ UserId: userId }, { therapistId: userId }] }],
    ['TherapySession', { [Op.or]: [{ patientId: userId }, { therapistId: userId }] }],
    ['SessionNote', { therapistId: userId }],
    ['TherapistProfile', { UserId: userId }],
    ['TherapistValidation', { therapistId: userId }],
    ['MatchingRequest', { [Op.or]: [{ UserId: userId }, { chosenTherapistId: userId }] }],
    ['EthicManifest', { uploadedBy: userId }],
    ['PlanRequest', { resolvedBy: userId }],
    ['User', { therapistId: userId }],
  ];
  for (const [name, where] of refs) {
    if (await model(name).findOne({ where, attributes: ['id'], transaction })) return true;
  }
  return false;
}

async function personalData(user, locale, transaction) {
  const data = { schemaVersion: 1, type: 'personal', locale, profile: pick(user, PROFILE) };
  let bytes = Buffer.byteLength(JSON.stringify(data));
  const tooLarge = () => new DataRightsError(413, 'export_too_large',
    'La exportación supera el límite de esta versión.', 'The export exceeds this version’s limit.');
  for (const [key, name, owner, fields, encrypted = [], json = [], keep = () => true] of CORE) {
    const where = { [owner]: user.id };
    if (name === 'DiaryEntry' || name === 'Evidence') where.deletedAt = null;
    const rows = await model(name).findAll({ where, attributes: fields, order: [['id', 'ASC']], limit: 5001, transaction });
    if (rows.length > 5000) throw tooLarge();
    data[key] = rows.map(row => {
      const output = pick(row, fields);
      for (const field of encrypted) if (output[field] !== null) output[field] = desencriptar(output[field]);
      for (const field of json) if (output[field] !== null) output[field] = JSON.parse(output[field]);
      bytes += Buffer.byteLength(JSON.stringify(output));
      if (bytes > 10 * 1024 * 1024) throw tooLarge();
      return output;
    }).filter(keep);
  }
  return data;
}

module.exports = { CORE, personalData, requiresReview };
