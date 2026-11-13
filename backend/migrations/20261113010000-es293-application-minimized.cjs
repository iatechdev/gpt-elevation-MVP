// ES-293 (E249-1) · ProfessionalApplications.minimizedAt: marca la solicitud MINIMIZADA al purgar a la persona (opción C de Mauricio, 12-nov-2026).
// ADITIVA e idempotente (ADD COLUMN IF NOT EXISTS; nada se borra ni se reescribe). Sin datos personales: solo una fecha. El down (solo con permiso explícito, nunca en producción) quita la columna.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.query('ALTER TABLE "ProfessionalApplications" ADD COLUMN IF NOT EXISTS "minimizedAt" TIMESTAMP WITH TIME ZONE');
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261113010000-es293-application-minimized');
  await queryInterface.removeColumn('ProfessionalApplications', 'minimizedAt');
}

module.exports = { up, down };
