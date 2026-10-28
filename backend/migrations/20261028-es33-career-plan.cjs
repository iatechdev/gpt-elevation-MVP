// Aditiva, repetible; no down destructivo. Los hijos se purgan antes que el contenedor en CORE.
async function up(sequelize) {
  await sequelize.transaction(async transaction => {
    const common = `"id" SERIAL PRIMARY KEY, "UserId" INTEGER NOT NULL REFERENCES "Users"("id"),
      "requestId" VARCHAR(64) NOT NULL, "inputHash" VARCHAR(64) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL`;
    for (const [table, fields] of [
      ['CareerExperiments', '"choiceId" INTEGER NOT NULL, "currentVersion" INTEGER NOT NULL'],
      ['CareerExperimentVersions', '"experimentId" INTEGER NOT NULL, "version" INTEGER NOT NULL, "lifecycle" VARCHAR(16) NOT NULL, "payload" TEXT NOT NULL, "basisHash" VARCHAR(64) NOT NULL'],
      ['CareerPlanVersions', '"experimentId" INTEGER NOT NULL, "version" INTEGER NOT NULL, "status" VARCHAR(16) NOT NULL, "payload" TEXT NOT NULL, "basisHash" VARCHAR(64) NOT NULL'],
      ['CareerExperimentReviews', '"experimentId" INTEGER NOT NULL, "submissionVersion" INTEGER NOT NULL, "status" VARCHAR(24) NOT NULL, "payload" TEXT NOT NULL'],
      ['CareerReminders', '"planVersionId" INTEGER NOT NULL, "actionKey" VARCHAR(24) NOT NULL, "status" VARCHAR(12) NOT NULL, "payload" TEXT NOT NULL'],
    ]) await sequelize.query(`CREATE TABLE IF NOT EXISTS "${table}" (${common}, ${fields})`, { transaction });
    for (const [name, table, columns, where] of [
      ['career_experiment_request', 'CareerExperiments', '"UserId","requestId"', ''],
      ['career_experiment_owner_id', 'CareerExperiments', '"UserId","id"', ''],
      ['career_experiment_version', 'CareerExperimentVersions', '"experimentId","version"', ''],
      ['career_experiment_version_request', 'CareerExperimentVersions', '"UserId","requestId"', ''],
      ['career_plan_version', 'CareerPlanVersions', '"experimentId","version"', ''],
      ['career_plan_request', 'CareerPlanVersions', '"UserId","requestId"', ''],
      ['career_plan_one_accepted', 'CareerPlanVersions', '"experimentId"', ` WHERE "status"='accepted'`],
      ['career_review_request', 'CareerExperimentReviews', '"UserId","requestId"', ''],
      ['career_reminder_request', 'CareerReminders', '"UserId","requestId"', ''],
      ['career_reminder_one_active', 'CareerReminders', '"UserId","planVersionId","actionKey"', ` WHERE "status"='active'`],
      ['career_plan_owner_id', 'CareerPlanVersions', '"UserId","id"', ''],
    ]) await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns})${where}`, { transaction });
    for (const [table, field, target, name] of [
      ['CareerExperimentVersions', 'experimentId', 'CareerExperiments', 'career_ev_owner_fk'],
      ['CareerPlanVersions', 'experimentId', 'CareerExperiments', 'career_pv_owner_fk'],
      ['CareerExperimentReviews', 'experimentId', 'CareerExperiments', 'career_review_owner_fk'],
      ['CareerReminders', 'planVersionId', 'CareerPlanVersions', 'career_reminder_owner_fk'],
    ]) await sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${name}' AND conrelid='"${table}"'::regclass)
      THEN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("UserId","${field}") REFERENCES "${target}"("UserId","id"); END IF; END $$`, { transaction });
  });
}
module.exports = { up };
