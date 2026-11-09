// ES-219 · Comprobación de SOLO LECTURA: ¿hay versiones repetidas o más de una guía activa por clave en "PromptVaults"?
// Úsala ANTES de aplicar la migración 20261109010000-es219-prompt-version-unique. No escribe nada y no imprime el texto de las guías.
// Uso (en backend/, con DATABASE_URL del entorno que quieras revisar, cargada por quien opera, nunca pegada en el repo ni en el chat):
//   npm run check:prompt-duplicates
// Salida 0 = sin duplicados (se puede migrar). Salida 2 = hay duplicados (informe por clave: ids de las filas); NO se borra nada.
const { sequelize } = require('../database');
const { findDuplicates } = require('../migrations/20261109010000-es219-prompt-version-unique.cjs');

(async () => {
  try {
    const report = await findDuplicates(sequelize);
    if (!report.versions.length && !report.active.length) { console.log('Sin duplicados: la migración ES-219 puede aplicarse.'); process.exitCode = 0; return; }
    console.log('Hay duplicados. NO se borró nada; decide qué filas conservar (ids abajo) antes de migrar.');
    for (const row of report.versions) console.log(`- versión repetida: clave=${row.key} versión=${row.version} filas=${row.rows} ids=${row.ids.join(',')}`);
    for (const row of report.active) console.log(`- más de una activa: clave=${row.key} filas=${row.rows} ids=${row.ids.join(',')}`);
    process.exitCode = 2;
  } catch (error) {
    console.error('No se pudo comprobar:', error.name);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
