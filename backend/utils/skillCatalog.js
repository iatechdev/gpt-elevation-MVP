// backend/utils/skillCatalog.js
// Catálogo de habilidades y rúbricas administrable desde el backoffice (ES-29, RF-06). Contrato: docs/elevation-skillmap/21-CONTRATO-SKILL-MAP.md.
// El sistema NO trae contenido propio: sin un catálogo publicado por el cliente no se evalúa nada. Un catálogo publicado es inmutable.

const { createHash } = require('crypto');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const SkillCatalog = require('../SkillCatalog');
const SkillDefinition = require('../SkillDefinition');
const { normalizeText } = require('./promptSafety');

const KEY_RE = /^[a-z][a-z0-9_]{2,47}$/;
const TYPES = ['transversal', 'domain'];
const LEVELS = ['1', '2', '3', '4'];
const LANGS = ['es', 'en'];
// ES-116: los cinco territorios laborales del mapa (ids estables; los nombres viven en el frontend, ES/EN).
const TERRITORIES = ['dir', 'con', 'com', 'ing', 'inn'];

class SkillError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = (es = 'Datos inválidos.', en = 'Invalid data.') => new SkillError(400, 'invalid_input', es, en);
const notFound = () => new SkillError(404, 'catalog_not_found', 'Catálogo o habilidad no encontrada.', 'Catalog or skill not found.');
const notEditable = () => new SkillError(409, 'catalog_not_editable', 'Solo se puede editar un borrador.', 'Only a draft can be edited.');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (obj, keys) => Object.keys(obj).every((k) => keys.includes(k));
const text = (value, max) => {
  if (typeof value !== 'string') throw invalid();
  const clean = normalizeText(value);
  if (clean.length < 1 || clean.length > max) throw invalid(`El texto debe tener entre 1 y ${max} caracteres.`, `Text must be 1 to ${max} characters.`);
  return clean;
};
const today = () => new Date().toISOString().slice(0, 10);

// Normaliza lo enviado desde el backoffice. Un borrador admite contenido incompleto; publicar exige completarlo.
function normalizeDefinition(body) {
  if (!isPlain(body) || !onlyKeys(body, ['type', 'labels', 'rubric', 'territories'])) throw invalid();
  const out = {};
  if (body.territories !== undefined) {
    const t = body.territories;
    if (!Array.isArray(t) || t.length > TERRITORIES.length || t.some((id) => typeof id !== 'string' || !TERRITORIES.includes(id)) || new Set(t).size !== t.length) {
      throw invalid('Territorios inválidos: usa ids conocidos, sin repetir.', 'Invalid territories: use known ids, without repeats.');
    }
    out.territories = [...t];
  }
  if (body.type === undefined || !TYPES.includes(body.type)) throw invalid();
  out.type = body.type;
  out.labels = {};
  if (body.labels !== undefined) {
    if (!isPlain(body.labels) || !onlyKeys(body.labels, LANGS)) throw invalid();
    for (const lang of LANGS) if (body.labels[lang] !== undefined) out.labels[lang] = text(body.labels[lang], 80);
  }
  out.rubric = { levels: {} };
  if (body.rubric !== undefined) {
    const r = body.rubric;
    if (!isPlain(r) || !onlyKeys(r, ['levels', 'source', 'verifiedBy', 'verifiedAt'])) throw invalid();
    if (r.levels !== undefined) {
      if (!isPlain(r.levels) || !onlyKeys(r.levels, LEVELS)) throw invalid();
      for (const level of LEVELS) {
        if (r.levels[level] === undefined) continue;
        const l = r.levels[level];
        if (!isPlain(l) || !onlyKeys(l, LANGS)) throw invalid();
        out.rubric.levels[level] = {};
        for (const lang of LANGS) if (l[lang] !== undefined) out.rubric.levels[level][lang] = text(l[lang], 300);
      }
    }
    if (r.source !== undefined) out.rubric.source = text(r.source, 200);
    if (r.verifiedBy !== undefined) out.rubric.verifiedBy = text(r.verifiedBy, 200);
    if (r.verifiedAt !== undefined) {
      if (typeof r.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt) || Number.isNaN(Date.parse(r.verifiedAt)) || r.verifiedAt > today()) throw invalid();
      out.rubric.verifiedAt = r.verifiedAt;
    }
  }
  return out;
}

// Lista de lo que falta para poder publicar una habilidad.
function missingFor(def) {
  const missing = [];
  for (const lang of LANGS) if (!def.labels?.[lang]) missing.push(`labels.${lang}`);
  for (const level of LEVELS) for (const lang of LANGS) if (!def.rubric?.levels?.[level]?.[lang]) missing.push(`rubric.levels.${level}.${lang}`);
  for (const k of ['source', 'verifiedBy', 'verifiedAt']) if (!def.rubric?.[k]) missing.push(`rubric.${k}`);
  return missing;
}

const canonical = (def) => JSON.stringify({ type: def.type, labels: def.labels, rubric: def.rubric });
const rubricHash = (def) => createHash('sha256').update(canonical(def)).digest('hex');

async function ownTransaction(fn) {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      throw new SkillError(409, 'conflict', 'Otro cambio ocurrió al mismo tiempo. Reintenta.', 'Another change happened at the same time. Retry.');
    }
    throw error;
  }
}

