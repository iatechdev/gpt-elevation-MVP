// backend/utils/routeCatalog.js
// Catálogo curado de rutas, fuentes y recursos, administrable desde el backoffice (ES-31, RF-07, RF-08, RF-10, RF-17).
// Contrato: docs/elevation-skillmap/23-CONTRATO-CATALOGO-RUTAS.md. El sistema NO trae contenido, NO consulta páginas web y NO infiere
// demanda ni elegibilidad: guarda lo que el cliente curó, exige fuente y fecha, y marca como «por confirmar», «no publicado» o
// «desactualizado» lo que no esté verificado. «Vigente», «accesible» y «verificada» son afirmaciones de una persona con nombre y fecha.

const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const RouteCatalog = require('../RouteCatalog');
const RouteCatalogItem = require('../RouteCatalogItem');
const defaultPolicy = require('../config/routeCatalogPolicy.json');
const { normalizeText, redactSecrets } = require('./promptSafety');

const KINDS = ['contexts', 'sources', 'roles', 'offers', 'resources'];
const KEY_RE = /^[a-z][a-z0-9_]{2,47}$/;
const LANGS = ['es', 'en'];
const SOURCE_TYPES = ['official', 'institutional', 'market_report', 'offer_page', 'course_provider', 'other'];
const MODALITIES = ['onsite', 'hybrid', 'remote', 'unknown'];
const LEVELS = ['introductory', 'intermediate', 'advanced'];
const EXPOSURE = ['sourced', 'hypothesis', 'unknown'];
const DRAFT_CAPS = { contexts: 12, sources: 100, roles: 60, offers: 60, resources: 100 };
// Frases que la política del catálogo prohíbe (RF-17): ni «sin futuro» ni lenguaje de reemplazo o automatización total, en ningún campo de texto.
// Se comparan sin tildes y sin distinguir mayúsculas. Es un filtro por frases, limitado: no entiende el sentido de una oración y puede dar
// falsos positivos (p. ej. «será automatizado el registro» en un texto legítimo). «Automatización de procesos» como tema NO se bloquea.
const FORBIDDEN_PHRASES = Object.freeze({
  sin_futuro: /sin futuro|no (tiene|tendra|habra) futuro|(has|have|will have) no future|no future|no futuro/,
  desaparecer: /desaparecer(a|an)\b|will (soon )?disappear|dejara(n)? de existir|will cease to exist/,
  sera_reemplazado: /sera(n)? (completamente |totalmente |pronto )?(reemplazad|sustituid|desplazad|eliminad)/,
  reemplazado_por: /(reemplazad|sustituid|desplazad)[oa]s? por (la |el |las |los )?(ia|inteligencia artificial|maquina|robot|automatizacion)/,
  will_be_replaced: /will be (fully |completely |soon )?(replaced|automated|eliminated|displaced|obsolete)/,
  replaced_by: /(replaced|displaced|substituted) by (ai|artificial|machines?|robots?|automation)/,
  sera_automatizado: /sera(n)? (completamente |totalmente |pronto )?automatizad/,
  tasa_reemplazo: /tasa de reemplazo|replacement rate|automation rate/,
  ya_no_necesaria: /ya no (se )?(necesit|sera(n)? necesari)|no longer (needed|required|necessary)/,
});
const PERCENT = /\d+(?:[.,]\d+)?\s*(%|por\s*ciento|percent|pct\b)/i;
const unaccent = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function checkPolicy(clean, { percent }) {
  const plain = unaccent(clean);
  if (Object.values(FORBIDDEN_PHRASES).some((re) => re.test(plain)) || (percent && PERCENT.test(plain))) {
    throw new CatalogError(422, 'forbidden_label', 'Ese texto no está permitido en el catálogo.', 'That text is not allowed in the catalog.');
  }
}

class CatalogError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = (es = 'Datos inválidos.', en = 'Invalid data.') => new CatalogError(400, 'invalid_input', es, en);
const notFound = () => new CatalogError(404, 'catalog_not_found', 'Catálogo o elemento no encontrado.', 'Catalog or item not found.');
const notEditable = () => new CatalogError(409, 'catalog_not_editable', 'Solo se puede editar un borrador.', 'Only a draft can be edited.');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (obj, keys) => Object.keys(obj).every((k) => keys.includes(k));
const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

