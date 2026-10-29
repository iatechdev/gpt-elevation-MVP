'use strict';
// ES-85 (ES-84-A) · Tablas del worker de análisis de IA: AiJobs y SkillCandidates, con CHECK de dominio, clave foránea compuesta
// de propietario y disparadores que imponen la matriz de transiciones. Aditiva e idempotente.
// No guarda prompts, respuestas ni texto de personas. El down borra jobs y candidatas: guarda común de ES-59.
const guardDown = require('../scripts/guard-down.cjs');

const JOB_STATES = ['PENDING', 'RUNNING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED', 'CANCELLED', 'INVALIDATED'];
// Matriz de transiciones del job (spike 43, §6). Los estados finales no tienen salida.
const JOB_TRANSITIONS = [
  'PENDING>RUNNING', 'PENDING>CANCELLED', 'PENDING>INVALIDATED',
  'RUNNING>PENDING', 'RUNNING>FAILED', 'RUNNING>REVIEW_REQUIRED', 'RUNNING>COMPLETED', 'RUNNING>CANCELLED', 'RUNNING>INVALIDATED',
  'REVIEW_REQUIRED>COMPLETED', 'REVIEW_REQUIRED>CANCELLED', 'REVIEW_REQUIRED>INVALIDATED',
];
const CANDIDATE_STATES = ['REVIEW_REQUIRED', 'ACCEPTED', 'REJECTED', 'INVALIDATED'];
const CANDIDATE_TRANSITIONS = [
  'REVIEW_REQUIRED>ACCEPTED', 'REVIEW_REQUIRED>REJECTED', 'REVIEW_REQUIRED>INVALIDATED', 'ACCEPTED>INVALIDATED',
];

const list = (values) => values.map((v) => `'${v}'`).join(', ');

async function up(queryInterface) {
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "AiJobs" (
      "id" SERIAL PRIMARY KEY,
      "UserId" INTEGER NOT NULL REFERENCES "Users"("id"),
      "kind" VARCHAR(32) NOT NULL,
      "contextVersion" INTEGER NOT NULL,
      "contextHash" VARCHAR(64) NOT NULL,
      "requestId" VARCHAR(64) NOT NULL,
      "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      "attempt" INTEGER NOT NULL DEFAULT 0,
      "leaseOwner" VARCHAR(64),
      "leaseExpiresAt" TIMESTAMP WITH TIME ZONE,
      "fence" INTEGER NOT NULL DEFAULT 0,
      "notBefore" TIMESTAMP WITH TIME ZONE,
      "catalogVersion" INTEGER,
      "errorCode" VARCHAR(32),
      "startedAt" TIMESTAMP WITH TIME ZONE,
      "finishedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "ai_jobs_status_check" CHECK ("status" IN (${list(JOB_STATES)})),
      CONSTRAINT "ai_jobs_kind_check" CHECK ("kind" IN ('competency_extraction')),
      CONSTRAINT "ai_jobs_counters_check" CHECK ("attempt" >= 0 AND "fence" >= 0)
    )`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "ai_jobs_owner_request" ON "AiJobs" ("UserId", "requestId")`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "ai_jobs_owner_id" ON "AiJobs" ("UserId", "id")`);
    await run(`CREATE INDEX IF NOT EXISTS "ai_jobs_status_created" ON "AiJobs" ("status", "createdAt")`);

    await run(`CREATE TABLE IF NOT EXISTS "SkillCandidates" (
      "id" SERIAL PRIMARY KEY,
      "jobId" INTEGER NOT NULL,
      "UserId" INTEGER NOT NULL REFERENCES "Users"("id"),
      "skillKey" VARCHAR(48) NOT NULL,
      "level" INTEGER,
      "citations" JSON NOT NULL,
      "status" VARCHAR(16) NOT NULL DEFAULT 'REVIEW_REQUIRED',
      "catalogVersion" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "skill_candidates_status_check" CHECK ("status" IN (${list(CANDIDATE_STATES)})),
      CONSTRAINT "skill_candidates_level_check" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 4),
      CONSTRAINT "skill_candidates_owner_fk" FOREIGN KEY ("UserId", "jobId") REFERENCES "AiJobs"("UserId", "id")
    )`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "skill_candidates_job_skill" ON "SkillCandidates" ("jobId", "skillKey")`);
    await run(`CREATE INDEX IF NOT EXISTS "skill_candidates_owner_status" ON "SkillCandidates" ("UserId", "status")`);

    // Disparadores: la matriz se impone en la tabla, no solo en las funciones del worker (también protege al API).
    await run(`CREATE OR REPLACE FUNCTION ai_jobs_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW."UserId" <> OLD."UserId" OR NEW."kind" <> OLD."kind" OR NEW."contextVersion" <> OLD."contextVersion"
         OR NEW."contextHash" <> OLD."contextHash" OR NEW."requestId" <> OLD."requestId" THEN
        RAISE EXCEPTION 'ai_jobs_immutable' USING ERRCODE = '23514';
      END IF;
      IF NEW."fence" < OLD."fence" THEN
        RAISE EXCEPTION 'ai_jobs_fence_decreased' USING ERRCODE = '23514';
      END IF;
      IF NEW."status" <> OLD."status"
         AND (OLD."status" || '>' || NEW."status") <> ALL (ARRAY[${list(JOB_TRANSITIONS)}]) THEN
        RAISE EXCEPTION 'ai_jobs_illegal_transition' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $fn$`);
    await run(`DROP TRIGGER IF EXISTS "ai_jobs_guard" ON "AiJobs"`);
    await run(`CREATE TRIGGER "ai_jobs_guard" BEFORE UPDATE ON "AiJobs" FOR EACH ROW EXECUTE FUNCTION ai_jobs_guard()`);

    await run(`CREATE OR REPLACE FUNCTION skill_candidates_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW."jobId" <> OLD."jobId" OR NEW."UserId" <> OLD."UserId" OR NEW."skillKey" <> OLD."skillKey"
         OR NEW."level" IS DISTINCT FROM OLD."level" OR NEW."citations"::jsonb <> OLD."citations"::jsonb
         OR NEW."catalogVersion" <> OLD."catalogVersion" THEN
        RAISE EXCEPTION 'skill_candidates_immutable' USING ERRCODE = '23514';
      END IF;
      IF NEW."status" <> OLD."status"
         AND (OLD."status" || '>' || NEW."status") <> ALL (ARRAY[${list(CANDIDATE_TRANSITIONS)}]) THEN
        RAISE EXCEPTION 'skill_candidates_illegal_transition' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $fn$`);
    await run(`DROP TRIGGER IF EXISTS "skill_candidates_guard" ON "SkillCandidates"`);
    await run(`CREATE TRIGGER "skill_candidates_guard" BEFORE UPDATE ON "SkillCandidates" FOR EACH ROW EXECUTE FUNCTION skill_candidates_guard()`);
  });
}

// El down borra jobs y candidatas de las personas: solo con permiso explícito y nunca en producción (guarda común, ES-59).
async function down(queryInterface) {
  guardDown('20261028190000-es85-ai-jobs-skill-candidates');
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('DROP TABLE IF EXISTS "SkillCandidates"', { transaction });
    await sequelize.query('DROP TABLE IF EXISTS "AiJobs"', { transaction });
    await sequelize.query('DROP FUNCTION IF EXISTS skill_candidates_guard()', { transaction });
    await sequelize.query('DROP FUNCTION IF EXISTS ai_jobs_guard()', { transaction });
  });
}

module.exports = { up, down };
