// [QA-Claude] ES-18 / ES-19 · pruebas de integración contra Postgres REAL (base local de ES-80).
// Uso: QA_SUT=<clon limpio> QA_API=http://127.0.0.1:8098 DATABASE_URL=<base local> node qa/integration/es18-19-real-db.mjs
// El servidor del commit bajo prueba debe estar corriendo contra esa misma base. Solo datos sintéticos (@example.test).
// No se imprimen contraseñas ni tokens.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const sut = process.env.QA_SUT; const api = process.env.QA_API; const dbUrl = process.env.DATABASE_URL;
if (!sut || !api || !dbUrl) throw new Error('Defina QA_SUT, QA_API y DATABASE_URL.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();

const results = []; let failed = 0;
const check = (id, ok, detail = '') => { results.push({ id, ok, detail }); if (!ok) failed++; console.log(JSON.stringify({ id, ok, detail })); };
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* no JSON */ }
  return { status: r.status, json: j };
};
const stamp = Date.now();
const mkUser = async (tag, role = 'user') => {
  const email = `qa-${tag}-${stamp}@example.test`; const password = randomBytes(14).toString('base64url') + 'aA1!';
  const reg = await call('POST', '/api/register', { body: { name: 'QA ' + tag, email, password } });
  if (reg.status !== 201) throw new Error(`registro ${tag}: ${reg.status}`);
  if (role !== 'user') await db.query('update "Users" set role=$1 where email=$2', [role, email]);
  const id = (await db.query('select id from "Users" where email=$1', [email])).rows[0].id;
  const login = async () => (await call('POST', '/api/login', { body: { email, password } }));
  return { tag, email, id, login, password };
};
const tokenOf = async u => { const r = await u.login(); if (r.status !== 200) throw new Error('login ' + u.tag + ' ' + r.status); return r.json.token; };
const decode = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

// ── S0 · tablas creadas por sync() en Postgres real ───────────────────────────
const need = ['RevokedTokens', 'AuthRevocations', 'Consents', 'ConsentEvents'];
const have = (await db.query("select table_name from information_schema.tables where table_schema='public'")).rows.map(r => r.table_name);
check('REAL-T01 tablas nuevas creadas por sync()', need.every(t => have.includes(t)), JSON.stringify(need.map(t => [t, have.includes(t)])));
const idx = (await db.query("select indexname, indexdef from pg_indexes where tablename='Consents'")).rows;
check('REAL-T02 restricción única de Consents (UserId, purpose, scope)', idx.some(i => /UNIQUE/i.test(i.indexdef) && /UserId/.test(i.indexdef) && /purpose/.test(i.indexdef) && /scope/.test(i.indexdef)), idx.map(i => i.indexname).join(','));
const enc = (await db.query('show server_encoding')).rows[0].server_encoding;
console.log(JSON.stringify({ nota: 'codificación de la base', server_encoding: enc }));

// ── S1 · sesiones con revocación en base real ─────────────────────────────────
const A = await mkUser('A'); const B = await mkUser('B'); const ADM = await mkUser('adm', 'admin'); const TER = await mkUser('ter', 'therapist');
const a1 = await tokenOf(A); const a2 = await tokenOf(A);
const c1 = decode(a1);
check('REAL-S01 el login real emite jti e iatMs', typeof c1.jti === 'string' && c1.jti.length === 32 && Number.isFinite(c1.iatMs), `jti=${typeof c1.jti} iatMs=${typeof c1.iatMs}`);
check('REAL-S02 token válido accede', (await call('GET', '/api/mood/history', { token: a1 })).status === 200);
check('REAL-S03 logout revoca solo ese token', (await call('POST', '/api/logout', { token: a1 })).status === 200
  && (await call('GET', '/api/mood/history', { token: a1 })).status === 401 && (await call('GET', '/api/mood/history', { token: a2 })).status === 200);
const rv = (await db.query('select count(*)::int n from "RevokedTokens" where "UserId"=$1', [A.id])).rows[0].n;
check('REAL-S04 la revocación quedó guardada en Postgres', rv === 1, `filas=${rv}`);
check('REAL-S05 logout-all corta todas y un login inmediato vale', (await call('POST', '/api/logout-all', { token: a2 })).status === 200
  && (await call('GET', '/api/mood/history', { token: a2 })).status === 401);
const a3 = await tokenOf(A);
check('REAL-S06 token emitido tras el corte vale (precisión de ms)', (await call('GET', '/api/mood/history', { token: a3 })).status === 200);
const bTok = await tokenOf(B);
const adm = await tokenOf(ADM);
check('REAL-S07 admin desactiva a B: su sesión previa queda cortada y no puede volver a entrar', (await call('PUT', `/api/admin/usuarios/${B.id}`, { token: adm, body: { active: false } })).status === 200
  && (await call('GET', '/api/mood/history', { token: bTok })).status === 401 && (await B.login()).status === 403);
await call('PUT', `/api/admin/usuarios/${B.id}`, { token: adm, body: { active: true } });
const b2 = await tokenOf(B);

