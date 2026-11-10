// [QA-Claude] ES-257 · PR #205 (/api/user/progress promedia solo valores válidos 1-5) · servidor REAL, Postgres con migraciones, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> [MODE=main] node qa/integration/es257-progreso-pr205.cjs
// MODE=main: mismo guion contra main (control); las expectativas P1-P3 se evalúan igual y se informa cuáles fallan (esperado en main).
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const MODE = E.MODE || 'pr'; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 600) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 600) })); };
// Oráculo independiente: media de enteros 1-5 válidos, redondeo «mitad hacia arriba» a 1 decimal con aritmética entera exacta.
const oracle = (vals) => { const v = vals.filter(x => Number.isInteger(x) && x >= 1 && x <= 5); if (!v.length) return null; const s = v.reduce((a, b) => a + b, 0), n = v.length; return Math.floor((s * 20 + n) / (2 * n)) / 10; };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  let seqN = 0; const mk = async (tag, role = 'user') => { const email = `qa257-${String(tag).replace(/[^a-z0-9]/gi, '')}${++seqN}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA257 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, hdr = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...hdr } }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
  const reqCols = async (t) => q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null and column_name not in ('id')`, [t]);
  info('esquema', 'NOT NULL sin default MoodLogs: ' + (await reqCols('MoodLogs')).map(r => r.column_name).join(',') + ' · SessionRatings: ' + (await reqCols('SessionRatings')).map(r => r.column_name).join(','));
  const sm = async (u, i, ci, co) => q(`insert into "MoodLogs"("UserId",checkin_mood,checkout_mood,date,"createdAt","updatedAt") values ($1,$2,$3,$4,now(),now())`, [u.id, ci, co, day(i)]);
  const sr = async (u, i, r) => q(`insert into "SessionRatings"("UserId",rating,date,"createdAt","updatedAt") values ($1,$2,$3,now(),now())`, [u.id, r, day(i)]);
  const prog = async (u) => (await call(u, 'GET', '/api/user/progress'));
  const person = async (tag, { ratings = [], moods = [] } = {}) => { const u = await mk(tag); for (let i = 0; i < ratings.length; i++) await sr(u, i, ratings[i]); for (let i = 0; i < moods.length; i++) await sm(u, i, moods[i][0], moods[i][1]); return u; };
  const fail = [];
  const expectRating = async (tag, ratings, want) => { const u = await person('r' + tag, { ratings }); const r = await prog(u); const got = r.json?.stats?.avgRating; const ok = r.status === 200 && got === want && (want === null ? got === null : true); if (!ok) fail.push(tag); return { ok, detail: `${JSON.stringify(ratings)} → ${r.status} avgRating=${JSON.stringify(got)} (esperado ${JSON.stringify(want)})` }; };

  // P1 calificaciones
  const P1 = [['4+NULL', [4, null], 4], ['solo NULL', [null], null], ['varias NULL', [null, null, null], null], ['sin filas', [], null], ['5,4,3', [5, 4, 3], 4], ['3,3,4 (3,333)', [3, 3, 4], 3.3], ['3,4,4,4 (3,75)', [3, 4, 4, 4], 3.8], ['una sola 2', [2], 2], ['NULL,5,NULL,1', [null, 5, null, 1], 3], ['20 valores suma 69 (3,45)', [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3].map((v, i) => v), oracle([3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3])]];
  const p1res = []; for (const [t, rs, w] of P1) { const x = await expectRating(t, rs, w); p1res.push(x); }
  check('P1 calificaciones (10 casos): nulas no cuentan como 0 ni en el divisor; solo nulas o sin filas → null; redondeo a 1 decimal', p1res.every(x => x.ok), p1res.filter(x => !x.ok).map(x => x.detail).join(' | ') || p1res.map(x => x.detail.split('→')[1]).join(' ; '));
  info('P1-redondeo', `3,75→${(await prog(await person('rr', { ratings: [3, 4, 4, 4] }))).json.stats.avgRating} (oráculo ${oracle([3, 4, 4, 4])}); 3,35→${oracle([3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3])} esperado por oráculo`);

  // P2 ánimo
  const expectMood = async (tag, moods, want) => { const u = await person('m' + tag, { moods }); const r = await prog(u); const got = r.json?.stats?.avgMood; return { ok: r.status === 200 && got === want, detail: `${JSON.stringify(moods)} → ${r.status} avgMood=${JSON.stringify(got)} (esperado ${JSON.stringify(want)})` }; };
  const P2 = [['(4,NULL)', [[4, null]], 4], ['(NULL,NULL)', [[null, null]], null], ['(4,2)', [[4, 2]], 3], ['mezcla (4,2),(5,NULL),(NULL,NULL)', [[4, 2], [5, null], [null, null]], oracle([4, 2, 5])], ['(1,5)', [[1, 5]], 3], ['(3,NULL)x3 + (NULL,5)', [[3, null], [3, null], [3, null], [null, 5]], oracle([3, 3, 3, 5])], ['sin registros', [], null]];
  const p2res = []; for (const [t, ms, w] of P2) p2res.push(await expectMood(t, ms, w));
  check('P2 ánimo (7 casos): promedio = suma de válidos / cantidad de válidos (no de registros); sin válidos → null; nunca fuera de 1–5', p2res.every(x => x.ok), p2res.filter(x => !x.ok).map(x => x.detail).join(' | ') || p2res.map(x => x.detail.split('→')[1]).join(' ; '));

  // P3 bordes y fuera de escala
  let seedErr = [];
  const tryRating = async (u, i, v) => { try { await sr(u, i, v); return true; } catch (e) { seedErr.push('rating ' + v + ': ' + e.message.slice(0, 60)); return false; } };
  const u3 = await mk('p3'); for (const [i, v] of [4, 0, 6, -1, 99, 32767].entries()) await tryRating(u3, i, v);
  const u3m = await mk('p3m'); for (const [i, v] of [[3, 0], [6, -1], [99, 3]].entries()) await sm(u3m, i, v[0], v[1]);
  const u3o = await mk('p3o'); for (const [i, v] of [0, 6, -1, 99].entries()) await tryRating(u3o, i, v); await sm(u3o, 0, 0, 6); await sm(u3o, 1, -1, 99);
  const u3e = await mk('p3e'); await sr(u3e, 0, 1); await sr(u3e, 1, 5); await sm(u3e, 0, 1, 5);
  const [a3, b3, c3, d3] = [await prog(u3), await prog(u3m), await prog(u3o), await prog(u3e)];
  check('P3a fuera de escala (0, 6, −1, 99, 32767) mezclados con un 4: no entran al promedio (avgRating 4); sin NaN ni 5xx', a3.status === 200 && a3.json.stats.avgRating === 4 && !/NaN/.test(a3.text), `${a3.status} ${a3.json?.stats?.avgRating}`);
  check('P3b ánimo fuera de escala (3,0)(6,−1)(99,3) → promedio solo de 3 y 3 = 3', b3.status === 200 && b3.json.stats.avgMood === 3, `${b3.status} ${b3.json?.stats?.avgMood}`);
  check('P3c solo valores fuera de escala (calificación y ánimo) → null en ambos, 200, sin NaN', c3.status === 200 && c3.json.stats.avgRating === null && c3.json.stats.avgMood === null && !/NaN/.test(c3.text), `${c3.status} ${JSON.stringify(c3.json?.stats)}`);
  check('P3d los extremos exactos 1 y 5 SÍ cuentan: rating (1,5) → 3 y ánimo (1,5) → 3', d3.status === 200 && d3.json.stats.avgRating === 3 && d3.json.stats.avgMood === 3, JSON.stringify(d3.json?.stats));
  info('P3-siembra', 'columnas INTEGER/SMALLINT: se pudieron sembrar enteros fuera de escala; decimales y texto no caben en la columna (no probables). Errores de siembra: ' + (seedErr.join('; ') || 'ninguno'));

  // P4 aislamiento y ventana
  const A = await person('A', { ratings: [5, 5, 5], moods: [[5, 5]] }), B = await person('B', { ratings: [1, 1], moods: [[1, 1]] });
  const [ra, rb] = [await prog(A), await prog(B)];
  const idsOf = (r) => JSON.stringify([...(r.json.moodLogs || []), ...(r.json.ratings || [])].map(x => x.UserId));
  check('P4a cada persona ve SOLO su promedio (A 5/5, B 1/1) y las filas devueltas son solo suyas', ra.json.stats.avgRating === 5 && rb.json.stats.avgRating === 1 && ra.json.stats.avgMood === 5 && rb.json.stats.avgMood === 1 && JSON.parse(idsOf(ra)).every(x => x === A.id) && JSON.parse(idsOf(rb)).every(x => x === B.id) && !ra.text.includes(B.email) && !rb.text.includes(A.email), idsOf(ra) + ' ' + idsOf(rb));
  const none = await call(null, 'GET', '/api/user/progress'), bad = await call({ token: jwt.sign({ id: A.id, role: 'user', iatMs: Date.now() }, 'otra-clave', { expiresIn: '1h' }) }, 'GET', '/api/user/progress'), exp = await call({ token: jwt.sign({ id: A.id, name: A.name, role: 'user', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '-10s' }) }, 'GET', '/api/user/progress'), qs = await call(A, 'GET', `/api/user/progress?userId=${B.id}&UserId=${B.id}`);
  check('P4b sin sesión, firmado con otra clave y vencido → 401/403; pasar `userId` ajeno en la consulta no cambia el resultado', [none, bad, exp].every(r => [401, 403].includes(r.status)) && qs.status === 200 && qs.json.stats.avgRating === 5, `${none.status} ${bad.status} ${exp.status} qs=${qs.json?.stats?.avgRating}`);
  const big = await mk('big'); const vals = []; for (let i = 0; i < 40; i++) { const v = (i % 5) + 1; vals.push([i, v]); await sr(big, i, v); await sm(big, i, v, null); }
  const recent = vals.sort((x, y) => y[0] - x[0]).slice(0, 30).map(x => x[1]); const allv = vals.map(x => x[1]); const rbig = await prog(big);
  check('P4c con 40 registros se usa la ventana de los 30 más recientes (observación del comportamiento existente: 30)', rbig.json.stats.avgRating === oracle(recent) && rbig.json.ratings.length === 30 && rbig.json.moodLogs.length === 30, `ventana=${oracle(recent)} total=${oracle(allv)} got=${rbig.json.stats.avgRating} filas=${rbig.json.ratings.length}`);

  // P5 forma de la respuesta + pantalla
  const shape = (r) => ({ top: Object.keys(r.json).sort(), stats: Object.keys(r.json.stats).sort(), mood: Object.keys(r.json.moodLogs[0] || {}).sort(), rating: Object.keys(r.json.ratings[0] || {}).sort(), types: Object.fromEntries(Object.entries(r.json.stats).map(([k, v]) => [k, v === null ? 'null' : typeof v])) });
  const snapU = await person('snap', { ratings: [5, 4, 3], moods: [[4, 2], [5, null]] }); const sp = await prog(snapU);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-257-forma-${MODE}.json`), JSON.stringify({ shape: shape(sp), stats: sp.json.stats }, null, 2));
  check('P5a forma de la respuesta: claves de primer nivel (stats, moodLogs, ratings, recommendations), de stats (totalSessions, avgMood, avgRating, streak) y tipos; se guarda para compararla con main campo por campo', JSON.stringify(shape(sp).top) === JSON.stringify(['moodLogs', 'ratings', 'recommendations', 'stats']) && JSON.stringify(shape(sp).stats) === JSON.stringify(['avgMood', 'avgRating', 'streak', 'totalSessions']), JSON.stringify(shape(sp)));
  const ui = fs.readFileSync(path.join(E.QA_SUT, 'frontend', 'src', 'pages', 'UserProgress.tsx'), 'utf8');
  check('P5b la pantalla (UserProgress.tsx) trata null como «—» (`!= null ? … : \'—\'`) para ánimo y calificación: sin «0,0» ni «NaN»; el contrato `number | null` no cambia', /avgMood != null \? .* : '—'/.test(ui) && /avgRating != null \? .* : '—'/.test(ui) && /avgMood: number \| null/.test(ui) && /avgRating: number \| null/.test(ui), '');
  const nul = await prog(await person('nul', { ratings: [null], moods: [[null, null]] }));
  check('P5c persona con filas pero sin valores válidos: la respuesta trae null (no 0) en ambos y totalSessions cuenta la fila', nul.json.stats.avgRating === null && nul.json.stats.avgMood === null && nul.json.stats.totalSessions === 1, JSON.stringify(nul.json.stats));

  // P6 otros promedios (observaciones)
  const TH = await mk('th', 'therapist'), AD = await mk('ad', 'admin'); const pp = await person('pp', { ratings: [4, null, 4, null] }); await q('update "Users" set "therapistId"=$1 where id=$2', [TH.id, pp.id]);
  await fetch(API + '/api/consents/therapist_sharing', { method: 'PUT', headers: { Authorization: 'Bearer ' + pp.token, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'granted' }) });
  const tl = await call(TH, 'GET', '/api/therapist/pacientes'); const row = (tl.json || []).find?.(x => x.id === pp.id) || (tl.json?.patients || []).find?.(x => x.id === pp.id);
  info('P6a panel del profesional (/api/therapist/pacientes)', `persona con calificaciones [4,NULL,4,NULL] (promedio válido 4): avgRating=${JSON.stringify(row?.avgRating)} (status ${tl.status})`);
  const am = await call(AD, 'GET', '/api/admin/metrics'); const found = []; const walk = (o, p = '') => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/avgRating|avgMood/.test(k)) found.push(p + k + '=' + JSON.stringify(v)); walk(v, p + k + '.'); } }; walk(am.json);
  info('P6b métricas de administración (SQL AVG ignora NULL, pero cuenta valores fuera de escala)', `status ${am.status}: ${found.slice(0, 4).join(' ')}`);
  const tsrc = fs.readFileSync(path.join(E.QA_SUT, 'backend', 'routes', 'therapistRoutes.js'), 'utf8');
  info('P6c código', 'therapistRoutes.js usa `ratings.reduce((acc,r)=>acc+r.rating,0)/ratings.length` en ' + (tsrc.match(/ratings\.reduce/g) || []).length + ' sitios (lista de personas y resumen-IA): una calificación NULL cuenta como 0 en el divisor');

  // P7 concurrencia y filas raras
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => prog(i % 2 ? A : B)));
  check('P7a 20 solicitudes simultáneas de dos personas: todas 200, sin 5xx, sin mezcla (A siempre 5, B siempre 1)', rs.every((r, i) => r.status === 200 && r.json.stats.avgRating === (i % 2 ? 5 : 1)), rs.map(r => r.status).join(''));
  const strange = await mk('strange'); await sr(strange, 0, null); await sr(strange, 1, 32767); await sr(strange, 2, -32768); await sm(strange, 0, 2147483647, -2147483648); await sm(strange, 1, 3, null); await sr(strange, 3, 3);
  const rst = await prog(strange);
  check('P7b filas con valores extremos de la columna (32767, −32768, ±2147483647) no tumban la ruta: 200 con promedio coherente (rating 3, ánimo 3)', rst.status === 200 && rst.json.stats.avgRating === 3 && rst.json.stats.avgMood === 3 && !/NaN|Infinity/.test(rst.text), `${rst.status} ${JSON.stringify(rst.json?.stats)}`);

  const fails = results.filter(r => r.ok === false); console.log(`\nRESUMEN ${MODE} ${results.filter(r => r.ok).length}/${results.filter(r => 'ok' in r).length} ok; fallos: ${fails.map(f => f.id.slice(0, 4)).join(', ') || 'ninguno'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-257-progreso-${MODE}.json`), JSON.stringify({ pr: 205, mode: MODE, head: E.QA_HEAD || null, results }, null, 2)); await db.end(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
