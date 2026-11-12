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
  // ES-88: análisis de IA del worker (ES-84). Candidatas antes que jobs por su clave foránea. Solo lo que es de la persona: no se exportan
  // `contextHash`, `requestId`, `leaseOwner`, `fence`, `notBefore` (estado técnico interno). Las citas son claves de campo, sin texto.
  ['skillCandidates', 'SkillCandidate', 'UserId', ['id', 'jobId', 'skillKey', 'level', 'confirmedLevel', 'citations', 'status', 'catalogVersion', 'reviewedAt', 'createdAt']],
  ['aiJobs', 'AiJob', 'UserId', ['id', 'kind', 'contextVersion', 'status', 'attempt', 'catalogVersion', 'errorCode', 'startedAt', 'finishedAt', 'createdAt']],
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
  // ES-132: enlaces de recuperación de contraseña. Se exportan solo cuándo se pidieron, vencieron o se usaron; NUNCA `tokenHash` (es una credencial de un solo uso,
  // aunque esté hasheada). Se purgan con la cuenta: un enlace pendiente no debe sobrevivir al borrado.
  ['passwordResets', 'PasswordReset', 'UserId', ['id', 'expiresAt', 'usedAt', 'createdAt']],
  // ES-276: el «Persona n» que un profesional asignó a esta persona (TherapistPersonOrdinal.personId). Se exporta id, número y fecha, NUNCA `therapistId`;
  // se purga con la persona. El contador monótono (TherapistOrdinalCounters, por profesional, sin personId) NO se toca: el número no se reutiliza.
  ['therapistOrdinals', 'TherapistPersonOrdinal', 'personId', ['id', 'ordinal', 'createdAt']],
  // ES-192: la invitación con la que la persona creó su cuenta (acceptedUserId). Se exporta solo cuándo se pidió, venció o se usó y con qué rol; NUNCA
  // `tokenHash` (credencial de un solo uso) ni el correo de otra persona (`invitedBy` es quien invitó). Se purga con la cuenta. Las invitaciones sin
  // aceptar no son de nadie y se limpian solas (30 días tras vencer).
  // ES-175: autorizaciones a un revisor (solo referencias), revisiones que recibió (observation y limits cifrados v2: se entregan descifrados), su objeción (reason cifrado) y la respuesta (text cifrado).
  // No se exportan `requestId` ni `reviewerId` de la respuesta (referencia técnica); sí el id del revisor en la autorización y la revisión, que son suyos. Se purgan con la cuenta (hijos antes que padres).
  ['reviewResponses', 'ReviewResponse', 'UserId', ['id', 'objectionId', 'text', 'locale', 'createdAt'], ['text']],
  ['reviewObjections', 'ReviewObjection', 'UserId', ['id', 'reviewId', 'reason', 'locale', 'createdAt'], ['reason']],
  ['professionalReviews', 'ProfessionalReview', 'UserId', ['id', 'shareId', 'reviewerId', 'materialVersion', 'evidenceRefs', 'observation', 'limits', 'locale', 'supersedesId', 'createdAt'], ['observation', 'limits']],
  ['reviewShares', 'ReviewShare', 'UserId', ['id', 'reviewerId', 'materialVersion', 'evidenceRefs', 'status', 'revokedAt', 'createdAt']],
  ['invitations', 'Invitation', 'acceptedUserId', ['id', 'role', 'expiresAt', 'usedAt', 'createdAt']],
];
const PROFILE = ['id', 'name', 'email', 'role', 'active', 'onboardingCompleted', 'motivation', 'planId', 'createdAt', 'updatedAt'];
const model = name => require('../' + name);
const pick = (row, fields) => Object.fromEntries(fields.map(field => [field, row[field] ?? null]));

