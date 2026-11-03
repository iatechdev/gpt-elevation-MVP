// ES-132 · Recuperación de contraseña: tabla PasswordResets (solo hash del token, un solo uso, vencimiento).
// Aditiva e idempotente. El down (solo con permiso explícito, nunca en producción) borra la tabla.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async transaction => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "PasswordResets" (
      "id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
      "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "password_resets__user_id_created_at" ON "PasswordResets" ("UserId", "createdAt")', { transaction });
  });
}
async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261101-es132-password-reset');
  await queryInterface.dropTable('PasswordResets');
}
module.exports = { up, down };
