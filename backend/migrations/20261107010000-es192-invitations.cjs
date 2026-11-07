// ES-192 · Invitación por enlace: tabla Invitations (solo hash del token, un solo uso, vencimiento).
// Aditiva e idempotente. El down (solo con permiso explícito, nunca en producción) borra la tabla.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "Invitations" (
      "id" SERIAL PRIMARY KEY, "email" VARCHAR(254) NOT NULL, "role" VARCHAR(16) NOT NULL, "invitedBy" INTEGER NOT NULL,
      "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "locale" VARCHAR(2) NOT NULL DEFAULT 'es', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "usedAt" TIMESTAMP WITH TIME ZONE, "acceptedUserId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "invitations__email_created_at" ON "Invitations" ("email", "createdAt")', { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "invitations__invited_by_created_at" ON "Invitations" ("invitedBy", "createdAt")', { transaction });
    // ES-117: toda tabla nueva activa RLS en su propia migración (sin política: nadie sin BYPASSRLS la lee ni escribe).
    await sequelize.query('ALTER TABLE "Invitations" ENABLE ROW LEVEL SECURITY', { transaction });
  });
}
async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261107010000-es192-invitations');
  await queryInterface.dropTable('Invitations');
}
module.exports = { up, down };
