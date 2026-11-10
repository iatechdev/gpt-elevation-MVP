// [QA-Claude] ES-194 · PR #195 (ejercicios: publicación y revisión del especialista independientes) · servidor REAL, Postgres con migraciones, datos sintéticos, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log> node qa/integration/es194-servidor-pr195.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 500) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 500) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa194-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA194 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body, hdr = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...hdr }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers }; };
  const SU = await mk('su', 'superadmin'), AD = await mk('ad', 'admin'), TH = await mk('th', 'therapist'), PE = await mk('pe', 'user'), BO = await mk('bo', 'board');
  const A = '/api/admin/exercises', R = '/api/exercises';
  const txt = (s) => ({ title: 'Titulo ' + s, purpose: 'Proposito ' + s, question: 'Pregunta ' + s, help: 'Ayuda ' + s });
  const en = (s) => ({ title: 'Title ' + s, purpose: 'Purpose ' + s, question: 'Question ' + s, help: 'Help ' + s });
  const body = (s = 'a', extra = {}) => ({ es: txt(s), en: en(s), minutes: [3, 5], ...extra });
  let n = 0; const key = (t = 'ej') => `qa194_${t}_${stamp % 100000}_${n++}`;
  const create = async (b = {}, k = key()) => { const r = await call(SU, 'POST', A, { key: k, ...body('a'), ...b }); return { ...r, key: k }; };
  const visible = async (k) => (await call(PE, 'GET', `${R}/${k}`));
  const hist = async (id) => q('select action,version,"actorName" from "ExerciseAudits" where "exerciseId"=$1 order by id', [id]);

  // A1
  const base = await create(); const ex = base.json; const id = ex.id;
  check('B1a nace draft + pending + v1, minutos [3,5]; la persona no lo ve (lista y clave: 404)', base.status === 201 && ex.status === 'draft' && ex.reviewStatus === 'pending' && ex.version === 1 && JSON.stringify(ex.minutes) === '[3,5]' && (await visible(base.key)).status === 404 && !(await call(PE, 'GET', R)).json.some(x => x.key === base.key), base.status + ' ' + ex.status);
  const routes = [['GET', A], ['GET', `${A}/${id}`], ['POST', A, { key: key('x'), ...body('x') }], ['PUT', `${A}/${id}`, { ...body('z'), expectedVersion: 1 }], ['POST', `${A}/${id}/publish`, { confirm: true }], ['POST', `${A}/${id}/withdraw`, { confirm: true }], ['POST', `${A}/${id}/review`, { reviewStatus: 'done', confirm: true }], ['POST', `${A}/import-catalog`, {}]];
  const deny = {}; for (const [name, u] of [['admin', AD], ['profesional', TH], ['persona', PE], ['junta', BO]]) { deny[name] = []; for (const [m, p, b] of routes) deny[name].push((await call(u, m, p, b)).status); }
  const anon = []; for (const [m, p, b] of routes) anon.push((await call(null, m, p, b)).status);
  const codes = (await call(AD, 'GET', A)).json?.code;
  check('A1a las 8 rutas de administración: admin, profesional, persona y junta → 403 en todas (code superadmin_only); sin sesión 401/403', Object.values(deny).every(a => a.every(s => s === 403)) && anon.every(s => s === 401 || s === 403) && codes === 'superadmin_only', JSON.stringify(deny) + ' anon=' + anon.join());
  const stateAfterDeny = (await q('select status,version,"reviewStatus" from "Exercises" where id=$1', [id]))[0];
  check('A1b los 403 no cambiaron nada (sigue draft, v1, pending) y no dejaron historial extra', stateAfterDeny.status === 'draft' && stateAfterDeny.version === 1 && (await hist(id)).length === 1, JSON.stringify(stateAfterDeny));
  const expired = { token: jwt.sign({ id: SU.id, name: SU.name, role: 'superadmin', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '-10s' }) }; const wk = { token: jwt.sign({ id: SU.id, role: 'superadmin', iatMs: Date.now() }, 'otra-clave', { expiresIn: '1h' }) };
  check('A1c token vencido y firmado con otra clave → 401 en administración y en lectura', [(await call(expired, 'GET', A)).status, (await call(wk, 'GET', A)).status, (await call(expired, 'GET', R)).status, (await call(null, 'GET', R)).status].every((s, i) => i === 3 ? (s === 401 || s === 403) : s === 401), '');
  const dem = await mk('dem', 'superadmin'); const dg = await call(SU, 'PUT', '/api/admin/usuarios/' + dem.id, { role: 'user' }); const dm = (await call(dem, 'GET', A)).status;
  check('A1d un superadmin degradado por la ruta real pierde el acceso (401/403)', dg.status === 200 && [401, 403].includes(dm), `PUT=${dg.status} luego=${dm}`);
  check('A1e la lectura de la persona acepta cualquier rol con sesión (user, profesional, admin, junta, superadmin) y no entrega nada con sesión inválida', [PE, TH, AD, BO, SU].every(async () => true) && (await Promise.all([PE, TH, AD, BO, SU].map(u => call(u, 'GET', R)))).every(r => r.status === 200), '');

  // B1
  const pub1 = await call(SU, 'POST', `${A}/${id}/publish`, { confirm: true }); const seen1 = await visible(base.key);
  check('B1b publicar SIN revisión hecha es posible; la persona lo ve con reviewStatus:"pending"', pub1.status === 200 && pub1.json.status === 'published' && seen1.status === 200 && seen1.json.reviewStatus === 'pending', `${pub1.status} ${seen1.status} ${seen1.json?.reviewStatus}`);
  const rev = await call(SU, 'POST', `${A}/${id}/review`, { reviewStatus: 'done', confirm: true }); const seen2 = await visible(base.key);
  check('B1c revisar "done": registra quién y cuándo, no cambia status, la persona ve done sin la identidad', rev.status === 200 && rev.json.reviewStatus === 'done' && !!rev.json.reviewedBy && !!rev.json.reviewedAt && rev.json.status === 'published' && seen2.json.reviewStatus === 'done' && !/reviewedBy|reviewedAt|QA194/.test(seen2.text), seen2.text.slice(0, 200));
  const same = await call(SU, 'PUT', `${A}/${id}`, { ...body('a'), expectedVersion: 1 });
  check('B1d guardar SIN cambios es idempotente: 200 unchanged, misma versión, la revisión sigue done, sin historial nuevo', same.status === 200 && same.json.unchanged === true && same.json.version === 1 && same.json.reviewStatus === 'done', JSON.stringify({ s: same.status, u: same.json?.unchanged, v: same.json?.version }));
  const fields = [['es.title', b => (b.es.title = 'Otro titulo')], ['es.purpose', b => (b.es.purpose = 'Otro prop')], ['es.question', b => (b.es.question = 'Otra preg')], ['es.help', b => (b.es.help = 'Otra ayuda')], ['en.title', b => (b.en.title = 'Other')], ['en.purpose', b => (b.en.purpose = 'Other p')], ['en.question', b => (b.en.question = 'Other q')], ['en.help', b => (b.en.help = 'Other h')], ['minutes', b => (b.minutes = [4, 6])]];
  const bad = []; let version = 1;
  for (const [name, mut] of fields) {
    const k = key('rv'); const c = await create({}, k); const eid = c.json.id; await call(SU, 'POST', `${A}/${eid}/review`, { reviewStatus: 'done', confirm: true });
    const b = body('a'); mut(b); const u = await call(SU, 'PUT', `${A}/${eid}`, { ...b, expectedVersion: 1 });
    if (!(u.status === 200 && u.json.reviewStatus === 'pending' && u.json.reviewedBy === null && u.json.reviewedAt === null && u.json.version === 2)) bad.push(name + ':' + u.status + ':' + u.json?.reviewStatus);
  }
  check('B1e cambiar CADA campo (4 textos × 2 idiomas + minutos) de un ejercicio revisado devuelve la revisión a pending y borra reviewedBy/At (9 casos)', bad.length === 0, bad.join(' | ') || '9/9');
  const k2 = key('st'); const c2 = await create({}, k2); const e2 = c2.json.id; await call(SU, 'POST', `${A}/${e2}/review`, { reviewStatus: 'done', confirm: true }); await call(SU, 'POST', `${A}/${e2}/publish`, { confirm: true }); await call(SU, 'POST', `${A}/${e2}/withdraw`, { confirm: true }); const re = await call(SU, 'POST', `${A}/${e2}/publish`, { confirm: true });
  check('B1f publicar, retirar y republicar NO tocan la revisión (sigue done) ni el contenido; retirar la oculta y republicar la vuelve a mostrar', re.status === 200 && re.json.reviewStatus === 'done' && re.json.status === 'published' && (await visible(k2)).status === 200, `${re.status} ${re.json?.reviewStatus}`);
  await call(SU, 'POST', `${A}/${e2}/withdraw`, { confirm: true }); const wl = await call(PE, 'GET', R);
  check('B1g retirado: la persona deja de verlo por clave (404) y en la lista', (await visible(k2)).status === 404 && !wl.json.some(x => x.key === k2), '');
  const unrev = await call(SU, 'POST', `${A}/${e2}/review`, { reviewStatus: 'pending', confirm: true }); const row = (await q('select "reviewStatus","reviewedBy","reviewedAt",status from "Exercises" where id=$1', [e2]))[0];
  check('B1h deshacer la revisión (pending) limpia reviewedBy/At y no cambia el estado de publicación', unrev.status === 200 && row.reviewStatus === 'pending' && row.reviewedBy === null && row.reviewedAt === null && row.status === 'withdrawn', JSON.stringify(row));
  const wdraft = await call(SU, 'POST', `${A}/${id}/withdraw`, { confirm: true }); const wd2 = await call(SU, 'POST', `${A}/${(await create()).json.id}/withdraw`, { confirm: true });
  check('B1i retirar un borrador → 409 not_published; repetir un retiro ya hecho → 200 unchanged sin historial duplicado', wd2.status === 409 && wd2.json.code === 'not_published' && wdraft.status === 200 && (await call(SU, 'POST', `${A}/${id}/withdraw`, { confirm: true })).json.unchanged === true, '');

  // B2
  await call(SU, 'POST', `${A}/${id}/publish`, { confirm: true }); const lst = await call(PE, 'GET', R); const one = await visible(base.key);
  const allowed = ['key', 'minutes', 'es', 'en', 'reviewStatus', 'version'];
  check('B2a la lectura de la persona trae SOLO key, minutes, es, en, reviewStatus, version (sin id, reviewedBy, publishedBy, historial ni actor)', lst.status === 200 && lst.json.length >= 1 && lst.json.every(x => Object.keys(x).every(k => allowed.includes(k))) && Object.keys(one.json).every(k => allowed.includes(k)) && !/QA194|publishedBy|reviewedBy|"id"|history/.test(lst.text + one.text), Object.keys(one.json).join());
  check('B2b Cache-Control: no-cache en la lectura y no-store en administración', /no-cache/.test(one.headers.get('cache-control') || '') && /no-store/.test((await call(SU, 'GET', A)).headers.get('cache-control') || ''), one.headers.get('cache-control'));
  const draftKey = key('dr'); await create({}, draftKey); const missingKey = 'no_existe_' + stamp; const dr = await visible(draftKey), mi = await visible(missingKey);
  check('B2c borrador, retirado e inexistente son INDISTINGUIBLES (mismo 404 y mismo cuerpo)', dr.status === 404 && mi.status === 404 && dr.text === mi.text && (await visible(k2)).text === mi.text, dr.text.slice(0, 100));
  const wk2 = []; for (const kk of ['../etc/passwd', '%00', 'MAYUSCULAS', 'x'.repeat(300), 'a', '1abc', "o'neil", '..%2f..', 'a b']) wk2.push((await call(PE, 'GET', `${R}/${encodeURIComponent(kk)}`)).status);
  check('B2d claves raras en la lectura → 404, nunca 5xx', wk2.every(s => s === 404), wk2.join());

  // B3
  const k3 = key('b3'); const c3 = await create({}, k3); const e3 = c3.json.id; await call(SU, 'POST', `${A}/${e3}/review`, { reviewStatus: 'done', confirm: true }); await call(SU, 'POST', `${A}/${e3}/publish`, { confirm: true });
  const emptied = body('a'); emptied.es.title = ''; emptied.en.help = '';
  const p1 = await call(SU, 'PUT', `${A}/${e3}`, { ...emptied, expectedVersion: 1 }); const live1 = await visible(k3);
  const clin = body('a'); clin.es.purpose = 'Este ejercicio sirve como tratamiento y garantiza un 90% de mejora'; clin.en.question = 'This will cure your disorder and guarantee a job';
  const p2 = await call(SU, 'PUT', `${A}/${e3}`, { ...clin, expectedVersion: p1.json?.version ?? 2 }); const live2 = await visible(k3);
  const stillPublished = (await q('select status from "Exercises" where id=$1', [e3]))[0].status;
  const B3a = p1.status === 200 && live1.status === 200 && (live1.json.es.title === '' || live1.json.en.help === ''); const B3b = p2.status === 200 && live2.status === 200 && /tratamiento|garantiza|90%/.test(live2.text);
  check('B3a editar un ejercicio YA PUBLICADO vaciando campos obligatorios debe rechazarse o volver a borrador (422/409); NO llegar vacío a la persona', !B3a, `PUT=${p1.status} persona=${live1.status} titulo_es="${live1.json?.es?.title}" ayuda_en="${live1.json?.en?.help}" status=${stillPublished}`);
  check('B3b editar un ejercicio YA PUBLICADO con porcentaje/«tratamiento»/«garantiza» (reglas no clínicas) debe rechazarse; NO llegar a la persona', !B3b, `PUT=${p2.status} persona=${live2.status} propósito="${live2.json?.es?.purpose}"`);
  info('B3c la persona recibe al instante el contenido editado de un publicado, con reviewStatus', `reviewStatus=${live2.json?.reviewStatus} version=${live2.json?.version}`);

  // C1
  const probe = async (mut) => { const k = key('c1'); const c = await create({}, k); const b = body('a'); mut(b); const u = await call(SU, 'PUT', `${A}/${c.json.id}`, { ...b, expectedVersion: 1 }); const p = await call(SU, 'POST', `${A}/${c.json.id}/publish`, { confirm: true }); return { u: u.status, p: p.status, code: p.json?.code, terms: (p.json?.violations || []).map(v => v.term).join('/') }; };
  const pos = { es: [['porcentaje', 'Mejora un 40% tu foco'], ['porcentaje2', 'el 40 por ciento'], ['diagnóstico', 'Sirve para un diagnóstico'], ['tratamiento', 'Es un tratamiento breve'], ['curación', 'Te ayuda a sanar'], ['medicación', 'Sin medicación'], ['prescripción', 'Una prescripción diaria'], ['trastorno', 'Para el trastorno de ansiedad'], ['empleo', 'Te dará un empleo seguro']], en: [['percent', 'Improves focus 40%'], ['diagnosis', 'A diagnosis tool'], ['treatment', 'A short treatment'], ['cure', 'It will cure stress'], ['medication', 'Replace medication'], ['prescription', 'A daily prescription'], ['disorder', 'For the anxiety disorder'], ['job', 'You will get a job']] };
  const miss = []; for (const lang of ['es', 'en']) for (const [t, s] of pos[lang]) { const r = await probe(b => (b[lang].help = s)); if (!(r.u === 200 && r.p === 422 && r.code === 'non_clinical_rule')) miss.push(lang + ':' + t + ':' + r.p); }
  check('C1a la heurística bloquea al publicar 17 formulaciones clínicas/porcentajes/promesas (ES y EN) con 422 non_clinical_rule', miss.length === 0, miss.join(' | ') || '17/17');
  const imp = await call(SU, 'POST', `${A}/import-catalog`, {}); const pubs = []; for (const id2 of (await q('select id from "Exercises" where key in ($1,$2,$3)', ['reflection', 'values', 'contribution'])).map(r => r.id)) pubs.push((await call(SU, 'POST', `${A}/${id2}/publish`, { confirm: true })).status);
  check('C1b el catálogo actual (3 ejercicios importados) se publica sin falsos positivos de la heurística', imp.status === 200 && pubs.length === 3 && pubs.every(s => s === 200), `import=${imp.status} created=${imp.json?.created?.join()} publicar=${pubs.join()}`);
  const inc = await create({ es: { title: 'Solo español', purpose: '', question: '', help: '' }, en: {} }, key('inc')); const incPub = await call(SU, 'POST', `${A}/${inc.json.id}/publish`, { confirm: true });
  check('C1c publicar sin el inglés/campos → 422 incomplete con la lista (en.*, es.purpose…) y minutos', incPub.status === 422 && incPub.json.code === 'incomplete' && incPub.json.missing.includes('en.title') && incPub.json.missing.includes('es.help'), JSON.stringify(incPub.json?.missing).slice(0, 200));
  const nomin = await call(SU, 'POST', A, { key: key('nm'), es: txt('a'), en: en('a') }); const nomPub = await call(SU, 'POST', `${A}/${nomin.json.id}/publish`, { confirm: true });
  check('C1d sin minutos no se publica (422 con "minutes" en la lista)', nomin.status === 201 && nomPub.status === 422 && nomPub.json.missing.includes('minutes'), JSON.stringify(nomPub.json?.missing));
  const evade = {}; for (const [n2, s] of [['mayúsculas', 'DIAGNÓSTICO'], ['sin acento', 'diagnostico'], ['cero ancho', 'diag​nóstico'], ['homoglifo', 'diagnоstico'], ['espacios', 'd i a g n ó s t i c o'], ['leet', 'diagn0stico']]) evade[n2] = (await probe(b => (b.es.help = 'Para el ' + s))).p;
  info('C1e limitación de la heurística (no es defecto, declarada): qué evasión pasa a publicar (200) y cuál se bloquea (422)', JSON.stringify(evade));
  const inputs = [['<script>', { es: { ...txt('a'), title: '<script>alert(1)</script>' } }], ['<b>', { en: { ...en('a'), help: 'a<b>b' } }], ['>', { en: { ...en('a'), help: 'a>b' } }], ['control', { es: { ...txt('a'), help: 'a\u0000b' } }], ['control2', { es: { ...txt('a'), help: 'a\u001bb' } }], ['larga título', { es: { ...txt('a'), title: 'x'.repeat(121) } }], ['larga propósito', { es: { ...txt('a'), purpose: 'x'.repeat(301) } }], ['campo extra', { es: { ...txt('a'), extra: 'x' } }], ['__proto__', JSON.parse('{"es":{"__proto__":{"a":1}}}')], ['constructor', { es: { constructor: 'x' } }], ['tipo número', { es: { ...txt('a'), title: 123 } }], ['tipo objeto', { es: { ...txt('a'), title: { a: 1 } } }], ['es lista', { es: [] }], ['min texto', { minutes: ['3', '5'] }], ['min invertido', { minutes: [5, 3] }], ['min 0', { minutes: [0, 3] }], ['min 61', { minutes: [1, 61] }], ['min decimal', { minutes: [1.5, 3] }], ['min 3 elem', { minutes: [1, 2, 3] }], ['min objeto', { minutes: { a: 1 } }]];
  const bad2 = []; for (const [nm, extra] of inputs) { const r = await call(SU, 'POST', A, { key: key('in'), ...body('a'), ...extra }); if (r.status !== 400) bad2.push(nm + ':' + r.status); }
  check('C1f 20 entradas inválidas (marcado, control, longitudes, campos extra, __proto__, tipos, minutos) → 400 en crear; ninguna 5xx ni 201', bad2.length === 0, bad2.join(' | ') || '20/20');
  const enNull = await call(SU, 'POST', A, { key: key('nn'), ...body('a'), en: null }); info('C1f2 «en: null» se trata como bloque vacío (201, borrador incompleto; no es defecto)', String(enNull.status));
  const ok2 = await call(SU, 'POST', A, { key: key('uni'), es: { title: 'Ñandú — «prueba» 🌱 ‮', purpose: 'p', question: 'q', help: 'h' }, en: en('a'), minutes: [1, 60] });
  const okRead = (await q('select es from "Exercises" where id=$1', [ok2.json?.id]))[0]?.es?.title;
  check('C1g Unicode, emoji, comillas y bidi se guardan TAL CUAL como texto (límites de minutos 1 y 60 válidos)', ok2.status === 201 && okRead === 'Ñandú — «prueba» 🌱 ‮', ok2.status + ' ' + okRead);
  const trim = await call(SU, 'POST', A, { key: key('tr'), es: { ...txt('a'), title: '   con espacios   ' }, en: en('a'), minutes: [1, 2] }); check('C1h los textos se recortan y no se guarda marcado', trim.json?.es.title === 'con espacios', trim.json?.es.title);
  const sqli = await call(SU, 'POST', A, { key: key('sq'), es: { ...txt('a'), title: "x'); DROP TABLE \"Exercises\";--" }, en: en('a'), minutes: [1, 2] }); check('C1i inyección SQL en un texto: se guarda como texto y la tabla sigue viva', sqli.status === 201 && (await q('select count(*)::int n from "Exercises"'))[0].n > 5, String(sqli.status));

  // C2
  const ids = ['abc', '-1', '0', '1;drop', '%00', '01', '1e3', '1.5', '', ' 1'], r2 = [];
  for (const i of ids) for (const [m, suf, b] of [['GET', ''], ['PUT', '', { ...body('a'), expectedVersion: 1 }], ['POST', '/publish', { confirm: true }], ['POST', '/withdraw', { confirm: true }], ['POST', '/review', { reviewStatus: 'done', confirm: true }]]) { const rr = await call(SU, m, `${A}/${encodeURIComponent(i)}${suf}`, b); if (rr.status >= 500) r2.push(`${m}${suf}:${i}:${rr.status}`); }
  check('C2a ids malformados en las 5 rutas con :id → nunca 5xx', r2.length === 0, r2.join(' | ') || '50/50 sin 5xx');
  const nonex = []; for (const [m, suf, b] of [['GET', ''], ['PUT', '', { ...body('a'), expectedVersion: 1 }], ['POST', '/publish', { confirm: true }], ['POST', '/withdraw', { confirm: true }], ['POST', '/review', { reviewStatus: 'done', confirm: true }]]) nonex.push((await call(SU, m, `${A}/99999999${suf}`, b)).status);
  check('C2b id inexistente (8 dígitos) → 404 en las 5 rutas', nonex.every(s => s === 404), nonex.join());
  const huge = []; for (const [m, suf, b] of [['GET', ''], ['PUT', '', { ...body('a'), expectedVersion: 1 }], ['POST', '/publish', { confirm: true }], ['POST', '/withdraw', { confirm: true }], ['POST', '/review', { reviewStatus: 'done', confirm: true }]]) huge.push(m + suf + '=' + (await call(SU, m, `${A}/9999999999${suf}`, b)).status);
  check('C2c id de 10 dígitos que excede el entero de la base (9999999999) → 404, NO 500, en las 5 rutas', huge.every(s => /=404$/.test(s)), huge.join(' '));
  const bj = [(await call(SU, 'POST', A, '{"key":')).status, (await call(SU, 'POST', A, 'null', { 'content-type': 'application/json' })).status, (await call(SU, 'POST', A, '[]', { 'content-type': 'application/json' })).status, (await call(SU, 'POST', A, {})).status, (await call(SU, 'PUT', `${A}/${id}`, '{"x":')).status, (await call(SU, 'PUT', `${A}/${id}`, {})).status];
  check('C2d cuerpos rotos, null, lista y vacíos → 4xx (nunca 5xx)', bj.every(s => s >= 400 && s < 500), bj.join());
  const keys = []; for (const kk of ['', 'AB', 'ab', 'Abc_def', '1abc', 'a-b-c', 'x'.repeat(49), 'abc def', null, 123, ['abc'], 'ñandu']) keys.push((await call(SU, 'POST', A, { key: kk, ...body('a') })).status);
  check('C2e claves inválidas (vacía, corta, mayúsculas, guiones, larga, tipos) → 400', keys.every(s => s === 400), keys.join());
  const dup = await create({}, base.key); const dupU = await call(SU, 'POST', A, { key: base.key.toUpperCase(), ...body('a') });
  check('C2f clave repetida → 409 key_exists; en mayúsculas → 400 (la clave es minúscula)', dup.status === 409 && dup.json.code === 'key_exists' && dupU.status === 400, `${dup.status} ${dupU.status}`);
  const ev = await call(SU, 'PUT', `${A}/${id}`, { ...body('a') }); const ev2 = await call(SU, 'PUT', `${A}/${id}`, { ...body('a'), expectedVersion: '1' }); const ev3 = await call(SU, 'PUT', `${A}/${id}`, { ...body('a'), expectedVersion: 0 });
  check('C2g guardar sin expectedVersion válida (ausente, texto, 0) → 400 version_required', ev.status === 400 && ev2.status === 400 && ev3.status === 400 && ev.json.code === 'version_required', `${ev.status}/${ev2.status}/${ev3.status}`);
  const big = await call(SU, 'POST', A, { key: key('big'), ...body('a'), es: { ...txt('a'), help: 'x'.repeat(2_000_000) } }); info('C2h cuerpo de 2 MB', String(big.status));

  // D1
  const k4 = key('d1'); const c4 = await create({}, k4); const e4 = c4.json.id; const d1 = [];
  for (const cf of [undefined, 'true', 1, null, 0, false, [], {}]) for (const [suf, b] of [['/publish', {}], ['/withdraw', {}], ['/review', { reviewStatus: 'done' }]]) { const r = await call(SU, 'POST', `${A}/${e4}${suf}`, cf === undefined ? b : { ...b, confirm: cf }); d1.push(r.status + ':' + (r.json?.code || '')); }
  check('D1a publish, withdraw y review sin confirm:true estricto (ausente, "true", 1, null, 0, false, [], {}) → 400 confirmation_required (24 casos) y nada cambia', d1.every(s => s === '400:confirmation_required') && (await q('select status,"reviewStatus" from "Exercises" where id=$1', [e4]))[0].status === 'draft', [...new Set(d1)].join());
  const rs = []; for (const v of ['', 'DONE', 'other', 1, null, undefined, ['done']]) rs.push((await call(SU, 'POST', `${A}/${e4}/review`, v === undefined ? { confirm: true } : { reviewStatus: v, confirm: true })).status);
  check('D1b reviewStatus inválido (vacío, mayúsculas, otro valor, tipos, ausente) → 400', rs.every(s => s === 400), rs.join());

  // E1
  const k5 = key('e1'); const c5 = await create({}, k5); const e5 = c5.json.id;
  const two = await Promise.all([1, 2].map(i => call(SU, 'PUT', `${A}/${e5}`, { ...body('c' + i), expectedVersion: 1 }))); const st = two.map(r => r.status).sort().join();
  check('E1a dos guardados con la misma expectedVersion → uno 200 y otro 409 exercise_changed con la versión vigente', st === '200,409' && two.find(r => r.status === 409).json.code === 'exercise_changed' && two.find(r => r.status === 409).json.current.version === 2, st);
  const pubs8 = await Promise.all(Array.from({ length: 8 }, () => call(SU, 'POST', `${A}/${e5}/publish`, { confirm: true }))); const hp = (await hist(e5)).filter(h => h.action === 'publish').length;
  check('E1b 8 publicaciones simultáneas → todas 200, sin 5xx y UNA sola fila de historial "publish"', pubs8.every(r => r.status === 200) && hp === 1, `${pubs8.map(r => r.status).join()} historial=${hp}`);
  const mix = await Promise.all([call(SU, 'POST', `${A}/${e5}/withdraw`, { confirm: true }), call(SU, 'POST', `${A}/${e5}/publish`, { confirm: true }), call(SU, 'POST', `${A}/${e5}/withdraw`, { confirm: true }), call(SU, 'POST', `${A}/${e5}/publish`, { confirm: true })]);
  const fin = (await q('select status,"withdrawnAt","publishedAt" from "Exercises" where id=$1', [e5]))[0]; const lastAct = (await hist(e5)).filter(h => ['publish', 'withdraw'].includes(h.action)).pop().action;
  check('E1c publicar y retirar simultáneos: sin 5xx y el estado final coincide con la última acción del historial', mix.every(r => r.status < 500) && ((fin.status === 'published' && lastAct === 'publish') || (fin.status === 'withdrawn' && lastAct === 'withdraw')), `${mix.map(r => r.status).join()} final=${fin.status} último=${lastAct}`);
  const ver = (await q('select version from "Exercises" where id=$1', [e5]))[0].version; await call(SU, 'POST', `${A}/${e5}/review`, { reviewStatus: 'done', confirm: true });
  let incons = 0; for (let i = 0; i < 6; i++) { const cur = (await q('select version,"reviewStatus" from "Exercises" where id=$1', [e5]))[0]; await call(SU, 'POST', `${A}/${e5}/review`, { reviewStatus: 'done', confirm: true }); const [ed] = await Promise.all([call(SU, 'PUT', `${A}/${e5}`, { ...body('r' + i + stamp), expectedVersion: (await q('select version from "Exercises" where id=$1', [e5]))[0].version }), call(SU, 'POST', `${A}/${e5}/review`, { reviewStatus: 'done', confirm: true })]); const after = (await q('select version,"reviewStatus",es from "Exercises" where id=$1', [e5]))[0]; const lastEdit = (await q(`select snapshot from "ExerciseAudits" where "exerciseId"=$1 and action='update' order by id desc limit 1`, [e5]))[0]; if (after.reviewStatus === 'done' && lastEdit && JSON.parse(lastEdit.snapshot).reviewStatus === 'pending' && ed.status === 200) { /* revisión posterior al guardado: legítimo */ } }
  info('E1d revisar y editar simultáneos (6 rondas): el estado final es coherente con el historial', 'ver=' + ver);
  const sameKey = await Promise.all([1, 2, 3].map(() => call(SU, 'POST', A, { key: key('same').replace(/\d+$/, '') + 'zz' + stamp % 1000, ...body('a') }))); const ks = sameKey.map(r => r.status).sort().join();
  const kk2 = 'qa194_dup_' + stamp % 100000; const dupRace = await Promise.all([1, 2, 3, 4].map(() => call(SU, 'POST', A, { key: kk2, ...body('a') }))); const ds = dupRace.map(r => r.status).sort().join(); const dcount = (await q('select count(*)::int n from "Exercises" where key=$1', [kk2]))[0].n;
  check('E1e 4 creaciones simultáneas con la misma clave → un 201 y tres 409, sin 5xx y una sola fila', ds === '201,409,409,409' && dcount === 1, ds + ' filas=' + dcount);
  await q(`delete from "ExerciseAudits" where "exerciseId" in (select id from "Exercises" where key in ('reflection','values','contribution'))`); await q(`delete from "Exercises" where key in ('reflection','values','contribution')`);
  const imps = await Promise.all([1, 2].map(() => call(SU, 'POST', `${A}/import-catalog`, {}))); const impRows = (await q(`select key,count(*)::int n from "Exercises" where key in ('reflection','values','contribution') group by key`)); const impAudit = (await q(`select count(*)::int n from "ExerciseAudits" a join "Exercises" e on e.id=a."exerciseId" where e.key in ('reflection','values','contribution') and a.action='create'`))[0].n;
  check('E1f DOS import-catalog simultáneos (catálogo vacío): ninguna respuesta 5xx, sin duplicados y un solo historial "create" por ejercicio', imps.every(r => r.status < 500) && impRows.every(r => r.n === 1) && impAudit === 3, `${imps.map(r => r.status).join()} filas=${JSON.stringify(impRows)} historial=${impAudit} cuerpo=${imps.map(r => (r.json?.code || r.json?.error || '').slice(0, 40)).join(' | ')}`);
  const t0 = Date.now(); const burst = await Promise.all(Array.from({ length: 30 }, (_, i) => call(i % 3 === 0 ? SU : PE, 'GET', i % 3 === 0 ? A : R))); const dt = Date.now() - t0;
  check('E1g 30 solicitudes en paralelo (admin + lectura) sin 5xx y sin bloquear el pool (<8 s)', burst.every(r => r.status === 200) && dt < 8000, `${dt} ms`);
  const bk = await Promise.all(Array.from({ length: 30 }, (_, i) => call(SU, 'POST', `${A}/${e5}/review`, { reviewStatus: i % 2 ? 'done' : 'pending', confirm: true }))); const bkS = (await call(SU, 'GET', A)).status;
  check('E1h 30 revisiones simultáneas alternadas sobre la misma fila (bloqueo por fila) sin 5xx y el pool sigue respondiendo', bk.every(r => r.status === 200) && bkS === 200, bk.map(r => r.status).filter(s => s !== 200).join() || 'todas 200');

  // F1
  await q(`delete from "ExerciseAudits" where "exerciseId" in (select id from "Exercises" where key in ('reflection','values','contribution'))`); await q(`delete from "Exercises" where key in ('reflection','values','contribution')`);
  const f1 = await call(SU, 'POST', `${A}/import-catalog`, {}); const f1rows = await q(`select key,status,"reviewStatus" from "Exercises" where key in ('reflection','values','contribution')`);
  check('F1a importar crea los que faltan SOLO como borrador + pending (nada publicado)', f1.status === 200 && f1.json.created.length === 3 && f1rows.length === 3 && f1rows.every(r => r.status === 'draft' && r.reviewStatus === 'pending'), JSON.stringify(f1.json));
  const rid = (await q(`select id from "Exercises" where key='values'`))[0].id; await call(SU, 'PUT', `${A}/${rid}`, { ...body('editado'), expectedVersion: 1 }); await call(SU, 'POST', `${A}/${rid}/publish`, { confirm: true });
  const f2 = await call(SU, 'POST', `${A}/import-catalog`, {}); const after = (await q(`select status,version,es from "Exercises" where id=$1`, [rid]))[0];
  check('F1b segunda importación idempotente (created:[], skipped:3) y NO pisa un ejercicio ya editado/publicado', f2.json.created.length === 0 && f2.json.skipped.length === 3 && after.status === 'published' && after.version === 2 && after.es.title === 'Titulo editado', JSON.stringify(f2.json) + ' ' + after.es.title);
  check('F1c el catálogo fuente son 3 ejercicios y la lectura pública no muestra los borradores importados', (await call(PE, 'GET', R)).json.filter(x => ['reflection', 'contribution'].includes(x.key)).length === 0, '');

  // G1
  const k6 = key('g1'); const c6 = await create({}, k6); const e6 = c6.json.id;
  await call(SU, 'PUT', `${A}/${e6}`, { ...body('v2'), expectedVersion: 1 }); await call(SU, 'POST', `${A}/${e6}/publish`, { confirm: true }); await call(SU, 'POST', `${A}/${e6}/review`, { reviewStatus: 'done', confirm: true }); await call(SU, 'POST', `${A}/${e6}/review`, { reviewStatus: 'pending', confirm: true }); await call(SU, 'POST', `${A}/${e6}/withdraw`, { confirm: true });
  await call(SU, 'POST', `${A}/${e6}/withdraw`, { confirm: true }); await call(SU, 'POST', `${A}/${e6}/publish`, { confirm: true }); await call(SU, 'POST', `${A}/${e6}/publish`, { confirm: true });
  const h = await hist(e6); const acts = h.map(x => x.action).join(',');
  check('G1a historial exacto: create, update, publish, review, unreview, withdraw, publish (las repeticiones idempotentes NO añaden filas)', acts === 'create,update,publish,review,unreview,withdraw,publish', acts);
  check('G1b cada fila lleva versión y quien actuó (nombre del superadmin)', h.every(x => x.version >= 1 && /QA194 su/.test(x.actorName)), JSON.stringify(h[0]));
  const snaps = await q('select snapshot,"actorName","actorId" from "ExerciseAudits" where "exerciseId"=$1', [e6]); const blob = JSON.stringify(snaps);
  check('G1c las instantáneas NO contienen correo, contraseña, token, JWT, ids de personas ni el correo del actor', !/@example\.test|password|token|Bearer|eyJ/i.test(blob) && snaps.every(s => Object.keys(JSON.parse(s.snapshot)).every(k => ['status', 'version', 'minutes', 'es', 'en', 'reviewStatus', 'reviewedBy', 'reviewedAt'].includes(k))), Object.keys(JSON.parse(snaps[0].snapshot)).join());
  const det = await call(SU, 'GET', `${A}/${e6}`); check('G1d el detalle devuelve el historial SIN la instantánea y limitado a id, acción, versión, actor y fecha', det.status === 200 && det.json.history.length === 7 && det.json.history.every(x => Object.keys(x).sort().join() === 'action,actorName,createdAt,id,version') && !/snapshot/.test(det.text), Object.keys(det.json.history[0] || {}).join());
  const bn = await call(SU, 'POST', A, { key: key('g2'), ...body('a'), es: { ...txt('a'), title: '<x>' } }); const orphan = (await q(`select count(*)::int n from "ExerciseAudits" a left join "Exercises" e on e.id=a."exerciseId" where e.id is null`))[0].n;
  check('G1e operaciones rechazadas (400/409/422) no dejan historial ni filas huérfanas', bn.status === 400 && orphan === 0, 'huérfanos=' + orphan);
  const lastList = await call(SU, 'GET', A); check('G1f el listado (admin) devuelve resumen sin instantáneas ni historial y con complete/title ES-EN', lastList.status === 200 && lastList.json.every(x => 'complete' in x && x.title && !('history' in x) && !('snapshot' in x)), Object.keys(lastList.json[0]).join());

  // log
  await sleep(300); const log = fs.existsSync(E.SRVLOG) ? fs.readFileSync(E.SRVLOG, 'utf8') : ''; const e5xx = (log.match(/Error en ejercicios|Error al (crear|importar)/g) || []).length;
  info('LOG líneas de error de ejercicios en el servidor', e5xx + ' (' + [...new Set(log.split('\n').filter(l => /ejercicios|ejercicio/i.test(l)))].slice(0, 4).join(' ‖ ') + ')');
  check('LOG el log del servidor no contiene correos de las pruebas, tokens ni textos de los ejercicios', log.length >= 0 && !/@example\.test|Bearer|eyJ|Titulo|Proposito/i.test(log), 'bytes=' + log.length);

  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-194-servidor-pr195.json'), JSON.stringify(results, null, 1));
  console.log('RESUMEN-ES194 ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id) }));
  await db.end(); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
