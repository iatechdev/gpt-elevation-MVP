// backend/utils/legalDocs.js
// ES-336 (F1) · Lectura de los documentos legales publicados (LegalReleases / LegalDocumentVersions). Solo lectura: no hay editor en esta fase.
// El SQL va crudo y con parámetros; el titular no interviene (los documentos son públicos y sin datos personales).
const { sequelize } = require('../database');
const { DOC_KEYS, LANGS } = require('./legalContent');

// La publicación vigente (a lo sumo una: índice único parcial) o null si no hay ninguna.
async function currentRelease() {
  const rows = await sequelize.query(
    `SELECT "id", "version", "changeKind", "effectiveFrom", "publishedAt" FROM "LegalReleases" WHERE "status" = 'published' LIMIT 1`, { type: 'SELECT' });
  return rows[0] ?? null;
}

// { release, docs: [{ docKey, langs: ['es','en'] }] } de lo publicado; docs vacío si no hay publicación.
async function currentSummary() {
  const release = await currentRelease();
  if (!release) return { release: null, docs: [] };
  const rows = await sequelize.query(
    `SELECT "docKey", "lang" FROM "LegalDocumentVersions" WHERE "releaseId" = :id ORDER BY "docKey", "lang"`, { replacements: { id: release.id }, type: 'SELECT' });
  const byKey = new Map();
  for (const { docKey, lang } of rows) byKey.set(docKey, [...(byKey.get(docKey) ?? []), lang]);
  return { release, docs: [...byKey].map(([docKey, langs]) => ({ docKey, langs })) };
}

// El documento publicado (clave + idioma) o null. Las claves salen de listas cerradas: cualquier otra es el llamador quien la rechaza.
async function publishedDocument(docKey, lang) {
  if (!DOC_KEYS.includes(docKey) || !LANGS.includes(lang)) return null;
  const rows = await sequelize.query(
    `SELECT r."version", r."effectiveFrom", r."publishedAt", d."docKey", d."lang", d."content", d."contentHash"
       FROM "LegalDocumentVersions" d JOIN "LegalReleases" r ON r."id" = d."releaseId"
      WHERE r."status" = 'published' AND d."docKey" = :docKey AND d."lang" = :lang LIMIT 1`,
    { replacements: { docKey, lang }, type: 'SELECT' });
  return rows[0] ?? null;
}

module.exports = { currentRelease, currentSummary, publishedDocument };
