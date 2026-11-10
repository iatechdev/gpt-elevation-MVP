// ES-186 (parte B) · Tabla AdminAuditEntries (auditoría de acciones de administración) y columna Invitations.requestId con índice único parcial
// (invitar con el mismo requestId es idempotente: una sola invitación por quien invita y requestId).
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS): nada se borra ni se reescribe; las filas actuales de Invitations quedan con requestId NULL.
// Sin contraseñas, tokens ni correos: solo ids y claves de acción. RLS desde su propia migración (ES-117, sin política).
// El down (solo con permiso explícito, nunca en producción) borra la tabla, el índice y la columna.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "AdminAuditEntries" (
      "id" SERIAL PRIMARY KEY, "actorId" INTEGER, "actorRole" VARCHAR(16), "action" VARCHAR(40) NOT NULL,
      "targetType" VARCHAR(24), "targetId" INTEGER, "result" VARCHAR(12) NOT NULL DEFAULT 'ok',
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "admin_audit_entries__created_at" ON "AdminAuditEntries" ("createdAt")', { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "admin_audit_entries__actor_created_at" ON "AdminAuditEntries" ("actorId", "createdAt")', { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "admin_audit_entries__target" ON "AdminAuditEntries" ("targetType", "targetId")', { transaction });
    await sequelize.query('ALTER TABLE "AdminAuditEntries" ENABLE ROW LEVEL SECURITY', { transaction });
    await sequelize.query('ALTER TABLE "Invitations" ADD COLUMN IF NOT EXISTS "requestId" VARCHAR(64)', { transaction });
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "invitations__invited_by_request_id" ON "Invitations" ("invitedBy", "requestId") WHERE "requestId" IS NOT NULL', { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261112010000-es186-admin-audit');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS "invitations__invited_by_request_id"');
  await queryInterface.removeColumn('Invitations', 'requestId');
  await queryInterface.dropTable('AdminAuditEntries');
}

module.exports = { up, down };