// ---------- normalizadores (aceptan borradores incompletos; los obligatorios se exigen al publicar) ----------
const text = (v, max, { percent = false } = {}) => {
  if (typeof v !== 'string') throw invalid();
  const clean = redactSecrets(normalizeText(v));
  if (clean.length < 1 || clean.length > max) throw invalid(`El texto debe tener entre 1 y ${max} caracteres.`, `Text must be 1 to ${max} characters.`);
  checkPolicy(clean, { percent });
  return clean;
};
const i18n = (v, max) => {
  if (!isPlain(v) || !onlyKeys(v, LANGS)) throw invalid();
  const out = {};
  for (const lang of LANGS) if (v[lang] !== undefined) out[lang] = text(v[lang], max, { percent: true });
  return out;
};
const date = (v, { allowFuture = false } = {}) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || (!allowFuture && v > todayIso())) throw invalid();
  return v;
};
const httpsUrl = (v) => {
  if (typeof v !== 'string' || v.length > 500) throw invalid();
  let url;
  try { url = new URL(v); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw invalid();
  return url.toString(); // se guarda como dato: nunca se descarga ni se abre desde el servidor
};
const country = (v) => { if (typeof v !== 'string' || !/^[A-Z]{2}$/.test(v)) throw invalid(); return v; };
const langCode = (v) => { if (typeof v !== 'string' || !/^[a-z]{2}$/.test(v)) throw invalid(); return v; };
const keyList = (v, max) => {
  if (!Array.isArray(v) || v.length > max || !v.every((k) => typeof k === 'string' && KEY_RE.test(k)) || new Set(v).size !== v.length) throw invalid();
  return v;
};
const oneOf = (v, list) => { if (!list.includes(v)) throw invalid(); return v; };
const bool = (v) => { if (typeof v !== 'boolean') throw invalid(); return v; };
const optionalSynthetic = (src, out) => { if (src.synthetic !== undefined) out.synthetic = bool(src.synthetic); };

function shape(src, spec) {
  if (!isPlain(src) || !onlyKeys(src, [...Object.keys(spec), 'synthetic'])) throw invalid();
  const out = {};
  for (const [key, fn] of Object.entries(spec)) if (src[key] !== undefined) out[key] = fn(src[key]);
  optionalSynthetic(src, out);
  return out;
}

const NORMALIZERS = {
  contexts: (src) => shape(src, { labels: (v) => i18n(v, 80), note: (v) => i18n(v, 300) }),
  sources: (src) => shape(src, {
    type: (v) => oneOf(v, SOURCE_TYPES), title: (v) => text(v, 200), url: httpsUrl, country: (v) => (v === null ? null : country(v)), language: langCode,
    publishedAt: (v) => date(v), consultedAt: (v) => date(v), consultedBy: (v) => text(v, 120), accessible: bool,
  }),
  roles: (src) => shape(src, {
    labels: (v) => i18n(v, 100), industry: (v) => i18n(v, 100), market: country,
    languagesRequired: (v) => { if (!Array.isArray(v) || v.length < 1 || v.length > 4 || !v.every((l) => l === 'unknown' || /^[a-z]{2}$/.test(l))) throw invalid(); return v; },
    modality: (v) => { if (!Array.isArray(v) || v.length < 1 || v.length > 4 || !v.every((m) => MODALITIES.includes(m))) throw invalid(); return v; },
    tasks: (v) => {
      if (!Array.isArray(v) || v.length < 1 || v.length > 12) throw invalid();
      return v.map((task) => {
        if (!isPlain(task) || !onlyKeys(task, ['text', 'aiExposure'])) throw invalid();
        const out = {};
        if (task.text !== undefined) out.text = i18n(task.text, 200);
        if (task.aiExposure !== undefined) {
          const e = task.aiExposure;
          if (!isPlain(e) || !onlyKeys(e, ['status', 'sourceKey', 'note'])) throw invalid();
          out.aiExposure = { status: oneOf(e.status, EXPOSURE) };
          if (e.sourceKey !== undefined) { if (typeof e.sourceKey !== 'string' || !KEY_RE.test(e.sourceKey)) throw invalid(); out.aiExposure.sourceKey = e.sourceKey; }
          if (e.note !== undefined) {
            out.aiExposure.note = i18n(e.note, 300);
          }
        }
        return out;
      });
    },
    barriers: (v) => { if (!Array.isArray(v) || v.length > 8) throw invalid(); return v.map((b) => i18n(b, 200)); },
    capabilities: (v) => {
      if (!Array.isArray(v) || v.length > 12) throw invalid();
      return v.map((c) => {
        if (!isPlain(c) || !onlyKeys(c, ['skillKey', 'importance']) || typeof c.skillKey !== 'string' || !KEY_RE.test(c.skillKey)) throw invalid();
        return { skillKey: c.skillKey, importance: oneOf(c.importance, ['essential', 'optional']) };
      });
    },
    contexts: (v) => keyList(v, 6), sourceKeys: (v) => keyList(v, 12),
    review: (v) => { if (!isPlain(v) || !onlyKeys(v, ['by', 'at'])) throw invalid(); const out = {}; if (v.by !== undefined) out.by = text(v.by, 120); if (v.at !== undefined) out.at = date(v.at); return out; },
    regulated: (v) => {
      if (!isPlain(v) || !onlyKeys(v, ['isRegulated', 'note', 'sourceKey'])) throw invalid();
      const out = {};
      if (v.isRegulated !== undefined) out.isRegulated = bool(v.isRegulated);
      if (v.note !== undefined) out.note = i18n(v.note, 300);
      if (v.sourceKey !== undefined) { if (typeof v.sourceKey !== 'string' || !KEY_RE.test(v.sourceKey)) throw invalid(); out.sourceKey = v.sourceKey; }
      return out;
    },
  }),
  offers: (src) => shape(src, {
    title: (v) => text(v, 200), organization: (v) => text(v, 200), roleKey: (v) => { if (typeof v !== 'string' || !KEY_RE.test(v)) throw invalid(); return v; },
    url: httpsUrl, market: country, language: langCode, modality: (v) => oneOf(v, MODALITIES), postedAt: (v) => date(v), checkedAt: (v) => date(v),
    // El salario siempre se declara: publicado con su texto, o «no publicado». No hay campos de demanda ni de volumen.
    salary: (v) => {
      if (!isPlain(v) || !onlyKeys(v, ['published', 'text'])) throw invalid();
      const out = { published: bool(v.published) };
      if (v.text !== undefined) out.text = text(v.text, 100);
      return out;
    },
    verification: (v) => { if (!isPlain(v) || !onlyKeys(v, ['by', 'at'])) throw invalid(); const out = {}; if (v.by !== undefined) out.by = text(v.by, 120); if (v.at !== undefined) out.at = date(v.at); return out; },
    extract: (v) => text(v, 300),
  }),
  resources: (src) => shape(src, {
    kind: (v) => oneOf(v, ['course', 'reading']), title: (v) => text(v, 200), url: httpsUrl, provider: (v) => text(v, 120), purpose: (v) => i18n(v, 300),
    language: langCode, level: (v) => oneOf(v, LEVELS),
    duration: (v) => {
      if (!isPlain(v) || !onlyKeys(v, ['minutes', 'text'])) throw invalid();
      const out = {};
      if (v.minutes !== undefined) { if (!Number.isInteger(v.minutes) || v.minutes < 1 || v.minutes > 100000) throw invalid(); out.minutes = v.minutes; }
      if (v.text !== undefined) out.text = text(v.text, 100);
      return out;
    },
    price: (v) => {
      if (!isPlain(v) || !onlyKeys(v, ['published', 'amount', 'currency'])) throw invalid();
      const out = { published: bool(v.published) };
      if (v.amount !== undefined) { if (typeof v.amount !== 'number' || !Number.isFinite(v.amount) || v.amount < 0 || v.amount > 1e9) throw invalid(); out.amount = v.amount; }
      if (v.currency !== undefined) { if (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)) throw invalid(); out.currency = v.currency; }
      return out;
    },
    linkedSkillKey: (v) => { if (typeof v !== 'string' || !KEY_RE.test(v)) throw invalid(); return v; }, exercise: (v) => i18n(v, 300),
    roleKeys: (v) => keyList(v, 12), sourceKey: (v) => { if (typeof v !== 'string' || !KEY_RE.test(v)) throw invalid(); return v; },
  }),
};

