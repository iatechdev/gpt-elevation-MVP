// Aditiva e idempotente. El down (solo con permiso explícito, nunca en producción) borra las tres tablas.
// Contrato doble: scripts/migrateRoutes.js y la prueba la llaman con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async transaction => {
    const common = `"id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL REFERENCES "Users"("id"),
      "requestId" VARCHAR(64) NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`;
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "RouteConstraintsVersions" (${common},
      "version" INTEGER NOT NULL CHECK ("version" > 0), "status" VARCHAR(12) NOT NULL CHECK ("status" IN ('current','superseded')),
      "payload" TEXT NOT NULL)`, { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "RouteChoices" (${common},
      "roleKey" VARCHAR(48) NOT NULL, "slot" VARCHAR(12) NOT NULL CHECK ("slot" IN ('continuity','adjacency','exploration')),
      "decision" VARCHAR(8) NOT NULL CHECK ("decision" IN ('accepted','rejected')), "catalogVersion" INTEGER NOT NULL,
      "constraintsVersion" INTEGER NOT NULL, "basisHash" VARCHAR(64) NOT NULL,
      "status" VARCHAR(12) NOT NULL CHECK ("status" IN ('current','superseded')))`, { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "RouteReviewRequests" (${common},
      "status" VARCHAR(12) NOT NULL CHECK ("status" IN ('open','closed')), "note" TEXT)`, { transaction });
    for (const [name, table, fields, predicate] of [
      ['route_constraints_owner_version', 'RouteConstraintsVersions', '"UserId", "version"', ''],
      ['route_constraints_owner_request', 'RouteConstraintsVersions', '"UserId", "requestId"', ''],
      ['route_constraints_one_current', 'RouteConstraintsVersions', '"UserId"', ` WHERE "status" = 'current'`],
      ['route_choices_owner_request', 'RouteChoices', '"UserId", "requestId"', ''],
      ['route_choices_one_current', 'RouteChoices', '"UserId", "roleKey"', ` WHERE "status" = 'current'`],
      ['route_reviews_owner_request', 'RouteReviewRequests', '"UserId", "requestId"', ''],
      ['route_reviews_one_open', 'RouteReviewRequests', '"UserId"', ` WHERE "status" = 'open'`],
    ]) await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${name}" ON "${table}" (${fields})${predicate}`, { transaction });
  });
}
// El down borra decisiones de rutas de las personas: solo con permiso explícito y nunca en producción (guarda común, ES-59).
async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261028-es32-routes');
  for (const table of ['RouteReviewRequests', 'RouteChoices', 'RouteConstraintsVersions']) await queryInterface.dropTable(table);
}
module.exports = { up, down };
