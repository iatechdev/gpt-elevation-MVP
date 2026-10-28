// Datos de DEMOSTRACIÓN para staging: catálogo de habilidades y de rutas publicados, una persona sintética con evidencia confirmada y tres
// autoevaluaciones, para que «Mi mapa», las evidencias y el catálogo de rutas se vean con contenido. Todo es sintético y está rotulado como tal.
// NO es contenido del cliente: el catálogo real lo escribe y publica el cliente desde el backoffice (ES-29, ES-31).
//
// Protecciones (en este orden):
//  1. Exige ALLOW_SYNTHETIC_CATALOG=true (la misma bandera que ya gobierna la publicación de contenido sintético; producción nunca la define)
//     y DEMO_USER_PASSWORD (la clave de la persona de demostración sale del entorno del operador; no está en el repositorio ni se imprime).
//  2. Antes de escribir NADA, se niega si ya hay un catálogo PUBLICADO que no sea sintético (no pisa datos del cliente) o un borrador abierto
//     (no mezcla contenido). Así un rechazo nunca deja la base a medias.
//  3. Es idempotente: una segunda corrida no duplica nada (requestId fijos) y no cambia la clave de una persona ya creada.
const bcrypt = require('bcryptjs');
const User = require('../User');
const SkillCatalog = require('../SkillCatalog');
const RouteCatalog = require('../RouteCatalog');
const skillCatalog = require('./skillCatalog');
const routeCatalog = require('./routeCatalog');
const evidence = require('./evidence');
const skillMap = require('./skillMap');
const { build: buildRouteCatalog } = require('../seeds/routeCatalogSynthetic.cjs');
const data = require('./demoSeedData');

const { SeedError, assertSeedAllowed, isSyntheticLabel, demoSkills, DEMO_EVIDENCE, DEMO_EMAIL } = data;
const ROUTE_KINDS = ['contexts', 'sources', 'roles', 'offers', 'resources'];

// Protección 2: solo lecturas. Devuelve qué hay que crear; lanza antes de que se escriba cualquier cosa.
async function preflight() {
  const skills = await skillCatalog.getPublished();
  if (skills && [...skills.skills.values()].some((skill) => !isSyntheticLabel(skill.labels))) {
    throw new SeedError('real_catalog_present', 'Ya hay un catálogo de habilidades publicado que no es sintético: no se toca.');
  }
  const routes = await routeCatalog.getPublishedRouteCatalog();
  if (routes && ROUTE_KINDS.flatMap((kind) => routes[kind] || []).some((item) => item.synthetic !== true)) {
    throw new SeedError('real_catalog_present', 'Ya hay un catálogo de rutas publicado que no es sintético: no se toca.');
  }
  if (!skills && await SkillCatalog.findOne({ where: { status: 'draft' } })) throw new SeedError('draft_exists', 'Hay un borrador de habilidades abierto.');
  if (!routes && await RouteCatalog.findOne({ where: { status: 'draft' } })) throw new SeedError('draft_exists', 'Hay un borrador de rutas abierto.');
  return { createSkills: !skills, createRoutes: !routes };
}

async function seedSkillCatalog(now) {
  const draft = await skillCatalog.createDraft();
  for (const skill of demoSkills(now)) await skillCatalog.upsertSkill(draft.id, skill.skillKey, { type: skill.type, labels: skill.labels, rubric: skill.rubric });
  await skillCatalog.publish(draft.id, null);
}

async function seedRouteCatalog() {
  const draft = await routeCatalog.createDraft();
  const content = buildRouteCatalog();
  for (const kind of routeCatalog.KINDS) for (const [key, item] of Object.entries(content[kind])) await routeCatalog.upsertItem(draft.id, kind, key, item);
  await routeCatalog.publish(draft.id, null, { allowSynthetic: true });
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
  if (plan.createSkills) await seedSkillCatalog(now);
  if (plan.createRoutes) await seedRouteCatalog();
  const { user, created } = await seedParticipant(env);
  for (const item of DEMO_EVIDENCE) {
    const saved = await evidence.create(user.id, data.evidenceBody(item));
    await skillMap.selfAssess(user.id, {
      skillKey: item.skillKey, level: item.level, evidenceRefs: [{ evidenceId: saved.id, version: 1 }], requestId: data.assessRequestId(item),
    });
  }
  return {
    skillCatalog: plan.createSkills ? 'created' : 'exists', routeCatalog: plan.createRoutes ? 'created' : 'exists', participant: created ? 'created' : 'exists',
    evidence: DEMO_EVIDENCE.length, assessments: DEMO_EVIDENCE.length, email: DEMO_EMAIL,
  };
}

module.exports = { seedDemo, preflight, ...data };
