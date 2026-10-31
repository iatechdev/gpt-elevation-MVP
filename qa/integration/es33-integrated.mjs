// [QA-Claude] ES-33 · PR #44 integrado: ES-14 (contexto) + ES-32 (rutas) + ES-33 (experimento y plan) por HTTP contra Postgres REAL, sin dobles.
// Uso: QA_SUT=<clon con el head de #44> QA_API=http://127.0.0.1:8144 (servidor con DATA_RIGHTS_ENABLED=true y ALLOW_SYNTHETIC_CATALOG=true)
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> node qa/integration/es33-integrated.mjs     Solo datos sintéticos; no se imprimen secretos.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
if (!sut || !api || !dbUrl || !JWT) throw new Error('Defina QA_SUT, QA_API, DATABASE_URL y QA_JWT_SECRET.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const info = (id, d) => console.log(JSON.stringify({ id, info: d }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* sin JSON */ } return { status: r.status, json, text };
};
const stamp = Date.now(); const rid = () => 'qa' + randomBytes(8).toString('hex');
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa33i-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA33I ' + tag, email, password } }); if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) };
};
// Catálogos: ruta (sintético del PR #33) y habilidades
const adm = await mkUser('adm', 'admin');
const seed = spawnSync(process.execPath, ['scripts/seedRouteCatalogSynthetic.js'], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', NODE_ENV: 'development', ALLOW_SYNTHETIC_CATALOG: 'true', JWT_SECRET: JWT }, encoding: 'utf8' });
const draftId = JSON.parse(seed.stdout.trim().split('\n').pop()).draftId;
check('INT-00a catálogo de rutas sintético publicado', (await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm.token })).status === 200);
const lv = (p) => Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: p + ' nivel ' + n, en: p + ' level ' + n }]));
const sd = await call('POST', '/api/admin/skill-catalog', { token: adm.token }); const sid = sd.json?.id ?? sd.json?.draftId;
for (const k of ['comunicacion', 'planificacion_organizacion', 'analisis_informacion', 'resolucion_problemas', 'trabajo_en_equipo', 'influencia_liderazgo', 'adaptabilidad', 'aprendizaje_autonomo']) await call('PUT', `/api/admin/skill-catalog/${sid}/skills/${k}`, { token: adm.token, body: { type: 'transversal', labels: { es: k, en: k }, rubric: { levels: lv(k), source: 'Sintética QA', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } } });
check('INT-00b catálogo de habilidades sintético publicado', (await call('POST', `/api/admin/skill-catalog/${sid}/publish`, { token: adm.token })).status === 200);

const ctx = (over = {}) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: 'Docente ficticia', interests: 'datos', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, ...over });
const putCtx = (u, version, action, over) => call('PUT', '/api/user/context', { token: u.token, body: { schemaVersion: 1, expectedVersion: version, action, context: ctx(over) } });
const CON = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'yes', originContextKey: 'ctx_educacion_formacion', interestContextKeys: [], preferredModalities: [] };
const putCon = (u, base, over = {}) => call('PUT', '/api/routes/constraints', { token: u.token, body: { baseVersion: base, requestId: rid(), payload: { ...CON, ...over } } });
const accept = async (u) => { const r = await call('GET', '/api/routes', { token: u.token }); const route = r.json?.routes?.[0]; if (!route) return { status: r.status, none: true }; const c = await call('POST', '/api/routes/choices', { token: u.token, body: { requestId: rid(), roleKey: route.roleKey, slot: route.slot, decision: 'accepted', basisHash: r.json.basisHash } }); return { status: c.status, id: c.json?.choice?.id, route }; };
const propose = (u, choiceId, over = {}) => call('POST', '/api/experiments/proposals', { token: u.token, body: { choiceId, taskIndex: 0, minutes: 20, ...over } });
const create = async (u, choiceId) => { const p = await propose(u, choiceId); if (p.status !== 200) return { status: p.status, p }; const c = await call('POST', '/api/experiments', { token: u.token, body: { requestId: rid(), proposal: p.json.proposal, token: p.json.token } }); return { status: c.status, id: c.json?.experimentId, p }; };
const ready = async (tag, { context = 'complete', over = {} } = {}) => { const u = await mkUser(tag); if (context !== 'none') await putCtx(u, 0, context === 'complete' ? 'continue' : 'save_draft', over); await putCon(u, 0); const c = await accept(u); return { u, choice: c }; };

