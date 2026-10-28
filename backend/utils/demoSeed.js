// Datos de DEMOSTRACIÓN para staging: catálogo de habilidades y de rutas publicados, una persona sintética con evidencia confirmada y tres
// autoevaluaciones, para que «Mi mapa», las evidencias y el catálogo de rutas se vean con contenido. Todo es sintético y está rotulado como tal.
// NO es contenido del cliente: el catálogo real lo escribe y publica el cliente desde el backoffice (ES-29, ES-31).
//
// Protecciones (en este orden):
//  1. Exige ALLOW_SYNTHETIC_CATALOG=true (la misma bandera que ya gobierna la publicación de contenido sintético; producción nunca la define)
//     y DEMO_USER_PASSWORD (la clave de la persona de demostración sale del entorno del operador; no está en el repositorio ni se imprime).
//  2. Antes de escribir NADA, se niega si ya hay un catálogo PUBLICADO que no sea sintético (no pisa datos del cliente) o un borrador abierto que
//     no sea claramente de esta semilla (no mezcla contenido). Un rechazo no deja la base a medias.
//  3. Es idempotente y REANUDABLE: cada helper de catálogo confirma su propia transacción, así que un corte entre «crear borrador» y «publicar» deja
//     un borrador a medias. Si ese borrador es íntegramente sintético y no está vacío, es de esta semilla y la siguiente corrida lo completa y lo
//     publica; un borrador vacío o con cualquier contenido real se trata como del cliente y se rechaza.
const bcrypt = require('bcryptjs');
const User = require('../User');
const SkillCatalog = require('../SkillCatalog');
const SkillDefinition = require('../SkillDefinition');
const RouteCatalog = require('../RouteCatalog');
const RouteCatalogItem = require('../RouteCatalogItem');
const skillCatalog = require('./skillCatalog');
const routeCatalog = require('./routeCatalog');
const evidence = require('./evidence');
const skillMap = require('./skillMap');
const { build: buildRouteCatalog } = require('../seeds/routeCatalogSynthetic.cjs');
const data = require('./demoSeedData');

const { SeedError, assertSeedAllowed, isSyntheticLabel, demoSkills, DEMO_EVIDENCE, DEMO_EMAIL } = data;
const ROUTE_KINDS = ['contexts', 'sources', 'roles', 'offers', 'resources'];

// Borrador abierto de esta semilla: no vacío y con todos sus elementos sintéticos. Cualquier otro borrador abierto es del cliente.
async function ownDraft(Catalog, Items, isSynthetic, what) {
  const draft = await Catalog.findOne({ where: { status: 'draft' } });
  if (!draft) return null;
  const items = await Items.findAll({ where: { catalogId: draft.id } });
  if (!items.length || !items.every(isSynthetic)) throw new SeedError('draft_exists', `Hay un borrador de ${what} abierto que no es de la semilla.`);
  return draft;
}

// Protección 2: solo lecturas. Devuelve qué hay que crear o completar; lanza antes de que se escriba cualquier cosa.
async function preflight() {
  const skills = await skillCatalog.getPublished();
  if (skills && [...skills.skills.values()].some((skill) => !isSyntheticLabel(skill.labels))) {
    throw new SeedError('real_catalog_present', 'Ya hay un catálogo de habilidades publicado que no es sintético: no se toca.');
  }
  const routes = await routeCatalog.getPublishedRouteCatalog();
  if (routes && ROUTE_KINDS.flatMap((kind) => routes[kind] || []).some((item) => item.synthetic !== true)) {
    throw new SeedError('real_catalog_present', 'Ya hay un catálogo de rutas publicado que no es sintético: no se toca.');
  }
  const skillDraft = skills ? null : await ownDraft(SkillCatalog, SkillDefinition, (d) => isSyntheticLabel(d.labels), 'habilidades');
  const routeDraft = routes ? null : await ownDraft(RouteCatalog, RouteCatalogItem, (i) => Boolean(i.data && i.data.synthetic === true), 'rutas');
  return { createSkills: !skills, skillDraftId: skillDraft ? skillDraft.id : null, createRoutes: !routes, routeDraftId: routeDraft ? routeDraft.id : null };
}

async function seedSkillCatalog(now, draftId) {
  const id = draftId ?? (await skillCatalog.createDraft()).id;
  for (const skill of demoSkills(now)) await skillCatalog.upsertSkill(id, skill.skillKey, { type: skill.type, labels: skill.labels, rubric: skill.rubric });
  await skillCatalog.publish(id, null);
}

async function seedRouteCatalog(draftId) {
  const id = draftId ?? (await routeCatalog.createDraft()).id;
  const content = buildRouteCatalog();
  for (const kind of routeCatalog.KINDS) for (const [key, item] of Object.entries(content[kind])) await routeCatalog.upsertItem(id, kind, key, item);
  await routeCatalog.publish(id, null, { allowSynthetic: true });
}

async function seedParticipant(env) {
  const existing = await User.findOne({ where: { email: DEMO_EMAIL } });
  if (existing) return { user: existing, created: false };
  const password = await bcrypt.hash(env.DEMO_USER_PASSWORD, 10);
  const user = await User.create({ name: 'Persona sintética (demostración)', email: DEMO_EMAIL, password, role: 'user', active: true });
  return { user, created: true };
}

async function seedDemo({ env = process.env, now = new Date() } = {}) {
  assertSeedAllowed(env);
  const plan = await preflight();
  if (plan.createSkills) await seedSkillCatalog(now, plan.skillDraftId);
  if (plan.createRoutes) await seedRouteCatalog(plan.routeDraftId);
  const { user, created } = await seedParticipant(env);
  for (const item of DEMO_EVIDENCE) {
    const saved = await evidence.create(user.id, data.evidenceBody(item));
    await skillMap.selfAssess(user.id, {
      skillKey: item.skillKey, level: item.level, evidenceRefs: [{ evidenceId: saved.id, version: 1 }], requestId: data.assessRequestId(item),
    });
  }
  return {
    skillCatalog: plan.createSkills ? (plan.skillDraftId ? 'resumed' : 'created') : 'exists',
    routeCatalog: plan.createRoutes ? (plan.routeDraftId ? 'resumed' : 'created') : 'exists',
    participant: created ? 'created' : 'exists', evidence: DEMO_EVIDENCE.length, assessments: DEMO_EVIDENCE.length, email: DEMO_EMAIL,
  };
}

module.exports = { seedDemo, preflight, ...data };
