// Carga los datos de DEMOSTRACIÓN sintéticos en staging (catálogos de habilidades y de rutas publicados + una persona con evidencia y autoevaluaciones).
// Uso (en el entorno de staging, con las variables definidas por el operador; ninguna se imprime):
//   ALLOW_SYNTHETIC_CATALOG=true DEMO_USER_PASSWORD=<clave de 12+ caracteres> node scripts/seedStagingDemo.js
// Es idempotente. Se niega si ya hay un catálogo real publicado o un borrador abierto. NO usar en producción: ahí no se define ALLOW_SYNTHETIC_CATALOG.
const { sequelize } = require('../database');
const { seedDemo, SeedError } = require('../utils/demoSeed');

async function main() {
  await sequelize.authenticate();
  // Solo las tablas del Skill Map y las rutas (crear si faltan, nunca alterar); Users ya existe en staging.
  for (const model of ['SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'RouteCatalog', 'RouteCatalogItem', 'Evidence', 'EvidenceVersion', 'DerivedInvalidation',
    'Consent', 'ConsentEvent', 'DeletionRequest']) await require('../' + model).sync();
  const result = await seedDemo();
  console.log(JSON.stringify({ ...result, synthetic: true }));
}
main().catch((error) => {
  const messages = {
    synthetic_not_allowed: 'Se niega: define ALLOW_SYNTHETIC_CATALOG=true solo en staging o pruebas.',
    password_required: 'Se niega: define DEMO_USER_PASSWORD (mínimo 12 caracteres) en el entorno del operador.',
    real_catalog_present: 'Se niega: ya hay un catálogo real publicado. No se toca.',
    draft_exists: 'Se niega: hay un borrador abierto. Publícalo o descártalo desde el backoffice y vuelve a intentar.',
  };
  const code = error instanceof SeedError || (error && error.code) ? error.code : null;
  console.error(messages[code] || 'No se pudo cargar la demostración.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