// A: recorrido completo
const A = await ready('A'); const B = await ready('B');
check('INT-01 preparación real de A: contexto completado, restricciones y elección aceptada de ES-32', A.choice.status === 201 && !!A.choice.id, `elección=${A.choice.status}`);
const pA = await propose(A.u, A.choice.id);
check('INT-02 proponer experimento con contexto y ruta reales → 200, bilingüe, sin persistir', pA.status === 200 && pA.json?.proposal?.content?.title?.es && pA.json.proposal.content.title.en && (await q('select count(*)::int n from "CareerExperiments"'))[0].n === 0, `status=${pA.status} ${pA.text.slice(0, 80)}`);
check('INT-03 la propuesta usa la disponibilidad y la zona horaria del contexto real (300 min, America/Bogota)', pA.json?.proposal?.availability?.weeklyMinutes === 300 && pA.json.proposal.availability.timeZone === 'America/Bogota', JSON.stringify(pA.json?.proposal?.availability));
const cA = await call('POST', '/api/experiments', { token: A.u.token, body: { requestId: rid(), proposal: pA.json.proposal, token: pA.json.token } });
check('INT-04 crear el experimento → 201', cA.status === 201, `status=${cA.status}`); const eid = cA.json?.experimentId;
const ch = (u, id, op, v) => call('POST', `/api/experiments/${id}/versions`, { token: u.token, body: { requestId: rid(), expectedVersion: v, change: op } });
let v = 1; for (const op of [{ action: 'start' }, { action: 'submit', sample: 'Muestra sintética', evidenceRefs: [], assistance: 'none' }, { action: 'reflect', observation: 'o', interpretation: 'i' }, { action: 'decide', decision: 'continue', reason: 'r' }]) { const z = await ch(A.u, eid, op, v); v = z.json?.version?.version ?? v; if (z.status !== 201) info('INT-05x', op.action + ' → ' + z.status + ' ' + z.text.slice(0, 80)); }
check('INT-05 ciclo completo hasta la decisión (versión 5)', v === 5, `v=${v}`);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const pp = await call('POST', '/api/career-plan/proposals', { token: A.u.token, body: { experimentId: eid, expectedVersion: v } });
const ac = await call('POST', '/api/career-plan/versions', { token: A.u.token, body: { requestId: rid(), expectedVersion: 0, action: 'accept', proposal: pp.json?.proposal, token: pp.json?.token, selections: ['step_7', 'step_30', 'step_90'].map((k, i) => ({ actionKey: k, chosenDate: day([3, 20, 70][i]), estimatedMinutes: 20, resourceRefs: [] })) } });
check('INT-06 proponer y aceptar el plan a 7/30/90 días con la disponibilidad real', pp.status === 200 && ac.status === 201 && ac.json?.plan?.status === 'accepted', `${pp.status}/${ac.status} ${ac.text.slice(0, 80)}`);
const raw = (await q(`select payload from "CareerExperimentVersions" where "UserId"=$1 limit 1`, [A.u.id]))[0].payload;
check('INT-07 el contenido del experimento se guarda cifrado (v2:)', /^v2:/.test(raw), raw.slice(0, 8));
// Aislamiento
const iso = await Promise.all([call('GET', '/api/experiments/' + eid, { token: B.u.token }), call('GET', '/api/career-plan/versions/' + ac.json.plan.id, { token: B.u.token }), propose(B.u, A.choice.id), ch(B.u, eid, { action: 'start' }, 1)]);
check('INT-08 B no lee ni modifica lo de A, ni propone sobre la elección de A (404/409, nunca 200/201)', iso.every(x => [403, 404, 409].includes(x.status)), iso.map(x => x.status).join(','));
const lstB = await call('GET', '/api/experiments', { token: B.u.token }); check('INT-09 el listado de B no trae nada de A', lstB.json?.experiments?.length === 0, '');
for (const who of ['th', 'brd']) { const x = await mkUser(who, who === 'th' ? 'therapist' : 'board'); const r = await propose(x, A.choice.id); check(`INT-10 ${who} no propone sobre elecciones ajenas → 403`, r.status === 403, `status=${r.status}`); }
const su = await mkUser('su', 'superadmin'); check('INT-10b superadmin → 403', (await propose(su, A.choice.id)).status === 403 && (await propose(adm, A.choice.id)).status === 403, '');
// Contexto: reglas
const N0 = await ready('N0', { context: 'none' }); const r0 = await propose(N0.u, N0.choice.id);
check('INT-11 sin contexto → 409 context_incomplete con mensaje a Mi contexto (ES y EN) y nada se crea', r0.status === 409 && r0.json?.code === 'context_incomplete' && /Mi contexto/.test(r0.text) && /My context/.test(r0.text), `status=${r0.status} code=${r0.json?.code}`);
const D = await ready('D', { context: 'draft' }); const rD = await propose(D.u, D.choice.id);
check('INT-12 con borrador de contexto (sin «continuar») → 409 context_incomplete; un borrador no se usa', rD.status === 409 && rD.json?.code === 'context_incomplete', `status=${rD.status} code=${rD.json?.code}`);
const AV = await ready('AV', { over: { availabilityMinutesPerWeek: null } }); const rAV = await propose(AV.u, AV.choice.id);
info('INT-13i', `contexto con disponibilidad null: elección=${AV.choice.status} propuesta=${rAV.status} ${rAV.json?.code}`);
check('INT-13 disponibilidad desconocida (null) → 409 availability_unknown; no se inventa un valor', rAV.status === 409 && rAV.json?.code === 'availability_unknown', `status=${rAV.status} code=${rAV.json?.code}`);
const TZ = await ready('TZ', { over: { timeZone: null } }); const rTZ = await propose(TZ.u, TZ.choice.id);
info('INT-14i', `contexto con zona null: continuar=${(await q('select count(*)::int n from "ParticipantContexts" where "UserId"=$1 and "completedAt" is not null', [TZ.u.id]))[0].n} propuesta=${rTZ.status} ${rTZ.json?.code}`);
check('INT-14 zona horaria desconocida (null) → 409 timezone_unknown (o ES-14 impide completarla sin zona)', (rTZ.status === 409 && ['timezone_unknown', 'context_incomplete'].includes(rTZ.json?.code)), `status=${rTZ.status} code=${rTZ.json?.code}`);
const LOW = await ready('LOW', { over: { availabilityMinutesPerWeek: 10 } }); const rLOW = await propose(LOW.u, LOW.choice.id);
check('INT-15 disponibilidad de 10 min/semana con una tarea de 20 → 422 needs_scope_reduction', rLOW.status === 422 && rLOW.json?.code === 'needs_scope_reduction', `status=${rLOW.status} code=${rLOW.json?.code}`);
// La versión del contexto entra en la huella
const before = await call('GET', '/api/experiments/' + eid, { token: A.u.token });
const cv = (await q('select version from "ParticipantContexts" where "UserId"=$1', [A.u.id]))[0].version;
const edit = await putCtx(A.u, cv, 'save_draft', { interests: 'interés cambiado después del experimento' });
const afterCtx = await call('GET', '/api/experiments/' + eid, { token: A.u.token }); const planAfter = await call('GET', '/api/career-plan/versions/' + ac.json.plan.id, { token: A.u.token });
check('INT-16 antes de editar el contexto la base es vigente; tras editarlo el experimento y el plan pasan a needs_review (basis_changed)', before.json?.basis?.status === 'current' && edit.status === 200 && afterCtx.json?.basis?.status === 'needs_review' && planAfter.json?.plan?.basis?.status === 'needs_review', `antes=${before.json?.basis?.status} edit=${edit.status} exp=${afterCtx.json?.basis?.status} plan=${planAfter.json?.plan?.basis?.status}`);
check('INT-17 lo ya guardado no se reescribe (la versión del experimento sigue siendo la 5)', afterCtx.json?.experiment?.currentVersion === 5, `v=${afterCtx.json?.experiment?.currentVersion}`);
const rb = await ch(A.u, eid, { action: 'rebase' }, 5); check('INT-18 rebase explícito crea la versión 6 en ready', rb.status === 201 && rb.json?.version?.lifecycle === 'ready', `status=${rb.status}`);
// Rutas: cambio de restricciones de ES-32
const E = await ready('E'); const eE = await create(E.u, E.choice.id);
const conV = (await q('select version from "RouteConstraintsVersions" where "UserId"=$1 and status=\'current\'', [E.u.id]))[0].version; await putCon(E.u, conV, { languages: ['es', 'en'] });
const eAfter = await call('GET', '/api/experiments/' + eE.id, { token: E.u.token });
check('INT-19 si cambian las restricciones de ES-32 el experimento pasa a needs_review', eE.status === 201 && eAfter.json?.basis?.status === 'needs_review', `crear=${eE.status} base=${eAfter.json?.basis?.status}`);
const rej = await ready('R'); const rr = await call('GET', '/api/routes', { token: rej.u.token }); const rt = rr.json.routes[0];
const rejected = await call('POST', '/api/routes/choices', { token: rej.u.token, body: { requestId: rid(), roleKey: rt.roleKey, slot: rt.slot, decision: 'rejected', basisHash: rr.json.basisHash } });
const pR = await propose(rej.u, rejected.json?.choice?.id); check('INT-20 sobre una elección RECHAZADA no se propone (409)', rejected.status === 201 && pR.status === 409, `rechazo=${rejected.status} propuesta=${pR.status}`);
check('INT-21 sobre un ID de elección inexistente → 404/409, sin 500', [404, 409].includes((await propose(A.u, 999999)).status), '');
// Eliminación pendiente
const X = await ready('X'); await call('POST', '/api/account/deletion-requests', { token: X.u.token, body: { confirm: true } }); const rX = await propose(X.u, X.choice.id);
check('INT-22 con eliminación pendiente se rechaza (401 por sesión revocada o 403)', [401, 403].includes(rX.status), `status=${rX.status}`);
// Carga con pool 5
const crowd = []; for (let i = 0; i < 6; i++) crowd.push(await ready('C' + i));
const ps = await Promise.all(crowd.map(async c => ({ c, p: await propose(c.u, c.choice.id) })));
const t0 = performance.now(); const outs = await Promise.all(ps.map(async ({ c, p }) => { const x = await call('POST', '/api/experiments', { token: c.u.token, body: { requestId: rid(), proposal: p.json.proposal, token: p.json.token } }); return { s: x.status, ms: Math.round(performance.now() - t0) }; }));
info('carga', outs.map(o => o.s + '@' + o.ms).join(' '));
check('INT-23 6 personas crean un experimento a la vez con lecturas reales y pool 5: ningún 5xx y todo en menos de 3 s', outs.every(o => o.s === 201 && o.ms < 3000), outs.map(o => o.s).join(','));
const solo = crowd[0]; const eidS = (await call('GET', '/api/experiments', { token: solo.u.token })).json.experiments[0].id; await ch(solo.u, eidS, { action: 'start' }, 1);
const t1 = performance.now(); const flood = await Promise.all(Array.from({ length: 12 }, () => ch(solo.u, eidS, { action: 'submit', sample: 'M', evidenceRefs: [], assistance: 'none' }, 2).then(z => ({ s: z.status, ms: Math.round(performance.now() - t1) }))));
check('INT-24 12 cambios simultáneos de una persona: 1 creado, el resto 409, sin 5xx y en menos de 3 s', flood.filter(z => z.s === 201).length === 1 && flood.every(z => z.s < 500 && z.ms < 3000), flood.map(z => z.s).join(','));
// ES-23
const exp = await call('POST', '/api/exports/preview', { token: A.u.token, body: { type: 'personal', locale: 'es' } });
const k = Object.keys(exp.json?.data ?? {}).filter(x => /career|experiment|plan|reminder/i.test(x));
check('INT-25 la exportación personal de A incluye contexto, rutas y datos de ES-33 y no los de B', exp.status === 201 && k.length >= 1 && exp.json.data.participantContext?.length === 1 && !exp.text.includes('QA33I B') && !/inputHash|v2:/.test(exp.text), `status=${exp.status} claves=${k.join(',')}`);
await call('POST', '/api/account/deletion-requests', { token: A.u.token, body: { confirm: true } });
const reqId = (await q('select id from "DeletionRequests" where "UserId"=$1', [A.u.id]))[0].id;
const purge = (replay = false) => spawnSync(process.execPath, ['scripts/purgePersonalData.js', reqId, '--producers-stopped-and-drained', ...(replay ? ['--replay'] : [])], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const p1 = purge(); const cnt = async (t, id) => (await q(`select count(*)::int n from "${t}" where "UserId"=$1`, [id]))[0].n;
const left = { contexto: await cnt('ParticipantContexts', A.u.id), restricciones: await cnt('RouteConstraintsVersions', A.u.id), elecciones: await cnt('RouteChoices', A.u.id), experimentos: await cnt('CareerExperiments', A.u.id), versiones: await cnt('CareerExperimentVersions', A.u.id), planes: await cnt('CareerPlanVersions', A.u.id) };
check('INT-26 la purga deja 0 filas de contexto, rutas, experimentos, versiones y planes de A', p1.status === 0 && Object.values(left).every(n => n === 0), JSON.stringify(left) + ' exit=' + p1.status);
check('INT-27 lo de B sigue intacto y el replay es idempotente', (await cnt('RouteConstraintsVersions', B.u.id)) === 1 && purge(true).status === 0 && purge().status === 0, '');
console.log(JSON.stringify({ fin: true }));
await db.end();