const describe = (row, count) => ({ id: row.id, version: row.version, status: row.status, publishedAt: row.publishedAt ?? null, skillCount: count });

async function list() {
  const catalogs = await SkillCatalog.findAll({ order: [['version', 'DESC']] });
  const out = [];
  for (const c of catalogs) out.push(describe(c, (await SkillDefinition.findAll({ where: { catalogId: c.id } })).length));
  return { catalogs: out };
}

async function get(id) {
  const catalog = await SkillCatalog.findOne({ where: { id } });
  if (!catalog) throw notFound();
  const defs = await SkillDefinition.findAll({ where: { catalogId: catalog.id }, order: [['skillKey', 'ASC']] });
  return { ...describe(catalog, defs.length), skills: defs.map((d) => ({ skillKey: d.skillKey, type: d.type, labels: d.labels, rubric: d.rubric, territories: d.territories ?? [], missing: missingFor(d) })) };
}

// Crea el borrador copiando el catálogo vigente (o vacío si no hay). Solo puede haber un borrador abierto.
async function createDraft() {
  return ownTransaction(async (transaction) => {
    const open = await SkillCatalog.findOne({ where: { status: 'draft' }, transaction });
    if (open) throw new SkillError(409, 'draft_exists', 'Ya hay un borrador abierto.', 'A draft is already open.', { draftId: open.id });
    const all = await SkillCatalog.findAll({ transaction });
    const published = all.find((c) => c.status === 'published');
    const draft = await SkillCatalog.create({ version: all.reduce((m, c) => Math.max(m, c.version), 0) + 1, status: 'draft' }, { transaction });
    let copied = 0;
    if (published) {
      for (const d of await SkillDefinition.findAll({ where: { catalogId: published.id }, transaction })) {
        await SkillDefinition.create({ catalogId: draft.id, skillKey: d.skillKey, type: d.type, labels: d.labels, rubric: d.rubric, territories: d.territories ?? null }, { transaction });
        copied++;
      }
    }
    return describe(draft, copied);
  });
}

async function editableDraft(id, transaction) {
  const catalog = await SkillCatalog.findOne({ where: { id }, transaction, lock: Transaction.LOCK.UPDATE });
  if (!catalog) throw notFound();
  if (catalog.status !== 'draft') throw notEditable();
  return catalog;
}

async function upsertSkill(id, skillKey, body) {
  if (typeof skillKey !== 'string' || !KEY_RE.test(skillKey)) throw invalid('Clave de habilidad inválida.', 'Invalid skill key.');
  const def = normalizeDefinition(body);
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const existing = await SkillDefinition.findOne({ where: { catalogId: catalog.id, skillKey }, transaction });
    // `territories` omitido conserva lo guardado; [] lo vacía explícitamente.
    const fields = { type: def.type, labels: def.labels, rubric: def.rubric, ...(def.territories !== undefined ? { territories: def.territories } : {}) };
    if (existing) await existing.update(fields, { transaction });
    else await SkillDefinition.create({ catalogId: catalog.id, skillKey, ...fields }, { transaction });
    const territories = def.territories ?? existing?.territories ?? [];
    return { skillKey, ...def, territories, missing: missingFor(def) };
  });
}

async function removeSkill(id, skillKey) {
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const existing = await SkillDefinition.findOne({ where: { catalogId: catalog.id, skillKey }, transaction });
    if (!existing) throw notFound();
    await SkillDefinition.destroy({ where: { catalogId: catalog.id, skillKey }, transaction });
    return { removed: true };
  });
}

// Publicar exige que TODAS las habilidades estén completas (etiquetas ES/EN, 4 niveles en ambos idiomas, fuente, verificador y fecha).
async function publish(id, adminId) {
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const defs = await SkillDefinition.findAll({ where: { catalogId: catalog.id }, transaction });
    if (!defs.length) throw new SkillError(422, 'incomplete_catalog', 'El catálogo no tiene habilidades.', 'The catalog has no skills.', { missing: {} });
    const missing = {};
    for (const d of defs) { const m = missingFor(d); if (m.length) missing[d.skillKey] = m; }
    if (Object.keys(missing).length) {
      throw new SkillError(422, 'incomplete_catalog', 'Faltan datos obligatorios para publicar.', 'Required data is missing to publish.', { missing });
    }
    for (const previous of await SkillCatalog.findAll({ where: { status: 'published' }, transaction })) await previous.update({ status: 'archived' }, { transaction });
    await catalog.update({ status: 'published', publishedAt: new Date(), publishedBy: adminId }, { transaction });
    return describe(catalog, defs.length);
  });
}

// Catálogo vigente con sus habilidades, o null si el cliente no ha publicado ninguno.
async function getPublished() {
  const catalog = await SkillCatalog.findOne({ where: { status: 'published' } });
  if (!catalog) return null;
  const defs = await SkillDefinition.findAll({ where: { catalogId: catalog.id }, order: [['skillKey', 'ASC']] });
  return { version: catalog.version, skills: new Map(defs.map((d) => [d.skillKey, { skillKey: d.skillKey, type: d.type, labels: d.labels, rubric: d.rubric, territories: d.territories ?? [], rubricHash: rubricHash(d) }])) };
}

module.exports = { TERRITORIES, SkillError, list, get, createDraft, upsertSkill, removeSkill, publish, getPublished, normalizeDefinition, missingFor, rubricHash, KEY_RE };
