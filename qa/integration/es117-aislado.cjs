// [QA-Claude] ES-117 · ensayo local del procedimiento de Infra para staging: SequelizeMeta con 8 migraciones antiguas SIN registrar y
// `db:migrate --migrations-path <dir aislado con solo ES-117>`. Debe ejecutar SOLO ES-117. Datos sintéticos, PostgreSQL embebido, 0 tokens.
const { spawnSync } = require('child_process'); const { createRequire } = require('module'); const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend'; const { Client } = createRequire(BACK + '/package.json')('pg');
const ES117 = '20261102120000-es117-supabase-rls.js'; const DB = 'q117b', APP = 'qa_app2', PW = 'Qa117b-' + crypto.randomBytes(8).toString('hex');
const admin0 = 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'; const appUrl = `postgres://${APP}:${PW}@127.0.0.1:54459/${DB}`;
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
const cli = (args) => spawnSync('npx', ['sequelize-cli', ...args], { cwd: BACK, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false', NODE_ENV: 'test' } });
const check = () => spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: appUrl, DB_SSL: 'false' } });
(async () => {
  const a = new Client({ connectionString: admin0, ssl: false }); await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`); await a.query(`DROP ROLE IF EXISTS ${APP}`);
  for (const r of ['anon', 'authenticated', 'service_role']) if (!(await a.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [r])).rowCount) await a.query(`CREATE ROLE ${r} NOLOGIN`);
  await a.query(`CREATE ROLE ${APP} LOGIN CREATEROLE CREATEDB NOSUPERUSER NOBYPASSRLS PASSWORD '${PW}'`); await a.query(`CREATE DATABASE ${DB} OWNER ${APP}`);
  for (const r of ['elevation_worker', 'elevation_worker_owner']) if ((await a.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [r])).rowCount) await a.query(`GRANT ${r} TO ${APP} WITH ADMIN OPTION`);
  const migs = fs.readdirSync(BACK + '/migrations').filter(f => f.endsWith('.js')).sort(); const PREV = migs[migs.indexOf(ES117) - 1];
  const app = new Client({ connectionString: appUrl, ssl: false }); await app.connect();
  for (const k of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) await app.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ${k} TO anon, authenticated, service_role`);
  const pre = cli(['db:migrate', '--to', PREV]); R('A1 base previa aplicada', pre.status === 0, (pre.stdout + pre.stderr).slice(-120));
  const all = (await app.query('SELECT name FROM "SequelizeMeta" ORDER BY name')).rows.map(r => r.name); const drop = all.slice(0, 8);
  await app.query('DELETE FROM "SequelizeMeta" WHERE name = ANY($1)', [drop]); const metaBefore = (await app.query('SELECT count(*)::int n FROM "SequelizeMeta"')).rows[0].n;
  R('A2 escenario: 8 migraciones antiguas sin registrar en SequelizeMeta (como staging)', drop.length === 8, `registradas=${metaBefore} (de ${all.length})`);
  const st = cli(['db:migrate:status']); const pend = (st.stdout.match(/^down /gm) || []).length; R('A3 `db:migrate:status` a secas ve 9 pendientes (las 8 antiguas + ES-117): por eso NO se usa `db:migrate` a secas', pend === 9, `pendientes=${pend}`);
  const c0 = check(); R('A4 línea base: check:rls FALLA y lista tablas sin RLS', c0.status === 1 && /Tablas sin RLS \(\d+\)/.test(c0.stderr), (c0.stderr.match(/Tablas sin RLS \(\d+\)/) || [''])[0]);
  const dir = path.join(BACK, 'mig-es117'); fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(path.join(BACK, 'migrations', ES117), path.join(dir, ES117));
  const ap = cli(['db:migrate', '--migrations-path', 'mig-es117']); const txt = ap.stdout + ap.stderr; const ran = (txt.match(/migrating/g) || []).length;
  R('A5 aplicación aislada: sale 0 y ejecuta SOLO ES-117', ap.status === 0 && ran === 1 && txt.includes('es117'), `migrando=${ran} salida=${ap.status}`);
  const metaAfter = (await app.query('SELECT name FROM "SequelizeMeta" ORDER BY name')).rows.map(r => r.name); R('A6 SequelizeMeta: solo se añadió ES-117; las 8 antiguas siguen sin registrar', metaAfter.length === metaBefore + 1 && metaAfter.includes(ES117) && !drop.some(n => metaAfter.includes(n)), `registradas=${metaAfter.length}`);
  const c1 = check(); R('A7 después: check:rls «RLS ok»', c1.status === 0 && /RLS ok/.test(c1.stdout), c1.stdout.trim().slice(0, 80));
  const ap2 = cli(['db:migrate', '--migrations-path', 'mig-es117']); R('A8 repetir el comando es inocuo (idempotente: nada pendiente)', ap2.status === 0 && !/migrating/.test(ap2.stdout + ap2.stderr), 'sin nuevas migraciones');
  fs.rmSync(dir, { recursive: true, force: true }); await app.end();
  console.log('RESUMEN-ES117-AISLADO ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-117-aislado-resultados.json'), JSON.stringify(out, null, 1));
  await a.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`); await a.query(`DROP ROLE IF EXISTS ${APP}`); await a.end();
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 600)); process.exit(1); });
