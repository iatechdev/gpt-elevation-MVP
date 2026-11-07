// ES-193 · Datos de contacto y ayuda editables: tablas ContactEntries y ContactEntryAudits.
// Aditiva e idempotente. NO siembra ningún número (ninguno va en el código); la lista inicial la carga superadministración desde Contenido.
// El down (solo con permiso explícito, nunca en producción) borra las tablas.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "ContactEntries" (
      "id" SERIAL PRIMARY KEY, "country" VARCHAR(2) NOT NULL, "name" VARCHAR(80) NOT NULL, "contact" VARCHAR(32) NOT NULL,
      "descriptionEs" VARCHAR(300) NOT NULL DEFAULT '', "descriptionEn" VARCHAR(300) NOT NULL DEFAULT '', "position" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT false, "source" VARCHAR(300), "verifiedBy" VARCHAR(120), "verifiedAt" DATE,
      "version" INTEGER NOT NULL DEFAULT 1, "updatedBy" VARCHAR(120),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "contact_entries__country_active_position" ON "ContactEntries" ("country", "active", "position")', { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "ContactEntryAudits" (
      "id" SERIAL PRIMARY KEY, "entryId" INTEGER NOT NULL, "action" VARCHAR(16) NOT NULL, "actorId" INTEGER, "actorName" VARCHAR(120),
      "snapshot" TEXT NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "contact_entry_audits__entry_created_at" ON "ContactEntryAudits" ("entryId", "createdAt")', { transaction });
    // ES-117: toda tabla nueva activa RLS en su propia migración (sin política: nadie sin BYPASSRLS la lee ni escribe).
    await sequelize.query('ALTER TABLE "ContactEntries" ENABLE ROW LEVEL SECURITY', { transaction });
    await sequelize.query('ALTER TABLE "ContactEntryAudits" ENABLE ROW LEVEL SECURITY', { transaction });
  });
}
async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261107020000-es193-contact-entries');
  await queryInterface.dropTable('ContactEntryAudits');
  await queryInterface.dropTable('ContactEntries');
}
module.exports = { up, down };
