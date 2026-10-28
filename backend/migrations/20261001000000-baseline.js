'use strict';
// ES-59 · Línea base (versión 20261001, anterior a toda migración posterior). Crea el esquema que `sequelize.sync()` producía el 28-oct-2026 sobre una base vacía
// (36 tablas y sus índices), tal como lo registró `sync` con los modelos de `main`.
// Es idempotente (`CREATE TABLE IF NOT EXISTS`), así que se puede marcar como aplicada en una base que
// ya tiene el esquema (staging) sin recrear nada. Una migración ya aplicada no se edita: los cambios
// futuros son migraciones nuevas con `up` y `down`.
const statements = require('./baseline-20261028.json');

const tablas = statements
  .map((sql) => (sql.match(/^CREATE TABLE IF NOT EXISTS "(\w+)"/) || [])[1])
  .filter(Boolean);

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of statements) {
        await queryInterface.sequelize.query(sql, { transaction });
      }
    });
  },

  // Borra TODAS las tablas. Solo para bases desechables (CI y desarrollo): se niega en producción
  // y exige una variable explícita. En producción no se ejecutan `down`; se corrige hacia adelante.
  async down(queryInterface) {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_MIGRATION !== 'true') {
      throw new Error('El down de la línea base borra todas las tablas: exige ALLOW_DESTRUCTIVE_MIGRATION=true y no se permite con NODE_ENV=production.');
    }
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const tabla of [...tablas].reverse()) {
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${tabla}" CASCADE`, { transaction });
      }
    });
  },
};
