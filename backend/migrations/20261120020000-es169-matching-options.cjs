// ES-169 (PR 2a, servidor) · Opciones del emparejamiento en la BASE DE DATOS (tema, estilo, idioma; ES/EN) + requestId idempotente en MatchingRequests.
// Decisiones de Mauricio y Alejo (16-nov-2026) e Infra (19-nov-2026): las listas viven en la base; la clave «anxiety» se CONSERVA (etiqueta «Estrés y carga»); el servidor conserva `score`; la pantalla de
// administración de las listas (2c) es otro ticket. ADITIVA e idempotente (CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, semilla con ON CONFLICT DO NOTHING; nada se borra ni se reescribe).
// Sin DEFAULT en createdAt/updatedAt (igual que lo que crea sync() desde el modelo; si no, db:drift lo marca) y la semilla los pone expl�citos. Idempotente sobre una tabla creada por sync() (staging, ES-115) o por esta migraci�n.
// RLS en la tabla nueva (ES-117, sin política). El down (solo con permiso explícito, nunca en producción) borra la tabla nueva y la columna.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const SEED = [
  ['topic', 'anxiety', 'Estrés y carga', 'Stress and workload', 1], ['topic', 'relationships', 'Relaciones', 'Relationships', 2], ['topic', 'self-knowledge', 'Autoconocimiento', 'Self-knowledge', 3],
  ['topic', 'habits', 'Hábitos', 'Habits', 4], ['topic', 'other', 'Otro', 'Other', 5],
  ['style', 'reflective', 'Reflexivo', 'Reflective', 1], ['style', 'structured', 'Estructurado', 'Structured', 2], ['style', 'spiritual', 'Espiritual', 'Spiritual', 3], ['style', 'practical', 'Práctico', 'Practical', 4],
  ['language', 'es', 'Español', 'Spanish', 1], ['language', 'en', 'Inglés', 'English', 2], ['language', 'both', 'Ambos', 'Both', 3],
];

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    const run = (sql, replacements) => sequelize.query(sql, { transaction, ...(replacements ? { replacements } : {}) });
    await run(`CREATE TABLE IF NOT EXISTS "MatchingOptions" (
      "id" SERIAL PRIMARY KEY, "kind" VARCHAR(12) NOT NULL, "key" VARCHAR(32) NOT NULL, "label_es" VARCHAR(60) NOT NULL, "label_en" VARCHAR(60) NOT NULL,
      "position" INTEGER NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "matching_options__kind_key" ON "MatchingOptions" ("kind", "key")');
    await run('ALTER TABLE "MatchingOptions" ENABLE ROW LEVEL SECURITY');
    for (const [kind, key, es, en, position] of SEED) {
      await run('INSERT INTO "MatchingOptions" ("kind","key","label_es","label_en","position","createdAt","updatedAt") VALUES (:kind,:key,:es,:en,:position, now(), now()) ON CONFLICT ("kind","key") DO NOTHING', { kind, key, es, en, position });
    }
    // requestId del cliente: una misma solicitud (doble clic, reintento) es UNA sola fila y UNA sola llamada a la IA. Nulo = cliente anterior (sin idempotencia, como hoy).
    await run('ALTER TABLE "MatchingRequests" ADD COLUMN IF NOT EXISTS "requestId" VARCHAR(64)');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "matching_requests__request" ON "MatchingRequests" ("UserId", "requestId") WHERE "requestId" IS NOT NULL');
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261120020000-es169-matching-options');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS "matching_requests__request"');
  await queryInterface.removeColumn('MatchingRequests', 'requestId');
  await queryInterface.dropTable('MatchingOptions');
}

module.exports = { up, down };
