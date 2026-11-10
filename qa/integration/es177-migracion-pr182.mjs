// [QA-Claude] ES-163 · M1–M3: migración sobre una base con entradas ANTIGUAS, idempotencia, guard-down, rehacer, deriva y RLS. Base desechable local.
import { createRequire } from 'node:module'; import { spawnSync } from 'node:child_process'; import fs from 'node:fs';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const { Client } = createRequire(BACK + '/package.json')('pg');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim();
const adm = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await adm.connect(); await adm.query('DROP DATABASE IF EXISTS q177m WITH (FORCE)'); await adm.query('CREATE DATABASE q177m'); await adm.end();
const url = 'postgres://elevation:elevation_local@127.0.0.1:54459/q177m'; const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: d }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 360) })); };
const env = (extra = {}) => ({ ...process.env, DATABASE_URL: url, DB_SSL: 'false', NODE_ENV: 'development', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, ...extra });
const cli = (args, extra) => { const r = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', ...args], { cwd: BACK, env: env(extra), encoding: 'utf8', timeout: 240000 }); return { st: r.status, out: (r.stdout + r.stderr) }; };
const c = new Client({ connectionString: url });
// 1) todas las migraciones HASTA la anterior a ES-163
const names = fs.readdirSync(BACK + '/migrations').filter(f => /^\d{14}-/.test(f)).sort(); const prev = names[names.indexOf('20261111010000-es177-person-ordinals.cjs') - 1];
const u1 = cli(['db:migrate', '--to', prev]); check('M1c migraciones hasta la anterior a ES-177 (' + prev + ')', u1.st === 0, 'exit=' + u1.st);
await c.connect();
// 2) filas ANTIGUAS: profesional, persona, sesión y 3 notas cifradas con la función de la aplicación
// 2) datos existentes antes de la migración: un profesional y tres personas vinculadas
const usr = async (n, role, th = null) => (await c.query("insert into \"Users\"(name,email,password,role,active,\"therapistId\",\"createdAt\",\"updatedAt\") values($1,$2,'x',$3,true,$4,now(),now()) returning id", ['QA177 ' + n, 'qa177-' + n + '@example.test', role, th])).rows[0].id;
const th = await usr('t', 'therapist'); const ps = []; for (const n of ['p1', 'p2', 'p3']) ps.push(await usr(n, 'user', th));
const usersBefore = (await c.query('select id,"therapistId" from "Users" order by id')).rows;
const u2 = cli(['db:migrate']); const u3 = cli(['db:migrate']);
const usersAfter = (await c.query('select id,"therapistId" from "Users" order by id')).rows;
check('M1a aplicar la migración sobre una base con profesional y personas ya vinculadas: éxito y no toca ninguna fila de Users', u2.st === 0 && JSON.stringify(usersBefore) === JSON.stringify(usersAfter), 'exit=' + u2.st);
const cols = (await c.query("select column_name,is_nullable,data_type from information_schema.columns where table_name='TherapistPersonOrdinals' order by ordinal_position")).rows;
check('M1b la tabla tiene therapistId/personId/ordinal/fechas NOT NULL y ninguna columna de texto personal', cols.length >= 6 && ['therapistId', 'personId', 'ordinal', 'createdAt', 'updatedAt'].every(n => cols.find(x => x.column_name === n && x.is_nullable === 'NO')) && !cols.some(x => /text|name|email/i.test(x.column_name)), JSON.stringify(cols.map(x => x.column_name + ':' + x.is_nullable)));
const fks = (await c.query("select conname, confdeltype, confrelid::regclass::text as ref from pg_constraint where conrelid='\"TherapistPersonOrdinals\"'::regclass and contype='f'")).rows;
check('M1c dos claves foráneas hacia Users con ON DELETE CASCADE', fks.length === 2 && fks.every(f => f.confdeltype === 'c' && /Users/.test(f.ref)), JSON.stringify(fks));
const idx = (await c.query("select indexname,indexdef from pg_indexes where tablename='TherapistPersonOrdinals'")).rows;
check('M1d índices únicos (therapistId, personId) y (therapistId, ordinal)', idx.filter(i => /UNIQUE/.test(i.indexdef)).length >= 2 && idx.some(i => /personId/.test(i.indexdef) && /UNIQUE/.test(i.indexdef)) && idx.some(i => /ordinal/.test(i.indexdef) && /UNIQUE/.test(i.indexdef)), idx.map(i => i.indexname).join(','));
const rls = (await c.query("select relrowsecurity from pg_class where oid='\"TherapistPersonOrdinals\"'::regclass")).rows[0].relrowsecurity; const pol = (await c.query("select count(*)::int n from pg_policies where tablename='TherapistPersonOrdinals'")).rows[0].n;
const roles = (await c.query("select rolname from pg_roles where rolname in ('anon','authenticated')")).rows.map(r => r.rolname); const priv = []; for (const r of roles) { const p = (await c.query("select has_table_privilege($1, '\"TherapistPersonOrdinals\"', 'SELECT,INSERT,UPDATE,DELETE') as ok", [r])).rows[0].ok; priv.push(r + ':' + p); }
check('M1e RLS HABILITADA en la misma migración, sin políticas y sin privilegios para anon/authenticated', rls === true && pol === 0 && !priv.some(x => x.endsWith(':true')), `rls=${rls} políticas=${pol} roles=${priv.join(',') || 'anon/authenticated no existen en la base local (lo cubre check:rls)'}`);
check('M2a segunda ejecución sin cambios (idempotente)', u3.st === 0 && /No migrations were executed|up to date/i.test(u3.out), u3.out.split('\n').filter(l => /No migrations|ERROR/i.test(l)).join(' ').slice(0, 100));
const ins = (t, p, o) => c.query('insert into "TherapistPersonOrdinals"("therapistId","personId","ordinal","createdAt","updatedAt") values($1,$2,$3,now(),now())', [t, p, o]); const err = async (f) => { try { await f(); return 'sin error'; } catch (e) { return e.code; } };
await ins(th, ps[0], 1); const d1 = await err(() => ins(th, ps[0], 2)), d2 = await err(() => ins(th, ps[1], 1)), d3 = await err(() => ins(th, 99999999, 5)), d4 = await err(() => c.query('insert into "TherapistPersonOrdinals"("therapistId","personId","createdAt","updatedAt") values($1,$2,now(),now())', [th, ps[2]]));
check('M1f restricciones: misma persona dos veces → 23505; mismo ordinal dos veces → 23505; persona inexistente → 23503; sin ordinal → 23502', d1 === '23505' && d2 === '23505' && d3 === '23503' && d4 === '23502', `${d1}/${d2}/${d3}/${d4}`);
await ins(th, ps[1], 2); await c.query('delete from "Users" where id=$1', [ps[1]]); const casc = (await c.query('select count(*)::int n from "TherapistPersonOrdinals" where "personId"=$1', [ps[1]])).rows[0].n;
await c.query('update "Users" set "therapistId"=null where "therapistId"=$1', [th]); await c.query('delete from "Users" where id=$1', [th]); const casc2 = (await c.query('select count(*)::int n from "TherapistPersonOrdinals" where "therapistId"=$1', [th])).rows[0].n;
check('M1g cascada real: eliminar a la persona borra su fila; eliminar al profesional borra las suyas', casc === 0 && casc2 === 0, `persona=${casc} profesional=${casc2}`);
const d5 = cli(['db:migrate:undo']); const d6 = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'true', NODE_ENV: 'production' }); const still = (await c.query("select to_regclass('\"TherapistPersonOrdinals\"') t")).rows[0].t;
check('M2b down SIN bandera, y con bandera pero en producción, se rechazan (la tabla sigue)', d5.st !== 0 && d6.st !== 0 && !!still && /ALLOW_DESTRUCTIVE_MIGRATION|producci|production/i.test(d5.out + d6.out), 'sinBandera=' + d5.st + ' producción=' + d6.st + ' tabla=' + still);
const d7 = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'true' }); const gone = (await c.query("select to_regclass('\"TherapistPersonOrdinals\"') t")).rows[0].t; const uCount = (await c.query('select count(*)::int n from "Users"')).rows[0].n;
check('M2c down con bandera fuera de producción: borra solo la tabla (Users intacto)', d7.st === 0 && gone === null && uCount >= 1, 'exit=' + d7.st + ' tabla=' + gone + ' usuarios=' + uCount);
const u4 = cli(['db:migrate']); const back = (await c.query("select to_regclass('\"TherapistPersonOrdinals\"') t")).rows[0].t;
check('M2d rehacer (up) tras el down: la tabla vuelve', u4.st === 0 && !!back, 'exit=' + u4.st);
await c.end();
const dr = spawnSync(process.execPath, ['scripts/schema-drift.cjs'], { cwd: BACK, env: env(), encoding: 'utf8' }); const rl = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, env: env(), encoding: 'utf8' });
check('M3a db:drift sobre la base migrada: sin deriva', dr.status === 0, 'exit=' + dr.status + ' ' + (dr.stdout + dr.stderr).trim().split('\n').slice(-1)[0]);
check('M3b check:rls: todas las tablas con RLS y sin privilegios para anon/authenticated', rl.status === 0, 'exit=' + rl.status + ' ' + (rl.stdout + rl.stderr).trim().split('\n').slice(-1)[0]);
const allow = fs.readFileSync(BACK + '/scripts/drift-allowed.json', 'utf8'); const mine = allow.match(/TherapistPersonOrdinals_[A-Za-z]+_fkey/g) || []; const other = allow.match(/TherapistPersonOrdinals(?!_[A-Za-z]+_fkey)[^"]*/g) || [];
check('M3c drift-allowed.json: las únicas entradas nuevas son las dos claves foráneas de la tabla', mine.length === 2 && other.length === 0, mine.join(', ') + (other.length ? ' · otras: ' + other.join(', ') : ''));
fs.writeFileSync('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence/ES-177-migracion-pr182.json', JSON.stringify(out, null, 1));
console.log('RESUMEN-ES177-MIG ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); process.exit(0);
