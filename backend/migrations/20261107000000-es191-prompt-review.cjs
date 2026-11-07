// ES-191 · Validación en servidor de las guías de la IA: columnas de revisión en PromptVaults y tabla PromptRules (reglas administrables).
// Aditiva e idempotente. La lista inicial de frases es un PUNTO DE PARTIDA, NO VERIFICADO por un especialista (source = 'initial'):
// superadministración la edita desde /api/superadmin/prompt-rules. Una frase termina en `*` (o lo lleva dentro) para cubrir el resto de la palabra.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const INITIAL_RULES = {
  override: [
    ['es', 'ignora lo anterior'], ['es', 'ignora las instrucciones'], ['es', 'ignora todas las instrucciones'], ['es', 'ignora las reglas'],
    ['es', 'ignora todas las reglas'], ['es', 'olvida lo anterior'], ['es', 'olvida las instrucciones'], ['es', 'olvida las reglas'],
    ['es', 'deja de seguir las reglas'], ['es', 'no sigas las reglas'], ['es', 'anula las reglas'], ['es', 'las reglas no aplican'],
    ['es', 'sin restricciones'], ['es', 'sin limites'], ['es', 'modo desarrollador'], ['es', 'ahora eres'],
    ['es', 'revela tus instrucciones'], ['es', 'revela tu prompt'], ['es', 'muestra tu prompt'], ['es', 'muestra tus instrucciones'],
    ['en', 'ignore previous instructions'], ['en', 'ignore all previous'], ['en', 'ignore the previous'], ['en', 'ignore the rules'],
    ['en', 'ignore your rules'], ['en', 'ignore all rules'], ['en', 'disregard the rules'], ['en', 'disregard previous'],
    ['en', 'forget the rules'], ['en', 'forget previous instructions'], ['en', 'forget your instructions'], ['en', 'override the rules'],
    ['en', 'override your rules'], ['en', 'rules do not apply'], ['en', 'without restrictions'], ['en', 'no restrictions'],
    ['en', 'developer mode'], ['en', 'you are now'], ['en', 'reveal your instructions'], ['en', 'reveal the system prompt'],
    ['en', 'show your system prompt'], ['en', 'show your instructions'],
    ['any', 'jailbreak'],
  ],
  diagnosis: [
    ['any', 'diagnos*'], ['es', 'tiene depresion'], ['es', 'tienes depresion'], ['es', 'tiene ansiedad'], ['es', 'tienes ansiedad'],
    ['es', 'eres bipolar'], ['es', 'padeces'], ['es', 'sufres de'], ['es', 'dile que tiene un trastorno'],
    ['en', 'you have depression'], ['en', 'you have anxiety'], ['en', 'you are bipolar'], ['en', 'you suffer from'],
    ['en', 'tell them they have a disorder'],
  ],
  treatment: [
    ['es', 'receta*'], ['es', 'recetar*'], ['es', 'prescrib*'], ['es', 'prescripcion*'], ['es', 'medicacion'], ['es', 'medicamento*'],
    ['es', 'dosis'], ['es', 'antidepresiv*'], ['es', 'ansiolitic*'], ['es', 'tratamiento*'], ['es', 'curar*'], ['es', 'curacion*'],
    ['en', 'prescribe*'], ['en', 'prescription*'], ['en', 'medication*'], ['en', 'medicine'], ['en', 'dosage'], ['en', 'antidepressant*'],
    ['en', 'treatment*'], ['en', 'cure*'],
  ],
  employment_promise: [
    ['es', 'garantiz* empleo'], ['es', 'garantiz* trabajo'], ['es', 'garantiz* resultado*'], ['es', 'garantiz* exito'], ['es', 'garantiz* que consegu*'],
    ['es', 'promet* empleo'], ['es', 'promet* trabajo'], ['es', 'promet* resultado*'], ['es', 'exito garantizado'], ['es', 'resultados garantizados'],
    ['es', 'conseguiras trabajo'], ['es', 'conseguiras empleo'], ['es', '100% de exito'],
    ['en', 'guarantee* employment'], ['en', 'guarantee* a job'], ['en', 'guarantee* results'], ['en', 'guarantee* success'],
    ['en', 'promis* a job'], ['en', 'promis* employment'], ['en', 'promis* results'], ['en', 'guaranteed success'], ['en', 'guaranteed results'],
    ['en', 'you will get a job'], ['en', 'you will get hired'], ['en', 'you will find a job'], ['en', '100% success'],
  ],
};

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`ALTER TABLE "PromptVaults"
      ADD COLUMN IF NOT EXISTS "reviewOutcome" VARCHAR(12),
      ADD COLUMN IF NOT EXISTS "reviewReasons" TEXT,
      ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP WITH TIME ZONE`, { transaction });
    await sequelize.query(`CREATE TABLE IF NOT EXISTS "PromptRules" (
      "id" SERIAL PRIMARY KEY, "category" VARCHAR(24) NOT NULL, "locale" VARCHAR(3) NOT NULL DEFAULT 'any',
      "phrase" VARCHAR(160) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "source" VARCHAR(16) NOT NULL DEFAULT 'admin',
      "updatedBy" VARCHAR(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`, { transaction });
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "prompt_rules__category_locale_phrase" ON "PromptRules" ("category", "locale", "phrase")', { transaction });
    // ES-117: toda tabla nueva activa RLS en su propia migración (sin política: nadie sin BYPASSRLS la lee ni escribe).
    await sequelize.query('ALTER TABLE "PromptRules" ENABLE ROW LEVEL SECURITY', { transaction });
    for (const [category, rules] of Object.entries(INITIAL_RULES)) {
      for (const [locale, phrase] of rules) {
        await sequelize.query(`INSERT INTO "PromptRules" ("category", "locale", "phrase", "active", "source", "createdAt", "updatedAt")
          VALUES (:category, :locale, :phrase, true, 'initial', NOW(), NOW()) ON CONFLICT ("category", "locale", "phrase") DO NOTHING`,
        { transaction, replacements: { category, locale, phrase } });
      }
    }
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261107000000-es191-prompt-review');
  const { sequelize } = queryInterface;
  await sequelize.query('DROP TABLE IF EXISTS "PromptRules"');
  await sequelize.query('ALTER TABLE "PromptVaults" DROP COLUMN IF EXISTS "reviewOutcome", DROP COLUMN IF EXISTS "reviewReasons", DROP COLUMN IF EXISTS "reviewedAt"');
}
module.exports = { up, down, INITIAL_RULES };
