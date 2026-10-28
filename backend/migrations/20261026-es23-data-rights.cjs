// Additive, idempotent migration. No existing table or personal record is changed.
// Acepta una instancia de Sequelize (scripts/migrateDataRights.js) o el queryInterface que pasa sequelize-cli (ES-59).
async function up(arg) {
  // Con sequelize-cli llega el queryInterface: las tablas ExportRequests y DeletionRequests ya las crea la línea
  // base (20261001000000), con el índice del modelo; repetir esta migración duplicaría el índice (ES-59).
  if (arg.sequelize) return;
  const sequelize = arg;
  await sequelize.transaction(async transaction => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "ExportRequests" (
      "id" UUID PRIMARY KEY,
      "UserId" INTEGER NOT NULL,
      "locale" VARCHAR(2) NOT NULL,
      "fingerprint" VARCHAR(64) NOT NULL,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`, { transaction });
    await sequelize.query(`CREATE INDEX IF NOT EXISTS export_requests_owner_expiry
      ON "ExportRequests" ("UserId", "expiresAt")`, { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "DeletionRequests" (
      "id" UUID PRIMARY KEY,
      "UserId" INTEGER NOT NULL UNIQUE,
      "status" VARCHAR(32) NOT NULL DEFAULT 'accepted',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "activePurgedAt" TIMESTAMP WITH TIME ZONE,
      "failureCode" VARCHAR(48),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`, { transaction });
    await sequelize.query(`CREATE INDEX IF NOT EXISTS deletion_requests_status
      ON "DeletionRequests" ("status")`, { transaction });
  });
}

// A code rollback MUST retain tombstones and the session/consent deletion guard.
// Dropping the ledger could resurrect access and is never a rollback operation.
// Para sequelize-cli (ES-59): sin efecto a propósito. Las tablas las borra el down de la línea base en bases
// desechables; en producción no se ejecutan down.
async function down() {}

module.exports = { up, down };
