// ES-301 · Users.termsVersion y Users.acceptedAt: la versión del aviso de privacidad/términos que la persona aceptó al registrarse y cuándo (puesto por el servidor).
// ADITIVA e idempotente (ADD COLUMN IF NOT EXISTS; nada se borra ni se reescribe; las cuentas existentes quedan en NULL = sin aceptación registrada). Sin datos personales nuevos: una versión y una fecha.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "termsVersion" VARCHAR(32)', { transaction });
    await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP WITH TIME ZONE', { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261113030000-es301-terms-acceptance');
  await queryInterface.removeColumn('Users', 'acceptedAt');
  await queryInterface.removeColumn('Users', 'termsVersion');
}

module.exports = { up, down };