function normalizeItem(kind, src) {
  if (!KINDS.includes(kind)) throw notFound();
  return NORMALIZERS[kind](src);
}

// ---------- completitud al publicar ----------
const both = (v) => isPlain(v) && v.es && v.en;
function missingFor(kind, item) {
  const m = [];
  const need = (cond, name) => { if (!cond) m.push(name); };
  if (kind === 'contexts') need(both(item.labels), 'labels');
  if (kind === 'sources') {
    for (const k of ['type', 'title', 'url', 'language', 'consultedAt', 'consultedBy']) need(item[k] !== undefined, k);
    need(item.accessible !== undefined, 'accessible');
    need('country' in item, 'country'); // país o null declarado
  }
  if (kind === 'roles') {
    need(both(item.labels), 'labels'); need(both(item.industry), 'industry'); need(item.market, 'market');
    need(item.languagesRequired, 'languagesRequired'); need(item.modality, 'modality');
    need(item.tasks?.length, 'tasks');
    (item.tasks || []).forEach((t, i) => {
      need(both(t.text), `tasks.${i}.text`); need(t.aiExposure?.status, `tasks.${i}.aiExposure`);
      if (t.aiExposure?.status === 'sourced') need(t.aiExposure.sourceKey, `tasks.${i}.aiExposure.sourceKey`);
    });
    need(item.barriers !== undefined, 'barriers'); need(item.capabilities !== undefined, 'capabilities');
    need(item.contexts?.length, 'contexts'); need(item.sourceKeys?.length, 'sourceKeys');
    need(item.review?.by && item.review?.at, 'review'); // revisión de dominio identificada
    need(item.regulated?.isRegulated !== undefined, 'regulated');
    if (item.regulated?.isRegulated) need(both(item.regulated.note), 'regulated.note'); // la habilitación queda pendiente; nunca se afirma elegibilidad
  }
  if (kind === 'offers') {
    for (const k of ['title', 'organization', 'roleKey', 'url', 'market', 'language', 'modality', 'checkedAt']) need(item[k] !== undefined, k);
    need(item.salary?.published !== undefined, 'salary');
    if (item.salary?.published) need(item.salary.text, 'salary.text');
    need(item.verification?.by && item.verification?.at, 'verification');
  }
  if (kind === 'resources') {
    for (const k of ['kind', 'title', 'url', 'provider', 'language', 'level', 'linkedSkillKey']) need(item[k] !== undefined, k);
    need(both(item.purpose), 'purpose'); need(both(item.exercise), 'exercise');
    need(item.duration && (item.duration.minutes || item.duration.text), 'duration');
    need(item.price?.published !== undefined, 'price');
    if (item.price?.published) need(item.price.amount !== undefined && item.price.currency, 'price.amount');
  }
  return m;
}

