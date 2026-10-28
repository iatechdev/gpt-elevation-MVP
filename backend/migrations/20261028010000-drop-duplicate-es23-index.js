'use strict';
// ES-59 · Elimina el índice duplicado que dejó la ejecución manual de la migración de ES-23.
// `export_requests_owner_expiry` tiene las mismas columnas que el índice del modelo
// (`export_requests__user_id_expires_at`). En una base nueva no existe: es un no-op. En staging, donde ES-23 se
// ejecutó a mano después de que `sync()` creara las tablas, lo quita. No afecta a datos.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS export_requests_owner_expiry');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS export_requests_owner_expiry ON "ExportRequests" ("UserId", "expiresAt")',
    );
  },
};
