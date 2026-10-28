// Carga el catálogo SINTÉTICO de prueba (backend/seeds/routeCatalogSynthetic.cjs) como BORRADOR del catálogo de rutas (ES-31).
// Para desarrollo y staging: se niega a correr con NODE_ENV=production. Publicarlo en staging exige además ALLOW_SYNTHETIC_CATALOG=true
// (producción nunca lo define); sin eso el servidor se niega a publicar contenido sintético.
// Uso: node scripts/seedRouteCatalogSynthetic.js      (con DATABASE_URL del entorno de pruebas)
const { sequelize } = require('../database');
const catalog = require('../utils/routeCatalog');
const { build } = require('../seeds/routeCatalogSynthetic.cjs');

async function main() {
  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('production'), { code: 'production' });
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
  console.error(error && error.code === 'production' ? 'Se niega a correr en producción: el catálogo sintético es solo para pruebas.'
    : error && error.code === 'draft_exists' ? 'Ya hay un borrador abierto: edítalo o publícalo desde el backoffice.' : 'No se pudo cargar el catálogo sintético.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
