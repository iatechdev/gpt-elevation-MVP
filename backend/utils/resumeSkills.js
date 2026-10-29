// ES-110: pasar las habilidades DECLARADAS en la hoja de vida (ES-109) a «Mis evidencias», solo las que la persona acepta. Reglas:
//  - Una habilidad declarada es lo que dice el documento: NO es evidencia verificada. Se crea como BORRADOR (nunca confirmada), de modo que el motor
//    (getConfirmedEvidence) no la lee hasta que la persona la respalde con una situación real y la confirme.
//  - Sin nivel: nada de esto toca el Skill Map (no se crea ninguna evaluación). Sin déficits ficticios ni conversión de escalas.
//  - Solo habilidades que existen en el catálogo VIGENTE (coincidencia exacta de nombre, sin acentos ni mayúsculas); lo demás es «sin clasificar» y no se inventa categoría.
//  - Cada evidencia guarda su origen (hoja de vida, versión y fecha, y la clave del catálogo) en la parte PRIVADA, y el texto exacto que la respalda en su contenido.
//  - Idempotente por requestId y sin duplicados aunque se confirme dos veces o a la vez. El propietario sale siempre de la sesión.
const { createHash } = require('crypto');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const ParticipantContext = require('../ParticipantContext');
const ParticipantResume = require('../ParticipantResume');
const Evidence = require('../Evidence');
const EvidenceVersion = require('../EvidenceVersion');
const skillCatalog = require('./skillCatalog');
const evidence = require('./evidence');
const { encriptarV2, desencriptar } = require('./crypto');
const { upgradeContext } = require('./participantContext');

class ResumeSkillsError extends Error {
  constructor(status, code, es, en) { super(`${es} / ${en}`); this.status = status; this.code = code; }
}
const MAX_SELECTED = 40;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const fold = (value) => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function readContext(userId, transaction) {
  const row = await ParticipantContext.findOne({ where: { UserId: userId }, transaction });
  return row ? upgradeContext(JSON.parse(desencriptar(row.content))) : null;
}

// Claves del catálogo vigente por nombre normalizado (ES y EN). Sin catálogo publicado no se clasifica nada.
async function catalogIndex() {
  const published = await skillCatalog.getPublished();
  const index = new Map();
  if (!published) return { index, version: null };
  for (const skill of published.skills.values()) {
    for (const lang of ['es', 'en']) {
      const label = skill.labels && skill.labels[lang];
      if (typeof label === 'string' && label.trim() && !index.has(fold(label))) index.set(fold(label), { skillKey: skill.skillKey, labels: { es: skill.labels.es ?? null, en: skill.labels.en ?? null } });
    }
  }
  return { index, version: published.version };
}

// Claves del catálogo que ya pasaron a evidencia (versión vigente, no borrada), por clave: evita duplicados.
async function addedKeys(userId, transaction) {
  const evidences = await Evidence.findAll({ where: { UserId: userId, deletedAt: null }, transaction });
  const current = new Map(evidences.map((ev) => [ev.id, ev.currentVersion]));
  if (!current.size) return new Set();
  const rows = await EvidenceVersion.findAll({ where: { UserId: userId }, attributes: ['EvidenceId', 'version', 'origins'], transaction });
  const keys = new Set();
  for (const row of rows) {
    if (current.get(row.EvidenceId) !== row.version) continue;
    for (const origin of Array.isArray(row.origins) ? row.origins : []) if (origin && origin.type === 'resume' && origin.skillKey) keys.add(origin.skillKey);
  }
  return keys;
}

