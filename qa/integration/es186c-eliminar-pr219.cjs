// [QA-Claude] ES-186 parte C · PR #219 («Eliminar» de administración = solicitud ES-23 para personas; profesional/junta/administración solo sin dependencias) · servidor REAL, Postgres con migraciones, pool 5, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log> [MODE=main] node qa/integration/es186c-eliminar-pr219.cjs
// MODE=main: control; los mismos pasos contra main para medir el «antes» (500 con datos, 409 al repetir). Los resultados se informan, no se exigen.
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const MODE = E.MODE || 'pr'; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 800) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 800) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 800) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 800) })); };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa186c-${tag}-${stamp}@example.test`; const password = randomBytes(12).toString('base64url') + 'aA1!'; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA186C ' + tag, email, password }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const SU = await mk('su', 'superadmin'), SU2 = await mk('su2', 'superadmin'), AD = await mk('ad', 'admin'), AD2 = await mk('ad2', 'admin'), TA = await mk('ta', 'therapist'), BO = await mk('bo', 'board');
  const D = (u, id) => call(u, 'DELETE', `/api/admin/usuarios/${id}`); const A = '/api/admin/usuarios';
  const audit = (extra = '', p = []) => q(`select * from "AdminAuditEntries" ${extra} order by id`, p).catch(() => []); const delReq = async (id) => (await q('select count(*)::int n from "DeletionRequests" where "UserId"=$1', [id]))[0].n;
  const row = async (id) => (await q('select id,active,"therapistId",role from "Users" where id=$1', [id]))[0];
  // FK hacia Users
  const fks = await q(`select kcu.table_name t, kcu.column_name c, rc.delete_rule r from information_schema.referential_constraints rc join information_schema.key_column_usage kcu on kcu.constraint_name=rc.constraint_name and kcu.constraint_schema=rc.constraint_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=rc.unique_constraint_name where ccu.table_name='Users' and ccu.column_name='id' and kcu.table_schema='public' order by 1,2`);
  info('FK', `${fks.length} claves foráneas hacia Users: ` + fks.map(f => `${f.t}.${f.c}(${f.r})`).join(', '));
  // sembrador genérico: una fila en `t` con la columna `c` = userId
  const seedRow = async (t, c, uid) => {
    const cols = await q(`select column_name n,data_type d,character_maximum_length l,udt_name u from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null and column_name<>'id'`, [t]);
    const names = [], vals = [];
    for (const k of cols) { names.push('"' + k.n + '"'); let v;
      if (k.n === c) v = uid; else if (/timestamp/.test(k.d)) v = 'now()'; else if (k.d === 'date') v = 'current_date'; else if (/int|numeric|real|double/.test(k.d)) v = '1'; else if (k.d === 'boolean') v = 'false'; else if (/json/.test(k.d)) v = /jsonb/.test(k.d) ? "'[]'::jsonb" : "'[]'::json"; else if (k.u === 'uuid') v = 'gen_random_uuid()'; else v = `'${('x' + randomBytes(3).toString('hex')).slice(0, k.l || 8)}'`;
      vals.push(typeof v === 'number' ? String(v) : v); }
    if (!names.includes('"' + c + '"')) { names.push('"' + c + '"'); vals.push(String(uid)); }
    await q(`insert into "${t}"(${names.join(',')}) values (${vals.join(',')})`); };

  // ---------- D1 persona → solicitud
  const P1 = await mk('p1'); await q('update "Users" set "therapistId"=$1 where id=$2', [TA.id, P1.id]);
  await call(P1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' }); await q(`insert into "MoodLogs"("UserId",checkin_mood,checkout_mood,date,"createdAt","updatedAt") values ($1,3,4,current_date,now(),now())`, [P1.id]); await q(`insert into "SessionRatings"("UserId",rating,date,"createdAt","updatedAt") values ($1,4,current_date,now(),now())`, [P1.id]);
  const seesBefore = (await call(TA, 'GET', `/api/therapist/pacientes/${P1.id}/historia`)).status; const progBefore = (await call(P1, 'GET', '/api/user/progress')).status;
  const r1 = await D(SU, P1.id); const after = await row(P1.id); const moods = (await q('select count(*)::int n from "MoodLogs" where "UserId"=$1', [P1.id]))[0].n;
  info('D1-control', `[${MODE}] DELETE persona con vínculo y datos → ${r1.status} ${r1.json?.code || r1.json?.error || ''}; fila Users tras la llamada: ${after ? 'existe' : 'BORRADA'}`);
  if (MODE === 'main') {
    const Pm = await mk('pm'); const seededM = []; for (const f of fks) { if (f.t === 'AdminAuditEntries') continue; try { await seedRow(f.t, f.c, Pm.id); seededM.push(f.t); } catch { /* */ } }
    const rm = await D(SU, Pm.id); const rm2 = await D(SU, Pm.id); const Pn = await mk('pn'); const rn = await D(SU, Pn.id); const rn2 = await D(SU, Pn.id);
    info('CONTROL-main', 'persona con filas en ' + seededM.length + ' tablas → DELETE ' + rm.status + ' ' + (rm.json?.error || rm.json?.message || '') + ' (existe después: ' + (!!(await row(Pm.id))) + ') · repetir → ' + rm2.status + ' · persona sin datos → ' + rn.status + ' y repetir → ' + rn2.status);
    fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-186c-eliminar-main.json'), JSON.stringify({ pr: 219, mode: MODE, results }, null, 2)); await db.end(); process.exit(0);
  }
  check('D1a DELETE a una persona → 202 `deletion_requested` `repeated:false`; NO hay DELETE físico (la fila de Users y sus datos siguen); UNA `DeletionRequest`; queda inactiva', r1.status === 202 && r1.json.code === 'deletion_requested' && r1.json.repeated === false && !!after && after.active === false && moods === 1 && (await delReq(P1.id)) === 1, `${r1.status} ${JSON.stringify(r1.json)?.slice(0, 160)} existe=${!!after} moods=${moods}`);
  const prog = await call(P1, 'GET', '/api/user/progress'); const lg = await call(null, 'POST', '/api/login', { email: P1.email, password: P1.password }); const un = await call(SU, 'PUT', `${A}/${P1.id}/unlock`, {}); const re = await call(SU, 'PUT', `${A}/${P1.id}`, { active: true });
  check('D1b la persona pierde el acceso AL INSTANTE: su token vigente → 401/403 (antes respondía ' + progBefore + '), el inicio de sesión se bloquea (403/401), y desbloquear / reactivar no lo levantan (409)', progBefore === 200 && [401, 403].includes(prog.status) && [401, 403].includes(lg.status) && un.status === 409 && re.status === 409, `token=${prog.status} login=${lg.status} unlock=${un.status} reactivar=${re.status}`);
  const sees = await call(TA, 'GET', `/api/therapist/pacientes/${P1.id}/historia`); const lista = await call(TA, 'GET', '/api/therapist/pacientes'); const inList = JSON.stringify(lista.json || '').includes(String(P1.id));
  check('D1c el profesional queda desvinculado (`therapistId` NULL) y deja de ver a la persona (antes la veía: ' + seesBefore + ') ni en la lista', seesBefore === 200 && after.therapistId === null && [403, 404].includes(sees.status) && !(lista.json?.some?.(x => x.id === P1.id)), `vinculo=${after.therapistId} historia=${sees.status} enLista=${inList}`);
  const body202 = r1.text; check('D1d la respuesta no contiene correo, nombre ni ids de otras cuentas', !body202.includes(P1.email) && !/QA186C/.test(body202), body202.slice(0, 200));

  // ---------- D2 idempotencia
  const r1b = await D(SU, P1.id);
  check('D2a repetir el DELETE → 202 `repeated:true`, sigue UNA `DeletionRequest` y la fila no se borra', r1b.status === 202 && r1b.json.repeated === true && (await delReq(P1.id)) === 1 && !!(await row(P1.id)), `${r1b.status} ${JSON.stringify(r1b.json)?.slice(0, 120)}`);
  info('D2-control', `[${MODE}] repetir el DELETE → ${r1b.status} ${r1b.json?.code || r1b.json?.error || ''}`);
  const P2 = await mk('p2'); const sim = await Promise.all(Array.from({ length: 8 }, () => D(SU, P2.id))); const aud = await audit(`where action='user.delete_request' and "targetId"=$1`, [P2.id]);
  check('D2b 8 DELETE simultáneos (pool 5): todos 202 (1× `repeated:false` + 7× `repeated:true`), UNA solicitud, UNA entrada de auditoría, 0 5xx, sin transacciones colgadas', sim.every(r => r.status === 202) && sim.filter(r => r.json?.repeated === false).length === 1 && sim.filter(r => r.json?.repeated === true).length === 7 && (await delReq(P2.id)) === 1 && aud.length === 1 && (await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%'`))[0].n === 0, sim.map(r => r.status + (r.json?.repeated ? 'r' : 'n')).join(' ') + ` auditoría=${aud.length}`);
  const aud1 = (await audit(`where action='user.delete_request' and "targetId"=$1`, [P1.id]));
  check('D2c la repetida (D2a) NO audita otra vez: UNA sola entrada `user.delete_request` para P1, con actor, rol, tipo y resultado `ok`', aud1.length === 1 && aud1[0].actorId === SU.id && aud1[0].actorRole === 'superadmin' && aud1[0].targetType === 'user' && aud1[0].result === 'ok', JSON.stringify(aud1.map(a => ({ a: a.action, r: a.result, t: a.targetType }))));

  // ---------- D3 persona con datos en todas las tablas posibles
  const P3 = await mk('p3'); const seeded = [], skipped = [];
  for (const f of fks) { if (['AdminAuditEntries'].includes(f.t)) continue; try { await seedRow(f.t, f.c, P3.id); seeded.push(f.t + '.' + f.c); } catch (e) { skipped.push(f.t + '.' + f.c + ':' + (e.code || e.message.slice(0, 20))); } }
  const cnt = async (uid) => { const o = {}; for (const f of fks) { if (f.t === 'AdminAuditEntries') continue; try { o[f.t + '.' + f.c] = (await q(`select count(*)::int n from "${f.t}" where "${f.c}"=$1`, [uid]))[0].n; } catch { /* */ } } return o; };
  const c0 = await cnt(P3.id); const r3 = await D(SU, P3.id); const c1 = await cnt(P3.id); const u3 = await row(P3.id);
  info('D3-control', `[${MODE}] persona con filas en ${seeded.length} tablas (sin sembrar ${skipped.length}: ${skipped.slice(0, 6).join(', ')}) → DELETE ${r3.status} ${r3.json?.code || r3.json?.error || ''}; fila Users ${u3 ? 'existe' : 'BORRADA'}`);
  check(`D3 persona con datos en ${seeded.length} tablas (carrera, rutas, evidencias, consentimientos, chat…): 202 sin 500, NINGUNA fila de esas tablas se pierde ni se duplica al solicitar, y la cuenta sigue en Users`, r3.status === 202 && JSON.stringify(c0) === JSON.stringify(c1) && !!u3, `${r3.status} filas antes=${Object.values(c0).reduce((a, b) => a + b, 0)} después=${Object.values(c1).reduce((a, b) => a + b, 0)}`);

  // ---------- D4 no personas
  const free = {}; for (const role of ['therapist', 'board', 'admin']) { const t = await mk('free' + role, role); const r = await D(SU, t.id); free[role] = { r, gone: !(await row(t.id)), tok: (await call(t, 'GET', '/api/user/progress')).status, req: await delReq(t.id) }; }
  check('D4a profesional, junta y administración SIN dependencias: 200 `deleted`, la fila desaparece, no se crea solicitud ES-23, sus sesiones quedan revocadas (token → 401/403)', Object.values(free).every(x => x.r.status === 200 && x.r.json?.code === 'deleted' && x.gone && x.req === 0 && [401, 403].includes(x.tok)), JSON.stringify(Object.fromEntries(Object.entries(free).map(([k, v]) => [k, [v.r.status, v.gone, v.tok]]))));
  const sinDel = (await audit(`where action='user.delete' and result='ok'`)).length; check('D4b cada eliminación física deja su entrada `user.delete`', sinDel >= 3, 'entradas=' + sinDel);
  // con dependencias: una por cada tabla con FK hacia Users
  const dep = [], bad500 = [], okDel = [];
  for (const f of fks) {
    if (['AdminAuditEntries'].includes(f.t)) continue; const t = await mk('dep' + dep.length, 'admin'); let seededOk = true; try { await seedRow(f.t, f.c, t.id); } catch { seededOk = false; }
    if (!seededOk) { dep.push(`${f.t}.${f.c}:sin-sembrar`); continue; }
    const r = await D(SU, t.id); const still = !!(await row(t.id)); const left = (await q(`select count(*)::int n from "${f.t}" where "${f.c}"=$1`, [t.id]).catch(() => [{ n: -1 }]))[0].n;
    dep.push(`${f.t}.${f.c}:${r.status}${r.json?.code ? '/' + r.json.code : ''}${still ? '' : '/borrado'}${left > 0 && !still ? '/HUERFANO' : ''}`);
    if (r.status >= 500) bad500.push(f.t + '.' + f.c); if (r.status === 200) okDel.push({ t: f.t, c: f.c, id: t.id, left });
  }
  info('D4-detalle', dep.join(' ; '));
  check('D4c con una dependencia en CADA tabla que apunta a Users: nunca 500; 409 `has_dependent_data` (la cuenta y la fila dependiente siguen) o 200 solo cuando la fila se desvincula/borra sin dejar huérfanos', bad500.length === 0 && !dep.some(x => /HUERFANO/.test(x)), bad500.join(',') || `${dep.length} tablas probadas`);
  const th = await mk('thdep', 'therapist'); const pp = await mk('ppdep'); await q('update "Users" set "therapistId"=$1 where id=$2', [th.id, pp.id]); const rth = await D(SU, th.id); const ppAfter = await row(pp.id);
  check('D4d profesional con una persona vinculada → 409 `has_dependent_data`, el profesional y el vínculo siguen intactos (rollback completo)', rth.status === 409 && rth.json.code === 'has_dependent_data' && !!(await row(th.id)) && ppAfter.therapistId === th.id, `${rth.status} ${rth.json?.code}`);
  // invitación aceptada y restablecimientos
  const ad3 = await mk('adinv', 'admin'); await q(`insert into "Invitations"(email,role,"invitedBy","tokenHash",locale,"expiresAt","acceptedUserId","usedAt","createdAt","updatedAt") values ('inv-${stamp}@example.test','admin',$1,$2,'es',now()+interval '1 day',$3,now(),now(),now())`, [SU.id, randomBytes(16).toString('hex'), ad3.id]); const rinv = await D(SU, ad3.id); const inv = (await q(`select "acceptedUserId" from "Invitations" where email=$1`, [`inv-${stamp}@example.test`]))[0];
  check('D4e invitación ACEPTADA por la cuenta: la eliminación procede (200) y la invitación queda desvinculada (`acceptedUserId` NULL), sin huérfanos', rinv.status === 200 && inv && inv.acceptedUserId === null, `${rinv.status} ${JSON.stringify(inv)}`);
  const orphanCols = await q(`select table_name t, column_name c from information_schema.columns where table_schema='public' and column_name in ('UserId','userId') and table_name not in ('Users')`); const delIds = Object.values(free).length ? await q(`select "targetId" i from "AdminAuditEntries" where action='user.delete' and result='ok'`) : []; let orph = 0; const orphList = [];
  for (const c of orphanCols.filter(c => c.t !== 'AuthRevocations')) { for (const { i } of delIds) { try { const n = (await q(`select count(*)::int n from "${c.t}" where "${c.c}"=$1`, [i]))[0].n; if (n) { orph += n; orphList.push(`${c.t}.${c.c}(${i}):${n}`); } } catch { /* */ } } }
  const authRev = (await q(`select count(*)::int n from "AuthRevocations" where "UserId" = any($1)`, [delIds.map(x => x.i)]).catch(() => [{ n: -1 }]))[0].n; info('D4g AuthRevocations', authRev + ' filas de AuthRevocations (solo UserId y fecha de revocación) quedan para las ' + delIds.length + ' cuentas borradas: es la marca que mantiene revocados sus tokens (ES-18; revokeUserSessions se llama después del borrado, igual que en main); no contiene datos personales');
  check('D4f tras las eliminaciones físicas, ninguna tabla con columna `UserId`/`userId` conserva filas de una cuenta borrada (0 huérfanos; se excluye AuthRevocations, informada aparte en D4g)', orph === 0, `tablas revisadas=${orphanCols.length} cuentas borradas=${delIds.length} huérfanos=${orph} ${orphList.slice(0, 4).join(',')}`);

  // ---------- D5 reglas previas
  const T5 = await mk('t5'); const adp = await D(AD, T5.id); const tp = await D(TA, T5.id); const PX = await mk('px'); const pp5 = await D(PX, T5.id); const bp = await D(BO, T5.id); const an = await D(null, T5.id); const self = await D(SU, SU.id); const sup = await D(SU, SU2.id); const ad2 = await D(AD, AD2.id); const nf = await D(SU, 999999999);
  check('D5a solo superadmin: admin, profesional, persona, junta → 403; sin sesión 401/403; no te eliminas a ti mismo (403); no se elimina a un superadmin (403); admin sobre admin 403; inexistente 404; y nada de eso cambia cuentas', [adp, tp, pp5, bp, self, sup, ad2].every(r => r.status === 403) && [401, 403].includes(an.status) && nf.status === 404 && !!(await row(T5.id)) && !!(await row(SU.id)) && !!(await row(SU2.id)) && !!(await row(AD2.id)), [adp, tp, pp5, bp, an, self, sup, ad2, nf].map(r => r.status).join());
  const den = await audit(`where result='denied' and action='user.delete'`); check('D5b las denegaciones de admin/profesional/persona/junta dejan entrada `denied` `user.delete`', den.length >= 1, `entradas denied=${den.length}`);
  const hostile = ['abc', '0', '-1', '1234567890', '99999999999999999999', '1;drop', '%00', '1.5', ' 1', '١٢٣']; const hs = []; for (const h of hostile) { const r = await call(SU, 'DELETE', `${A}/${encodeURIComponent(h)}`); hs.push(h + '→' + r.status); }
  const s500 = hs.filter(x => /→5\d\d$/.test(x)); info('D5c ids hostiles', hs.join(' ; ') + (s500.length ? ` · con 5xx (mismo patrón preexistente que ES-262): ${s500.join(',')}` : ''));
  check('D5d ids hostiles en DELETE → 4xx sin 5xx (si aparece alguno es el patrón ES-262 preexistente y se informa)', s500.length === 0, s500.join(',') || 'todos 4xx');

  // ---------- A1 auditoría atómica
  await db.query(`CREATE OR REPLACE FUNCTION qa_f() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'qa fail'; END $$`);
  const P4 = await mk('p4'); await db.query(`CREATE TRIGGER qa_f BEFORE INSERT ON "AdminAuditEntries" FOR EACH ROW EXECUTE FUNCTION qa_f()`); const a1 = await D(SU, P4.id); const a1row = await row(P4.id); const a1tok = (await call(P4, 'GET', '/api/user/progress')).status; await db.query('DROP TRIGGER qa_f ON "AdminAuditEntries"');
  check('A1a con la auditoría FALLANDO: 5xx y NO se crea la solicitud, la persona sigue activa y su token sigue valiendo (todo en la misma transacción)', a1.status >= 500 && (await delReq(P4.id)) === 0 && a1row.active === true && a1tok === 200 && !/qa fail|stack/i.test(a1.text), `${a1.status} solicitudes=${await delReq(P4.id)} activa=${a1row.active} token=${a1tok}`);
  const P5 = await mk('p5'); const before = (await audit(`where "targetId"=$1`, [P5.id])).length; await db.query(`CREATE TRIGGER qa_f BEFORE INSERT ON "DeletionRequests" FOR EACH ROW EXECUTE FUNCTION qa_f()`); const a2 = await D(SU, P5.id); await db.query('DROP TRIGGER qa_f ON "DeletionRequests"');
  check('A1b con la solicitud FALLANDO: 5xx y NO queda entrada de auditoría ni cambio en la cuenta', a2.status >= 500 && (await audit(`where "targetId"=$1`, [P5.id])).length === before && (await row(P5.id)).active === true, `${a2.status}`);
  const lec = await call(SU, 'GET', '/api/superadmin/audit?action=user.delete_request&limit=100'); const lecAll = await call(SU, 'GET', '/api/superadmin/audit?limit=100');
  check('A1c la lectura de auditoría acepta la acción nueva (filtro `action=user.delete_request` → 200 con esas entradas) y no contiene correos, nombres ni notas', lec.status === 200 && lec.json.entries.length >= 2 && lec.json.entries.every(x => x.action === 'user.delete_request') && ![SU, AD, TA, P1, P2, BO].some(u => lecAll.text.includes(u.email)) && !/QA186C/.test(lecAll.text), `${lec.status} entradas=${lec.json?.entries?.length}`);
  const vocab = await audit(); const okAct = new Set(['user.update', 'user.delete', 'user.delete_request', 'user.assign_therapist', 'user.set_plan', 'user.unlock', 'user.reset_link', 'invitation.create', 'invitation.revoke', 'matching.confirm', 'plan_request.approve', 'plan_request.reject']);
  check('A1d vocabulario cerrado en TODAS las filas de auditoría (actorRole, targetType, action, result): ningún texto libre', vocab.every(x => ['superadmin', 'admin', 'therapist', 'user', 'board', null].includes(x.actorRole) && ['user', 'invitation', 'matching_request', 'plan_request', null].includes(x.targetType) && okAct.has(x.action) && ['ok', 'denied', 'failed'].includes(x.result)), `filas=${vocab.length}`);

  // ---------- P1 privacidad
  const log = (() => { try { return fs.readFileSync(E.SRVLOG, 'utf8'); } catch { return ''; } })(); const emails = [SU, SU2, AD, AD2, TA, BO, P1, P2, P3, P4, P5].map(u => u.email);
  check('P1a el registro del servidor no contiene correos ni contenido de las cuentas eliminadas o solicitadas', !emails.some(e => log.includes(e)) && !/QA186C/.test(log), 'log ' + log.length + ' bytes');
  const bi = await call(SU, 'DELETE', `${A}/${th.id}`); check('P1b el 409 es bilingüe y no revela cuántos datos tiene la cuenta ni cuáles', /No se puede eliminar/.test(bi.json?.error || '') && /cannot be deleted/.test(bi.json?.error || '') && !/\d+ (filas|registros|rows)/i.test(bi.text), bi.text.slice(0, 200));

  const fails = results.filter(r => r.ok === false); console.log(`\nRESUMEN ${MODE} ${results.filter(r => r.ok).length}/${results.filter(r => 'ok' in r).length} ok; fallos: ${fails.map(f => f.id.slice(0, 4)).join(', ') || 'ninguno'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-186c-eliminar-${MODE}.json`), JSON.stringify({ pr: 219, mode: MODE, head: E.QA_HEAD || null, results }, null, 2)); await db.end(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
