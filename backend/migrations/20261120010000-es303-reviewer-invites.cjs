// ES-303 (PR A) · ReviewerInvites: invitaciones de un solo uso con las que una persona revisora recibe autorizaciones (sin directorio ni enumeración de profesionales).
// ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS; nada se borra ni se reescribe). RLS desde esta migración (ES-117, sin política).
// Solo se guarda el sha256 del código. Sin claves foráneas hacia Users (como ES-175): `usedByUserId` lo anula la purga de la persona (ES-23).
// El down (solo con permiso explícito, nunca en producción) borra la tabla.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "ReviewerInvites" (
      "id" SERIAL PRIMARY KEY, "reviewerId" INTEGER NOT NULL, "tokenHash" VARCHAR(64) NOT NULL, "requestId" VARCHAR(64) NOT NULL,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "usedByUserId" INTEGER, "revokedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_invites__token" ON "ReviewerInvites" ("tokenHash")');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_invites__request" ON "ReviewerInvites" ("reviewerId", "requestId")');
    await run('CREATE INDEX IF NOT EXISTS "reviewer_invites__reviewer" ON "ReviewerInvites" ("reviewerId", "createdAt")');
    await run('ALTER TABLE "ReviewerInvites" ENABLE ROW LEVEL SECURITY');
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261120010000-es303-reviewer-invites');
  await queryInterface.dropTable('ReviewerInvites');
}

module.exports = { up, down };