function crossRefs(byKind, policy) {
  const problems = {};
  const add = (kind, key, what) => { (problems[`${kind}/${key}`] ||= []).push(what); };
  const has = (kind, key) => byKind[kind].has(key);
  for (const [key, r] of byKind.roles) {
    (r.contexts || []).forEach((c) => { if (!has('contexts', c)) add('roles', key, `contexts.${c}`); });
    (r.sourceKeys || []).forEach((s) => { if (!has('sources', s)) add('roles', key, `sourceKeys.${s}`); });
    (r.tasks || []).forEach((t, i) => { if (t.aiExposure?.sourceKey && !has('sources', t.aiExposure.sourceKey)) add('roles', key, `tasks.${i}.aiExposure.sourceKey`); });
    if (r.regulated?.sourceKey && !has('sources', r.regulated.sourceKey)) add('roles', key, 'regulated.sourceKey');
  }
  const perRole = new Map();
  for (const [key, o] of byKind.offers) {
    if (o.roleKey && !has('roles', o.roleKey)) add('offers', key, `roleKey.${o.roleKey}`);
    perRole.set(o.roleKey, (perRole.get(o.roleKey) || 0) + 1);
  }
  for (const [roleKey, count] of perRole) {
    if (count > policy.maxOffersPerRole) add('roles', roleKey, `offers_over_${policy.maxOffersPerRole}`);
  }
  for (const [key, r] of byKind.resources) {
    (r.roleKeys || []).forEach((k) => { if (!has('roles', k)) add('resources', key, `roleKeys.${k}`); });
    if (r.sourceKey && !has('sources', r.sourceKey)) add('resources', key, 'sourceKey');
  }
  return problems;
}

// ---------- operaciones ----------
async function ownTransaction(fn) {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      throw new CatalogError(409, 'conflict', 'Otro cambio ocurrió al mismo tiempo. Reintenta.', 'Another change happened at the same time. Retry.');
    }
    throw error;
  }
}

