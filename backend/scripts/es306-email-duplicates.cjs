// ES-306 · Informe de SOLO LECTURA: cuentas de Users con el mismo correo ignorando mayúsculas y espacios a los lados.
// Úsalo ANTES de aplicar la migración 20261114010000-es306-email-lower-unique (que solo crea el índice único si no hay duplicados). No escribe nada
// y no imprime correos: solo cuántas cuentas hay por grupo y sus ids.
// Uso (en backend/, con DATABASE_URL del entorno a revisar, cargada por quien opera, nunca pegada en el repo ni en el chat):  npm run check:email-duplicates
// Salida 0 = sin duplicados. Salida 2 = hay duplicados (NO se borra ni fusiona nada; fusionar es decisión de Mauricio/Alejo). Salida 1 = no se pudo comprobar.
const { sequelize } = require('../database');
const { duplicateGroups } = require('../migrations/20261114010000-es306-email-lower-unique.cjs');

(async () => {
  try {
    const groups = await duplicateGroups(sequelize);
    if (!groups.length) { console.log('Sin duplicados por lower(email): la migración ES-306 creará el índice único.'); process.exitCode = 0; return; }
    console.log('Hay duplicados. NO se borró ni fusionó nada; decide qué cuenta conservar (ids abajo) antes de migrar.');
    for (const group of groups) console.log(`- ${group.accounts} cuentas con el mismo correo: ids=${group.ids.join(',')}`);
    process.exitCode = 2;
  } catch (error) {
    console.error('No se pudo comprobar:', error.name);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
