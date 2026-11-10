// ES-177 · Tabla TherapistPersonOrdinals: ordinal estable «Persona n» por profesional (para quien no autorizó compartir).
// Incluye TherapistOrdinalCounters: contador MONÓTONO por profesional (solo sube) para que un número no se reutilice nunca.
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS, nada se borra ni se reescribe). Sin datos personales: solo dos ids y un número.
// RLS desde su propia migración (ES-117, sin política). Las claves foráneas son en cascada: si la persona o el profesional se eliminan, la fila se va con ellos.
// El down (solo con permiso explícito, nunca en producción) borra la tabla.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "TherapistPersonOrdinals" (
      "id" SERIAL PRIMARY KEY,
      "therapistId" INTEGER NOT NULL REFERENCES "Users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "personId" INTEGER NOT NULL REFERENCES "Users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "ordinal" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "therapist_person_ordinals__person" ON "TherapistPersonOrdinals" ("therapistId", "personId")', { transaction });
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "therapist_person_ordinals__ordinal" ON "TherapistPersonOrdinals" ("therapistId", "ordinal")', { transaction });
    await sequelize.query('ALTER TABLE "TherapistPersonOrdinals" ENABLE ROW LEVEL SECURITY', { transaction });
    // Contador que SOLO SUBE: el siguiente número sale de aquí, nunca de max()+1 (si se elimina a la persona con la n más alta, su número no se reutiliza).
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "TherapistOrdinalCounters" (
      "therapistId" INTEGER PRIMARY KEY REFERENCES "Users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "lastOrdinal" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('ALTER TABLE "TherapistOrdinalCounters" ENABLE ROW LEVEL SECURITY', { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261111010000-es177-person-ordinals');
  await queryInterface.dropTable('TherapistOrdinalCounters');
  await queryInterface.dropTable('TherapistPersonOrdinals');
}

module.exports = { up, down };