// -> habilidades declaradas en la hoja de vida cuya versión de origen todavía existe, con su clasificación y si ya pasaron a evidencia.
async function listCandidates(userId, transaction) {
  const [context, resumes, { index }, added] = await Promise.all([
    readContext(userId, transaction),
    ParticipantResume.findAll({ where: { UserId: userId }, attributes: ['id', 'version', 'createdAt'], transaction }),
    catalogIndex(), addedKeys(userId, transaction),
  ]);
  const byVersion = new Map(resumes.map((r) => [r.version, r]));
  const skills = [];
  for (const skill of context ? context.declaredSkills : []) {
    const resume = skill.resumeVersion === null ? undefined : byVersion.get(skill.resumeVersion);
    if (!resume) continue; // sin versión de origen no hay de dónde sacarla (una habilidad escrita a mano no es de la hoja de vida)
    const hit = index.get(fold(skill.name)) ?? null;
    skills.push({
      name: skill.name, support: skill.support,
      classified: hit ? { skillKey: hit.skillKey, labels: hit.labels } : null,
      resume: { id: resume.id, version: resume.version, createdAt: new Date(resume.createdAt).toISOString() },
      added: hit ? added.has(hit.skillKey) : false,
    });
  }
  return skills;
}

const ownTransaction = async (fn) => {
  const transaction = await sequelize.transaction();
  try { const result = await fn(transaction); await transaction.commit(); return result; } catch (error) { await transaction.rollback().catch(() => {}); throw error; }
};
const itemRequestId = (requestId, skillKey) => `rs-${createHash('sha256').update(`${requestId}|${skillKey}`).digest('hex').slice(0, 40)}`;

// body: { requestId, names: [nombre exacto de cada habilidad elegida] }. Nada se añade sin elegirla; por defecto ninguna.
async function promote(userId, body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : null;
  if (!keys || keys.some((k) => !['requestId', 'names'].includes(k)) || typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)
    || !Array.isArray(body.names) || body.names.length < 1 || body.names.length > MAX_SELECTED || body.names.some((n) => typeof n !== 'string' || !n.trim() || n.length > 60)) {
    throw new ResumeSkillsError(400, 'invalid_input', 'Datos inválidos.', 'Invalid data.');
  }
  const wanted = [...new Map(body.names.map((n) => [fold(n), n])).values()];
  return ownTransaction(async (transaction) => {
    // Serializa por persona: dos confirmaciones simultáneas no duplican evidencias.
    await User.findOne({ where: { id: userId }, attributes: ['id'], transaction, lock: Transaction.LOCK.UPDATE });
    const candidates = await listCandidates(userId, transaction);
    const created = []; const skipped = [];
    for (const name of wanted) {
      const skill = candidates.find((c) => fold(c.name) === fold(name));
      if (!skill) { skipped.push({ name, reason: 'not_declared' }); continue; }
      if (!skill.classified) { skipped.push({ name: skill.name, reason: 'unclassified' }); continue; }
      const requestId = itemRequestId(body.requestId, skill.classified.skillKey);
      const repeated = await EvidenceVersion.findOne({ where: { UserId: userId, requestId }, transaction });
      if (repeated) { created.push({ id: repeated.EvidenceId, name: skill.name, skillKey: skill.classified.skillKey, replayed: true }); continue; }
      if (skill.added) { skipped.push({ name: skill.name, reason: 'already_added' }); continue; }
      if (!skill.support) { skipped.push({ name: skill.name, reason: 'no_support' }); continue; }
      // Contrato de evidencia (ES-27): borrador con título y el texto exacto del documento como muestra. Sin nivel, sin confirmar.
      const payload = evidence.normalizePayload({ title: skill.name, artifactRefs: [{ kind: 'text', excerpt: skill.support }] }, 'draft');
      const ev = await Evidence.create({ UserId: userId, currentVersion: 1 }, { transaction });
      await EvidenceVersion.create({
        EvidenceId: ev.id, UserId: userId, version: 1, status: 'draft', authoring: 'person', payload: encriptarV2(JSON.stringify(payload)),
        origins: [{ type: 'resume', id: skill.resume.id, version: skill.resume.version, stamp: skill.resume.createdAt, skillKey: skill.classified.skillKey }],
        hasChatOrigin: false, consentVersion: null, requestId,
      }, { transaction });
      created.push({ id: ev.id, name: skill.name, skillKey: skill.classified.skillKey, replayed: false });
    }
    return { created, skipped };
  });
}
module.exports = { ResumeSkillsError, MAX_SELECTED, listCandidates, promote };