// ES-274 (opción A, decisión de Mauricio del 11-nov-2026): al atender una solicitud de eliminación se purgan los datos DE LA PERSONA y se conserva únicamente lo que
// ESCRIBIÓ EL PROFESIONAL. Lo conservado queda en la base con la fila de usuario de la persona ya reemplazada por la lápida (sin nombre ni correo), pero el texto libre de
// las notas puede contener datos que la identifiquen y no se puede depurar: NUNCA se afirma que quede «anonimizado» o «desvinculado» (ni en textos ni en el recibo).
// Plazo y base legal de conservación: en definición.
//   RETAINED: [categoría del recibo, modelo, columna de la persona, por qué se conserva]. No se exporta ni se borra en la purga de la persona.
const RETAINED = [
  ['clinicalNotes', 'ClinicalNote', 'UserId', 'notas que escribió el profesional sobre la persona'],
  ['sessionNotes', 'SessionNote', null, 'notas en vivo del profesional (se ligan a la sesión, no a la persona)'],
  ['therapySessions', 'TherapySession', 'patientId', 'agenda del profesional y su nota de la sesión (se limpian los campos de la persona: ver SESSION_PERSON_FIELDS)'],
];
// Campos de la fila de sesión que son de la persona o ambiguos (enlaces, motivos, ánimo posterior): se ponen en NULL al purgar.
const SESSION_PERSON_FIELDS = ['patientMoodAfter', 'cancelReason', 'meetingUrl', 'recordingUrl', 'googleEventId'];
// Datos de la persona fuera de CORE (no se exportan: contienen datos de terceros como las sugerencias de profesionales) que la purga borra igualmente.
const PURGE_ALSO = [['MatchingRequest', 'UserId']];

// Referencias DEL LADO DEL PROFESIONAL o de administración: describen a quien escribe o administra, no a una persona. Siguen mandando a revisión (nunca se borran por la
// solicitud de eliminación de una persona). Lo que la persona tiene con sus profesionales (notas sobre ella, sesiones como paciente, emparejamientos) ya NO bloquea.
async function blocksPurge(userId, transaction) {
  const refs = [
    ['ClinicalNote', { therapistId: userId }],
    ['TherapySession', { therapistId: userId }],
    ['SessionNote', { therapistId: userId }],
    ['TherapistProfile', { UserId: userId }],
    ['TherapistValidation', { therapistId: userId }],
    ['MatchingRequest', { chosenTherapistId: userId }],
    ['EthicManifest', { uploadedBy: userId }],
    ['PlanRequest', { resolvedBy: userId }],
    ['User', { therapistId: userId }],
    ['ProfessionalReview', { reviewerId: userId }], // ES-175: lo que el profesional escribió sobre otras personas manda a revisión, no se borra
    ['ReviewShare', { reviewerId: userId }],
  ];
  for (const [name, where] of refs) {
    if (await model(name).findOne({ where, attributes: ['id'], transaction })) return true;
  }
  return false;
}

// Categorías (sin contenido) de lo que se conserva de esta persona; vacío si no hay nada. Para el recibo y el aviso de la exportación.
async function retainedCategories(userId, transaction) {
  const found = [];
  if (await model('ClinicalNote').findOne({ where: { UserId: userId }, attributes: ['id'], transaction })) found.push('clinicalNotes');
  const sessions = await model('TherapySession').findAll({ where: { patientId: userId }, attributes: ['id'], transaction });
  if (sessions.length) {
    found.push('therapySessions');
    if (await model('SessionNote').findOne({ where: { sessionId: sessions.map(s => s.id) }, attributes: ['id'], transaction })) found.push('sessionNotes');
  }
  return found.sort((a, b) => RETAINED.findIndex(r => r[0] === a) - RETAINED.findIndex(r => r[0] === b));
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
  // ES-274: lo que escribió el profesional sobre la persona es SU registro profesional: no se incluye aquí y se dice (sin contenido ni conteos).
  if ((await retainedCategories(user.id, transaction)).length) {
    data.notices = [{ code: 'professional_notes_not_included', message: locale === 'en'
      ? 'Notes and records written by your professional about you are their professional record and are not included in this export.'
      : 'Las notas y registros que tu profesional escribió sobre ti son su registro profesional y no se incluyen en esta exportación.' }];
  }
  return data;
}

module.exports = { CORE, RETAINED, PURGE_ALSO, SESSION_PERSON_FIELDS, personalData, blocksPurge, retainedCategories };
