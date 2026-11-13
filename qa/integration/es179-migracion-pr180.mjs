// [QA-Claude] ES-163 · M1–M3: migración sobre una base con entradas ANTIGUAS, idempotencia, guard-down, rehacer, deriva y RLS. Base desechable local.
import { createRequire } from 'node:module'; import { spawnSync } from 'node:child_process'; import fs from 'node:fs';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const { Client } = createRequire(BACK + '/package.json')('pg');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim();
const adm = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await adm.connect(); await adm.query('DROP DATABASE IF EXISTS q179m WITH (FORCE)'); await adm.query('CREATE DATABASE q179m'); await adm.end();
const url = 'postgres://elevation:elevation_local@127.0.0.1:54459/q179m'; const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: d }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 360) })); };
const env = (extra = {}) => ({ ...process.env, DATABASE_URL: url, DB_SSL: 'false', NODE_ENV: 'development', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, ...extra });
const cli = (args, extra) => { const r = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', ...args], { cwd: BACK, env: env(extra), encoding: 'utf8', timeout: 240000 }); return { st: r.status, out: (r.stdout + r.stderr) }; };
const c = new Client({ connectionString: url });
// 1) todas las migraciones HASTA la anterior a ES-163
const names = fs.readdirSync(BACK + '/migrations').filter(f => /^\d{14}-/.test(f)).sort(); const prev = names[names.indexOf('20261111000000-es179-session-note-live.cjs') - 1];
const u1 = cli(['db:migrate', '--to', prev]); check('M1c migraciones hasta la anterior a ES-179 (' + prev + ')', u1.st === 0, 'exit=' + u1.st);
await c.connect();
// 2) filas ANTIGUAS: profesional, persona, sesión y 3 notas cifradas con la función de la aplicación
const enc = spawnSync(process.execPath, ['-e', "process.env.DB_SSL='false';const c=require('./utils/crypto');console.log(c.encriptarV2?c.encriptarV2('Nota antigua QA179'):c.encriptar('Nota antigua QA179'))"], { cwd: BACK, env: env(), encoding: 'utf8' }); const cipher = enc.stdout.trim().split('\n').pop();
const th = (await c.query("insert into \"Users\"(name,email,password,role,active,\"createdAt\",\"updatedAt\") values('QA179t','qa179t@example.test','x','therapist',true,now(),now()) returning id")).rows[0].id;
const pt = (await c.query("insert into \"Users\"(name,email,password,role,active,\"therapistId\",\"createdAt\",\"updatedAt\") values('QA179p','qa179p@example.test','x','user',true,$1,now(),now()) returning id", [th])).rows[0].id;
let sess; try { sess = (await c.query("insert into \"TherapySessions\"(\"patientId\",\"therapistId\",\"scheduledAt\",status,duration,\"createdAt\",\"updatedAt\") values($1,$2,now() + interval '1 day','in_progress',50,now(),now()) returning id", [pt, th])).rows[0].id; } catch (e) { check('M0 insertar sesión antigua', false, e.message); process.exit(1); }
for (let i = 0; i < 3; i++) await c.query('insert into "SessionNotes"("sessionId","therapistId",content,"timestamp","createdAt","updatedAt") values($1,$2,$3,now(),now(),now())', [sess, th, cipher]);
const before = (await c.query('select id, content from "SessionNotes" where "sessionId"=$1 order by id', [sess])).rows;
const u2 = cli(['db:migrate']); const u3 = cli(['db:migrate']); const after = (await c.query('select id, content, "isLive", version, "requestId" from "SessionNotes" where "sessionId"=$1 order by id', [sess])).rows;
const cols = (await c.query("select column_name,is_nullable,column_default,data_type,character_maximum_length from information_schema.columns where table_name='SessionNotes' and column_name in ('isLive','version','requestId') order by 1")).rows;
check('M1a aplicar ES-179 sobre una base con 3 notas antiguas cifradas: las filas se conservan IDÉNTICAS y quedan con isLive/version/requestId NULL', u2.st === 0 && after.length === 3 && after.every((r, i) => r.content === before[i].content && r.isLive === null && r.version === null && r.requestId === null), 'exit=' + u2.st + ' filas=' + after.length);
check('M1b las 3 columnas son NULLABLE y SIN valor por defecto (isLive BOOLEAN, version INTEGER, requestId VARCHAR(64))', cols.length === 3 && cols.every(r => r.is_nullable === 'YES' && r.column_default === null) && cols.find(r => r.column_name === 'requestId').character_maximum_length === 64, JSON.stringify(cols));
const idx = (await c.query("select indexdef from pg_indexes where indexname='session_notes__live'")).rows[0]?.indexdef || '';
check('M1c índice único PARCIAL (sessionId, therapistId) WHERE isLive = true', /UNIQUE/i.test(idx) && /sessionId/.test(idx) && /therapistId/.test(idx) && /isLive/.test(idx) && /WHERE/i.test(idx), idx.slice(0, 200));
check('M2a segunda ejecución sin cambios (idempotente)', u3.st === 0 && /No migrations were executed|up to date/i.test(u3.out), u3.out.split('\n').filter(l => /No migrations|ERROR/i.test(l)).join(' ').slice(0, 100));
const ins = (live) => c.query('insert into "SessionNotes"("sessionId","therapistId",content,"isLive","version","timestamp","createdAt","updatedAt") values($1,$2,$3,$4,1,now(),now(),now())', [sess, th, cipher, live]);
await ins(true); let dup = 'sin error'; try { await ins(true); } catch (e) { dup = e.code; } await ins(null); await ins(false);
check('M1d el índice permite varias filas antiguas/no vivas, pero rechaza una SEGUNDA nota viva de la misma sesión y profesional (23505)', dup === '23505', 'duplicado vivo=' + dup);
const d1 = cli(['db:migrate:undo']); const d2 = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'true', NODE_ENV: 'production' });
const still = (await c.query("select count(*)::int n from information_schema.columns where table_name='SessionNotes' and column_name in ('isLive','version','requestId')")).rows[0].n;
check('M2b down SIN bandera, y con bandera pero en producción, se rechazan (las columnas siguen)', d1.st !== 0 && d2.st !== 0 && still === 3 && /ALLOW_DESTRUCTIVE_MIGRATION|producci|production/i.test(d1.out + d2.out), 'sinBandera=' + d1.st + ' producción=' + d2.st + ' columnas=' + still);
const nBefore = (await c.query('select count(*)::int n from "SessionNotes"')).rows[0].n;
const d3 = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'true' }); const gone = (await c.query("select (select count(*)::int from information_schema.columns where table_name='SessionNotes' and column_name in ('isLive','version','requestId')) col, (select count(*)::int from pg_indexes where indexname='session_notes__live') idx")).rows[0]; const nAfter = (await c.query('select count(*)::int n from "SessionNotes"')).rows[0].n;
check('M2c down con bandera, fuera de producción: quita índice y columnas sin borrar notas', d3.st === 0 && gone.col === 0 && gone.idx === 0 && nAfter === nBefore, 'exit=' + d3.st + ' columnas=' + gone.col + ' índice=' + gone.idx + ' notas=' + nAfter + '/' + nBefore);
const u4 = cli(['db:migrate']); const back = (await c.query('select count(*)::int n from "SessionNotes"')).rows[0].n; const idx2 = (await c.query("select count(*)::int n from pg_indexes where indexname='session_notes__live'")).rows[0].n;
check('M2d rehacer (up) tras el down: aplica, el índice vuelve y no se pierde ninguna nota', u4.st === 0 && idx2 === 1 && back === nAfter, 'exit=' + u4.st + ' índice=' + idx2 + ' notas=' + back);
await c.end();
const dr = spawnSync(process.execPath, ['scripts/schema-drift.cjs'], { cwd: BACK, env: env(), encoding: 'utf8' }); const rls = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, env: env(), encoding: 'utf8' });
check('M3a db:drift sobre la base migrada: sin deriva', dr.status === 0, 'exit=' + dr.status + ' ' + (dr.stdout + dr.stderr).trim().split('\n').slice(-1)[0]);
check('M3b check:rls: todas las tablas con RLS y sin privilegios para anon/authenticated', rls.status === 0, 'exit=' + rls.status + ' ' + (rls.stdout + rls.stderr).trim().split('\n').slice(-1)[0]);
fs.writeFileSync('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence/ES-179-migracion-pr180.json', JSON.stringify(out, null, 1));
console.log('RESUMEN-ES179-MIG ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); process.exit(0);