const describe = (row, count) => ({ id: row.id, version: row.version, status: row.status, publishedAt: row.publishedAt ?? null, itemCount: count });
const grouped = (items) => Object.fromEntries(KINDS.map((k) => [k, new Map(items.filter((i) => i.kind === k).map((i) => [i.itemKey, i.data]))]));

async function list() {
  const out = [];
  for (const c of await RouteCatalog.findAll({ order: [['version', 'DESC']] })) out.push(describe(c, (await RouteCatalogItem.findAll({ where: { catalogId: c.id } })).length));
  return { catalogs: out };
}

async function get(id, policy = defaultPolicy) {
  const catalog = await RouteCatalog.findOne({ where: { id } });
  if (!catalog) throw notFound();
  const items = await RouteCatalogItem.findAll({ where: { catalogId: catalog.id } });
  const byKind = grouped(items);
  const missing = {};
  for (const kind of KINDS) for (const [key, data] of byKind[kind]) { const m = missingFor(kind, data); if (m.length) missing[`${kind}/${key}`] = m; }
  const refs = crossRefs(byKind, policy);
  for (const [k, v] of Object.entries(refs)) missing[k] = [...(missing[k] || []), ...v];
  return { ...describe(catalog, items.length), items: Object.fromEntries(KINDS.map((k) => [k, [...byKind[k]].map(([itemKey, data]) => ({ itemKey, ...data }))])), missing };
}

async function createDraft() {
  return ownTransaction(async (transaction) => {
    const open = await RouteCatalog.findOne({ where: { status: 'draft' }, transaction });
    if (open) throw new CatalogError(409, 'draft_exists', 'Ya hay un borrador abierto.', 'A draft is already open.', { draftId: open.id });
    const all = await RouteCatalog.findAll({ transaction });
    const published = all.find((c) => c.status === 'published');
    const draft = await RouteCatalog.create({ version: all.reduce((m, c) => Math.max(m, c.version), 0) + 1, status: 'draft' }, { transaction });
    let copied = 0;
    if (published) {
      for (const it of await RouteCatalogItem.findAll({ where: { catalogId: published.id }, transaction })) {
        await RouteCatalogItem.create({ catalogId: draft.id, kind: it.kind, itemKey: it.itemKey, data: it.data }, { transaction });
        copied++;
      }
    }
    return describe(draft, copied);
  });
}

async function editableDraft(id, transaction) {
  const catalog = await RouteCatalog.findOne({ where: { id }, transaction, lock: Transaction.LOCK.UPDATE });
  if (!catalog) throw notFound();
  if (catalog.status !== 'draft') throw notEditable();
  return catalog;
}

async function upsertItem(id, kind, key, body) {
  if (!KINDS.includes(kind)) throw notFound();
  if (typeof key !== 'string' || !KEY_RE.test(key)) throw invalid('Clave inválida.', 'Invalid key.');
  const data = normalizeItem(kind, body);
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const existing = await RouteCatalogItem.findOne({ where: { catalogId: catalog.id, kind, itemKey: key }, transaction });
    if (existing) await existing.update({ data }, { transaction });
    else {
      const count = (await RouteCatalogItem.findAll({ where: { catalogId: catalog.id, kind }, transaction })).length;
      if (count >= DRAFT_CAPS[kind]) throw new CatalogError(409, 'catalog_limit', 'Se alcanzó el máximo de elementos de este tipo.', 'The maximum number of items of this kind was reached.');
      await RouteCatalogItem.create({ catalogId: catalog.id, kind, itemKey: key, data }, { transaction });
    }
    return { kind, itemKey: key, ...data, missing: missingFor(kind, data) };
  });
}

async function removeItem(id, kind, key) {
  if (!KINDS.includes(kind)) throw notFound();
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const existing = await RouteCatalogItem.findOne({ where: { catalogId: catalog.id, kind, itemKey: key }, transaction });
    if (!existing) throw notFound();
    await RouteCatalogItem.destroy({ where: { catalogId: catalog.id, kind, itemKey: key }, transaction });
    return { removed: true };
  });
}

