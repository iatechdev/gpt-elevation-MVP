// ES-336 (F1) · Documentos legales versionados con servidor REAL (server.js) y PostgreSQL REAL: migración idempotente, invariantes en la base (una publicada, un borrador, lo publicado inmutable),
// semilla idempotente, lectura PÚBLICA de lo publicado con listas cerradas y caché pública corta, y que los borradores/archivados no se sirven. Sin editor (fase 2), sin tocar aceptaciones. 0 IA, datos sintéticos.
//   ES336_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-336-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-336 PostgreSQL + HTTP: documentos legales publicados, invariantes e inmutabilidad', { timeout: 300000 }, async (t) => {
  const { q, http, base, app, mkUser, dbName } = await startRealApi(t, { envVar: 'ES336_TEST_DATABASE_URL', prefix: 'es336' });
  const migration = require('../../migrations/20261120010000-es336-legal-documents.cjs');
  const { seedLegal } = require('../../scripts/seedLegal.cjs');
  const { TERMS } = require('../../utils/terms');
  const { validateContent, contentHash } = require('../../utils/legalContent');
  const seed = require('../../seeds/legalSeed.json');
  const getRaw = (route, headers = {}) => fetch(`${base}${route}`, { headers });
  const rejects = async (sql, params, pattern) => { await assert.rejects(q(sql, params), (e) => pattern.test(`${e.code} ${e.message}`)); };
  const content = { title: 'Documento de prueba', sections: [{ heading: 'Uno', paragraphs: ['Texto de prueba.'] }] };
  const addDoc = (releaseId, docKey, lang, c = content) => q(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,$2,$3,$4::jsonb,$5)`, [releaseId, docKey, lang, JSON.stringify(c), contentHash(c)]);
  const newRelease = async (version, status = 'draft') => (await q(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ($1,$2,'material') RETURNING id`, [version, status]))[0].id;

  await t.test('migración: aditiva e idempotente (segunda ejecución sin error ni cambios) y no toca los datos existentes', async () => {
    const users = Number((await q('SELECT count(*) n FROM "Users"'))[0].n);
    await migration.up(app); await migration.up(app);
    assert.equal(Number((await q('SELECT count(*) n FROM "Users"'))[0].n), users);
    const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('LegalReleases','LegalDocumentVersions') ORDER BY 1`)).map((r) => r.table_name);
    assert.deepEqual(tables, ['LegalDocumentVersions', 'LegalReleases']);
  });

  await t.test('sin publicación: /current devuelve version null y /:docKey 404 not_published (la SPA se queda con su texto), sin sesión', async () => {
    const cur = await http(null, 'GET', '/api/legal/current');
    assert.equal(cur.status, 200); assert.deepEqual(cur.body, { version: null, effectiveFrom: null, docs: [] });
    const doc = await http(null, 'GET', '/api/legal/privacy?lang=es');
    assert.equal(doc.status, 404); assert.equal(doc.body.code, 'not_published'); assert.match(doc.body.error, / \/ /);
  });

  await t.test('semilla: publica los 4 documentos del repo con la versión vigente (TERMS.version) y es idempotente; no toca aceptaciones', async () => {
    assert.equal(seed.version, TERMS.version);
    const first = await seedLegal(app);
    assert.deepEqual(first, { seeded: true, version: TERMS.version, documents: 4 });
    assert.deepEqual(await seedLegal(app), { seeded: false, reason: 'already_published', version: TERMS.version });
    const rows = await q(`SELECT "status","version","changeKind" FROM "LegalReleases"`);
    assert.deepEqual(rows, [{ status: 'published', version: TERMS.version, changeKind: 'material' }]);
    assert.equal(Number((await q('SELECT count(*) n FROM "LegalDocumentVersions"'))[0].n), 4);
    const bad = await q(`SELECT 1 FROM "Users" WHERE "termsVersion" IS NOT NULL`);
    assert.equal(bad.length, 0, 'la semilla no escribe aceptaciones');
  });

  await t.test('lectura pública: /current y cada documento (ES y EN), idénticos a la semilla y con el hash guardado; caché pública corta y sin Vary de sesión', async () => {
    const cur = await http(null, 'GET', '/api/legal/current');
    assert.equal(cur.body.version, TERMS.version);
    assert.deepEqual(cur.body.docs, [{ docKey: 'privacy', langs: ['en', 'es'] }, { docKey: 'terms', langs: ['en', 'es'] }]);
    for (const wanted of seed.documents) {
      const res = await getRaw(`/api/legal/${wanted.docKey}?lang=${wanted.lang}`);
      assert.equal(res.status, 200); const body = await res.json();
      assert.equal(body.source, 'db'); assert.equal(body.version, TERMS.version); assert.equal(body.docKey, wanted.docKey); assert.equal(body.lang, wanted.lang);
      assert.deepEqual(body.content, validateContent(wanted.content).value, `${wanted.docKey}/${wanted.lang} = semilla`);
      assert.equal(res.headers.get('cache-control'), 'public, max-age=60'); assert.ok(res.headers.get('etag'), 'ETag');
      assert.ok(!/authorization/i.test(res.headers.get('vary') ?? ''), 'una lectura pública no varía por sesión');
      const stored = await q(`SELECT "contentHash" FROM "LegalDocumentVersions" WHERE "docKey"=$1 AND "lang"=$2`, [wanted.docKey, wanted.lang]);
      assert.equal(stored[0].contentHash, contentHash(body.content));
    }
    const asUser = await http(await mkUser('user'), 'GET', '/api/legal/terms?lang=en'); // con sesión da lo mismo (no se personaliza)
    assert.equal(asUser.status, 200); assert.equal(asUser.body.version, TERMS.version);
    assert.equal((await http(null, 'GET', '/api/legal/terms')).body.lang, 'es', 'sin idioma: español');
  });

  await t.test('listas cerradas: clave o idioma inválidos son 400 estable; un documento válido no publicado es 404; nada de SQL ni rutas', async () => {
    for (const route of ['/api/legal/foo', '/api/legal/privacy?lang=fr', '/api/legal/privacy?lang=es&lang=en', "/api/legal/privacy';DROP TABLE x;--", '/api/legal/..%2Fadmin', '/api/legal/PRIVACY']) {
      const r = await http(null, 'GET', route); assert.equal(r.status, 400, route); assert.equal(r.body.code, 'invalid_legal_request'); assert.match(r.body.error, / \/ /);
      const raw = await getRaw(route); assert.equal(raw.headers.get('cache-control'), 'no-store', route);
    }
    // un parámetro desconocido se ignora (no cambia qué se sirve): el idioma sigue siendo el de la lista cerrada
    const ignored = await http(null, 'GET', '/api/legal/privacy?lang[]=en&x=1'); assert.equal(ignored.status, 200); assert.equal(ignored.body.lang, 'es');
    for (const key of ['non_clinical', 'cookies', 'sharing', 'feedback', 'retention']) assert.equal((await http(null, 'GET', `/api/legal/${key}?lang=es`)).status, 404, key);
    assert.equal((await q('SELECT count(*) n FROM "LegalReleases"'))[0].n, '1', 'las lecturas no escriben');
  });

  await t.test('restricciones de la base: clave, idioma, estado, forma de la versión y duplicados', async () => {
    const draft = await newRelease('2026-12-v1');
    await rejects(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,'otro','es','{}','x')`, [draft], /23514|check/i);
    await rejects(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,'privacy','fr','{}','x')`, [draft], /23514|check/i);
    await rejects(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ('v mala','archived','material')`, [], /23514|check/i);
    await rejects(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ('2026-12-v2','otro','material')`, [], /23514|check/i);
    await rejects(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ($1,'archived','material')`, ['2026-12-v1'], /23505|unique/i); // versión repetida
    await addDoc(draft, 'privacy', 'es'); await rejects(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,'privacy','es','{}','x')`, [draft], /23505|unique/i);
    await rejects(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ('2026-12-v9','draft','minor')`, [], /23505|unique/i); // un solo borrador
    await rejects(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ('2026-12-v8','published','minor')`, [], /23505|unique/i); // una sola publicada
    // un borrador NO se sirve
    assert.equal((await http(null, 'GET', '/api/legal/privacy?lang=es')).body.version, TERMS.version);
    await q(`DELETE FROM "LegalDocumentVersions" WHERE "releaseId"=$1`, [draft]); await q('DELETE FROM "LegalReleases" WHERE "id"=$1', [draft]); // un borrador sí se puede borrar
  });

  await t.test('inmutabilidad: lo publicado o archivado no se modifica ni se borra, ni admite documentos nuevos; solo pasa de publicada a archivada', async () => {
    const published = (await q(`SELECT id FROM "LegalReleases" WHERE "status"='published'`))[0].id;
    await rejects(`UPDATE "LegalDocumentVersions" SET "content"='{}'::jsonb WHERE "releaseId"=$1 AND "docKey"='privacy' AND "lang"='es'`, [published], /legal_immutable/);
    await rejects(`DELETE FROM "LegalDocumentVersions" WHERE "releaseId"=$1`, [published], /legal_immutable/);
    await rejects(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,'cookies','es','{}','x')`, [published], /legal_immutable/);
    await rejects(`DELETE FROM "LegalReleases" WHERE "id"=$1`, [published], /legal_immutable/);
    await rejects(`UPDATE "LegalReleases" SET "version"='otra' WHERE "id"=$1`, [published], /legal_immutable/);
    await rejects(`UPDATE "LegalReleases" SET "changeKind"='minor' WHERE "id"=$1`, [published], /legal_immutable/);
    await rejects(`UPDATE "LegalReleases" SET "publishedAt"=now() WHERE "id"=$1`, [published], /legal_immutable/);
    await rejects(`UPDATE "LegalReleases" SET "status"='draft' WHERE "id"=$1`, [published], /legal_immutable/);
    // una nueva publicación en borrador con sus documentos; se publica y la anterior se archiva (en ese orden, en una transacción)
    const next = await newRelease('2026-12-v2'); await addDoc(next, 'privacy', 'es'); await addDoc(next, 'privacy', 'en');
    await q('BEGIN'); try { await q(`UPDATE "LegalReleases" SET "status"='archived' WHERE "id"=$1`, [published]); await q(`UPDATE "LegalReleases" SET "status"='published', "publishedAt"=now() WHERE "id"=$1`, [next]); await q('COMMIT'); } catch (e) { await q('ROLLBACK'); throw e; }
    assert.equal((await http(null, 'GET', '/api/legal/current')).body.version, '2026-12-v2');
    assert.equal((await http(null, 'GET', '/api/legal/terms?lang=es')).status, 404, 'lo archivado y lo que no está en la nueva publicación no se sirve');
    await rejects(`UPDATE "LegalReleases" SET "notes"='x' WHERE "id"=$1`, [published], /legal_immutable/); // archivada: ni notas
    await rejects(`DELETE FROM "LegalReleases" WHERE "id"=$1`, [published], /legal_immutable/);
    // el historial sigue completo
    assert.equal(Number((await q('SELECT count(*) n FROM "LegalDocumentVersions"'))[0].n), 6);
  });

  await t.test('concurrencia: dos publicaciones a la vez dejan exactamente UNA publicada (una gana, la otra falla por el índice único)', async () => {
    const published = (await q(`SELECT id FROM "LegalReleases" WHERE "status"='published'`))[0].id;
    await q(`UPDATE "LegalReleases" SET "status"='archived' WHERE "id"=$1`, [published]);
    const results = await Promise.allSettled(['2026-12-v3', '2026-12-v4'].map((v) => q(`INSERT INTO "LegalReleases" ("version","status","changeKind") VALUES ($1,'published','minor')`, [v])));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(Number((await q(`SELECT count(*) n FROM "LegalReleases" WHERE "status"='published'`))[0].n), 1);
  });

  await t.test('carrera real (QA-336-01): un INSERT en curso no se cuela en una publicación que se publica a la vez (2 conexiones, 12 corridas, 0 fallos); TRUNCATE queda bloqueado', async () => {
    const { Client } = require('pg');
    const url = new URL(process.env.ES336_TEST_DATABASE_URL); url.pathname = '/' + dbName;
    const open = async () => { const c = new Client({ connectionString: url.toString() }); await c.connect(); return c; };
    const [A, B] = [await open(), await open()];
    const row = JSON.stringify(content);
    try {
      for (let i = 0; i < 12; i++) {
        await q(`UPDATE "LegalReleases" SET "status"='archived' WHERE "status"='published'`);
        const id = await newRelease('2027-01-race' + i);
        await B.query('BEGIN'); await B.query(`UPDATE "LegalReleases" SET "status"='published', "publishedAt"=now() WHERE "id"=$1`, [id]); // B publica, aún sin confirmar
        await A.query('BEGIN');
        const insert = A.query(`INSERT INTO "LegalDocumentVersions" ("releaseId","docKey","lang","content","contentHash") VALUES ($1,'privacy','es',$2::jsonb,$3)`, [id, row, 'a'.repeat(64)]).then(() => 'inserted', (e) => e.message);
        await new Promise((r) => setTimeout(r, 120)); // con FOR SHARE, A espera el candado de B; sin él, A leería «borrador» y seguiría
        await B.query('COMMIT');
        const outcome = await insert; await A.query('ROLLBACK').catch(() => {});
        assert.match(String(outcome), /legal_immutable/, `corrida ${i}: el documento debió rechazarse porque la publicación ya estaba publicada`);
        assert.equal(Number((await q('SELECT count(*) n FROM "LegalDocumentVersions" WHERE "releaseId"=$1', [id]))[0].n), 0);
      }
    } finally { await A.end(); await B.end(); }
    await rejects('TRUNCATE "LegalDocumentVersions"', [], /legal_immutable/);
    await rejects('TRUNCATE "LegalReleases" CASCADE', [], /legal_immutable/);
  });

  await t.test('la semilla se niega (sin escribir) si su versión no es la que exige el registro o si el contenido es inválido', async () => {
    await assert.rejects(seedLegal(app, { termsVersion: 'otra-version' }), (e) => e.code === 'version_mismatch');
    const bad = { ...seed, documents: seed.documents.map((d, i) => (i === 0 ? { ...d, content: { ...d.content, title: '<script>x</script>' } } : d)) };
    await assert.rejects(seedLegal(app, { seed: bad }), (e) => e.code === 'invalid_seed');
    const missing = { ...seed, documents: seed.documents.filter((d) => !(d.docKey === 'terms' && d.lang === 'en')) };
    await assert.rejects(seedLegal(app, { seed: missing }), (e) => e.code === 'invalid_seed');
  });
});
