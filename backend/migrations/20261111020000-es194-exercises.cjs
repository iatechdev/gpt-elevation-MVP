// ES-194 · Tablas Exercises y ExerciseAudits: ejercicios de acompañamiento editables desde la aplicación, con estado de publicación y revisión del especialista INDEPENDIENTES.
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS). NO siembra ningún ejercicio: el contenido lo crea o importa (como borrador, con revisión pendiente) superadministración.
// RLS desde su propia migración (ES-117, sin política). Sin datos de personas. El down (solo con permiso explícito, nunca en producción) borra las tablas.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "Exercises" (
      "id" SERIAL PRIMARY KEY, "key" VARCHAR(48) NOT NULL, "status" VARCHAR(12) NOT NULL DEFAULT 'draft', "version" INTEGER NOT NULL DEFAULT 1,
      "minutesMin" INTEGER, "minutesMax" INTEGER, "es" JSONB NOT NULL DEFAULT '{}', "en" JSONB NOT NULL DEFAULT '{}',
      "reviewStatus" VARCHAR(8) NOT NULL DEFAULT 'pending', "reviewedBy" VARCHAR(120), "reviewedAt" TIMESTAMP WITH TIME ZONE,
      "publishedBy" VARCHAR(120), "publishedAt" TIMESTAMP WITH TIME ZONE, "withdrawnBy" VARCHAR(120), "withdrawnAt" TIMESTAMP WITH TIME ZONE,
      "updatedBy" VARCHAR(120), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "exercises__key" ON "Exercises" ("key")', { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "exercises__status" ON "Exercises" ("status")', { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "ExerciseAudits" (
      "id" SERIAL PRIMARY KEY, "exerciseId" INTEGER NOT NULL, "version" INTEGER NOT NULL, "action" VARCHAR(16) NOT NULL, "actorId" INTEGER,
      "actorName" VARCHAR(120), "snapshot" TEXT NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE INDEX IF NOT EXISTS "exercise_audits__exercise_created_at" ON "ExerciseAudits" ("exerciseId", "createdAt")', { transaction });
    await sequelize.query('ALTER TABLE "Exercises" ENABLE ROW LEVEL SECURITY', { transaction });
    await sequelize.query('ALTER TABLE "ExerciseAudits" ENABLE ROW LEVEL SECURITY', { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261111020000-es194-exercises');
  await queryInterface.dropTable('ExerciseAudits');
  await queryInterface.dropTable('Exercises');
}

module.exports = { up, down };