// Publicar exige completitud y referencias cruzadas válidas, y que el catálogo no contenga contenido sintético fuera de pruebas.
async function publish(id, adminId, { policy = defaultPolicy, allowSynthetic = process.env.ALLOW_SYNTHETIC_CATALOG === 'true' } = {}) {
  return ownTransaction(async (transaction) => {
    const catalog = await editableDraft(id, transaction);
    const items = await RouteCatalogItem.findAll({ where: { catalogId: catalog.id }, transaction });
    const byKind = grouped(items);
    if (!byKind.contexts.size || !byKind.roles.size) {
      throw new CatalogError(422, 'incomplete_catalog', 'El catálogo necesita al menos un contexto y un rol.', 'The catalog needs at least one context and one role.', { missing: {} });
    }
    const missing = {};
    if (byKind.contexts.size > policy.maxContexts) missing.contexts = [`over_${policy.maxContexts}`];
    if (byKind.offers.size > policy.maxOffersTotal) missing.offers = [`over_${policy.maxOffersTotal}`];
    for (const kind of KINDS) for (const [key, data] of byKind[kind]) { const m = missingFor(kind, data); if (m.length) missing[`${kind}/${key}`] = m; }
    for (const [k, v] of Object.entries(crossRefs(byKind, policy))) missing[k] = [...(missing[k] || []), ...v];
    if (Object.keys(missing).length) throw new CatalogError(422, 'incomplete_catalog', 'Faltan datos obligatorios para publicar.', 'Required data is missing to publish.', { missing });
    if (!allowSynthetic && items.some((i) => i.data.synthetic)) {
      throw new CatalogError(422, 'synthetic_content_not_allowed', 'El catálogo contiene contenido sintético de prueba.', 'The catalog contains synthetic test content.');
    }
    for (const previous of await RouteCatalog.findAll({ where: { status: 'published' }, transaction })) await previous.update({ status: 'archived' }, { transaction });
    await catalog.update({ status: 'published', publishedAt: new Date(), publishedBy: adminId }, { transaction });
    return describe(catalog, items.length);
  });
}

// ---------- lectura para participantes y para ES-32: solo lo publicado, con la frescura ya calculada ----------
const daysBetween = (isoDate, now) => Math.floor((Date.parse(todayIso(now)) - Date.parse(isoDate)) / 86400000);

async function getPublishedRouteCatalog({ now = new Date(), policy = defaultPolicy } = {}) {
  const catalog = await RouteCatalog.findOne({ where: { status: 'published' } });
  if (!catalog) return null;
  const byKind = grouped(await RouteCatalogItem.findAll({ where: { catalogId: catalog.id } }));
  const sources = [...byKind.sources].map(([sourceKey, s]) => {
    // Una fuente inaccesible o antigua no se presenta como confirmación actual.
    const stale = s.accessible === false || daysBetween(s.consultedAt, now) > policy.sourceStaleDays;
    const { consultedBy, ...open } = s; // el nombre de quien consultó no se publica a participantes
    void consultedBy;
    return { sourceKey, ...open, stale };
  });
  const sourceByKey = new Map(sources.map((s) => [s.sourceKey, s]));
  const roles = [...byKind.roles].map(([roleKey, r]) => {
    const { review, ...open } = r; // solo se publica que existe revisión de dominio y su fecha, no el nombre
    const fresh = (r.sourceKeys || []).some((k) => sourceByKey.get(k) && !sourceByKey.get(k).stale);
    return { roleKey, ...open, domainReview: { present: Boolean(review?.by), at: review?.at ?? null }, verificationTask: !fresh };
  });
  const offers = [...byKind.offers].map(([offerKey, o]) => {
    const { verification, ...open } = o;
    const current = verification?.at && daysBetween(verification.at, now) <= policy.offerVerificationDays;
    return { offerKey, ...open, salary: o.salary.published ? o.salary : { published: false }, verifiedAt: verification?.at ?? null, status: current ? 'current' : 'expired' };
  });
  const resources = [...byKind.resources].map(([resourceKey, r]) => ({ resourceKey, ...r }));
  const contexts = [...byKind.contexts].map(([contextKey, c]) => ({ contextKey, ...c }));
  return { version: catalog.version, publishedAt: catalog.publishedAt, contexts, sources, roles, offers, resources };
}

module.exports = {
  CatalogError, FORBIDDEN_PHRASES, KINDS, KEY_RE, list, get, createDraft, upsertItem, removeItem, publish, getPublishedRouteCatalog, normalizeItem, missingFor,
};
