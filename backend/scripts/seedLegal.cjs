// ES-336 (F1) · Carga la publicación inicial de documentos legales (backend/seeds/legalSeed.json = lo que sirve hoy la SPA desde frontend/src/legal/legalCopy.ts).
// IDEMPOTENTE: si ya hay una publicación vigente o ya existe esa versión, no hace nada. No toca Users.termsVersion/acceptedAt ni backend/utils/terms.js (la versión vigente que exige el registro
// sigue saliendo de la constante; la semilla DEBE llevar la misma versión y se comprueba). Todo en una transacción: o queda publicada completa o no queda nada.
// Uso (con DATABASE_URL del entorno destino; en staging o producción, solo con confirmación de Mauricio):  node scripts/seedLegal.cjs
// Operador: no imprime contenido; solo la versión y el número de documentos.
const { validateContent, contentHash, DOC_KEYS, LANGS } = require('../utils/legalContent');

class SeedError extends Error { constructor(code, message) { super(message); this.code = code; } }

async function seedLegal(sequelize, { seed = require('../seeds/legalSeed.json'), termsVersion = require('../utils/terms').TERMS.version } = {}) {
  if (seed.version !== termsVersion) throw new SeedError('version_mismatch', `La semilla trae la versión ${seed.version} y el registro exige ${termsVersion}: deben ser la misma.`);
  const documents = seed.documents.map((doc) => {
    if (!DOC_KEYS.includes(doc.docKey) || !LANGS.includes(doc.lang)) throw new SeedError('invalid_seed', 'La semilla trae una clave o un idioma desconocido.');
    const checked = validateContent(doc.content);
    if (!checked.ok) throw new SeedError('invalid_seed', `La semilla no es válida en ${doc.docKey}/${doc.lang}: ${checked.field} (${checked.reason}).`);
    return { docKey: doc.docKey, lang: doc.lang, content: checked.value, hash: contentHash(checked.value) };
  });
  const pairs = new Set(documents.map((d) => `${d.docKey}/${d.lang}`));
  if (pairs.size !== documents.length) throw new SeedError('invalid_seed', 'La semilla repite un documento.');
  for (const key of new Set(documents.map((d) => d.docKey))) for (const lang of LANGS) if (!pairs.has(`${key}/${lang}`)) throw new SeedError('invalid_seed', `Falta ${key} en ${lang}: cada documento va en ES y EN.`);

  return sequelize.transaction(async (transaction) => {
    const [published] = await sequelize.query(`SELECT "version" FROM "LegalReleases" WHERE "status" = 'published' LIMIT 1`, { type: 'SELECT', transaction });
    if (published) return { seeded: false, reason: 'already_published', version: published.version };
    const [existing] = await sequelize.query('SELECT "status" FROM "LegalReleases" WHERE "version" = :version', { replacements: { version: seed.version }, type: 'SELECT', transaction });
    if (existing) return { seeded: false, reason: 'version_exists', version: seed.version };
    const [created] = await sequelize.query(
      `INSERT INTO "LegalReleases" ("version", "status", "changeKind", "effectiveFrom", "notes") VALUES (:version, 'draft', :kind, now(), 'Semilla inicial (ES-336 F1)') RETURNING "id"`,
      { replacements: { version: seed.version, kind: seed.changeKind === 'minor' ? 'minor' : 'material' }, type: 'SELECT', transaction });
    for (const doc of documents) {
      await sequelize.query(
        `INSERT INTO "LegalDocumentVersions" ("releaseId", "docKey", "lang", "content", "contentHash") VALUES (:id, :docKey, :lang, CAST(:content AS jsonb), :hash)`,
        { replacements: { id: created.id, docKey: doc.docKey, lang: doc.lang, content: JSON.stringify(doc.content), hash: doc.hash }, transaction });
    }
    await sequelize.query(`UPDATE "LegalReleases" SET "status" = 'published', "publishedAt" = now() WHERE "id" = :id`, { replacements: { id: created.id }, transaction });
    return { seeded: true, version: seed.version, documents: documents.length };
  });
}

module.exports = { seedLegal, SeedError };

if (require.main === module) {
  const { sequelize } = require('../database');
  (async () => {
    await sequelize.authenticate();
    const out = await seedLegal(sequelize);
    console.log(JSON.stringify(out));
  })().catch((error) => {
    console.error(error && error.code && String(error.code).includes('_') ? error.message : 'No se pudo cargar la semilla legal.');
    process.exitCode = 1;
  }).finally(() => sequelize.close());
}
