// Carga el catálogo SINTÉTICO de prueba (backend/seeds/routeCatalogSynthetic.cjs) como BORRADOR del catálogo de rutas (ES-31).
// Para desarrollo y staging: exige ALLOW_SYNTHETIC_CATALOG=true (producción nunca lo define). Antes se negaba con NODE_ENV=production, pero staging corre
// con NODE_ENV=production y no podía cargarlo. Publicarlo exige la misma bandera: sin ella el servidor se niega a publicar contenido sintético.
// Uso: node scripts/seedRouteCatalogSynthetic.js      (con DATABASE_URL del entorno de pruebas)
const { sequelize } = require('../database');
const catalog = require('../utils/routeCatalog');
const { build } = require('../seeds/routeCatalogSynthetic.cjs');

async function main() {
  if (process.env.ALLOW_SYNTHETIC_CATALOG !== 'true') throw Object.assign(new Error('synthetic_not_allowed'), { code: 'synthetic_not_allowed' });
  await sequelize.authenticate();
  await require('../RouteCatalog').sync();
  await require('../RouteCatalogItem').sync();
  const draft = await catalog.createDraft();
  const data = build();
  let count = 0;
  for (const kind of catalog.KINDS) {
    for (const [key, item] of Object.entries(data[kind])) { await catalog.upsertItem(draft.id, kind, key, item); count++; }
  }
  console.log(JSON.stringify({ draftId: draft.id, version: draft.version, items: count, published: false, synthetic: true }));
}
main().catch((error) => {
  console.error(error && error.code === 'synthetic_not_allowed' ? 'Se niega: define ALLOW_SYNTHETIC_CATALOG=true solo en el entorno de pruebas o staging.'
    : error && error.code === 'draft_exists' ? 'Ya hay un borrador abierto: edítalo o publícalo desde el backoffice.' : 'No se pudo cargar el catálogo sintético.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
