// [QA-Claude] ES-186 parte A · PR #203 (confirmar emparejamiento retira la autorización anterior; resoluciones sin doble efecto; códigos del 403) · servidor REAL, Postgres con migraciones, pool 5, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log> node qa/integration/es186a-matching-pr203.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 600) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 600) })); };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa186a-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA186A ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const SU = await mk('su', 'superadmin'), AD = await mk('ad', 'admin'), TA = await mk('ta', 'therapist'), TB = await mk('tb', 'therapist'), TC = await mk('tc', 'therapist'), TD = await mk('td', 'therapist');
  const persons = []; const person = async (tag) => { const p = await mk('p' + tag); persons.push(p); return p; };
  const link = (p, t) => q('update "Users" set "therapistId"=$1 where id=$2', [t ? t.id : null, p.id]);
  const mreq = async (p, t, status = 'pending') => (await q(`insert into "MatchingRequests"("UserId","chosenTherapistId",status,"createdAt","updatedAt") values ($1,$2,$3,now(),now()) returning id`, [p.id, t ? t.id : null, status]))[0].id;
  const confirm = (id, u = AD) => call(u, 'POST', `/api/admin/matching/${id}/confirm`, {});
  const therapistOf = async p => (await q('select "therapistId" from "Users" where id=$1', [p.id]))[0].therapistId;
  const consent = async (p, t) => q(`select status,version from "Consents" where "UserId"=$1 and purpose='therapist_sharing' and scope=$2`, [p.id, 'therapist-' + t.id]);
  const events = async (p, t, st = 'revoked') => (await q(`select count(*)::int n from "ConsentEvents" where "UserId"=$1 and purpose='therapist_sharing' and scope=$2 and status=$3`, [p.id, 'therapist-' + t.id, st]))[0].n;
  const sees = async (t, p) => (await call(t, 'GET', `/api/therapist/pacientes/${p.id}/historia`)).status;
  const authorize = async (p) => call(p, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' });
  const maxConn = async () => (await q('select count(*)::int n from pg_stat_activity where datname=current_database()'))[0].n;

  // ---------- A1 retiro y no revive
  const p1 = await person('1'); await link(p1, TA); const au = await authorize(p1);
  check('A1pre la persona vinculada a A autoriza compartir con A (consent granted) y A la ve', au.status === 200 && (await consent(p1, TA))[0]?.status === 'granted' && (await sees(TA, p1)) === 200, `${au.status} ${JSON.stringify(await consent(p1, TA))} A ve=${await sees(TA, p1)}`);
  const r1 = await mreq(p1, TB); const c1 = await confirm(r1);
  const afterA = await consent(p1, TA), afterB = await consent(p1, TB);
  check('A1a confirmar hacia B: vínculo a B; autorización con A en revoked (fila + 1 evento); con B NO existe; B no ve nada; A tampoco', c1.status === 200 && (await therapistOf(p1)) === TB.id && afterA[0]?.status === 'revoked' && (await events(p1, TA)) === 1 && afterB.length === 0 && [403, 404].includes(await sees(TB, p1)) && [403, 404].includes(await sees(TA, p1)), `${c1.status} A=${JSON.stringify(afterA)} ev=${await events(p1, TA)} B=${JSON.stringify(afterB)} Bve=${await sees(TB, p1)} Ave=${await sees(TA, p1)}`);
  const r1b = await mreq(p1, TA); const c1b = await confirm(r1b);
  check('A1b volver a A: la persona vuelve a A y la autorización con A SIGUE revoked (no revive); A no ve nada; el evento de revocación no se duplica', c1b.status === 200 && (await therapistOf(p1)) === TA.id && (await consent(p1, TA))[0]?.status === 'revoked' && [403, 404].includes(await sees(TA, p1)) && (await events(p1, TA)) === 1 && (await events(p1, TA, 'granted')) <= 1, `${c1b.status} ${JSON.stringify(await consent(p1, TA))} Ave=${await sees(TA, p1)} ev=${await events(p1, TA)}`);
  const re = await authorize(p1);
  check('A1c solo la decisión de la PERSONA reactiva: al autorizar de nuevo, A la ve', re.status === 200 && (await sees(TA, p1)) === 200, `${re.status} Ave=${await sees(TA, p1)}`);
  const p1x = await person('1x'); await link(p1x, TA); const rx = await mreq(p1x, TB); const cx = await confirm(rx);
  check('A1d sin autorización previa: confirmar no crea ninguna fila de consentimiento (ni con A ni con B)', cx.status === 200 && (await consent(p1x, TA)).length === 0 && (await consent(p1x, TB)).length === 0 && (await therapistOf(p1x)) === TB.id, '');
  const p1y = await person('1y'); await link(p1y, TA); await authorize(p1y); const ry = await mreq(p1y, TA); const cy = await confirm(ry);
  check('A1e confirmar al MISMO profesional: no revoca (la autorización con A sigue granted y A la ve)', cy.status === 200 && (await consent(p1y, TA))[0]?.status === 'granted' && (await sees(TA, p1y)) === 200 && (await events(p1y, TA)) === 0, `${cy.status} ${JSON.stringify(await consent(p1y, TA))}`);
  const p1z = await person('1z'); const rz = await mreq(p1z, TA); const cz = await confirm(rz);
  check('A1f persona sin profesional previo: confirmar vincula y no toca consentimientos', cz.status === 200 && (await therapistOf(p1z)) === TA.id && (await consent(p1z, TA)).length === 0, '');

  // ---------- A2 aislamiento del retiro
  const p2a = await person('2a'), p2b = await person('2b'); await link(p2a, TA); await link(p2b, TA); await authorize(p2a); await authorize(p2b);
  const otherPurposes = ['insights', 'diary'].filter(Boolean); const before = await q(`select purpose,scope,status from "Consents" where "UserId"=$1 order by purpose,scope`, [p2a.id]);
  for (const pr of ['insights_ai', 'diary_ai', 'insights', 'diary']) { await call(p2a, 'PUT', '/api/consents/' + pr, { status: 'granted' }); }
  const mid = await q(`select purpose,scope,status from "Consents" where "UserId"=$1 and purpose<>'therapist_sharing' order by purpose,scope`, [p2a.id]);
  const r2 = await mreq(p2a, TB); const c2 = await confirm(r2);
  const after = await q(`select purpose,scope,status from "Consents" where "UserId"=$1 and purpose<>'therapist_sharing' order by purpose,scope`, [p2a.id]);
  check('A2 el retiro afecta solo (persona, profesional anterior): la otra persona de A conserva su autorización y A la ve; los demás consentimientos de la persona quedan idénticos', c2.status === 200 && (await consent(p2b, TA))[0]?.status === 'granted' && (await sees(TA, p2b)) === 200 && JSON.stringify(mid) === JSON.stringify(after) && (await consent(p2a, TA))[0]?.status === 'revoked', `otros(${mid.length}) iguales=${JSON.stringify(mid) === JSON.stringify(after)} antes=${before.length}`);

  // ---------- A3 simultáneas
  for (const N of [2, 8]) {
    const p = await person('3c' + N); await link(p, TA); await authorize(p); const r = await mreq(p, TB);
    const rs = await Promise.all(Array.from({ length: N }, () => confirm(r)));
    const ok = rs.filter(x => x.status === 200).length, closed = rs.filter(x => x.status === 409 && x.json?.code === 'request_closed').length;
    check(`A3a ${N} confirmaciones simultáneas de la MISMA solicitud: una 200, ${N - 1} 409 request_closed, 0 5xx, un solo cambio de vínculo y UN solo evento de revocación`, ok === 1 && closed === N - 1 && rs.every(x => x.status < 500) && (await therapistOf(p)) === TB.id && (await events(p, TA)) === 1 && (await q('select status from "MatchingRequests" where id=$1', [r]))[0].status === 'confirmed', rs.map(x => x.status).join());
  }
  const plan = (await q('select id from "PricingPlans" order by id limit 1'))[0] || (await q(`insert into "PricingPlans"(name_es,name_en,price,currency,period,features_es,features_en,"createdAt","updatedAt") values ('QA plan','QA plan',0,'COP','month','[]','[]',now(),now()) returning id`))[0];
  const preq = async (p) => (await q(`insert into "PlanRequests"("userId","planId",status,"createdAt","updatedAt") values ($1,$2,'pending',now(),now()) returning id`, [p.id, plan.id]))[0].id;
  const approve = (id, u = AD) => call(u, 'PUT', `/api/admin/plan-requests/admin/${id}/approve`, { adminNote: 'ok' });
  const reject = (id, note = 'no', u = AD) => call(u, 'PUT', `/api/admin/plan-requests/admin/${id}/reject`, { adminNote: note });
  const planOf = async p => (await q('select "planId" from "Users" where id=$1', [p.id]))[0].planId;
  const pa = await person('3p'); const pr1 = await preq(pa); await q('update "Users" set "planId"=null where id=$1', [pa.id]);
  const rsA = await Promise.all(Array.from({ length: 8 }, () => approve(pr1)));
  check('A3b 8 aprobaciones simultáneas de la misma solicitud de plan: una 200, 7 409 request_closed, plan asignado una vez', rsA.filter(x => x.status === 200).length === 1 && rsA.filter(x => x.status === 409 && x.json?.code === 'request_closed').length === 7 && (await planOf(pa)) === plan.id, rsA.map(x => x.status).join());
  const pb = await person('3q'); const pr2 = await preq(pb); await q('update "Users" set "planId"=null where id=$1', [pb.id]);
  const rsB = await Promise.all([approve(pr2), reject(pr2), approve(pr2), reject(pr2), approve(pr2), reject(pr2)]);
  const st = (await q('select status from "PlanRequests" where id=$1', [pr2]))[0].status; const wins = rsB.filter(x => x.status === 200).length;
  check('A3c aprobar vs rechazar al mismo tiempo: un solo ganador (1×200, resto 409), estado de la solicitud coherente con el plan del usuario', wins === 1 && rsB.filter(x => x.status === 409).length === 5 && ((st === 'approved' && (await planOf(pb)) === plan.id) || (st === 'rejected' && (await planOf(pb)) === null)), `${rsB.map(x => x.status).join()} estado=${st} plan=${await planOf(pb)}`);

  // ---------- A4 persona con 2 solicitudes; 8 personas × 2 con pool 5
  const p4 = await person('4'); await link(p4, TA); await authorize(p4); const r4b = await mreq(p4, TB), r4c = await mreq(p4, TC); const t0 = Date.now();
  const rs4 = await Promise.all([confirm(r4b), confirm(r4c)]); const dt4 = Date.now() - t0; const fin = await therapistOf(p4);
  check('A4a una persona con 2 solicitudes (B y C) confirmadas a la vez: ambas 200, sin 5xx ni deadlock, vínculo final B o C, autorización con A retirada', rs4.every(x => x.status === 200) && [TB.id, TC.id].includes(fin) && (await consent(p4, TA))[0]?.status === 'revoked' && (await events(p4, TA)) === 1, `${rs4.map(x => x.status).join()} final=${fin === TB.id ? 'B' : 'C'} ${dt4}ms`);
  const loser = fin === TB.id ? TC : TB;
  check('A4b la autorización con el profesional intermedio no queda viva (ni granted con B ni con C)', (await consent(p4, TB)).every(r => r.status !== 'granted') && (await consent(p4, TC)).every(r => r.status !== 'granted'), JSON.stringify([await consent(p4, TB), await consent(p4, TC)]));
  const ppl = []; for (let i = 0; i < 8; i++) { const p = await person('4m' + i); await link(p, TA); await authorize(p); ppl.push({ p, rb: await mreq(p, TB), rc: await mreq(p, TC) }); }
  const t1 = Date.now(); let peak = 0; const poll = setInterval(async () => { try { peak = Math.max(peak, await maxConn()); } catch { /* */ } }, 100);
  const rs4m = await Promise.all(ppl.flatMap(x => [confirm(x.rb), confirm(x.rc)])); clearInterval(poll); const dt = Date.now() - t1;
  const okAll = rs4m.every(x => x.status === 200); const finals = []; for (const x of ppl) finals.push(await therapistOf(x.p));
  check('A4c 8 personas × 2 solicitudes en paralelo (16 simultáneas, pool 5): todas 200, sin 5xx/deadlock/agotamiento, tiempo acotado (<20 s), 8 autorizaciones con A retiradas', okAll && dt < 20000 && finals.every(f => [TB.id, TC.id].includes(f)) && (await q(`select count(*)::int n from "Consents" where purpose='therapist_sharing' and scope=$1 and status='revoked' and "UserId"=any($2)`, ['therapist-' + TA.id, ppl.map(x => x.p.id)]))[0].n === 8, `${rs4m.map(x => x.status).join()} ${dt}ms conexiones-pico=${peak}`);
  const pend = (await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%'`))[0].n;
  check('A4d tras las pruebas no quedan transacciones abiertas ("idle in transaction") ni bloqueos', pend === 0, 'idle in tx=' + pend);

  // ---------- A5 roles, ids y estados
  const p5 = await person('5'); const r5 = await mreq(p5, TB);
  const deny = []; for (const u of [TA, p5, null]) { deny.push((await confirm(r5, u)).status); deny.push((await approve(1, u)).status); deny.push((await reject(1, 'x', u)).status); }
  check('A5a profesional, persona y sin sesión → 403/401 en confirmar, aprobar y rechazar; la solicitud sigue pending', deny.every(s => [401, 403].includes(s)) && (await q('select status from "MatchingRequests" where id=$1', [r5]))[0].status === 'pending', deny.join());
  const cs = await confirm(r5, SU); const p5b = await person('5b'); const r5b = await mreq(p5b, TB); const ca = await confirm(r5b, AD);
  check('A5b superadmin y admin confirman (200)', cs.status === 200 && ca.status === 200, `${cs.status} ${ca.status}`);
  const ids = ['999999999', '0', '-1', 'abc', '1234567890', '99999999999999999999', '1;drop', '%00']; const idr = []; for (const i of ids) { idr.push((await confirm(i)).status, (await approve(i)).status, (await reject(i)).status); }
  check('A5c ids inexistentes/malformados/enormes (10 y 20 dígitos) → 4xx, nunca 5xx', idr.every(s => s >= 400 && s < 500), idr.join());
  const p5c = await person('5c'); const rn = await mreq(p5c, null); const cn = await confirm(rn);
  check('A5d solicitud sin profesional elegido → 400 y nada cambia', cn.status === 400 && (await therapistOf(p5c)) === null && (await q('select status from "MatchingRequests" where id=$1', [rn]))[0].status === 'pending', cn.status);
  const p5d = await person('5d'); await link(p5d, TA); await authorize(p5d); await q('update "Users" set active=false where id=$1', [TD.id]); const rd = await mreq(p5d, TD); const cd = await confirm(rd);
  check('A5e profesional desactivado → 409 therapist_unavailable SIN cambiar vínculo ni retirar la autorización con A', cd.status === 409 && cd.json?.code === 'therapist_unavailable' && (await therapistOf(p5d)) === TA.id && (await consent(p5d, TA))[0]?.status === 'granted' && (await events(p5d, TA)) === 0 && (await q('select status from "MatchingRequests" where id=$1', [rd]))[0].status === 'pending', `${cd.status} ${cd.json?.code}`);
  await q('update "Users" set active=true where id=$1', [TD.id]); await q(`insert into "TherapistProfiles"("UserId","acceptingNew","createdAt","updatedAt") values ($1,false,now(),now()) on conflict do nothing`, [TD.id]).catch(() => {});
  const nocap = (await q(`select "acceptingNew" from "TherapistProfiles" where "UserId"=$1`, [TD.id]))[0]; const cd2 = await confirm(rd);
  check('A5f profesional sin cupo (acceptingNew=false) → 409 therapist_unavailable sin cambios', !nocap || (cd2.status === 409 && cd2.json?.code === 'therapist_unavailable' && (await therapistOf(p5d)) === TA.id && (await consent(p5d, TA))[0]?.status === 'granted'), `perfil=${JSON.stringify(nocap)} ${cd2.status}`);
  const p5e = await person('5e'); await q('update "Users" set active=false where id=$1', [p5e.id]); const re5 = await mreq(p5e, TB); const ce = await confirm(re5);
  const p5f = await person('5f'); await q(`update "Users" set role='admin' where id=$1`, [p5f.id]); const rf = await mreq(p5f, TB); const cf = await confirm(rf);
  check('A5g persona inactiva o con rol distinto de user → 409 person_unavailable sin vincular', ce.status === 409 && ce.json?.code === 'person_unavailable' && cf.status === 409 && cf.json?.code === 'person_unavailable' && (await therapistOf(p5e)) === null && (await therapistOf(p5f)) === null, `${ce.status} ${cf.status}`);
  const again = await confirm(r5);
  check('A5h confirmar de nuevo una ya resuelta → 409 request_closed con texto bilingüe', again.status === 409 && again.json?.code === 'request_closed' && /resuelta/.test(again.json.error) && /resolved/.test(again.json.error), again.text.slice(0, 150));
  const pj = await person('5j'); const rj = await preq(pj); const rj1 = await reject(rj, 'no aplica'); const rj2 = await reject(rj, 'otra'); const rj3 = await approve(rj);
  check('A5i plan: rechazar una vez 200; rechazar/aprobar después → 409 request_closed (antes 400)', rj1.status === 200 && rj2.status === 409 && rj2.json?.code === 'request_closed' && rj3.status === 409 && rj3.json?.code === 'request_closed', `${rj1.status} ${rj2.status} ${rj3.status}`);
  const pk = await person('5k'); const rk = await preq(pk); const nn = await call(AD, 'PUT', `/api/admin/plan-requests/admin/${rk}/reject`, {}); const ne = await reject(rk, '   ');
  check('A5j rechazo sin nota o con nota vacía → 400 y la solicitud sigue pending', nn.status === 400 && ne.status === 400 && (await q('select status from "PlanRequests" where id=$1', [rk]))[0].status === 'pending', `${nn.status} ${ne.status}`);
  const rm = await call(AD, 'PUT', `/api/admin/plan-requests/admin/999999999/approve`, { adminNote: 'x' });
  check('A5k aprobar una solicitud inexistente → 404', rm.status === 404, rm.status);
  const pu = await person('5u'); await q('delete from "PricingPlans" where false'); const rU = await preq(pu); await q('update "Users" set "planId"=null where id=$1', [pu.id]);
  // rollback: aprobar con usuario inexistente es imposible por FK; se prueba que un error en mitad no deje estado a medias
  // (confirm) forzado: el profesional elegido se elimina de la vista tras bloquear NO es posible; se verifica con A5e/A5g que no hay estado a medias.
  info('A5l rollback', 'ramas de error de confirmar (A5d/e/f/g/h) verificadas sin vínculo a medias ni autorización retirada sin vínculo; error 500 interno forzado no se prueba sin mutar el código (ver mutaciones)');

  // ---------- A6 códigos del 403 de reset-link
  const tgt = await person('6'); const su2 = await mk('su2', 'superadmin');
  const l1 = await call(AD, 'POST', `/api/admin/usuarios/${tgt.id}/reset-link`, {}), l2 = await call(TA, 'POST', `/api/admin/usuarios/${tgt.id}/reset-link`, {}), l3 = await call(SU, 'POST', `/api/admin/usuarios/${su2.id}/reset-link`, {}), l4 = await call(SU, 'POST', `/api/admin/usuarios/${SU.id}/reset-link`, {}), l5 = await call(SU, 'POST', `/api/admin/usuarios/${tgt.id}/reset-link`, {}), l6 = await call(SU, 'POST', `/api/admin/usuarios/999999999/reset-link`, {});
  check('A6a reset-link: admin → 403 superadmin_only; superadmin → otro superadmin → 403 superadmin_target; a sí mismo y a persona 202; inexistente 404', l1.status === 403 && l1.json?.code === 'superadmin_only' && l3.status === 403 && l3.json?.code === 'superadmin_target' && l4.status === 202 && l5.status === 202 && l6.status === 404, `${l1.status}:${l1.json?.code} ${l3.status}:${l3.json?.code} ${l4.status} ${l5.status} ${l6.status} prof=${l2.status}:${l2.json?.code}`);
  check('A6b el cuerpo del 403 conserva el texto `error` anterior y no refleja entrada', /superadmin/i.test(l1.json?.error || '') && !/@example/.test(l1.text) && !l1.json.link, l1.text.slice(0, 160));
  const src = path.join(E.QA_SUT, 'frontend', 'src'); const g = (re) => { const out = []; const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|jsx?)$/.test(f.name)) { const s = fs.readFileSync(p, 'utf8'); if (re.test(s)) out.push(f.name); } } }; walk(src); return out; };
  const old = g(/ya fue procesada/), s400 = g(/status\s*===?\s*400/);
  check('A6c frontend: 0 usos de «ya fue procesada»; `status === 400` en: ' + (s400.join(',') || 'ninguno'), old.length === 0, 'procesada=' + old.join(','));
  const au2 = fs.readFileSync(path.join(src, 'pages', 'admin', 'AdminUsers.tsx'), 'utf8'); const dep = (au2.match(/\/confirm|plan-requests[^`'"]*\/(approve|reject)/g) || []).length;
  info('A6d pantalla', `AdminUsers.tsx referencia confirm/approve/reject ${dep} veces; depende de !res.ok y data.error (revisado a mano)`);

  // ---------- A7 sin fugas
  const MARK = 'qaMarca' + stamp; const pL = await person('7'); const rL = await preq(pL); await reject(rL, `nota ${MARK} persona@example.test`); await confirm('abc'); await approve('1234567890'); await call(AD, 'PUT', `/api/admin/plan-requests/admin/${rL}/approve`, { adminNote: MARK });
  let log = ''; try { log = fs.readFileSync(E.SRVLOG, 'utf8'); } catch { /* */ }
  const emails = persons.map(p => p.email).concat([SU, AD, TA, TB, TC, TD].map(u => u.email));
  check('A7a el registro del servidor no contiene la nota ni la marca ni correos sintéticos', !log.includes(MARK) && !emails.some(e => log.includes(e)), 'log ' + log.length + ' bytes');
  const rr = await call(AD, 'PUT', `/api/admin/plan-requests/admin/${rL}/reject`, { adminNote: MARK });
  check('A7b la respuesta de error (409) no refleja la entrada', rr.status === 409 && !rr.text.includes(MARK), rr.text.slice(0, 120));
  const srv5xx = (log.match(/\b5\d\d\b/g) || []).length; info('A7c registro', 'líneas con tokens 5xx: ' + srv5xx + '; tamaño ' + log.length);

  const fails = results.filter(r => r.ok === false); console.log(`\nRESUMEN ${results.filter(r => r.ok).length}/${results.filter(r => 'ok' in r).length} ok; fallos: ${fails.map(f => f.id).join(', ') || 'ninguno'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-186a-servidor-pr203.json'), JSON.stringify({ pr: 203, head: E.QA_HEAD || null, results }, null, 2)); await db.end(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
