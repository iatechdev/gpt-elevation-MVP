// ES-336 (F1) · Documentos legales versionados en la base: LegalReleases (publicación conjunta) y LegalDocumentVersions (un documento por idioma dentro de cada publicación).
// ADITIVA e idempotente (CREATE … IF NOT EXISTS; los disparadores se recrean): no toca ninguna fila existente ni Users.termsVersion/acceptedAt. Sin datos personales.
// Invariantes en la BASE (no solo en el código): a lo sumo UNA publicación `published` y UN borrador `draft` (índices únicos parciales); lo publicado/archivado es INMUTABLE
// (disparadores que rechazan UPDATE/DELETE de sus documentos y de sus datos de publicación); nada se borra salvo un borrador. El historial son las filas.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const KEYS = "'privacy','terms','non_clinical','cookies','sharing','feedback','retention'";

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "LegalReleases" (
      "id" SERIAL PRIMARY KEY,
      "version" VARCHAR(32) NOT NULL,
      "status" VARCHAR(10) NOT NULL CHECK ("status" IN ('draft','published','archived')),
      "changeKind" VARCHAR(10) NOT NULL CHECK ("changeKind" IN ('material','minor')),
      "effectiveFrom" TIMESTAMP WITH TIME ZONE,
      "notes" VARCHAR(500),
      "createdBy" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "publishedBy" INTEGER,
      "publishedAt" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "legal_releases_version_shape" CHECK ("version" ~ '^[A-Za-z0-9._-]{1,32}$')
    )`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "legal_releases_version" ON "LegalReleases" ("version")');
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "legal_releases_one_published" ON "LegalReleases" ((true)) WHERE "status" = 'published'`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "legal_releases_one_draft" ON "LegalReleases" ((true)) WHERE "status" = 'draft'`);
    await run(`CREATE TABLE IF NOT EXISTS "LegalDocumentVersions" (
      "id" SERIAL PRIMARY KEY,
      "releaseId" INTEGER NOT NULL REFERENCES "LegalReleases" ("id") ON DELETE RESTRICT,
      "docKey" VARCHAR(20) NOT NULL CHECK ("docKey" IN (${KEYS})),
      "lang" VARCHAR(2) NOT NULL CHECK ("lang" IN ('es','en')),
      "content" JSONB NOT NULL,
      "contentHash" CHAR(64) NOT NULL,
      CONSTRAINT "legal_document_versions_unique" UNIQUE ("releaseId", "docKey", "lang")
    )`);
    // RLS activada como en el resto de tablas (ES-117): sin políticas, solo el rol dueño (la API) accede; los roles de la API pública de Supabase no ven filas.
    await run('ALTER TABLE "LegalReleases" ENABLE ROW LEVEL SECURITY');
    await run('ALTER TABLE "LegalDocumentVersions" ENABLE ROW LEVEL SECURITY');
    // Inmutabilidad. Un documento solo se puede cambiar o borrar mientras su publicación es un borrador.
    await run(`CREATE OR REPLACE FUNCTION legal_documents_guard() RETURNS trigger AS $$
      DECLARE parent_status TEXT;
      BEGIN
        SELECT "status" INTO parent_status FROM "LegalReleases" WHERE "id" = COALESCE(OLD."releaseId", NEW."releaseId");
        IF TG_OP = 'DELETE' THEN
          IF parent_status IS NOT NULL AND parent_status <> 'draft' THEN RAISE EXCEPTION 'legal_immutable: un documento publicado o archivado no se borra'; END IF;
          RETURN OLD;
        END IF;
        IF TG_OP = 'UPDATE' THEN
          IF parent_status <> 'draft' OR NEW."releaseId" <> OLD."releaseId" THEN RAISE EXCEPTION 'legal_immutable: un documento publicado o archivado no se modifica'; END IF;
          RETURN NEW;
        END IF;
        IF parent_status <> 'draft' THEN RAISE EXCEPTION 'legal_immutable: solo se agregan documentos a un borrador'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql`);
    await run('DROP TRIGGER IF EXISTS "legal_documents_guard" ON "LegalDocumentVersions"');
    await run('CREATE TRIGGER "legal_documents_guard" BEFORE INSERT OR UPDATE OR DELETE ON "LegalDocumentVersions" FOR EACH ROW EXECUTE FUNCTION legal_documents_guard()');
    // Una publicación publicada/archivada no se borra ni cambia su versión, tipo de cambio ni vigencia; solo puede pasar de `published` a `archived` (y guardar el archivo).
    await run(`CREATE OR REPLACE FUNCTION legal_releases_guard() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD."status" <> 'draft' THEN RAISE EXCEPTION 'legal_immutable: una publicación publicada o archivada no se borra'; END IF;
          RETURN OLD;
        END IF;
        IF OLD."status" = 'archived' THEN RAISE EXCEPTION 'legal_immutable: una publicación archivada no se modifica'; END IF;
        IF OLD."status" = 'published' AND (NEW."status" <> 'archived' OR NEW."version" <> OLD."version" OR NEW."changeKind" <> OLD."changeKind"
            OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy" OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
            OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy") THEN
          RAISE EXCEPTION 'legal_immutable: una publicación publicada solo puede pasar a archivada';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql`);
    await run('DROP TRIGGER IF EXISTS "legal_releases_guard" ON "LegalReleases"');
    await run('CREATE TRIGGER "legal_releases_guard" BEFORE UPDATE OR DELETE ON "LegalReleases" FOR EACH ROW EXECUTE FUNCTION legal_releases_guard()');
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261120010000-es336-legal-documents');
  const sequelize = queryInterface.sequelize;
  await sequelize.query('DROP TABLE IF EXISTS "LegalDocumentVersions"');
  await sequelize.query('DROP TABLE IF EXISTS "LegalReleases"');
  await sequelize.query('DROP FUNCTION IF EXISTS legal_documents_guard()');
  await sequelize.query('DROP FUNCTION IF EXISTS legal_releases_guard()');
}

module.exports = { up, down };
