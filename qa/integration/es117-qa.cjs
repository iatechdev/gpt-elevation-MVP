// [QA-Claude] ES-117 · PR #130 · pruebas independientes contra el merge local con PostgreSQL embebido (datos sintéticos, 0 tokens reales).
// La app y las migraciones corren como un rol SIN superusuario y SIN BYPASSRLS (qa_app, dueño de la base), como en un despliegue real.
// Uso: node qa/integration/es117-qa.cjs   (no imprime contraseñas ni secretos; escribe qa/evidence/ES-117-pr130-resultados.json)
const { spawn, spawnSync } = require('child_process');
const { createRequire } = require('module');
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend'; const S = 'C:/Users/Usuario/Documents/qa13';
const { Client } = createRequire(BACK + '/package.json')('pg');
const ES117 = '20261102120000-es117-supabase-rls.js';
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DB = 'q117', APP = 'qa_app', APP_PW = 'Qa117-' + crypto.randomBytes(8).toString('hex');
const adminUrl = 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres';
const urlOf = (db, user, pw) => `postgres://${user}:${encodeURIComponent(pw)}@127.0.0.1:54459/${db}`;
const appUrl = urlOf(DB, APP, APP_PW);
const connect = async u => { const c = new Client({ connectionString: u, ssl: false }); await c.connect(); return c; };
const migs = fs.readdirSync(BACK + '/migrations').filter(f => f.endsWith('.js')).sort(); const PREV = migs[migs.indexOf(ES117) - 1];
const cli = (args, extra = {}) => spawnSync('npx', ['sequelize-cli', ...args], { cwd: BACK, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false', NODE_ENV: 'test', ...extra } });
const children = []; const stopAll = () => children.forEach(c => { try { c.kill(); } catch { /* */ } });
const startMock = () => { const c = spawn(process.execPath, [S + '/m142mock.cjs', '9950'], { stdio: 'ignore' }); children.push(c); return c; };
const startServer = async () => {
  const env = { ...process.env, PORT: '9951', DATABASE_URL: appUrl, DB_SSL: 'false', JWT_SECRET: fs.readFileSync(S + '/jwt', 'utf8').trim(), DATA_ENCRYPTION_KEY: fs.readFileSync(S + '/dek', 'utf8').trim(), PROMPT_ENCRYPTION_KEY: fs.readFileSync(S + '/pek', 'utf8').trim(), ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9950', AI_BUDGET_TOKENS_PER_USER: '5000000', AI_BUDGET_TOKENS_COHORT: '50000000', AI_BUDGET_PERIOD: 'day', AI_MAX_RETRIES: '0' };
  const c = spawn(process.execPath, ['server.js'], { cwd: BACK, env, stdio: 'ignore' }); children.push(c);
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:9951/api/health'); if (r.ok) return c; } catch { /* */ } await sleep(500); }
  throw new Error('el servidor no arrancó');
};
const API = 'http://127.0.0.1:9951';
const j = async (m, p, t, b) => { const t0 = performance.now(); const r = await fetch(API + p, { method: m, headers: { ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(b !== undefined ? { 'content-type': 'application/json' } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); let body = null; try { body = await r.json(); } catch { /* */ } return { s: r.status, j: body, ms: performance.now() - t0 }; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const workload = async (tok, n) => {
  const t = { msgs: [], chat: [], diary: [] }; let ok = true; const errs = [];
  for (let i = 0; i < n; i++) {
    const d = await j('POST', '/api/diary', tok, { date: '2026-10-01', content: 'Entrada sintética de QA número ' + i }); t.diary.push(d.ms); if (d.s >= 300) { ok = false; errs.push('diary ' + d.s); }
    const c = await j('POST', '/api/chat', tok, { message: 'Mensaje sintético ' + i, requestId: crypto.randomUUID() }); t.chat.push(c.ms); if (c.s !== 200) { ok = false; errs.push('chat ' + c.s); }
    const m = await j('GET', '/api/messages', tok); t.msgs.push(m.ms); if (m.s !== 200) { ok = false; errs.push('msgs ' + m.s); }
  }
  const dl = await j('GET', '/api/diary', tok); if (dl.s !== 200) { ok = false; errs.push('diary list ' + dl.s); }
  return { ok, errs, t, diaryCount: Array.isArray(dl.j) ? dl.j.length : (dl.j?.entries?.length ?? -1) };
};
(async () => {
  R('INFO versión previa a ES-117', !!PREV, PREV);
  const admin = await connect(adminUrl); const createdRoles = [];
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`); await admin.query(`DROP ROLE IF EXISTS ${APP}`);
  for (const role of ['anon', 'authenticated', 'service_role']) if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) { await admin.query(`CREATE ROLE ${role} NOLOGIN`); createdRoles.push(role); }
  await admin.query(`CREATE ROLE ${APP} LOGIN CREATEROLE CREATEDB NOSUPERUSER NOBYPASSRLS PASSWORD '${APP_PW}'`); await admin.query(`CREATE DATABASE ${DB} OWNER ${APP}`);
  for (const r of ['elevation_worker', 'elevation_worker_owner']) if ((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [r])).rowCount) await admin.query(`GRANT ${r} TO ${APP} WITH ADMIN OPTION`); // roles de clúster que dejaron otras pruebas: la migración ES-85 necesita poder concederlos
  const attrs = (await admin.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=$1', [APP])).rows[0]; R('F0 el rol de la app no es superusuario ni tiene BYPASSRLS (como un dueño real)', !attrs.rolsuper && !attrs.rolbypassrls, JSON.stringify(attrs));
  const app = await connect(appUrl); const dbq = await connect(adminUrl.replace('/postgres', '/' + DB)); // administrador dentro de la base de prueba (consultas de catálogo)
  for (const k of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) await app.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ${k} TO anon, authenticated, service_role`);
  const pre = cli(['db:migrate', '--to', PREV]); R('F1a migraciones previas aplicadas como dueño sin superusuario', pre.status === 0, (pre.stdout + pre.stderr).slice(-300));
  if (pre.status !== 0) throw new Error('sin base previa');
  startMock(); await sleep(500); await startServer();
  const email = `qa117-${Date.now()}@example.test`, password = 'Qa117-' + crypto.randomBytes(6).toString('hex') + 'aA!';
  await j('POST', '/api/register', null, { name: 'QA 117', email, password }); const lg = await j('POST', '/api/login', null, { email, password }); const tok = lg.j?.token; R('F3a registro y login sintéticos antes de ES-117', !!tok, 'http=' + lg.s);
  const before = await workload(tok, 12); R('F3b flujo (diario, chat, mensajes) antes de ES-117', before.ok, JSON.stringify(before.errs));
  // datos para el rendimiento: ~10 000 filas sintéticas por duplicación
  for (const tbl of ['Messages', 'DiaryEntries']) {
    const cols = (await app.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' AND column_name <> 'id' AND is_generated='NEVER' AND column_default IS NULL OR (table_name=$1 AND table_schema='public' AND column_name<>'id' AND column_default NOT LIKE 'nextval%')`, [tbl])).rows.map(r => `"${r.column_name}"`);
    if (cols.length) await app.query(`INSERT INTO "${tbl}" (${cols.join(',')}) SELECT ${cols.join(',')} FROM "${tbl}" CROSS JOIN generate_series(1, 400)`);
  }
  const beforeBig = await workload(tok, 12); // misma carga de datos que tendrá el «después»: la comparación de latencia no mezcla volumen con RLS
  const ctrl = await workload(tok, 12); // control: misma carga SIN migración entre medias, para conocer el ruido de la medición
  const rows0 = Object.fromEntries((await Promise.all(['Users', 'Messages', 'DiaryEntries'].map(async t => [t, (await app.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n]))));
  R('INFO filas sintéticas antes', true, JSON.stringify(rows0));
  const svcBefore = (await dbq.query(`SELECT count(*)::int n FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')`)).rows[0].n;
  const exp0 = await (async () => { const c = await connect(appUrl.replace(DB, DB)); const r = await c.query(`SELECT count(*) FILTER (WHERE NOT c.relrowsecurity)::int sin_rls, count(*)::int total FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')`); await c.end(); return r.rows[0]; })();
  R('F1b antes: el escenario reproduce la exposición (tablas sin RLS)', exp0.sin_rls > 10 && exp0.sin_rls <= exp0.total, JSON.stringify(exp0));
  // P2: lecturas concurrentes durante la migración
  const lat = []; let run = true; const reader = (async () => { const c = await connect(appUrl); while (run) { const t0 = performance.now(); await c.query('SELECT count(*) FROM "Messages"'); lat.push(performance.now() - t0); await sleep(20); } await c.end(); })();
  const t0 = Date.now(); const mig = await new Promise(res => { const c = spawn('npx', ['sequelize-cli', 'db:migrate'], { cwd: BACK, shell: true, env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false', NODE_ENV: 'test' } }); let o = ''; c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d); c.on('close', code => res({ status: code, stdout: o, stderr: '' })); }); const migMs = Date.now() - t0; run = false; await reader;
  R('F1c migración ES-117 aplicada sobre datos previos', mig.status === 0, (mig.stdout + mig.stderr).slice(-300));
  R('P1 duración de la migración con ~' + (rows0.Messages + rows0.DiaryEntries) + ' filas (umbral propuesto ≤ 30 s)', migMs <= 30000, migMs + ' ms (incluye arranque de sequelize-cli)');
  R('P2 lecturas concurrentes durante la migración (umbral propuesto: ninguna espera > 2 s)', Math.max(...lat) < 2000, `lecturas=${lat.length} máx=${Math.max(...lat).toFixed(0)} ms p95=${pct(lat, 0.95).toFixed(0)} ms`);
  const chk = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } }); R('F5 check:rls tras migrar: «RLS ok»', chk.status === 0 && /RLS ok/.test(chk.stdout), (chk.stdout + chk.stderr).trim().slice(0, 200));
  const exp1 = (await app.query(`SELECT count(*) FILTER (WHERE NOT c.relrowsecurity)::int sin_rls, count(*)::int total FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')`)).rows[0]; R('F1d RLS activo en todas las tablas de public tras migrar', exp1.sin_rls === 0 && exp1.total === exp0.total, JSON.stringify(exp1));
  const rows1 = Object.fromEntries((await Promise.all(['Users', 'Messages', 'DiaryEntries'].map(async t => [t, (await app.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n])))); R('F1e los datos del dueño siguen intactos (RLS no los oculta al dueño)', JSON.stringify(rows1) === JSON.stringify(rows0), JSON.stringify(rows1));
  // seguridad como anon / authenticated (SET ROLE desde el administrador)
  for (const role of ['anon', 'authenticated']) {
    const c = await connect(adminUrl.replace('/postgres', '/' + DB)); await c.query(`SET ROLE ${role}`); let denied = 0, tried = 0;
    for (const tbl of ['Users', 'Messages', 'DiaryEntries', 'Consents']) for (const sql of [`SELECT * FROM "${tbl}" LIMIT 1`, `DELETE FROM "${tbl}"`, `TRUNCATE "${tbl}"`]) { tried++; try { await c.query(sql); } catch (e) { if (e.code === '42501') denied++; } }
    R(`S1 ${role}: SELECT/DELETE/TRUNCATE sobre Users, Messages, DiaryEntries y Consents → permission denied (42501)`, denied === tried, `${denied}/${tried}`);
    let fn = 0; for (const f of ['ai_jobs_guard()', 'skill_candidates_guard()']) { try { await c.query(`SELECT ${f}`); } catch (e) { if (e.code === '42501') fn++; } } R(`S1 ${role}: EXECUTE de ai_jobs_guard y skill_candidates_guard denegado`, fn === 2, `${fn}/2`);
    try { await c.query(`SELECT nextval(pg_get_serial_sequence('"Messages"','id'))`); R(`S1 ${role}: nextval de secuencia denegado`, false, 'permitido'); } catch (e) { R(`S1 ${role}: nextval de secuencia denegado`, e.code === '42501', e.code); }
    await c.end();
  }
  // defensa en profundidad: aunque alguien reconceda privilegios, RLS sin políticas devuelve 0 filas
  const dp = await connect(adminUrl.replace('/postgres', '/' + DB)); await dp.query('BEGIN'); await dp.query('GRANT SELECT, DELETE ON "Users" TO anon'); await dp.query('SET LOCAL ROLE anon');
  const seen = (await dp.query('SELECT count(*)::int n FROM "Users"')).rows[0].n; const del = await dp.query('DELETE FROM "Users"'); await dp.query('ROLLBACK'); await dp.end();
  R('S1b defensa en profundidad: con GRANT reabierto por error, RLS sin políticas deja 0 filas visibles y 0 borradas', seen === 0 && del.rowCount === 0, `visibles=${seen} borradas=${del.rowCount}`);
  const svcAfter = (await dbq.query(`SELECT count(*)::int n FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')`)).rows[0].n; R('S4 service_role conserva sus privilegios', svcAfter === svcBefore && svcAfter > 10, `antes=${svcBefore} después=${svcAfter}`);
  // tablas futuras
  await app.query('CREATE TABLE "QaFutura" (id serial primary key, x text)'); const fut = (await dbq.query(`SELECT has_table_privilege('anon','public."QaFutura"','SELECT') a, has_table_privilege('authenticated','public."QaFutura"','SELECT') b, has_table_privilege('service_role','public."QaFutura"','SELECT') s`)).rows[0];
  R('S2a tabla nueva creada por el dueño: sin privilegios para anon/authenticated', !fut.a && !fut.b, JSON.stringify(fut));
  const chk2 = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } }); R('S2b check:rls detecta la tabla nueva sin RLS (sale con error y la nombra)', chk2.status === 1 && /QaFutura/.test(chk2.stderr), chk2.stderr.trim().slice(0, 160));
  await app.query('ALTER TABLE "QaFutura" ENABLE ROW LEVEL SECURITY'); const chk3 = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } }); R('S2c activando RLS en la tabla nueva, check:rls vuelve a pasar', chk3.status === 0, chk3.stdout.trim().slice(0, 100)); await app.query('DROP TABLE "QaFutura"');
  // hallazgo del revisor automático (P2): funciones futuras y EXECUTE heredado de PUBLIC
  await app.query('CREATE FUNCTION public.qa117_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'); const fx = (await dbq.query(`SELECT has_function_privilege('anon','public.qa117_probe()','EXECUTE') a, has_function_privilege('authenticated','public.qa117_probe()','EXECUTE') b`)).rows[0];
  const chkF = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } });
  R('S2d función nueva creada por el dueño: anon/authenticated NO deberían poder ejecutarla (EXECUTE heredado de PUBLIC)', !fx.a && !fx.b, JSON.stringify(fx) + ' · check:rls ' + (chkF.status === 1 ? 'la detecta (salida 1)' : 'no la detecta')); await app.query('DROP FUNCTION public.qa117_probe()');
  // worker
  const w = (await admin.query(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('elevation_worker','elevation_worker_owner')`)).rows; R('S3a roles del worker existen, sin superusuario ni BYPASSRLS', w.length === 2 && w.every(r => !r.rolsuper && !r.rolbypassrls), JSON.stringify(w));
  const wc = await connect(adminUrl.replace('/postgres', '/' + DB)); await wc.query('SET ROLE elevation_worker'); let wDenied = 0; for (const tbl of ['Users', 'Messages', 'DiaryEntries', 'Consents']) { try { await wc.query(`SELECT 1 FROM "${tbl}" LIMIT 1`); } catch (e) { if (e.code === '42501') wDenied++; } }
  let wOk = true; try { await wc.query('SELECT count(*) FROM "AiUsages"'); } catch { wOk = false; } R('S3b elevation_worker: sin acceso a Users/Messages/DiaryEntries/Consents y sí a AiUsages', wDenied === 4 && wOk, `denegadas=${wDenied}/4 AiUsages=${wOk}`); await wc.end();
  // la app tras ES-117
  await sleep(300); const after = await workload(tok, 12); R('F3c flujo (diario, chat, mensajes) después de ES-117 sin errores', after.ok, JSON.stringify(after.errs));
  R('F3d el diario y los mensajes previos siguen visibles para su dueño', after.diaryCount >= before.diaryCount, `antes=${before.diaryCount} después=${after.diaryCount}`);
  const me = (a) => `p50=${pct(a, 0.5).toFixed(1)} p95=${pct(a, 0.95).toFixed(1)}`; const cmp = (n, a, b) => { const x = pct(a, 0.5), y = pct(b, 0.5); return { n, x, y, rel: (y - x) / x }; };
  for (const [n, k] of [['GET /api/messages', 'msgs'], ['POST /api/chat (proveedor simulado)', 'chat'], ['POST /api/diary', 'diary']]) { const c = cmp(n, beforeBig.t[k], after.t[k]); R(`P3 ${n}: mediana antes→después (umbral propuesto: no más de +20 % o +15 ms)`, c.rel <= 0.2 || c.y - c.x <= 15, `antes ${me(beforeBig.t[k])} ms · después ${me(after.t[k])} ms`); }
  { const a = pct(beforeBig.t.msgs, 0.5), b = pct(ctrl.t.msgs, 0.5), c = pct(after.t.msgs, 0.5); R('INFO P3 ruido de medición GET /api/messages (p50): antes → control sin migración → después', true, `${a.toFixed(0)} → ${b.toFixed(0)} (${((b - a) / a * 100).toFixed(0)} %) → ${c.toFixed(0)} ms (después vs control ${((c - b) / b * 100).toFixed(0)} %)`); }
  // F4 down y reaplicación sobre datos
  const dn = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'true' }); R('F4a down aplicado (ensayo)', dn.status === 0, (dn.stdout + dn.stderr).slice(-200));
  const exp2 = (await app.query(`SELECT count(*) FILTER (WHERE c.relrowsecurity)::int con_rls FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')`)).rows[0]; R('F4b tras el down no queda RLS (estado previo)', exp2.con_rls === 0, JSON.stringify(exp2));
  const up2 = cli(['db:migrate']); R('F4c reaplicación del up', up2.status === 0, (up2.stdout + up2.stderr).slice(-200));
  const chk4 = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } }); R('F4d tras reaplicar, check:rls pasa', chk4.status === 0, chk4.stdout.trim().slice(0, 100));
  const rows2 = Object.fromEntries((await Promise.all(['Users', 'Messages', 'DiaryEntries'].map(async t => [t, (await app.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n])))); R('F4e up→down→up no pierde datos', rows2.Users === rows1.Users && rows2.Messages >= rows1.Messages, JSON.stringify(rows2));
  const drift = spawnSync('npm', ['run', 'db:drift'], { cwd: BACK, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false', NODE_ENV: 'test' } }); R('F4f db:drift sin deriva', drift.status === 0, (drift.stdout + drift.stderr).trim().slice(-250));
  // estáticas
  const migSrc = fs.readFileSync(BACK + '/migrations/' + ES117, 'utf8'), chkSrc = fs.readFileSync(BACK + '/scripts/check-rls.cjs', 'utf8');
  R('S5 la migración y el script no contienen secretos, correos ni identificadores de proyecto', !/(postgres:\/\/[^'"\s]*:[^'"\s]+@)|(@[a-z0-9-]+\.[a-z]{2,})|(eyJ[A-Za-z0-9_-]{20,})|(sk-[A-Za-z0-9]{10,})|(hxfgugdd|pxtijden)/i.test(migSrc + chkSrc), 'revisión por expresión regular');
  R('S6 check-rls.cjs es de solo lectura (sin INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/GRANT/REVOKE/TRUNCATE y no imprime DATABASE_URL)', !/(INSERT\s+INTO|UPDATE\s+"?\w+"?\s+SET|DELETE\s+FROM|ALTER\s+(TABLE|ROLE|DEFAULT)|CREATE\s+(TABLE|ROLE|POLICY|FUNCTION)|DROP\s+(TABLE|ROLE|POLICY)|GRANT\s+\w+\s+ON|REVOKE\s+\w+\s+ON|TRUNCATE\s+(TABLE\s+)?"?\w)/i.test(chkSrc.replace(/\/\/.*$/gm, '')) && !/console\.\w+\([^)]*DATABASE_URL/.test(chkSrc), 'revisión estática');
  console.log('RESUMEN-ES117 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-117-pr130-resultados.json'), JSON.stringify(out, null, 1));
  stopAll(); await app.end(); await dbq.end(); await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`); await admin.query(`DROP ROLE IF EXISTS ${APP}`); for (const r of createdRoles) await admin.query(`DROP ROLE IF EXISTS ${r}`).catch(() => {}); await admin.end();
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 700)); stopAll(); process.exit(1); });
