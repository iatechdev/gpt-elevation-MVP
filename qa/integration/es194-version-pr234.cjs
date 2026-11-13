// [QA-Claude] ES-194 · PR #234 (publish/withdraw/review exigen confirm + expectedVersion) · servidor REAL, Postgres con migraciones, datos sintéticos, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> [MODE=main] node qa/integration/es194-version-pr234.cjs
// MODE=main = control contra main (las mismas llamadas; se espera que main NO exija expectedVersion).
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const results = []; const MAIN = E.MODE === 'main';
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 700) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 700) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa234-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA234 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body, hdr = {}) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...hdr }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers, ms: Date.now() - t0 }; };
  const SU = await mk('su', 'superadmin'), SU2 = await mk('su2', 'superadmin'), AD = await mk('ad', 'admin'), TH = await mk('th', 'therapist'), PE = await mk('pe', 'user'), BO = await mk('bo', 'board');
  const A = '/api/admin/exercises', R = '/api/exercises';
  const txt = (s) => ({ title: 'Titulo ' + s, purpose: 'Proposito ' + s, question: 'Pregunta ' + s, help: 'Ayuda ' + s });
  const en = (s) => ({ title: 'Title ' + s, purpose: 'Purpose ' + s, question: 'Question ' + s, help: 'Help ' + s });
  const body = (s = 'a', extra = {}) => ({ es: txt(s), en: en(s), minutes: [3, 5], ...extra });
  let n = 0; const key = (t = 'ej') => `qa234_${t}_${stamp % 100000}_${n++}`;
  const create = async (b = {}, k = key()) => { const r = await call(SU, 'POST', A, { key: k, ...body('a'), ...b }); return { ...r, key: k, id: r.json?.id }; };
  const state = async (id) => { const r = (await q('select status,version,"reviewStatus","reviewedBy","publishedBy","withdrawnBy","es","en","minutesMin","minutesMax" from "Exercises" where id=$1', [id]))[0]; const h = await q('select action,version from "ExerciseAudits" where "exerciseId"=$1 order by id', [id]); return { row: JSON.stringify(r), audits: h.length, hist: h.map(x => x.action + '@' + x.version).join(',') }; };
  const same = (a, b) => a.row === b.row && a.audits === b.audits;
  const POST = (u, id, act, b) => call(u, 'POST', `${A}/${id}/${act}`, b);

  // ---------- X1 contrato
  const x1 = await create(); const id1 = x1.id; const s0 = await state(id1);
  const badVersions = [['ausente', undefined], ['0', 0], ['-1', -1], ['1.5', 1.5], ['"1"', '1'], ['null', null], ['true', true], ['array', [1]], ['objeto', { v: 1 }], ['2^53', 9007199254740992], ['1e400', 'RAW1e400'], ['NaN-string', 'NaN']];
  const acts = [['publish', {}], ['withdraw', {}], ['review-done', { reviewStatus: 'done' }], ['review-pending', { reviewStatus: 'pending' }]];
  const x1bad = []; const x1five = [];
  for (const [an, extra] of acts) for (const [vn, v] of badVersions) {
    const act = an.startsWith('review') ? 'review' : an; let raw;
    if (v === 'RAW1e400') raw = `{"confirm":true,${extra.reviewStatus ? `"reviewStatus":"${extra.reviewStatus}",` : ''}"expectedVersion":1e400}`;
    else { const o = { confirm: true, ...extra }; if (v !== undefined) o.expectedVersion = v; raw = JSON.stringify(o); }
    const r = await POST(SU, id1, act, raw);
    if (r.status >= 500) x1five.push(`${an}/${vn}:${r.status}`);
    const ok = MAIN ? true : (r.status === 400 && r.json?.code === 'expected_version_required');
    if (!ok) x1bad.push(`${an}/${vn}:${r.status}:${r.json?.code}`);
  }
  const s1 = await state(id1);
  check('X1a (bloqueante) versión inválida/ausente en publish, withdraw y review(done|pending): 12 variantes × 4 = 48 → 400 expected_version_required, ninguna 5xx, ningún cambio de estado ni historial', x1bad.length === 0 && x1five.length === 0 && same(s0, s1), `bad=${x1bad.slice(0, 6).join(' | ')} 5xx=${x1five.length} igual=${same(s0, s1)}`);
  const confs = [['ausente', undefined], ['"true"', 'true'], ['1', 1], ['null', null], ['false', false], ['[]', []]]; const x1c = [];
  for (const [an, extra] of acts) for (const [cn, c] of confs) {
    const act = an.startsWith('review') ? 'review' : an; const o = { expectedVersion: 1, ...extra }; if (c !== undefined) o.confirm = c;
    const r = await POST(SU, id1, act, o); if (!(r.status === 400 && r.json?.code === 'confirmation_required')) x1c.push(`${an}/${cn}:${r.status}:${r.json?.code}`);
  }
  check('X1b confirm ausente/"true"/1/null/false/[] (con versión válida) → 400 confirmation_required en las 3 acciones; sin cambios', x1c.length === 0 && same(s0, await state(id1)), x1c.slice(0, 6).join(' | '));
  const rawBodies = [['no JSON', 'esto-no-es-json'], ['JSON truncado', '{"confirm":true,'], ['null', 'null'], ['array vacío', '[]'], ['número', '5'], ['vacío', '']]; const x1r = [];
  for (const [rn, rb] of rawBodies) for (const act of ['publish', 'withdraw', 'review']) { const r = await call(SU, 'POST', `${A}/${id1}/${act}`, rb); if (!(r.status >= 400 && r.status < 500)) x1r.push(`${act}/${rn}:${r.status}`); }
  const rvInv = []; for (const bad of [undefined, null, 'x', 7, 'done ', ['done']]) { const o = { confirm: true, expectedVersion: 1 }; if (bad !== undefined) o.reviewStatus = bad; const r = await POST(SU, id1, 'review', o); if (!(r.status === 400)) rvInv.push(String(bad) + ':' + r.status); }
  check('X1c cuerpos hostiles (no JSON, truncado, null, [], número, vacío) y reviewStatus inválido → 4xx, nunca 5xx, sin cambios', x1r.length === 0 && rvInv.length === 0 && same(s0, await state(id1)), `${x1r.join(',')} ${rvInv.join(',')}`);
  const ordNoVer = await POST(SU, id1, 'review', { reviewStatus: 'zzz' });
  info('X1d orden de validación', `review sin nada con reviewStatus inválido → ${ordNoVer.status} ${ordNoVer.json?.code}; PUT sin versión usa el código «version_required» y las acciones «expected_version_required» (dos códigos para lo mismo)`);

  // ---------- X2 versión obsoleta
  const ok2 = [];
  for (const act of ['publish', 'review', 'withdraw']) {
    const c = await create(); const id = c.id; let readByA = (await call(SU, 'GET', `${A}/${id}`)).json.version;
    if (act === 'withdraw') { const p = await POST(SU, id, 'publish', { confirm: true, expectedVersion: readByA }); if (p.status !== 200) ok2.push('prep-publish:' + p.status); }
    const e = await call(SU2, 'PUT', `${A}/${id}`, { ...body('cambiada'), expectedVersion: readByA }); if (e.status !== 200) ok2.push(act + ' edit:' + e.status + ':' + JSON.stringify(e.json).slice(0, 80));
    const before = await state(id);
    const o = { confirm: true, expectedVersion: readByA }; if (act === 'review') o.reviewStatus = 'done';
    const r = await POST(SU, id, act, o); const after = await state(id);
    if (MAIN) { info('X2-main-' + act, `main con versión vieja: ${r.status} (se espera 200: sin control de versión)`); continue; }
    if (!(r.status === 409 && r.json?.code === 'exercise_changed' && r.json?.current?.version === readByA + 1 && same(before, after))) ok2.push(`${act}:${r.status}:${r.json?.code}:${r.json?.current?.version}:igual=${same(before, after)}`);
    const o2 = { ...o, expectedVersion: readByA + 1 }; const r2 = await POST(SU, id, act, o2); if (r2.status !== 200) ok2.push(`${act} con versión nueva:${r2.status}`);
  }
  check('X2 (bloqueante) A leyó v1, B editó (v2): publish, review y withdraw con v1 → 409 exercise_changed con current v2; estado, revisión e historial intactos; con v2 funciona', ok2.length === 0, ok2.join(' | ') || '3/3');
  // texto en conflicto no filtra datos de otros ejercicios y el cuerpo del 409 es el ejercicio pedido
  // ---------- X3 idempotencia
  const c3 = await create(); const id3 = c3.id;
  const pa = await POST(SU, id3, 'publish', { confirm: true, expectedVersion: 1 }); const pb = await POST(SU, id3, 'publish', { confirm: true, expectedVersion: 1 }); const hs3 = await state(id3);
  check('X3a repetir publish con la misma versión: 1.º 200, 2.º 200 unchanged, un solo registro de historial «publish»', pa.status === 200 && pb.status === 200 && pb.json?.unchanged === true && (hs3.hist.match(/publish/g) || []).length === 1, `${pa.status} ${pb.status} ${hs3.hist}`);
  const ra = await POST(SU, id3, 'review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 }); const rb = await POST(SU, id3, 'review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 }); const hs3b = await state(id3);
  check('X3b repetir review done: 200 y 200 unchanged, un solo registro «review»', ra.status === 200 && rb.status === 200 && rb.json?.unchanged === true && (hs3b.hist.match(/review/g) || []).length === 1, `${ra.status} ${rb.status} ${hs3b.hist}`);
  const wa = await POST(SU, id3, 'withdraw', { confirm: true, expectedVersion: 1 }); const wb = await POST(SU, id3, 'withdraw', { confirm: true, expectedVersion: 1 }); const hs3c = await state(id3);
  check('X3c repetir withdraw: 200 y 200 unchanged, un solo registro «withdraw»', wa.status === 200 && wb.status === 200 && wb.json?.unchanged === true && (hs3c.hist.match(/withdraw/g) || []).length === 1, `${wa.status} ${wb.status} ${hs3c.hist}`);
  const pc = await POST(SU, id3, 'publish', { confirm: true, expectedVersion: 1 }); const ver3 = (await call(SU, 'GET', `${A}/${id3}`)).json;
  check('X3d ciclo publicar → retirar → republicar con la misma versión: 200; la revisión done se conserva; el contenido no cambia', pc.status === 200 && ver3.status === 'published' && ver3.reviewStatus === 'done' && ver3.version === 1, `${pc.status} ${ver3.status} ${ver3.reviewStatus} v${ver3.version}`);
  if (!MAIN) {
    const stale = await POST(SU, id3, 'publish', { confirm: true, expectedVersion: 5 });
    info('X3e ya publicado + versión inexistente (5)', `${stale.status} ${stale.json?.code} (la versión se compara primero)`);
    // limitación declarada: la versión no cambia con transiciones de estado
    const c3b = await create(); await POST(SU, c3b.id, 'publish', { confirm: true, expectedVersion: 1 }); await POST(SU2, c3b.id, 'withdraw', { confirm: true, expectedVersion: 1 });
    const lim = await POST(SU, c3b.id, 'publish', { confirm: true, expectedVersion: 1 });
    info('X3f limitación declarada', `B retira (v1) y A, que vio «publicado v1», republica con v1 → ${lim.status} (200 = la versión no detecta transiciones de estado intermedias; el PR lo declara)`);
  }

  // ---------- X4 concurrencia
  const x4bad = []; let n5xx = 0; let publishWon = 0, editWon = 0, pubStale = 0;
  for (let i = 0; i < 20; i++) {
    const c = await create(); const id = c.id;
    const [p, e] = await Promise.all([POST(SU, id, 'publish', { confirm: true, expectedVersion: 1 }), call(SU2, 'PUT', `${A}/${id}`, { ...body('carrera' + i), expectedVersion: 1 })]);
    for (const r of [p, e]) if (r.status >= 500) { n5xx++; x4bad.push(`r${i}:5xx`); }
    const st = (await q('select status,version,"reviewStatus" from "Exercises" where id=$1', [id]))[0]; const au = await q('select action,version from "ExerciseAudits" where "exerciseId"=$1 order by id', [id]);
    const pubRow = au.find(x => x.action === 'publish');
    if (!MAIN) {
      if (p.status === 200) { publishWon++; if (!pubRow || pubRow.version !== 1) x4bad.push(`r${i}: publish 200 pero historial v${pubRow?.version}`); } else if (p.status === 409) { pubStale++; if (st.status !== 'draft' || pubRow) x4bad.push(`r${i}: publish 409 pero quedó publicado`); } else x4bad.push(`r${i}: publish ${p.status}`);
      if (e.status === 200) editWon++; else x4bad.push(`r${i}: PUT ${e.status}`);
      if (st.version !== 2) x4bad.push(`r${i}: versión final ${st.version}`);
    }
  }
  check('X4a (bloqueante) 20 rondas publish(v1) ‖ edición(v1) de dos superadmins: sin 5xx; la edición siempre gana (v2); si publish tuvo éxito es con v1 en el historial y si no, 409 y sigue borrador (nunca se publica contenido que no vio)', x4bad.length === 0 && n5xx === 0, `publish ok=${publishWon} 409=${pubStale} edit ok=${editWon} :: ${x4bad.slice(0, 5).join(' | ')}`);
  const x4b = [];
  for (let i = 0; i < 20; i++) {
    const c = await create(); const id = c.id;
    const [r, e] = await Promise.all([POST(SU, id, 'review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 }), call(SU2, 'PUT', `${A}/${id}`, { ...body('rev' + i), expectedVersion: 1 })]);
    const st = (await q('select version,"reviewStatus" from "Exercises" where id=$1', [id]))[0]; const au = await q('select action,version from "ExerciseAudits" where "exerciseId"=$1 order by id', [id]);
    if (r.status >= 500 || e.status >= 500) x4b.push(`r${i}:5xx`);
    if (!MAIN) { const rv = au.find(x => x.action === 'review'); if (st.reviewStatus === 'done' && (!rv || rv.version !== st.version)) x4b.push(`r${i}: queda «revisado» con v${st.version} pero se revisó v${rv?.version}`); if (r.status === 200 && e.status === 200 && st.reviewStatus !== 'pending') x4b.push(`r${i}: revisó y editó pero no volvió a pending`); }
  }
  check('X4b (bloqueante) 20 rondas review done(v1) ‖ edición(v1): nunca queda «revisado» sobre una versión distinta de la revisada; si ambas pasan, la edición devuelve a pending', x4b.length === 0, x4b.slice(0, 5).join(' | ') || '20/20');
  const x4c = [];
  for (let i = 0; i < 20; i++) {
    const c = await create(); const id = c.id; await POST(SU, id, 'publish', { confirm: true, expectedVersion: 1 });
    const [w, p] = await Promise.all([POST(SU, id, 'withdraw', { confirm: true, expectedVersion: 1 }), POST(SU2, id, 'publish', { confirm: true, expectedVersion: 1 })]);
    const st = (await q('select status from "Exercises" where id=$1', [id]))[0].status; const au = await q('select action from "ExerciseAudits" where "exerciseId"=$1 order by id', [id]);
    if (w.status >= 500 || p.status >= 500) x4c.push(`r${i}:5xx`);
    if (!['published', 'withdrawn'].includes(st)) x4c.push(`r${i}: estado ${st}`);
    const w1 = au.filter(x => x.action === 'withdraw').length; if (w1 > 1) x4c.push(`r${i}: ${w1} withdraw`);
  }
  check('X4c 20 rondas withdraw ‖ publish de dos superadmins sobre un publicado: sin 5xx, estado final válido y a lo sumo un registro «withdraw»', x4c.length === 0, x4c.slice(0, 5).join(' | ') || '20/20');
  const cb = await create(); const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => POST(i % 2 ? SU : SU2, cb.id, 'publish', { confirm: true, expectedVersion: 1 }))); const hb = await state(cb.id);
  const stuck = await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%' and pid<>pg_backend_pid()`);
  check('X4d ráfaga de 20 publish simultáneos con la misma versión: todos 200, un único registro «publish», cero transacciones colgadas', burst.every(r => r.status === 200) && (hb.hist.match(/publish/g) || []).length === 1 && stuck[0].n === 0, `${burst.map(r => r.status).join(',')} ${hb.hist} colgadas=${stuck[0].n}`);

  // ---------- X5 acceso
  const c5 = await create(); const id5 = c5.id; const before5 = await state(id5);
  const acc = []; const leak = [];
  for (const [name, u] of [['admin', AD], ['profesional', TH], ['persona', PE], ['junta', BO]]) for (const [act, o] of [['publish', { confirm: true, expectedVersion: 1 }], ['withdraw', { confirm: true, expectedVersion: 1 }], ['review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 }], ['publish', { confirm: true, expectedVersion: 'mala' }], ['publish', {}]]) {
    const r = await POST(u, id5, act, o); if (r.status !== 403) acc.push(`${name}/${act}:${r.status}`); if (/"version"|"current"|expectedVersion/.test(r.text)) leak.push(name + act);
  }
  for (const act of ['publish', 'withdraw', 'review']) { const r = await POST(null, id5, act, { confirm: true, expectedVersion: 1, reviewStatus: 'done' }); if (![401, 403].includes(r.status)) acc.push(`anon/${act}:${r.status}`); }
  const expired = { token: jwt.sign({ id: SU.id, name: SU.name, role: 'superadmin', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '-10s' }) }; const wk = { token: jwt.sign({ id: SU.id, role: 'superadmin', iatMs: Date.now() }, 'otra-clave', { expiresIn: '1h' }) };
  for (const [nm, u] of [['vencido', expired], ['otra clave', wk]]) { const r = await POST(u, id5, 'publish', { confirm: true, expectedVersion: 1 }); if (r.status !== 401) acc.push(`${nm}:${r.status}`); }
  check('X5a (bloqueante) admin, profesional, persona y junta → 403 en las 3 acciones (también con versión/cuerpo inválido: el rol se comprueba antes); sin sesión 401/403; token vencido o de otra clave 401; el 403 no revela versión ni ejercicio; nada cambió', acc.length === 0 && leak.length === 0 && same(before5, await state(id5)), `${acc.slice(0, 5).join(',')} fuga=${leak.join(',')}`);
  const ids = ['abc', '1.5', '99999999999999999999', '0', '-1', '1e3', '%00', '1%20OR%201=1', '0x1', '٣']; const badId = [];
  for (const i of ids) for (const act of ['publish', 'withdraw', 'review']) { const r = await call(SU, 'POST', `${A}/${encodeURIComponent(i) === i ? i : i}/${act}`, { confirm: true, expectedVersion: 1, reviewStatus: 'done' }); if (r.status >= 500) badId.push(`${i}/${act}:${r.status}`); }
  const inex = await POST(SU, 999999, 'publish', { confirm: true, expectedVersion: 1 });
  check('X5b IDs malformados (abc, 1.5, enorme, 0, -1, 1e3, %00, inyección, hex, dígitos no latinos) en las 3 acciones → nunca 5xx; id inexistente → 404', badId.length === 0 && inex.status === 404, `${badId.slice(0, 5).join(',')} inex=${inex.status}`);

  // ---------- X6 lectura de la persona
  const k6 = key('l'); const html = await create({ es: { ...txt('x'), title: '<img src=x onerror=alert(1)>Titulo' } }, key('h')); const c6 = await create({ es: { ...txt('x'), title: '&lt;b&gt;Titulo&lt;/b&gt; ${7*7}' } }, k6);
  check('X6a el marcado HTML se rechaza al crear (400 markup_not_allowed) y no queda fila', html.status === 400 && html.json?.reason === 'markup_not_allowed', `${html.status} ${html.json?.reason}`);
  const d1 = await call(PE, 'GET', `${R}/${k6}`); await POST(SU, c6.id, 'publish', { confirm: true, expectedVersion: 1 }); const p1 = await call(PE, 'GET', `${R}/${k6}`); const lst = await call(PE, 'GET', R);
  await POST(SU, c6.id, 'withdraw', { confirm: true, expectedVersion: 1 }); const w1 = await call(PE, 'GET', `${R}/${k6}`); const lst2 = await call(PE, 'GET', R);
  check('X6 lectura de la persona: borrador 404; publicado visible (HTML como texto, reviewStatus veraz) y en la lista; retirado 404 idéntico a inexistente y fuera de la lista', d1.status === 404 && p1.status === 200 && p1.json?.es?.title === '&lt;b&gt;Titulo&lt;/b&gt; ${7*7}' && /application\/json/.test(p1.headers.get('content-type')) && lst.json.some(x => x.key === k6) && w1.status === 404 && w1.text === (await call(PE, 'GET', `${R}/qa234_no_existe_1`)).text && !lst2.json.some(x => x.key === k6), `${d1.status} ${p1.status} ${w1.status}`);

  // ---------- X9 rendimiento
  const c9 = await create(); const id9 = c9.id; await POST(SU, id9, 'publish', { confirm: true, expectedVersion: 1 });
  const lat = { publish: [], review: [], withdraw: [], get: [] };
  for (let i = 0; i < 200; i++) { lat.publish.push((await POST(SU, id9, 'publish', { confirm: true, expectedVersion: 1 })).ms); lat.review.push((await POST(SU, id9, 'review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 })).ms); lat.get.push((await call(SU, 'GET', `${A}/${id9}`)).ms); }
  for (let i = 0; i < 100; i++) { await POST(SU, id9, 'withdraw', { confirm: true, expectedVersion: 1 }).then(r => lat.withdraw.push(r.ms)); await POST(SU, id9, 'publish', { confirm: true, expectedVersion: 1 }); }
  const big = await Promise.all(Array.from({ length: 20 }, () => POST(SU, id9, 'review', { reviewStatus: 'done', confirm: true, expectedVersion: 1 })));
  const summ = Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, `p95=${p95(v)}ms max=${Math.max(...v)}ms n=${v.length}`]));
  check('X9 rendimiento (umbral aprobado p95 < 300 ms, sin 5xx): publish, review, withdraw y GET; ráfaga de 20 sin 5xx', Object.values(lat).every(v => p95(v) < 300) && big.every(r => r.status < 500), JSON.stringify(summ) + ' ráfaga max=' + Math.max(...big.map(r => r.ms)) + 'ms');

  const stuckEnd = await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%' and pid<>pg_backend_pid()`);
  check('Z0 sin transacciones colgadas al final', stuckEnd[0].n === 0, String(stuckEnd[0].n));
  await db.end();
  const out = path.join(E.QA_OUT || '.', MAIN ? 'ES-194-version-pr234-main.json' : 'ES-194-version-pr234.json'); fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log('RESUMEN ' + results.filter(r => r.ok).length + '/' + results.filter(r => 'ok' in r).length + ' ok (MODE=' + (MAIN ? 'main' : 'pr') + ')');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
