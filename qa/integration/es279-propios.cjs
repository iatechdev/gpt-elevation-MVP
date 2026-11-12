// [QA-Claude] ES-279 (PR #250) · control de edición simultánea de textos públicos: guion PROPIO con el servidor real completo, PostgreSQL desechable y DOS sesiones reales de superadministración con nombre.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA250_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es279-propios.cjs
// Solo loopback, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const TAG = process.env.TAG || 'pr';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1200) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1200) }) + '\n'); };
const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.ceil(l.length * 0.95) - 1)];
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];

(async () => {
  const { q, mkUser, http, base, issueToken } = await startRealApi(t, { envVar: 'QA250_DB', prefix: 'qa250' });
  const mkNamed = async (name) => { const u = await mkUser('superadmin'); await q('UPDATE "Users" SET name=$2 WHERE id=$1', [u.id, name]); return { ...u, name, token: issueToken({ id: u.id, role: 'superadmin', name }) }; };
  const A = await mkNamed('Superadmin A QA'); const B = await mkNamed('Superadmin B QA');
  const put = (who, body) => http(who, 'PUT', '/api/landing-content', { key: 'hero_title', lang: 'es', ...body });
  const dbRow = async (key = 'hero_title', lang = 'es') => (await q('SELECT key, lang, value, "updatedAt", updated_by FROM "LandingContents" WHERE key=$1 AND lang=$2', [key, lang]))[0];
  const tableFp = async () => (await q(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) h, count(*)::int n FROM "LandingContents" x`))[0];
  const iso = (d) => new Date(d).toISOString();

  // ── C2 · dos sesiones reales (con nombre): el 409 trae el texto vigente y QUIÉN lo guardó, y no escribe ──
  const first = await put(A, { value: 'Texto de A', expectedUpdatedAt: null }); const v1 = first.body.updatedAt;
  const fpBefore = await tableFp();
  const stale = await put(B, { value: 'Texto de B', expectedUpdatedAt: null });
  const fpAfter = await tableFp();
  check(`C2a B (versión vieja) → 409 version_conflict con el texto vigente y quién lo guardó, y la tabla NO cambia [${TAG}]`, first.status === 200 && stale.status === 409 && stale.body.code === 'version_conflict' && stale.body.current && stale.body.current.value === 'Texto de A' && stale.body.current.updatedBy === 'Superadmin A QA' && iso(stale.body.current.updatedAt) === iso(v1) && fpBefore.h === fpAfter.h,
    `primer guardado ${first.status}; 409 ${stale.status}; current ${JSON.stringify(stale.body.current).slice(0, 140)}; huella igual ${fpBefore.h === fpAfter.h}`);
  const ok = await put(B, { value: 'Texto de B', expectedUpdatedAt: stale.body.current.updatedAt }); const old = await put(A, { value: 'Otra vez A', expectedUpdatedAt: v1 });
  check(`C2b B con la versión vigente guarda; A con la suya vieja → 409 con el texto de B [${TAG}]`, ok.status === 200 && old.status === 409 && old.body.current.value === 'Texto de B' && old.body.current.updatedBy === 'Superadmin B QA', `${ok.status}/${old.status}; quién: ${old.body.current && old.body.current.updatedBy}`);
  let version = ok.body.updatedAt;

  // ── C3 · carreras: 30 PUT con la misma versión ×5 rondas, 20 primeros guardados, mezcla con y sin versión; pool de 5 ──
  const roundProblems = []; const stat = [];
  for (let r = 0; r < 5; r += 1) {
    const out = await Promise.all(Array.from({ length: 30 }, (_, i) => put(i % 2 ? A : B, { value: `Ronda ${r} competidor ${i}`, expectedUpdatedAt: version })));
    const w = out.filter((x) => x.status === 200); const l = out.filter((x) => x.status === 409); const bad = out.filter((x) => x.status >= 500 || ![200, 409].includes(x.status));
    stat.push(`${w.length}/${l.length}/${bad.length}`);
    if (w.length !== 1 || l.length !== 29 || bad.length) roundProblems.push(`ronda ${r}: ganadores ${w.length}, 409 ${l.length}, otros ${bad.map((x) => x.status).join(',')}`);
    else { const idx = out.indexOf(w[0]); const row = await dbRow(); if (row.value !== `Ronda ${r} competidor ${idx}`) roundProblems.push(`ronda ${r}: la fila no es la del ganador`); version = w[0].body.updatedAt; }
  }
  check(`C3a 30 PUT simultáneos con la misma versión × 5 rondas (pool de 5): exactamente 1 ganador por ronda, 29 × 409, 0 5xx, la fila es la del ganador [${TAG}]`, roundProblems.length === 0, `ganadores/409/otros por ronda: ${stat.join(' ')}; ${roundProblems.join(' | ') || 'sin problemas'}`);
  const fresh = await Promise.all(Array.from({ length: 20 }, (_, i) => http(i % 2 ? A : B, 'PUT', '/api/landing-content', { key: 'cta_primary', lang: 'en', value: `Nuevo ${i}`, expectedUpdatedAt: null })));
  const freshRows = Number((await q('SELECT count(*) n FROM "LandingContents" WHERE key=$1 AND lang=$2', ['cta_primary', 'en']))[0].n);
  check(`C3b 20 primeros guardados simultáneos (expectedUpdatedAt=null): 1 crea, 19 × 409, 1 fila, 0 5xx [${TAG}]`, fresh.filter((x) => x.status === 200).length === 1 && fresh.filter((x) => x.status === 409).length === 19 && freshRows === 1, `estados ${JSON.stringify(fresh.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {}))}; filas ${freshRows}`);
  const mixed = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? put(A, { value: `Sin versión ${i}` }) : put(B, { value: `Con versión ${i}`, expectedUpdatedAt: version }))));
  const rowsHero = Number((await q('SELECT count(*) n FROM "LandingContents" WHERE key=$1 AND lang=$2', ['hero_title', 'es']))[0].n);
  check(`C3c mezcla de PUT con y sin versión (30 simultáneos): 0 5xx y 1 fila [${TAG}]`, mixed.every((x) => [200, 409].includes(x.status)) && rowsHero === 1, `estados ${JSON.stringify(mixed.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {}))}; filas ${rowsHero}`);
  const idle = Number((await q(`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction' AND pid <> pg_backend_pid()`))[0].n); const health = await fetch(base + '/api/health');
  check(`C3d tras las tormentas no quedan transacciones abiertas y la API responde [${TAG}]`, idle === 0 && health.status === 200, `«idle in transaction»: ${idle}; salud ${health.status}`);

  // ── C4 · semántica de expectedUpdatedAt ──
  const cur = await dbRow(); const curV = (await http(A, 'GET', '/api/landing-content/versions?lang=es')).body.find((e) => e.key === 'hero_title').updatedAt;
  const sem = []; const tryPut = async (label, body, expect) => { const before = await tableFp(); const r = await put(A, { value: 'Prueba semántica', ...body }); const after = await tableFp(); const okc = expect.includes(r.status); const wrote = before.h !== after.h; if (!okc) sem.push(`${label}: ${r.status} (esperaba ${expect})`); if (r.status !== 200 && wrote) sem.push(`${label}: escribió con ${r.status}`); return r; };
  await tryPut('null con registro existente', { expectedUpdatedAt: null }, [409]);
  await tryPut('versión inexistente en un texto nuevo', { key: 'cta_final_title', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }, [409]);
  for (const [label, val] of [['número', 12345], ['objeto', {}], ['arreglo', []], ['cadena vacía', ''], ['+00:00', '2026-01-01T00:00:00+00:00'], ['sin Z', '2026-01-01T00:00:00'], ['fecha imposible 2026-02-30', '2026-02-30T00:00:00Z'], ['segundo 60', '2026-12-31T23:59:60Z'], ['mes 13', '2026-13-01T00:00:00Z'], ['7 decimales', '2026-01-01T00:00:00.1234567Z'], ['41 caracteres', '2026-01-01T00:00:00.123456Z' + 'x'.repeat(15)], ['con espacios', ' 2026-01-01T00:00:00Z '], ['NUL', '2026-01-01T00:00:00Z\u0000'], ['solo fecha', '2026-01-01'], ['booleano', true], ['minúscula z', '2026-01-01T00:00:00z'], ['año 0000', '0000-01-01T00:00:00Z'], ['año 9999 (formato válido, no coincide)', '9999-12-31T23:59:59.999Z']]) {
    const exp = label.startsWith('año 9999') ? [409] : label.startsWith('año 0000') ? [400, 409] : [400];
    await tryPut(label, { expectedUpdatedAt: val }, exp);
  }
  check(`C4a null con registro existente → 409; versión inexistente → 409; 17 formatos inválidos → 400 y NUNCA escribe [${TAG}]`, sem.length === 0, sem.slice(0, 8).join(' | ') || '20 casos');
  // precisión: fila escrita por SQL con microsegundos
  await q(`INSERT INTO "LandingContents" (key, lang, value, updated_by, "createdAt", "updatedAt") VALUES ('cta_final_desc','es','Fila de SQL','sql', now(), '2026-11-01 10:00:00.123456+00')`);
  const sqlV = (await http(A, 'GET', '/api/landing-content/versions?lang=es')).body.find((e) => e.key === 'cta_final_desc');
  const prec = await http(A, 'PUT', '/api/landing-content', { key: 'cta_final_desc', lang: 'es', value: 'Guardado sobre fila de SQL', expectedUpdatedAt: sqlV.updatedAt });
  const prec6 = await http(A, 'PUT', '/api/landing-content', { key: 'cta_final_desc', lang: 'es', value: 'Con microsegundos', expectedUpdatedAt: '2026-11-01T10:00:00.123456Z' });
  info(`C4b precisión: fila de SQL con microsegundos [${TAG}]`, `versión entregada «${sqlV.updatedAt}»; PUT con esa versión → ${prec.status}; luego PUT con «…123456Z» (versión vieja) → ${prec6.status} (409 esperado: la fila ya cambió)`);
  check(`C4c la versión que entrega GET /versions sirve de expectedUpdatedAt para una fila escrita por SQL con microsegundos (sin falso 409) [${TAG}]`, prec.status === 200, `estado ${prec.status} ${JSON.stringify(prec.body).slice(0, 100)}`);
  // compatibilidad: sin versión
  const compat = await put(A, { value: 'Sin versión: el último guarda' }); check(`C7a sin expectedUpdatedAt el servidor guarda como antes (el último gana) [${TAG}]`, compat.status === 200 && (await dbRow()).value === 'Sin versión: el último guarda', `estado ${compat.status}`);

  // ── C5 · seguridad ──
  const admin = await mkUser('admin'); const ther = await mkUser('therapist'); const person = await mkUser('user'); const board = await mkUser('board'); const sec = [];
  for (const [name, who] of [['sin sesión', null], ['persona', person], ['profesional', ther], ['administración', admin], ['junta', board]]) {
    const g = await http(who, 'GET', '/api/landing-content/versions?lang=es'); const p = await put(who, { value: 'No autorizado', expectedUpdatedAt: null });
    if (![401, 403].includes(g.status)) sec.push(`${name} GET /versions → ${g.status}`); if (![401, 403].includes(p.status)) sec.push(`${name} PUT → ${p.status}`);
  }
  check(`C5a sin sesión, persona, profesional, administración y junta: PUT y GET /versions → 401/403 [${TAG}]`, sec.length === 0 && (await dbRow()).value === 'Sin versión: el último guarda', sec.join(' | ') || '10 solicitudes rechazadas; el texto no cambió');
  const pub = await http(null, 'GET', '/api/landing-content?lang=es'); const pubText = JSON.stringify(pub.body);
  check(`C5b la lectura pública no expone versión, quién guardó ni nombres de superadministración [${TAG}]`, pub.status === 200 && !/updatedAt|updated_by|updatedBy|Superadmin A QA|Superadmin B QA/.test(pubText), `estado ${pub.status}`);
  const vers = (await http(A, 'GET', '/api/landing-content/versions?lang=es')).body;
  info(`C5c qué devuelve /versions a superadministración [${TAG}]`, `${vers.length} textos; claves de cada uno: ${Object.keys(vers[0] || {}).join(',')}`);

  // ── C6 · hostiles ──
  const hostile = []; let n6 = 0;
  const bodies = [{ key: 'inventada', lang: 'es', value: 'x' }, { key: 'hero_title', lang: 'fr', value: 'x' }, { key: 'hero_title', lang: 'es', value: 'x'.repeat(5001) }, { key: 'hero_title', lang: 'es', value: null }, { key: 'hero_title', lang: 'es', value: 5 }, { key: 'hero_title', lang: 'es', value: ['a'] }, { key: ['hero_title'], lang: 'es', value: 'x' }, { key: 'hero_title', lang: { $ne: 1 }, value: 'x' },
    { key: "hero_title'; DROP TABLE \"LandingContents\";--", lang: 'es', value: 'x' }, { key: 'hero_title', lang: 'es', value: 'a\u0000b' }, { key: '__proto__', lang: 'es', value: 'x' }, { lang: 'es', value: 'x' }, { key: 'hero_title', value: 'x' }];
  for (const b of bodies) for (const exp of [undefined, null, version, 'basura']) { n6 += 1; const body = exp === undefined ? b : { ...b, expectedUpdatedAt: exp }; const r = await http(A, 'PUT', '/api/landing-content', body); const txt = JSON.stringify(r.body || {});
    if (r.status >= 500) hostile.push(`${JSON.stringify(b).slice(0, 40)} exp=${String(exp).slice(0, 12)} → ${r.status}`); if (/SequelizeDatabaseError|invalid input syntax|relation ".*" does not exist|\n\s+at \w/.test(txt)) hostile.push('filtra detalle interno: ' + txt.slice(0, 60)); }
  for (const lang of ['xx', '', 'ES', 'es%00', '../', 'es&lang=en', 'a'.repeat(5000)]) { n6 += 1; const r = await http(A, 'GET', '/api/landing-content/versions?lang=' + encodeURIComponent(lang)); if (r.status >= 500) hostile.push(`versions lang=${lang.slice(0, 10)} → ${r.status}`); }
  const broken = await fetch(base + '/api/landing-content', { method: 'PUT', headers: { Authorization: 'Bearer ' + A.token, 'Content-Type': 'application/json' }, body: '{"key":' }); const huge = await fetch(base + '/api/landing-content', { method: 'PUT', headers: { Authorization: 'Bearer ' + A.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'hero_title', lang: 'es', value: 'x', expectedUpdatedAt: 'z'.repeat(400000) }) });
  check(`C6 ${n6} entradas hostiles en PUT y /versions (claves, tipos, 5 001 caracteres, inyección, NUL, JSON roto, 400 KB): 0 5xx y sin texto de PostgreSQL [${TAG}]`, hostile.length === 0 && broken.status < 500 && huge.status < 500, `${hostile.slice(0, 6).join(' | ') || 'sin problemas'}; JSON roto ${broken.status}; 400 KB ${huge.status}`);

  // ── C9 · rendimiento: PUT con versión y sin versión (50 cada uno, en serie) ──
  const tw = []; const tn = []; let ver = (await http(A, 'GET', '/api/landing-content/versions?lang=es')).body.find((e) => e.key === 'hero_title').updatedAt;
  for (let i = 0; i < 50; i += 1) { let t0 = performance.now(); const r = await put(A, { value: `Con versión ${i}`, expectedUpdatedAt: ver }); tw.push(performance.now() - t0); if (r.status === 200) ver = r.body.updatedAt; t0 = performance.now(); await put(A, { value: `Sin versión ${i}` }); tn.push(performance.now() - t0); ver = (await http(A, 'GET', '/api/landing-content/versions?lang=es')).body.find((e) => e.key === 'hero_title').updatedAt; }
  info(`C9 latencia [${TAG}]`, `PUT con versión: mediana ${median(tw).toFixed(1)} ms, p95 ${p95(tw).toFixed(1)} ms | PUT sin versión (camino anterior): mediana ${median(tn).toFixed(1)} ms, p95 ${p95(tn).toFixed(1)} ms`);
  check(`C9 p95 de ambos caminos < 300 ms (propuesta) [${TAG}]`, p95(tw) < 300 && p95(tn) < 300, `con versión ${p95(tw).toFixed(1)} ms; sin versión ${p95(tn).toFixed(1)} ms`);

  fs.writeFileSync(path.join(OUT, `ES-279-propios-${TAG}.json`), JSON.stringify(results, null, 1));
  process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
