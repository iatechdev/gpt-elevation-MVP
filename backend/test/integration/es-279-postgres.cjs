// ES-279 (E216-7) · Textos públicos: dos administraciones que editan el mismo texto ya no se pisan en silencio. HTTP REAL (dos sesiones reales) contra el server.js real y PostgreSQL REAL.
//   ES279_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-279-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-279 PostgreSQL + HTTP: control de edición simultánea de textos públicos', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES279_TEST_DATABASE_URL', prefix: 'es279' });
  const A = await mkUser('superadmin'); const B = await mkUser('superadmin');
  const put = (who, body) => http(who, 'PUT', '/api/landing-content', { key: 'hero_title', lang: 'es', ...body });
  const row = async (key = 'hero_title') => (await q('SELECT value, "updatedAt", updated_by FROM "LandingContents" WHERE key=$1 AND lang=$2', [key, 'es']))[0];
  const iso = (d) => new Date(d).toISOString();
  let version;

  await t.test('dos sesiones: la segunda, con la versión vieja, recibe 409 con el texto vigente y NO escribe; con la nueva sí guarda', async () => {
    const first = await put(A, { value: 'Texto de A', expectedUpdatedAt: null });
    assert.equal(first.status, 200); version = first.body.updatedAt; assert.ok(version);
    const stale = await put(B, { value: 'Texto de B', expectedUpdatedAt: null }); // B leyó antes de que A guardara
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'version_conflict'); assert.ok(stale.body.error.includes(' / '));
    assert.equal(stale.body.current.value, 'Texto de A'); assert.equal(iso(stale.body.current.updatedAt), iso(version));
    assert.equal((await row()).value, 'Texto de A', 'el 409 no escribió nada');
    const ok = await put(B, { value: 'Texto de B', expectedUpdatedAt: stale.body.current.updatedAt }); // B vuelve a intentar con la versión vigente
    assert.equal(ok.status, 200);
    const old = await put(A, { value: 'Otra vez A', expectedUpdatedAt: version }); // A conserva la versión que leyó al inicio
    assert.equal(old.status, 409); assert.equal(old.body.current.value, 'Texto de B');
    assert.equal((await row()).value, 'Texto de B'); version = ok.body.updatedAt;
  });

  await t.test('carrera: 40 guardados simultáneos con la misma versión, en 6 rondas → en cada ronda exactamente uno gana y 39 reciben 409; queda el texto del ganador', async () => {
    // E250-1 (QA): con 10 simultáneos la prueba no distinguía quitar el bloqueo FOR UPDATE (sin él ven hasta 5 ganadores); con 40 repetidos, sí.
    for (let round = 0; round < 6; round += 1) {
      const results = await Promise.all(Array.from({ length: 40 }, (_, i) => put(i % 2 ? A : B, { value: `Ronda ${round} competidor ${i}`, expectedUpdatedAt: version })));
      const winners = results.filter((r) => r.status === 200); const losers = results.filter((r) => r.status === 409);
      assert.equal(winners.length, 1, `ronda ${round}: ganadores ${winners.length} (${results.map((r) => r.status).join(',')})`);
      assert.equal(losers.length, 39, `ronda ${round}`); assert.equal(results.filter((r) => r.status >= 500).length, 0);
      const index = results.indexOf(winners[0]);
      assert.equal((await row()).value, `Ronda ${round} competidor ${index}`);
      assert.equal((await q('SELECT count(*)::int n FROM "LandingContents" WHERE key=$1', ['hero_title']))[0].n, 1);
      version = winners[0].body.updatedAt; // la siguiente ronda parte de la versión que dejó el ganador
    }
  });

  await t.test('primer guardado de un texto nuevo: de ocho simultáneos con expectedUpdatedAt=null solo uno crea, y no hay filas duplicadas ni 5xx', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => http(i % 2 ? A : B, 'PUT', '/api/landing-content', { key: 'cta_primary', lang: 'es', value: `Nuevo ${i}`, expectedUpdatedAt: null })));
    assert.equal(results.filter((r) => r.status === 200).length, 1, results.map((r) => r.status).join(','));
    assert.equal(results.filter((r) => r.status === 409).length, 7);
    assert.equal((await q('SELECT count(*)::int n FROM "LandingContents" WHERE key=$1 AND lang=$2', ['cta_primary', 'es']))[0].n, 1);
    for (const r of results.filter((x) => x.status === 409)) assert.ok(r.body.current === null || typeof r.body.current.value === 'string');
  });

  await t.test('esperaba un registro que no existe → 409 sin crear nada; versión con formato inválido → 400 sin escribir', async () => {
    const gone = await http(A, 'PUT', '/api/landing-content', { key: 'cta_final_title', lang: 'es', value: 'x', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' });
    assert.equal(gone.status, 409); assert.equal(gone.body.current, null);
    assert.equal((await q('SELECT count(*)::int n FROM "LandingContents" WHERE key=$1', ['cta_final_title']))[0].n, 0);
    const before = JSON.stringify(await row());
    for (const bad of ['basura', 12345, [], {}, true, '2026-13-45T99:99:99Z', '2026-02-30T00:00:00.000Z', '2026-04-31T10:00:00Z', '2026-01-01T24:00:00Z', '2026-02-29T00:00:00Z', '2026-01-01', 'x'.repeat(200), '2026-01-01T00:00:00+05:00']) {
      const out = await put(A, { value: 'Hostil', expectedUpdatedAt: bad });
      assert.equal(out.status, 400, JSON.stringify(bad).slice(0, 30)); assert.equal(out.body.field, 'expectedUpdatedAt');
    }
    assert.equal(JSON.stringify(await row()), before, 'ninguna versión inválida cambió el texto');
  });

  await t.test('compatibilidad: sin expectedUpdatedAt el servidor conserva el comportamiento anterior (el último guarda); las validaciones de siempre siguen', async () => {
    assert.equal((await put(A, { value: 'Sin versión' })).status, 200);
    assert.equal((await row()).value, 'Sin versión');
    assert.equal((await put(A, { value: '' })).status, 400);
    assert.equal((await put(A, { value: 'x', lang: 'fr' })).status, 400);
    assert.equal((await put(A, { value: 'x'.repeat(5001), expectedUpdatedAt: null })).status, 400);
  });

  // E380-1 (QA-Claude-3 sobre #380): solo se guardan textos PUBLICABLES. Antes una clave cualquiera (`no_existe`) respondía 200 y escribía una fila que ninguna pantalla muestra.
  await t.test('E380-1: una clave que no es publicable es 400 estable y NO escribe (con y sin expectedUpdatedAt, en ES y EN); las claves del catálogo y las clásicas de la portada siguen guardando', async () => {
    const before = Number((await q('SELECT count(*) n FROM "LandingContents"'))[0].n);
    const hostile = ['no_existe', 'landing.no.existe', '__proto__', 'constructor', 'HERO_TITLE', 'hero_title ', ' hero_title', "x'; DROP TABLE \"LandingContents\";--", '../etc/passwd', 'a'.repeat(300)];
    for (const key of hostile) {
      for (const extra of [{}, { expectedUpdatedAt: null }]) {
        for (const lang of ['es', 'en']) {
          const out = await http(A, 'PUT', '/api/landing-content', { key, lang, value: 'texto', ...extra });
          assert.equal(out.status, 400, `${JSON.stringify(key).slice(0, 40)} ${lang} ${JSON.stringify(extra)} → ${out.status}`);
          assert.ok(['unknown_key', undefined].includes(out.body.code), JSON.stringify(out.body));
        }
      }
    }
    assert.equal(Number((await q('SELECT count(*) n FROM "LandingContents"'))[0].n), before, 'ninguna clave inválida creó una fila');
    assert.equal((await http(A, 'PUT', '/api/landing-content', { key: 'no_existe', lang: 'en', value: 'x' })).body.error, 'Unknown landing key.');
    assert.equal((await http(A, 'PUT', '/api/landing-content', { key: 'no_existe', lang: 'es', value: 'x' })).body.error, 'Clave landing desconocida.');
    const { catalog } = require('../../content/landingDefaults');
    for (const key of ['hero_title', 'hero_subtitle', 'cta_primary', 'cta_final_title', 'cta_final_subtitle', catalog[0].key, catalog[catalog.length - 1].key]) {
      const out = await http(A, 'PUT', '/api/landing-content', { key, lang: 'es', value: `Valor de ${key}` });
      assert.equal(out.status, 200, `${key}: ${out.status} ${JSON.stringify(out.body)}`);
    }
    assert.equal((await row(catalog[0].key)).value, `Valor de ${catalog[0].key}`);
    assert.equal((await put(A, { value: 'Sin versión' })).status, 200); // se restablece el texto que usan las pruebas siguientes
  });

  await t.test('versiones: solo superadministración las lee; la lectura pública no cambia ni expone quién guardó; administración, persona y sin sesión no escriben', async () => {
    const list = await http(A, 'GET', '/api/landing-content/versions?lang=es');
    assert.equal(list.status, 200);
    const hero = list.body.find((e) => e.key === 'hero_title');
    assert.ok(hero && hero.updatedAt && 'updatedBy' in hero && typeof hero.value === 'string'); // updatedBy sale del nombre en el token; el token sintético de la prueba no lo lleva
    for (const who of [await mkUser('admin'), await mkUser('therapist'), await mkUser('user'), null]) {
      assert.ok([401, 403].includes((await http(who, 'GET', '/api/landing-content/versions?lang=es')).status));
      assert.equal((await put(who, { value: 'No autorizado', expectedUpdatedAt: null })).status === 200, false);
    }
    const pub = await http(null, 'GET', '/api/landing-content?lang=es');
    assert.equal(pub.status, 200); assert.equal(pub.body.hero_title, 'Sin versión');
    assert.ok(!JSON.stringify(pub.body).includes('updatedBy') && !JSON.stringify(pub.body).includes('updatedAt'));
  });
});
