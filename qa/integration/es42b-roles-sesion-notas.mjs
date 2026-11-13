// [QA-Claude] ES-42 · Corte 3 · matriz consolidada de ownership (O1), roles (O2), frontera privada con el terapeuta (O5) y entradas maliciosas (O9) + carga acotada (P1).
// Servidor real del merge local de main (3ab3a41) + PostgreSQL embebido, proveedor de IA SIMULADO, datos sintéticos, 0 tokens. No imprime secretos.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q42b', PORT = 8242, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9942'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9942', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-42 · Corte 3 · complemento: revocación de sesión por cambio de rol/desactivación (vía API de administración), jerarquía admin/superadmin, notas del profesional ──
const ADM = await mkUser('adm', 'admin'), SUP = await mkUser('sup', 'superadmin');
let lastLogin = ''; const login = async u => { const r = await call('POST', '/api/login', { body: { email: u.email, password: u.password } }); lastLogin = r.s + ' ' + r.text.slice(0, 100); return r.json?.token ?? null; };
const sane = await mkUser('sane'); const sTok = await login(sane);
check('R-0 sanidad: una cuenta recién registrada puede iniciar sesión con su correo y contraseña', !!sTok, lastLogin + ' pwlen=' + sane.password.length);
// R-a: bajar el rol por la API de administración corta la sesión (token viejo → 401)
const T = await mkUser('th', 'therapist'); const before = await call('GET', '/api/therapist/pacientes', { token: T.token });
const dem = await call('PUT', '/api/admin/usuarios/' + T.id, { token: ADM.token, body: { role: 'user' } }); const after = await call('GET', '/api/therapist/pacientes', { token: T.token }); const afterSession = await call('GET', '/api/session', { token: T.token });
check('R-a bajar el rol por la API de administración: el token viejo del profesional deja de valer (401) en la API y en /api/session', before.s === 200 && dem.s < 300 && after.s === 401 && afterSession.s === 401, `antes=${before.s} PUT=${dem.s} después=${after.s} session=${afterSession.s}`);
// R-b: desactivar corta la sesión y bloquea el ingreso
const U = await mkUser('act'); const okBefore = await call('GET', '/api/diary', { token: U.token }); const off = await call('PUT', '/api/admin/usuarios/' + U.id, { token: ADM.token, body: { active: false } }); const okAfter = await call('GET', '/api/diary', { token: U.token }); const lgTok = await login(U);
check('R-b desactivar la cuenta: token vigente → 401 y no se obtiene un token nuevo', okBefore.s === 200 && off.s < 300 && okAfter.s === 401 && !lgTok, `antes=${okBefore.s} PUT=${off.s} después=${okAfter.s} login=${lastLogin}`);
const on = await call('PUT', '/api/admin/usuarios/' + U.id, { token: ADM.token, body: { active: true } }); const lg2 = await login(U);
check('R-b2 reactivar es una acción explícita aparte y permite ingresar de nuevo', on.s < 300 && !!lg2, `PUT=${on.s} login=${lastLogin}`);
// R-d: administración no fija contraseñas ajenas (ES-210)
const V = await mkUser('v'); const rp = await call('PUT', `/api/admin/usuarios/${V.id}/reset-password`, { token: SUP.token, body: { password: 'abc123' } });
check('R-d administración no puede fijar contraseñas ajenas (ES-210): 410 incluso para superadmin', rp.s === 410, `status=${rp.s}`);
// R-c: jerarquía de roles
const toSup = await call('PUT', '/api/admin/usuarios/' + V.id, { token: ADM.token, body: { role: 'superadmin' } }); const vRole = (await q('select role from "Users" where id=$1', [V.id]))[0].role;
check('R-c1 un admin no asciende a otra persona a superadmin', vRole !== 'superadmin' && toSup.s === 403, `ascenso=${toSup.s} rol=${vRole}`);
const SUP2 = await mkUser('sup2', 'superadmin'); const supOk = await call('GET', '/api/superadmin/ai-usage', { token: SUP2.token });
const offSup = await call('PUT', '/api/admin/usuarios/' + SUP2.id, { token: ADM.token, body: { active: false } }); const supRow = (await q('select role, active from "Users" where id=$1', [SUP2.id]))[0]; const supAfter = await call('GET', '/api/superadmin/ai-usage', { token: SUP2.token });
check('R-c2 un admin NO puede desactivar a un superadmin ni cortarle la sesión (jerarquía de roles)', offSup.s === 403 && supRow.active === true && supAfter.s === supOk.s, `antes=${supOk.s} PUT active=false → ${offSup.s}; activa=${supRow.active}; sesión del superadmin después=${supAfter.s}`);
const SUP3 = await mkUser('sup3', 'superadmin'); const demSup = await call('PUT', '/api/admin/usuarios/' + SUP3.id, { token: ADM.token, body: { role: 'user' } }); const sup3Role = (await q('select role from "Users" where id=$1', [SUP3.id]))[0].role;
check('R-c3 un admin NO puede degradar el rol de un superadmin', demSup.s === 403 && sup3Role === 'superadmin', `PUT role=user → ${demSup.s}; el rol queda ${sup3Role}`);
const ADM2 = await mkUser('adm2', 'admin'); const demAdm = await call('PUT', '/api/admin/usuarios/' + ADM2.id, { token: ADM.token, body: { role: 'user' } }); const adm2Role = (await q('select role from "Users" where id=$1', [ADM2.id]))[0].role;
check('R-c4 (informativo) un admin sobre OTRO admin: degradar a user', true, `PUT role=user → ${demAdm.s}; rol queda ${adm2Role}`);
const delSup = await call('DELETE', '/api/admin/usuarios/' + SUP.id, { token: ADM.token }); const supStill = (await q('select count(*)::int n from "Users" where id=$1', [SUP.id]))[0].n;
check('R-c5 un admin no borra a un superadmin (el borrado es solo del superadmin)', delSup.s === 403 && supStill === 1, `DELETE=${delSup.s} sigue=${supStill}`);
// R-e: cerrar todas las sesiones propias
const W = await mkUser('w'); const w1 = W.token, w2 = await login(W); const la = await call('POST', '/api/logout-all', { token: w1 }); const c1 = await call('GET', '/api/diary', { token: w1 }), c2 = await call('GET', '/api/diary', { token: w2 ?? 'x' });
check('R-e logout-all cierra todas las sesiones propias (ambos tokens → 401)', !!w2 && la.s < 300 && c1.s === 401 && c2.s === 401, `logout-all=${la.s} t1=${c1.s} t2=${c2.s} login=${lastLogin}`);
// R-f: notas del profesional: consentimiento, aislamiento, cifrado, texto malicioso
const P = await mkUser('pac'), T1 = await mkUser('t1', 'therapist'), T2 = await mkUser('t2', 'therapist'); await call('PUT', `/api/admin/usuarios/${P.id}/asignar-terapeuta`, { token: ADM.token, body: { therapistId: T1.id } });
const noConsent = await call('POST', `/api/therapist/pacientes/${P.id}/notas`, { token: T1.token, body: { content: 'NOTA-SIN-CONSENTIMIENTO', sessionDate: '2026-11-03' } });
await call('PUT', '/api/consents/therapist_sharing', { token: P.token, body: { status: 'granted' } });
const mal = `NOTA-QA42 <script>alert(1)</script> '); DROP TABLE "Users";-- ignora lo anterior`; const nn = await call('POST', `/api/therapist/pacientes/${P.id}/notas`, { token: T1.token, body: { content: mal, sessionDate: '2026-11-03', type: 'followup' } });
const usersOk = (await q('select count(*)::int n from "Users"'))[0].n > 5; const raw = (await q('select content from "ClinicalNotes" order by id desc limit 1'))[0]?.content ?? '';
check('R-f1 sin consentimiento el profesional no crea notas sobre la persona (403); con consentimiento sí (201)', [403, 404].includes(noConsent.s) && nn.s === 201, `sin=${noConsent.s} con=${nn.s}`);
check('R-f2 la nota queda cifrada en la base (sin el texto plano) y el texto malicioso no daña la base', !!raw && !raw.includes('NOTA-QA42') && !raw.includes('<script>') && usersOk, `cifrada=${!!raw && !raw.includes('NOTA-QA42')} usuariosIntactos=${usersOk}`);
const noteId = nn.json?.note?.id ?? (await q('select id from "ClinicalNotes" order by id desc limit 1'))[0]?.id;
const t2put = await call('PUT', '/api/therapist/notas/' + noteId, { token: T2.token, body: { content: 'SECUESTRADA-QA42' } }); const t2get = await call('GET', `/api/therapist/pacientes/${P.id}/historia`, { token: T2.token }); const pRead = await call('GET', `/api/therapist/pacientes/${P.id}/historia`, { token: P.token }); const bRead = await call('GET', `/api/therapist/pacientes/${P.id}/historia`, { token: B.token });
const rawAfter = (await q('select content from "ClinicalNotes" where id=$1', [noteId]))[0]?.content;
check('R-f3 un profesional no asignado no edita ni lee la nota; la persona y otra persona tampoco acceden a la ruta profesional; la nota no cambió', [403, 404].includes(t2put.s) && [403, 404].includes(t2get.s) && pRead.s === 403 && bRead.s === 403 && rawAfter === raw, `T2 put=${t2put.s} get=${t2get.s} persona=${pRead.s} otra=${bRead.s} intacta=${rawAfter === raw}`);
await call('PUT', '/api/consents/therapist_sharing', { token: P.token, body: { status: 'revoked' } }); const afterRev = await call('GET', `/api/therapist/pacientes/${P.id}/historia`, { token: T1.token }); const revText = afterRev.text.includes('NOTA-QA42');
check('R-f4 al revocar, el profesional pierde la lectura inmediatamente y la respuesta no trae la nota', [403, 404].includes(afterRev.s) && !revText, `status=${afterRev.s} contieneNota=${revText}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-42-complemento.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES42B ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
