// ES-173 (HU-P22) · «Mi opinión» del piloto: tabla PilotFeedbacks (una fila por persona y ventana).
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS; nada se borra ni se reescribe). RLS desde esta migración (ES-117, sin política).
// Sin clave foránea hacia Users: la purga de la persona (ES-23) la borra por `UserId` (personalData.CORE). `answers` solo lleva claves cerradas, sin texto libre.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "PilotFeedbacks" (
      "id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL, "windowKey" VARCHAR(8) NOT NULL, "questionnaireVersion" INTEGER NOT NULL, "answers" JSONB NOT NULL,
      "version" INTEGER NOT NULL, "status" VARCHAR(12) NOT NULL, "lastRequestId" VARCHAR(64),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "pilot_feedbacks__user_window" ON "PilotFeedbacks" ("UserId", "windowKey")');
    await run('ALTER TABLE "PilotFeedbacks" ENABLE ROW LEVEL SECURITY');
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261113020000-es173-pilot-feedback');
  await queryInterface.dropTable('PilotFeedbacks');
}

module.exports = { up, down };