// ── S2 · aislamiento A/B con datos reales ─────────────────────────────────────
await call('POST', '/api/mood/checkin', { token: a3, body: { mood: 4 } });
const hb = await call('GET', '/api/mood/history', { token: b2 });
check('REAL-AB01 B no ve el ánimo de A', hb.status === 200 && Array.isArray(hb.json) && hb.json.length === 0, `filas de B=${hb.json?.length}`);
const rec = await db.query('insert into "WellnessRecommendations" ("UserId", content, category, "generatedAt", "seenByUser", "seenByTherapist", "createdAt", "updatedAt") values ($1,$2,$3,now(),false,false,now(),now()) returning id', [A.id, 'cifrado-sintetico', 'reflection']);
const recId = rec.rows[0].id;
const bs = await call('PUT', `/api/recommendations/${recId}/seen`, { token: b2 });
const after = (await db.query('select "seenByUser" s from "WellnessRecommendations" where id=$1', [recId])).rows[0].s;
check('REAL-AB02 B no puede marcar la recomendación de A (404) y la fila no cambia', bs.status === 404 && after === false, `status=${bs.status} seenByUser=${after}`);
const as = await call('PUT', `/api/recommendations/${recId}/seen`, { token: a3 });
check('REAL-AB03 A sí puede marcar la suya', as.status === 200);
check('REAL-AB04 usuario común recibe 403 en rutas de terapeuta; el terapeuta no', (await call('GET', '/api/therapist/pacientes', { token: a3 })).status === 403 && (await call('GET', '/api/therapist/pacientes', { token: await tokenOf(TER) })).status !== 403);
check('REAL-AB05 el admin no recibe entradas individuales ni promedio con pocos datos', await (async () => {
  const r = await call('GET', `/api/admin/usuarios/${A.id}/stats`, { token: adm });
  return r.status === 200 && !('ultimosMoods' in r.json.stats) && r.json.stats.moodPromedio === null;
})());

// ── S3 · consentimientos: aislamiento y concurrencia con conexiones reales ────
await call('PUT', '/api/consents/research', { token: a3, body: { status: 'granted' } });
const cb = await call('GET', '/api/consents', { token: b2 });
check('REAL-C01 B no ve el consentimiento de A', cb.json.consents.find(c => c.purpose === 'research').status === 'undecided');
const hist = await call('GET', '/api/consents/history', { token: b2 });
check('REAL-C02 historial de B vacío', Array.isArray(hist.json.history) && hist.json.history.length === 0);

const C = await mkUser('C'); const cTok = await tokenOf(C);
const firstRound = await Promise.all(Array.from({ length: 25 }, () => call('PUT', '/api/consents/professional_bridge', { token: cTok, body: { status: 'granted' } })));
const codes = firstRound.map(r => r.status);
const rows1 = (await db.query('select count(*)::int n from "Consents" where "UserId"=$1 and purpose=$2', [C.id, 'professional_bridge'])).rows[0].n;
const ev1 = (await db.query('select count(*)::int n from "ConsentEvents" where "UserId"=$1 and purpose=$2', [C.id, 'professional_bridge'])).rows[0].n;
check('REAL-C03 25 primeras decisiones simultáneas: 0 errores 5xx y una sola fila', codes.every(s => s === 200) && rows1 === 1, `códigos=${[...new Set(codes)].join(',')} filas=${rows1} eventos=${ev1}`);
check('REAL-C04 las decisiones idénticas no duplican eventos (idempotencia)', ev1 === 1, `eventos=${ev1}`);

const mixed = await Promise.all(Array.from({ length: 40 }, (_, i) => call('PUT', '/api/consents/facilitator_sharing', { token: cTok, body: { status: i % 2 ? 'revoked' : 'granted' } })));
const codes2 = mixed.map(r => r.status);
const final = (await db.query('select status from "Consents" where "UserId"=$1 and purpose=$2', [C.id, 'facilitator_sharing'])).rows;
const lastEv = (await db.query('select status from "ConsentEvents" where "UserId"=$1 and purpose=$2 order by id desc limit 1', [C.id, 'facilitator_sharing'])).rows[0];
const evCount = (await db.query('select count(*)::int n from "ConsentEvents" where "UserId"=$1 and purpose=$2', [C.id, 'facilitator_sharing'])).rows[0].n;
check('REAL-C05 40 decisiones contradictorias simultáneas: sin 5xx, una fila, y el estado final coincide con el último evento', codes2.every(s => s === 200) && final.length === 1 && final[0].status === lastEv.status, `códigos=${[...new Set(codes2)].join(',')} filas=${final.length} final=${final[0]?.status} últimoEvento=${lastEv?.status} eventos=${evCount}`);

// ── S4 · si faltan las tablas de sesión, el sistema cierra en falla (503) ─────
await db.query('alter table "RevokedTokens" rename to "RevokedTokens_qa"');
const down = await call('GET', '/api/mood/history', { token: a3 });
await db.query('alter table "RevokedTokens_qa" rename to "RevokedTokens"');
const back = await call('GET', '/api/mood/history', { token: a3 });
check('REAL-F01 sin la tabla RevokedTokens toda petición autenticada da 503 (y vuelve a 200 al restaurarla)', down.status === 503 && back.status === 200, `sin tabla=${down.status} restaurada=${back.status}`);

console.log(JSON.stringify({ resumen: { total: results.length, fallos: failed } }));
await db.end();
process.exit(failed ? 1 : 0);
