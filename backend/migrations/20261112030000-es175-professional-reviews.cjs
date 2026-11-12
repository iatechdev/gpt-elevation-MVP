// ES-175 (HU-P24) · Revisiones profesionales y objeciones: ReviewShares, ProfessionalReviews, ReviewObjections, ReviewResponses.
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS; nada se borra ni se reescribe). RLS desde esta migración (ES-117, sin política).
// Sin claves foráneas hacia Users: la purga de la persona (ES-23) las borra por `UserId` (personalData.CORE) y la del profesional se bloquea para revisión (blocksPurge).
// Texto sobre la persona (observation, limits, reason, text) va cifrado v2 en la aplicación; aquí solo TEXT. El down (solo con permiso explícito, nunca en producción) borra las tablas.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "ReviewShares" (
      "id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL, "reviewerId" INTEGER NOT NULL, "materialVersion" INTEGER NOT NULL, "evidenceRefs" JSON NOT NULL,
      "status" VARCHAR(12) NOT NULL, "requestId" VARCHAR(64) NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_shares__request" ON "ReviewShares" ("UserId", "requestId")');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_shares__version" ON "ReviewShares" ("UserId", "reviewerId", "materialVersion")');
    await run('CREATE INDEX IF NOT EXISTS "review_shares__reviewer" ON "ReviewShares" ("reviewerId", "status")');
    await run(`CREATE TABLE IF NOT EXISTS "ProfessionalReviews" (
      "id" SERIAL PRIMARY KEY, "shareId" INTEGER NOT NULL, "UserId" INTEGER NOT NULL, "reviewerId" INTEGER NOT NULL, "materialVersion" INTEGER NOT NULL, "evidenceRefs" JSON NOT NULL,
      "observation" TEXT NOT NULL, "limits" TEXT NOT NULL, "locale" VARCHAR(2) NOT NULL, "supersedesId" INTEGER, "requestId" VARCHAR(64) NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "professional_reviews__request" ON "ProfessionalReviews" ("reviewerId", "requestId")');
    await run('CREATE INDEX IF NOT EXISTS "professional_reviews__owner" ON "ProfessionalReviews" ("UserId")');
    await run(`CREATE TABLE IF NOT EXISTS "ReviewObjections" (
      "id" SERIAL PRIMARY KEY, "reviewId" INTEGER NOT NULL, "UserId" INTEGER NOT NULL, "reason" TEXT NOT NULL, "locale" VARCHAR(2) NOT NULL, "requestId" VARCHAR(64) NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_objections__review" ON "ReviewObjections" ("reviewId")');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_objections__request" ON "ReviewObjections" ("UserId", "requestId")');
    await run(`CREATE TABLE IF NOT EXISTS "ReviewResponses" (
      "id" SERIAL PRIMARY KEY, "objectionId" INTEGER NOT NULL, "UserId" INTEGER NOT NULL, "reviewerId" INTEGER NOT NULL, "text" TEXT NOT NULL, "locale" VARCHAR(2) NOT NULL,
      "requestId" VARCHAR(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_responses__objection" ON "ReviewResponses" ("objectionId")');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "review_responses__request" ON "ReviewResponses" ("reviewerId", "requestId")');
    for (const table of ['ReviewShares', 'ProfessionalReviews', 'ReviewObjections', 'ReviewResponses']) await run(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261112030000-es175-professional-reviews');
  for (const table of ['ReviewResponses', 'ReviewObjections', 'ProfessionalReviews', 'ReviewShares']) await queryInterface.dropTable(table);
}

module.exports = { up, down };
