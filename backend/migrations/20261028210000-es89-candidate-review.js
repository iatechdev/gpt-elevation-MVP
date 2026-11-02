'use strict';
// ES-89 (ES-84-E) · Revisión de candidatas por la persona: nivel que confirma (o corrige a la baja) y cuándo lo decidió.
// Aditiva. `level` (lo que propuso la IA) es inmutable por el disparador de ES-85; la decisión de la persona se guarda aparte.
// Una candidata nunca puede quedar con un nivel confirmado MAYOR que el propuesto, ni con nivel confirmado si no se propuso ninguno.
const guardDown = require('../scripts/guard-down.cjs');

async function up(queryInterface) {
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`ALTER TABLE "SkillCandidates" ADD COLUMN IF NOT EXISTS "confirmedLevel" INTEGER`);
    await run(`ALTER TABLE "SkillCandidates" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP WITH TIME ZONE`);
    await run(`ALTER TABLE "SkillCandidates" DROP CONSTRAINT IF EXISTS "skill_candidates_confirmed_check"`);
    await run(`ALTER TABLE "SkillCandidates" ADD CONSTRAINT "skill_candidates_confirmed_check"
      CHECK ("confirmedLevel" IS NULL OR ("level" IS NOT NULL AND "confirmedLevel" BETWEEN 1 AND "level"))`);
  });
}

// El down borra las decisiones de nivel de las personas: solo con permiso explícito y nunca en producción (guarda común, ES-59).
async function down(queryInterface) {
  guardDown('20261028210000-es89-candidate-review');
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('ALTER TABLE "SkillCandidates" DROP CONSTRAINT IF EXISTS "skill_candidates_confirmed_check"', { transaction });
    await sequelize.query('ALTER TABLE "SkillCandidates" DROP COLUMN IF EXISTS "reviewedAt"', { transaction });
    await sequelize.query('ALTER TABLE "SkillCandidates" DROP COLUMN IF EXISTS "confirmedLevel"', { transaction });
  });
}

module.exports = { up, down };
