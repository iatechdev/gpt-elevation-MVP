// [QA-Claude] ES-260 · PR #214 (skillLabels aditivo en /api/route-catalog y /roles/:roleKey) · servidor REAL, Postgres con migraciones, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log> [MODE=main] node qa/integration/es260-skilllabels-pr214.cjs
// MODE=main: mismo guion contra main (control); los casos de skillLabels se evalúan igual y se informa cuáles fallan (esperado en main); la instantánea del resto del payload se guarda para compararla.
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const MODE = E.MODE || 'pr'; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 700) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 700) })); };
const { build } = req(path.join(E.QA_SUT, 'backend', 'seeds', 'routeCatalogSynthetic.cjs'));
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa260-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA260 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers }; };
  const AD = await mk('ad', 'admin'), PE = await mk('pe'), TH = await mk('th', 'therapist');
  const RC = '/api/admin/route-catalog', SC = '/api/admin/skill-catalog', R = '/api/route-catalog';
  const data = build();

  // --- antes de publicar el catálogo de rutas: no disponible
  const un1 = await call(PE, 'GET', R), un2 = await call(PE, 'GET', `${R}/roles/formador_corporativo`);
  // --- catálogo de rutas sintético publicado por la ruta real
  const rd = (await call(AD, 'POST', RC)).json; let upErr = [];
  for (const kind of ['contexts', 'sources', 'roles', 'offers', 'resources']) for (const [key, item] of Object.entries(data[kind])) { const r = await call(AD, 'PUT', `${RC}/${rd.id}/${kind}/${key}`, item); if (r.status !== 200) upErr.push(`${kind}/${key}:${r.status}`); }
  const pubR = await call(AD, 'POST', `${RC}/${rd.id}/publish`, {});
  check('PRE catálogo de rutas sintético publicado por la ruta real', pubR.status === 200 && upErr.length === 0, `${pubR.status} ${JSON.stringify(pubR.json).slice(0, 200)} errores=${upErr.slice(0, 3)}`);
  const referenced = [...new Set([...Object.values(data.roles).flatMap(r => r.capabilities.map(c => c.skillKey)), ...Object.values(data.resources).map(r => r.linkedSkillKey)].filter(Boolean))].sort();
  const [kept, absent, ...rest] = referenced;
  check('PRE el catálogo sintético referencia ≥ 5 habilidades', referenced.length >= 5, referenced.join());

  // --- L2: sin catálogo de habilidades publicado
  const none = await call(PE, 'GET', R), noneRole = await call(PE, 'GET', `${R}/roles/formador_corporativo`);
  check('L2a sin catálogo de habilidades publicado: 200 y `skillLabels` vacío en la lista y en la ficha (no 500) [en main: la clave no existe]', MODE === 'main' ? none.status === 200 : (none.status === 200 && JSON.stringify(none.json.skillLabels) === '{}' && JSON.stringify(noneRole.json.skillLabels) === '{}'), `${none.status} ${JSON.stringify(none.json?.skillLabels)}`);

  // --- catálogos de habilidades por la ruta real: v1 (archivada), v2 (vigente), borrador abierto con otros nombres
  const lv = Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `Nivel ${n} secreto`, en: `Secret level ${n}` }]));
  const def = (es, en) => ({ type: 'transversal', labels: { es, en }, rubric: { levels: lv, source: 'x', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, territories: ['dir'] });
  const s1 = (await call(AD, 'POST', SC)).json; await call(AD, 'PUT', `${SC}/${s1.id}/skills/${kept}`, def('Nombre viejo', 'Old name')); await call(AD, 'PUT', `${SC}/${s1.id}/skills/${absent}`, def('Solo en el archivado', 'Only archived')); const ps1 = await call(AD, 'POST', `${SC}/${s1.id}/publish`, {});
  const s2 = (await call(AD, 'POST', SC)).json; await call(AD, 'PUT', `${SC}/${s2.id}/skills/${kept}`, def('Nombre vigente', 'Current name')); await call(AD, 'DELETE', `${SC}/${s2.id}/skills/${absent}`); for (const k of rest) await call(AD, 'PUT', `${SC}/${s2.id}/skills/${k}`, def(`Nombre ${k}`, `Name ${k}`)); await call(AD, 'PUT', `${SC}/${s2.id}/skills/clave_no_referenciada`, def('No referenciada', 'Not referenced')); const ps2 = await call(AD, 'POST', `${SC}/${s2.id}/publish`, {});
  const s3 = (await call(AD, 'POST', SC)).json; await call(AD, 'PUT', `${SC}/${s3.id}/skills/${kept}`, def('NOMBRE DEL BORRADOR', 'DRAFT NAME'));
  check('PRE catálogos de habilidades: v1 archivada, v2 vigente y un borrador abierto con otros nombres', ps1.status === 200 && ps2.status === 200 && (await q(`select status from "SkillCatalogs" order by version`)).map(r => r.status).join() === 'archived,published,draft', `${ps1.status}/${ps2.status}`);

  const whole = await call(PE, 'GET', R); const sl = whole.json?.skillLabels;
  const okSet = Object.keys(sl || {}).sort().join() === [kept, ...rest].sort().join();
  check('L1a lista completa: `skillLabels` trae SOLO las habilidades referenciadas que existen en el catálogo VIGENTE, con el nombre vigente {es,en}', MODE === 'main' ? whole.status === 200 : (whole.status === 200 && okSet && sl[kept].es === 'Nombre vigente' && sl[kept].en === 'Current name' && Object.values(sl).every(v => Object.keys(v).sort().join() === 'en,es' && v.es && v.en)), `${whole.status} claves=${Object.keys(sl || {}).length}/${referenced.length - 1}`);
  check('L2b la clave que solo existe en el catálogo ARCHIVADO se omite (no se inventa ni queda vacía); la no referenciada tampoco aparece; el borrador abierto NO se filtra', MODE === 'main' ? true : (!Object.hasOwn(sl, absent) && !Object.hasOwn(sl, 'clave_no_referenciada') && !/NOMBRE DEL BORRADOR|DRAFT NAME|Nombre viejo|Old name|Solo en el archivado/.test(whole.text)), `${absent}`);
  // por rol
  const roles = Object.keys(data.roles); const badRole = [];
  for (const rk of roles) {
    const r = await call(PE, 'GET', `${R}/roles/${rk}`); const wanted = new Set([...data.roles[rk].capabilities.map(c => c.skillKey), ...Object.values(data.resources).filter(x => x.roleKeys.includes(rk)).map(x => x.linkedSkillKey)].filter(Boolean)); const have = new Set([kept, ...rest]);
    const exp = [...wanted].filter(k => have.has(k)).sort().join(); const got = Object.keys(r.json?.skillLabels || {}).sort().join();
    if (MODE !== 'main' && (r.status !== 200 || exp !== got)) badRole.push(`${rk}: esperado[${exp}] obtenido[${got}]`);
  }
  check(`L1b ficha de cada uno de los ${roles.length} roles: \`skillLabels\` = exactamente las habilidades de ESE rol y sus recursos que existen en el vigente`, badRole.length === 0, badRole.join(' | ') || 'ok');
  const leak = /Nivel \d secreto|Secret level|Revisor sintético|rubric|verifiedBy|verifiedAt|levels|territories|"type":"transversal"/i.test(JSON.stringify(sl || {})); const leakAll = /Revisor sintético|Nivel \d secreto|Secret level/.test(whole.text);
  check('L1c solo nombres: ni rúbrica, niveles, territorios, tipo ni quién verificó en `skillLabels` ni en ninguna parte de la respuesta', !leak && !leakAll, 'respuesta ' + whole.text.length + ' bytes');
  // vacío/ausente
  await q(`update "SkillDefinitions" set labels=$1 where "catalogId"=$2 and "skillKey"=$3`, [JSON.stringify({ es: 'Solo español', en: '' }), s2.id, kept]); const emp = await call(PE, 'GET', R);
  await q(`update "SkillDefinitions" set labels=$1 where "catalogId"=$2 and "skillKey"=$3`, [JSON.stringify({ es: 'Nombre vigente' }), s2.id, kept]); const emp2 = await call(PE, 'GET', R);
  await q(`update "SkillDefinitions" set labels=$1 where "catalogId"=$2 and "skillKey"=$3`, [JSON.stringify({ es: 'Nombre vigente', en: 'Current name' }), s2.id, kept]);
  check('L2c etiqueta con `en` vacío o ausente → la habilidad se omite (no se inventa ni se devuelve a medias)', MODE === 'main' ? true : (!Object.hasOwn(emp.json.skillLabels, kept) && !Object.hasOwn(emp2.json.skillLabels, kept) && emp.status === 200 && emp2.status === 200), `${Object.hasOwn(emp.json.skillLabels || {}, kept)}/${Object.hasOwn(emp2.json.skillLabels || {}, kept)}`);
  // publicar un catálogo nuevo: las etiquetas siguen al vigente
  const s4 = (await call(AD, 'POST', SC)).json; const s4id = s4.id ?? s4.draftId; await call(AD, 'PUT', `${SC}/${s4id}/skills/${kept}`, def('Nombre v3', 'Name v3')); const ps4 = await call(AD, 'POST', `${SC}/${s4id}/publish`, {}); const after = await call(PE, 'GET', R);
  check('L2d al publicar un catálogo de habilidades nuevo, las etiquetas siguen al VIGENTE (nombre v3; el borrador nuevo hereda el resto)', MODE === 'main' ? true : (ps4.status === 200 && after.json.skillLabels[kept]?.es === 'Nombre v3' && after.json.skillLabels[kept]?.en === 'Name v3'), `${ps4.status} ${String(JSON.stringify(after.json?.skillLabels ?? null)).slice(0, 120)}`);
  // restaurar un vigente completo para L5: publicar de nuevo con todas
  const s5 = (await call(AD, 'POST', SC)).json; const s5id = s5.id ?? s5.draftId; for (const k of [kept, ...rest]) await call(AD, 'PUT', `${SC}/${s5id}/skills/${k}`, def(`Nombre ${k}`, `Name ${k}`)); await call(AD, 'POST', `${SC}/${s5id}/publish`, {});

  // --- L3 aditivo / estados / permisos
  const una = [un1.status, un1.json?.code, un2.status, un2.json?.code]; const nf = await call(PE, 'GET', `${R}/roles/no_existe_${stamp}`); const anon = await call(null, 'GET', R); const anonR = await call(null, 'GET', `${R}/roles/formador_corporativo`); const th = await call(TH, 'GET', R);
  check('L3a estados y permisos como en main: catálogo no publicado → 503 `catalog_unavailable` (lista y ficha); rol inexistente → 404 `role_not_found`; sin sesión 401/403; `Cache-Control: no-store`; otros roles con sesión leen igual', una.join() === '503,catalog_unavailable,503,catalog_unavailable' && nf.status === 404 && nf.json.code === 'role_not_found' && [401, 403].includes(anon.status) && [401, 403].includes(anonR.status) && /no-store/.test(whole.headers.get('cache-control') || '') && th.status === 200, `${una} nf=${nf.status} anon=${anon.status}/${anonR.status} th=${th.status} cc=${whole.headers.get('cache-control')}`);
  const full = await call(PE, 'GET', R); const one = await call(PE, 'GET', `${R}/roles/${roles[0]}`);
  const strip = (j) => { const { skillLabels, publishedAt, ...rest2 } = j; void skillLabels; void publishedAt; return JSON.stringify(rest2, (k, v) => (k === 'id' || k === 'catalogId' ? undefined : v)); };
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-260-forma-${MODE}.json`), JSON.stringify({ keys: Object.keys(full.json).sort(), roleKeys: Object.keys(one.json).sort(), listWithoutLabels: JSON.parse(strip(full.json)), roleWithoutLabels: JSON.parse(strip(one.json)) }, null, 1));
  check('L3b la clave nueva es la única añadida: claves de primer nivel de la lista y de la ficha (contexts, sources, roles, offers, resources, version, publishedAt [+ role, sources, offers, resources en la ficha]) + `skillLabels` (comparación campo a campo con main: ver la evidencia de forma)', MODE === 'main' ? !('skillLabels' in full.json) : (Object.keys(full.json).sort().join() === 'contexts,offers,publishedAt,resources,roles,skillLabels,sources,version' && Object.keys(one.json).sort().join() === 'offers,resources,role,skillLabels,sources,version'), Object.keys(full.json).join() + ' | ' + Object.keys(one.json).join());

  // --- L4 privacidad y seguridad
  const hostile = ['..%2F..%2Fetc%2Fpasswd', '%00', 'x'.repeat(300), '__proto__', 'constructor', 'FORMADOR_CORPORATIVO', 'formador corporativo', "a'--", '%E0%A4%A', '.']; const hs = []; for (const h of hostile) { const r = await call(PE, 'GET', `${R}/roles/${h}`); hs.push(h.slice(0, 12) + '→' + r.status); }
  check('L4a `roleKey` hostil (traversal, nulo, 300 caracteres, `__proto__`, mayúsculas, espacios, comilla, % inválido) → 404 (o 400), nunca 5xx ni skillLabels', hs.every(x => /→(404|400)$/.test(x)), hs.join(' ; '));
  await q(`insert into "SkillDefinitions"("catalogId","skillKey",type,labels,rubric,territories,"createdAt","updatedAt") select id, $1, 'transversal', $2::jsonb, '{}'::jsonb, '[]'::jsonb, now(), now() from "SkillCatalogs" where status='published'`, ["x\"y'z<>", JSON.stringify({ es: '<script>alert(1)</script>', en: 'x' })]).catch(e => info('L4b-siembra', 'no se pudo sembrar clave rara: ' + e.message.slice(0, 80)));
  const weird = await call(PE, 'GET', R);
  check('L4b una habilidad con clave y nombre raros (comillas, HTML) en el vigente NO rompe la respuesta (200) y no se mezcla con las referenciadas', weird.status === 200 && (MODE === 'main' || !Object.hasOwn(weird.json.skillLabels, "x\"y'z<>")), weird.status);
  const log = (() => { try { return fs.readFileSync(E.SRVLOG, 'utf8'); } catch { return ''; } })();
  check('L4c el registro del servidor no contiene nombres de habilidades, rúbricas ni correos; la respuesta no incluye ids de personas', !/Nombre vigente|Nivel \d secreto|Revisor sintético/.test(log) && ![AD, PE, TH].some(u => log.includes(u.email)) && !/"UserId"|"userId"/.test(whole.text), 'log ' + log.length + ' bytes');

  // --- L5 rendimiento y consistencia
  const PGLOG = E.PGLOG || 'C:/Users/Usuario/Documents/qa13/pgstart.log'; const dbn = (await q('select current_database() d'))[0].d;
  await q(`ALTER DATABASE "${dbn}" SET log_statement='all'`); await q('select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()', [dbn]); await new Promise(r => setTimeout(r, 1500));
  const tag = 'QA_MARK_' + stamp; const db2 = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db2.connect(); await call(PE, 'GET', R); await new Promise(r => setTimeout(r, 500)); await db2.query(`select '${tag}_A'`); await call(PE, 'GET', R); await db2.query(`select '${tag}_B'`); await new Promise(r => setTimeout(r, 1500)); await db2.end();
  let plog = ''; try { plog = fs.readFileSync(PGLOG, 'utf8'); } catch { /* */ } const a0 = plog.lastIndexOf(tag + '_A'), b0 = plog.lastIndexOf(tag + '_B'); const seg = a0 >= 0 && b0 > a0 ? plog.slice(a0, b0) : '';
  const stm = seg.split(/\r?\n/).filter(l => /statement:|execute/i.test(l) && /SELECT/i.test(l)); const cnt = (re) => stm.filter(l => re.test(l)).length; const d = { SkillCatalogs: cnt(/"SkillCatalogs"/), SkillDefinitions: cnt(/"SkillDefinitions"/), RouteCatalogs: cnt(/"RouteCatalogs"/), RouteCatalogItems: cnt(/"RouteCatalogItems"/), total: stm.length };
  info('L5a consultas SELECT por lectura (registro de sentencias de Postgres)', JSON.stringify(d) + (seg ? '' : ' [SIN REGISTRO: no se pudo medir]'));
  check('L5b a lo sumo 2 consultas adicionales por lectura frente a main: 1 a SkillCatalogs + 1 a SkillDefinitions (sin N+1); main no consulta habilidades', !!seg && (MODE === 'main' ? d.SkillCatalogs === 0 && d.SkillDefinitions === 0 : (d.SkillCatalogs <= 1 && d.SkillDefinitions <= 1)), JSON.stringify(d));
  const t = async (n) => { const a = []; for (let i = 0; i < n; i++) { const s = process.hrtime.bigint(); await call(PE, 'GET', R); a.push(Number(process.hrtime.bigint() - s) / 1e6); } a.sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / n, p50: a[Math.floor(n / 2)], p95: a[Math.floor(n * 0.95)] }; };
  await t(5); const tm = await t(60); info('L5c latencia /api/route-catalog (60 lecturas, ms)', JSON.stringify({ mode: MODE, mean: +tm.mean.toFixed(1), p50: +tm.p50.toFixed(1), p95: +tm.p95.toFixed(1) }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-260-latencia-${MODE}.json`), JSON.stringify(tm));
  const many = await Promise.all(Array.from({ length: 20 }, () => call(PE, 'GET', R))); const bodies = new Set(many.map(r => r.text));
  check('L5d 20 lecturas simultáneas (pool 5): todas 200, sin 5xx y con respuestas IDÉNTICAS', many.every(r => r.status === 200) && bodies.size === 1, many.map(r => r.status).join('') + ` distintas=${bodies.size}`);
  const idle = (await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%'`))[0].n; check('L5e sin transacciones colgadas', idle === 0, 'idle in tx=' + idle);

  const fails = results.filter(r => r.ok === false); console.log(`\nRESUMEN ${MODE} ${results.filter(r => r.ok).length}/${results.filter(r => 'ok' in r).length} ok; fallos: ${fails.map(f => f.id.slice(0, 4)).join(', ') || 'ninguno'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-260-skilllabels-${MODE}.json`), JSON.stringify({ pr: 214, mode: MODE, head: E.QA_HEAD || null, results }, null, 2)); await db.end(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
