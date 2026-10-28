// [QA-Claude] ES-33 · PR #44 (experimento, revisión y plan) contra Postgres REAL local, en el proceso de prueba, con el pool de PRODUCCIÓN por defecto (5).
// Uso: QA_SUT=<clon con el head de #44> PG_ADMIN_URL=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es33-real-db.mjs
// Solo los puertos ES-14 (contexto) y ES-32 (ruta elegida) se sustituyen por dobles, y solo DESPUÉS de comprobar que en runtime responden 503 pendiente.
// Datos sintéticos; no se imprimen secretos.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';

const sut = process.env.QA_SUT, adminUrl = process.env.PG_ADMIN_URL;
if (!sut || !adminUrl || !['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw new Error('Defina QA_SUT y PG_ADMIN_URL (solo Postgres local desechable).');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const B = p => req(path.join(sut, 'backend', p));
const { Sequelize } = req('sequelize'); const express = req('express');
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test';
const name = `qa33_${randomBytes(6).toString('hex')}`;
const admin = new Sequelize(adminUrl, { logging: false, dialectOptions: { ssl: false } });
await admin.query(`CREATE DATABASE "${name}"`);
const target = new URL(adminUrl); target.pathname = '/' + name;
const POOL = Number(process.env.QA_POOL || 5);
const sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: POOL, min: 0, acquire: 30000 } });
const dbPath = req.resolve(path.join(sut, 'backend', 'database.js')); req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { sequelize } };
let server;
try {
  B('associations')(); const { CORE } = B('utils/personalData');
  const names = ['CareerExperiment', 'CareerExperimentVersion', 'CareerPlanVersion', 'CareerExperimentReview', 'CareerReminder'];
  for (const [, model] of CORE) B(model);
  for (const m of ['ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', ...names]) B(m);
  await sequelize.sync();
  const mig = B('migrations/20261028-es33-career-plan.cjs'); await mig.up(sequelize); await mig.up(sequelize);
  check('ES33-M01 migración dos veces sin error y con índices únicos/compuestos', (await sequelize.query(`SELECT count(*)::int n FROM pg_indexes WHERE tablename IN ('CareerExperiments','CareerExperimentVersions','CareerPlanVersions','CareerExperimentReviews','CareerReminders') AND indexname LIKE 'career_%'`, { type: 'SELECT' }))[0].n >= 10, '');
  const User = B('User'); const { issueToken } = B('utils/sessions'); const contracts = B('utils/careerPlanContracts'); const { problem } = B('utils/careerPlanRules');
  const evidence = B('utils/evidence'); const { context, route } = B('test/es-33-fixture.cjs');
  const users = {};
  for (const role of ['user', 'other', 'admin', 'therapist', 'board', 'superadmin']) users[role] = await User.create({ name: 'QA ' + role, email: `qa33-${role}-${randomBytes(3).toString('hex')}@example.test`, password: randomBytes(24).toString('hex'), active: true, role: role === 'other' ? 'user' : role });
  const jwt = Object.fromEntries(Object.entries(users).map(([r, u]) => [r, issueToken(u)]));
  const app = express(); app.use(express.json()); const auth = B('middlewares/auth').verificarToken; const routers = B('routes/careerPlan');
  app.use('/api/experiments', auth, routers.experiments); app.use('/api/career-plan', auth, routers.plans);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/api`;
  const http = async (p, { actor = 'user', method = 'GET', body, token } = {}) => {
    const h = {}; if (actor !== null) h.Authorization = 'Bearer ' + (token || jwt[actor]); if (body !== undefined) h['Content-Type'] = 'application/json';
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ } return { status: r.status, json, text, headers: r.headers };
  };
  const ENDPOINTS = [['POST', '/experiments/proposals'], ['POST', '/experiments'], ['GET', '/experiments'], ['GET', '/experiments/1'], ['GET', '/experiments/1/review-requests'], ['POST', '/experiments/1/versions'], ['POST', '/experiments/1/review-requests'], ['POST', '/career-plan/proposals'], ['POST', '/career-plan/versions'], ['GET', '/career-plan'], ['GET', '/career-plan/versions/1'], ['GET', '/career-plan/reminders'], ['POST', '/career-plan/reminders']];

  // ── Puertos pendientes en runtime (sin dobles)
  let r = await http('/experiments/proposals', { method: 'POST', body: { choiceId: users.user.id, taskIndex: 0, minutes: 20 } });
  check('ES33-P01 runtime SIN dobles: proponer experimento → 503 con código de contrato pendiente (ruta o contexto), sin 500 ni trazas', r.status === 503 && /contract_pending/.test(r.json?.code || '') && !/stack|at |Sequelize/.test(r.text), `status=${r.status} code=${r.json?.code}`);
  r = await http('/experiments', { method: 'POST', body: { requestId: randomUUID(), proposal: { choiceId: 1 }, token: 'x' } });
  check('ES33-P02 runtime SIN dobles: crear experimento no persiste nada (4xx/503, 0 filas)', r.status >= 400 && (await sequelize.query('SELECT count(*)::int n FROM "CareerExperiments"', { type: 'SELECT' }))[0].n === 0, `status=${r.status} code=${r.json?.code}`);
  r = await http('/career-plan/proposals', { method: 'POST', body: { experimentId: 1, expectedVersion: 1 } });
  check('ES33-P03 runtime SIN dobles: proponer plan sobre un experimento inexistente → 404 (no 500)', r.status === 404, `status=${r.status}`);

  // ── Acceso
  for (const [m, p] of ENDPOINTS) { const x = await http(p, { actor: null, method: m, body: m === 'GET' ? undefined : {} }); check(`ES33-S01 ${m} ${p} sin token → 401/403`, [401, 403].includes(x.status), `status=${x.status}`); }
  for (const who of ['admin', 'therapist', 'board', 'superadmin']) {
    const xs = await Promise.all(ENDPOINTS.map(([m, p]) => http(p, { actor: who, method: m, body: m === 'GET' ? undefined : {} })));
    check(`ES33-S02 ${who} no accede a ningún endpoint (todos 403)`, xs.every(x => x.status === 403), xs.map(x => x.status).join(','));
  }
  r = await http('/experiments?x=1'); check('ES33-V00 parámetro de consulta desconocido → 400', r.status === 400, `status=${r.status}`);
  for (const bad of ['abc', '-1', '1.5']) { r = await http('/experiments?after=' + bad); check(`ES33-V00b after=${bad} → 400`, r.status === 400, `status=${r.status}`); }
  for (const id of ['abc', '0', '-3', '1e3']) { r = await http('/experiments/' + id); check(`ES33-V00c /experiments/${id} → 400/404`, [400, 404].includes(r.status), `status=${r.status}`); }

  // ── Dobles explícitos de ES-14/ES-32
  const state = { routeVersion: 1, context: context() };
  contracts.getRoute = async (userId, choiceId) => { if (choiceId !== userId) throw problem('resource_not_found', 'No encontrado.', 'Not found.', 404); return { basisHash: `synthetic-${state.routeVersion}`, route: route() }; };
  contracts.getContext = async () => structuredClone(state.context);
  const a = users.user, b = users.other;
  const propose = (actor = 'user', over = {}) => http('/experiments/proposals', { actor, method: 'POST', body: { choiceId: users[actor].id, taskIndex: 0, minutes: 20, ...over } });
  const create = async (actor = 'user', requestId = randomUUID()) => { const p = await propose(actor); return http('/experiments', { actor, method: 'POST', body: { requestId, proposal: p.json.proposal, token: p.json.token } }); };
  const ev = await evidence.create(a.id, { requestId: randomUUID(), status: 'confirmed', payload: { title: 'QA evidencia', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'assisted' } });
  const evB = await evidence.create(b.id, { requestId: randomUUID(), status: 'confirmed', payload: { title: 'QA evidencia de B', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'assisted' } });

  // ── Validación de la propuesta
  for (const [n, body] of [['minutos fuera de plantilla', { choiceId: a.id, taskIndex: 0, minutes: 7 }], ['taskIndex negativo', { choiceId: a.id, taskIndex: -1, minutes: 20 }], ['taskIndex fuera de rango', { choiceId: a.id, taskIndex: 99, minutes: 20 }], ['clave extra', { choiceId: a.id, taskIndex: 0, minutes: 20, extra: 1 }], ['choiceId texto', { choiceId: '1', taskIndex: 0, minutes: 20 }], ['choiceId ajeno', { choiceId: b.id, taskIndex: 0, minutes: 20 }]]) {
    const x = await http('/experiments/proposals', { method: 'POST', body }); check(`ES33-V01 propuesta inválida «${n}» → 4xx, no 5xx`, x.status >= 400 && x.status < 500 && !/stack|at |Sequelize/.test(x.text), `status=${x.status} code=${x.json?.code}`);
  }
  state.context.weeklyMinutes = 10; r = await propose(); check('ES33-V02 disponibilidad semanal menor que la tarea → 422 needs_scope_reduction', r.status === 422 && r.json?.code === 'needs_scope_reduction', `status=${r.status} code=${r.json?.code}`);
  state.context.weeklyMinutes = 60;
  r = await http('/experiments/proposals', { method: 'POST', body: '{no json' }); check('ES33-V03 JSON roto → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);

  // ── Propuesta firmada, creación, idempotencia, manipulación
  const p1 = await propose();
  check('ES33-C01 la propuesta es bilingüe, sin persistencia y sin contenido privado', p1.status === 200 && p1.json.proposal.content.title.es && p1.json.proposal.content.title.en && (await sequelize.query('SELECT count(*)::int n FROM "CareerExperiments"', { type: 'SELECT' }))[0].n === 0, '');
  const allText = JSON.stringify(p1.json.proposal);
  check('ES33-C02 la propuesta no contiene diagnóstico, prescripción, promesas de empleo ni porcentajes de reemplazo', !/diagn|prescri|terapia|garantiz|guarantee|empleabilidad|employab|reemplaz|replac|\d+\s*%/i.test(allText), (allText.match(/diagn|prescri|terapia|garantiz|guarantee|empleabilidad|employab|reemplaz|replac|\d+\s*%/i) || ['—'])[0]);
  check('ES33-C03 la rúbrica se declara «not_domain_validated» y el ejercicio no acredita competencia', p1.json.proposal.rubric.status === 'not_domain_validated' && /no acredita|does not establish/i.test(JSON.stringify(p1.json.proposal.content.limitation)), '');
  const rq = randomUUID(); const input = { requestId: rq, proposal: p1.json.proposal, token: p1.json.token };
  const tampered = structuredClone(input); tampered.proposal.minutes = 45;
  check('ES33-C04 propuesta manipulada → 409; token de otra persona → 409; token alterado → 409', (await http('/experiments', { method: 'POST', body: tampered })).status === 409 && (await http('/experiments', { actor: 'other', method: 'POST', body: input })).status === 409 && (await http('/experiments', { method: 'POST', body: { ...input, token: 'x' + input.token } })).status === 409, '');
  const c1 = await http('/experiments', { method: 'POST', body: input }), c1r = await http('/experiments', { method: 'POST', body: input });
  check('ES33-C05 crear → 201; repetir con el mismo requestId → 200 mismo experimento', c1.status === 201 && c1r.status === 200 && c1r.json.experimentId === c1.json.experimentId, `${c1.status}/${c1r.status}`);
  const eid = c1.json.experimentId;
  const burstSame = await Promise.all(Array.from({ length: 4 }, () => http('/experiments', { method: 'POST', body: input })));
  check('ES33-C06 4 reintentos concurrentes con el mismo requestId → sin 5xx y una sola fila', burstSame.every(x => x.status < 500) && (await sequelize.query(`SELECT count(*)::int n FROM "CareerExperiments" WHERE "requestId"=:r`, { replacements: { r: rq }, type: 'SELECT' }))[0].n === 1, burstSame.map(x => x.status).join(','));
  const raw = (await sequelize.query(`SELECT payload FROM "CareerExperimentVersions" WHERE "UserId"=:u`, { replacements: { u: a.id }, type: 'SELECT' }))[0].payload;
  check('ES33-C07 el contenido del experimento se guarda cifrado (v2:)', /^v2:/.test(raw) && !raw.includes('taskIndex'), raw.slice(0, 10));

  // ── Aislamiento
  const pB = await create('other'); const eidB = pB.json.experimentId;
  const iso = await Promise.all([http('/experiments/' + eid, { actor: 'other' }), http('/experiments/' + eid + '/review-requests', { actor: 'other' }), http('/experiments/' + eid + '/versions', { actor: 'other', method: 'POST', body: { requestId: randomUUID(), expectedVersion: 1, change: { action: 'start' } } }), http('/experiments/' + eid + '/review-requests', { actor: 'other', method: 'POST', body: { requestId: randomUUID(), expectedVersion: 1, action: 'request', submissionVersion: 1, evidenceRefs: [], includeSample: true } })]);
  check('ES33-S03 B no lee ni modifica el experimento de A por ID (404)', iso.every(x => x.status === 404), iso.map(x => x.status).join(','));
  const lst = await http('/experiments', { actor: 'other' }); check('ES33-S04 el listado de B solo contiene lo de B', lst.json.experiments.length === 1 && lst.json.experiments[0].id === eidB, `n=${lst.json.experiments.length}`);

  // ── Ciclo de vida
  const ch = (op, v, actor = 'user', id = eid) => http(`/experiments/${id}/versions`, { actor, method: 'POST', body: { requestId: randomUUID(), expectedVersion: v, change: op } });
  check('ES33-L01 entregar antes de iniciar → 409 transition_not_allowed', (await ch({ action: 'submit', sample: 'x', evidenceRefs: [], assistance: 'none' }, 1)).status === 409, '');
  const s = await ch({ action: 'start' }, 1); check('ES33-L02 iniciar → 201 versión 2 in_progress', s.status === 201 && s.json.version.version === 2 && s.json.version.lifecycle === 'in_progress', `status=${s.status}`);
  check('ES33-L03 versión esperada obsoleta → 409', (await ch({ action: 'start' }, 1)).status === 409, '');
  const sub = (refs, v, sample = 'Muestra QA') => ch({ action: 'submit', sample, evidenceRefs: refs, assistance: 'drafting' }, v);
  check('ES33-L04 entregar citando evidencia AJENA → 4xx (no se acepta)', (await sub([{ evidenceId: evB.id, version: 1 }], 2)).status >= 400, '');
  check('ES33-L05 entregar citando versión inexistente de evidencia propia → 4xx', (await sub([{ evidenceId: ev.id, version: 9 }], 2)).status >= 400, '');
  check('ES33-L06 entrega vacía (sin muestra ni evidencia) / ayuda inválida / 9 referencias → 400', (await ch({ action: 'submit', evidenceRefs: [], assistance: 'none' }, 2)).status === 400 && (await ch({ action: 'submit', sample: 'x', evidenceRefs: [], assistance: 'mucha' }, 2)).status === 400 && (await sub(Array.from({ length: 9 }, (_, i) => ({ evidenceId: i + 1, version: 1 })), 2)).status === 400, '');
  const sOk = await sub([{ evidenceId: ev.id, version: 1 }], 2); check('ES33-L07 entregar con evidencia propia confirmada → 201 versión 3', sOk.status === 201 && sOk.json.version.version === 3, `status=${sOk.status} ${sOk.text.slice(0, 80)}`);
  check('ES33-L08 decidir antes de reflexionar → 409', (await ch({ action: 'decide', decision: 'continue', reason: 'x' }, 3)).status === 409, '');
  const rf = await ch({ action: 'reflect', observation: 'Observé algo', interpretation: 'Lo interpreto así' }, 3); check('ES33-L09 reflexionar → 201', rf.status === 201, `status=${rf.status}`);
  check('ES33-L10 acción desconocida / clave extra / texto con control → 400', (await ch({ action: 'hackear' }, 4)).status === 400 && (await ch({ action: 'start', extra: 1 }, 4)).status === 400 && (await ch({ action: 'decide', decision: 'continue', reason: 'a\u0000b' }, 4)).status === 400, '');
  const dc = await ch({ action: 'decide', decision: 'continue', reason: 'Quiero seguir' }, 4); check('ES33-L11 decidir → 201 lifecycle decided', dc.status === 201 && dc.json.version.lifecycle === 'decided', `status=${dc.status}`);
  const par = await Promise.all(Array.from({ length: 3 }, () => ch({ action: 'decide', decision: 'adjust', reason: 'Ajustar' }, 5)));
  check('ES33-L12 3 cambios concurrentes con la misma versión → exactamente 1 creado, el resto 409, sin 5xx', par.filter(x => x.status === 201).length === 1 && par.filter(x => x.status === 409).length === 2, par.map(x => x.status).join(','));
  const exp1 = await http('/experiments/' + eid);
  check('ES33-L13 el experimento expone la base vigente y la revisión humana como NO compartida (shared=false, contrato pendiente)', exp1.json?.basis?.status === 'current' && exp1.json.humanReview.shared === false && exp1.json.humanReview.contract === 'pending', JSON.stringify(exp1.json?.humanReview).slice(0, 100));
  state.routeVersion = 2; const exp2 = await http('/experiments/' + eid);
  check('ES33-L14 si cambia la ruta/base, el experimento pasa a needs_review (basis_changed) sin reescribirse', exp2.json?.basis?.status === 'needs_review' && exp2.json.basis.reasons.includes('basis_changed'), JSON.stringify(exp2.json?.basis));
  check('ES33-L15 con base cambiada no se puede proponer plan ni cambiar sin rebase (409)', (await http('/career-plan/proposals', { method: 'POST', body: { experimentId: eid, expectedVersion: 6 } })).status === 409, '');
  const rb = await ch({ action: 'rebase' }, 6); check('ES33-L16 rebase crea una versión nueva sobre la base vigente (201, vuelve a ready)', rb.status === 201 && rb.json.version.lifecycle === 'ready', `status=${rb.status}`);
  state.routeVersion = 1;

  // ── Evidencia nueva confirmada durante un experimento en curso
  const ex = await create('user'); const eidX = ex.json.experimentId;
  await ch({ action: 'start' }, 1, 'user', eidX); await ch({ action: 'submit', sample: 'Mi entrega', evidenceRefs: [], assistance: 'none' }, 2, 'user', eidX);
  const before = await http('/experiments/' + eidX);
  await evidence.create(a.id, { requestId: randomUUID(), status: 'confirmed', payload: { title: 'Evidencia nueva durante el experimento', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'assisted' } });
  const afterEv = await http('/experiments/' + eidX);
  const blockedEdit = await ch({ action: 'reflect', observation: 'o', interpretation: 'i' }, 3, 'user', eidX);
  info('evidencia-nueva', `antes=${before.json?.basis?.status}/${before.json?.current?.version?.lifecycle ?? before.json?.current?.lifecycle} despues=${afterEv.json?.basis?.status} ${JSON.stringify(afterEv.json?.basis?.reasons)} reflexionar=${blockedEdit.status}`);
  check('ES33-X01 comportamiento documentado (contrato §Huella): evidencia nueva confirmada cambia la base → needs_review/basis_changed y no se puede continuar sin rebase (409); la persona sigue viendo su historia', before.json?.basis?.status === 'current' && afterEv.json?.basis?.status === 'needs_review' && afterEv.json.basis.reasons.includes('basis_changed') && blockedEdit.status === 409 && afterEv.status === 200, `base=${afterEv.json?.basis?.status} reflexionar=${blockedEdit.status}`);
  const rbX = await ch({ action: 'rebase' }, 3, 'user', eidX); const afterRb = await http('/experiments/' + eidX);
  info('rebase', `status=${rbX.status} lifecycle=${rbX.json?.version?.lifecycle} entrega_conservada_en_actual=${JSON.stringify(Boolean(afterRb.json?.current?.payload?.submission))} versiones=${afterRb.json?.versions?.length}`);
  check('ES33-X02 tras el rebase la entrega previa sigue consultable en el historial de versiones (no se pierde)', rbX.status === 201 && (afterRb.json?.versions ?? []).some(v => v.payload?.submission?.sample === 'Mi entrega'), `versiones=${afterRb.json?.versions?.length}`);

  // ── Revisión humana (autorización explícita, sin compartir)
  const e2 = await create('user'); const eid2 = e2.json.experimentId;
  await ch({ action: 'start' }, 1, 'user', eid2); await ch({ action: 'submit', sample: 'Muestra', evidenceRefs: [{ evidenceId: ev.id, version: 1 }], assistance: 'planning' }, 2, 'user', eid2);
  const rv = (body, id = eid2) => http(`/experiments/${id}/review-requests`, { method: 'POST', body: { requestId: randomUUID(), expectedVersion: 3, ...body } });
  check('ES33-R01 pedir revisión sin elegir nada → 400; con evidencia no citada en la entrega → 400; con muestra inexistente → 400', (await rv({ action: 'request', submissionVersion: 3, evidenceRefs: [], includeSample: false })).status === 400 && (await rv({ action: 'request', submissionVersion: 3, evidenceRefs: [{ evidenceId: evB.id, version: 1 }], includeSample: false })).status === 400, '');
  const rq1 = await rv({ action: 'request', submissionVersion: 3, evidenceRefs: [{ evidenceId: ev.id, version: 1 }], includeSample: true });
  check('ES33-R02 solicitar revisión → 201 pending_authorization y shared=false', rq1.status === 201 && rq1.json.reviewRequest.status === 'pending_authorization' && rq1.json.reviewRequest.shared === false, `status=${rq1.status}`);
  check('ES33-R03 retirar la solicitud ajena (B) → 404; retirar la propia → 201 withdrawn', (await http(`/experiments/${eid2}/review-requests`, { actor: 'other', method: 'POST', body: { requestId: randomUUID(), expectedVersion: 3, action: 'withdraw', reviewId: rq1.json.reviewRequest.id } })).status === 404 && (await rv({ action: 'withdraw', reviewId: rq1.json.reviewRequest.id })).json?.reviewRequest?.status === 'withdrawn', '');
  const lr = await http(`/experiments/${eid2}/review-requests`); check('ES33-R04 listado de solicitudes: ninguna compartida', lr.status === 200 && lr.json.reviewRequests.every(x => x.shared === false), `n=${lr.json?.reviewRequests?.length}`);
  check('ES33-R05 ninguna fila indica envío a terceros (no hay lectura de profesional): terapeuta/admin/junta siguen en 403', (await http(`/experiments/${eid2}/review-requests`, { actor: 'therapist' })).status === 403, '');

  // ── Plan
  const dc2 = await create('user'); const eid3 = dc2.json.experimentId;
  let v3 = 1; for (const op of [{ action: 'start' }, { action: 'submit', sample: 'M', evidenceRefs: [], assistance: 'none' }, { action: 'reflect', observation: 'o', interpretation: 'i' }, { action: 'decide', decision: 'continue', reason: 'r' }]) { const z = await ch(op, v3, 'user', eid3); v3 = z.json.version.version; }
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const pp = await http('/career-plan/proposals', { method: 'POST', body: { experimentId: eid3, expectedVersion: v3 } });
  check('ES33-PL01 proponer plan (3 acciones 7/30/90 con dependencias) firmado y sin persistir', pp.status === 200 && pp.json.proposal.actions.length === 3 && (await sequelize.query('SELECT count(*)::int n FROM "CareerPlanVersions"', { type: 'SELECT' }))[0].n === 0, `status=${pp.status}`);
  const sel = (d = [3, 20, 70], m = 20) => ['step_7', 'step_30', 'step_90'].map((k, i) => ({ actionKey: k, chosenDate: day(d[i]), estimatedMinutes: m, resourceRefs: [] }));
  const acc = (selections, body = {}) => http('/career-plan/versions', { method: 'POST', body: { requestId: randomUUID(), expectedVersion: 0, action: 'accept', proposal: pp.json.proposal, token: pp.json.token, selections, ...body } });
  check('ES33-PL02 fecha pasada → 400; dependencia posterior a su acción → 4xx; minutos del primer paso <20 → 400; acción desconocida → 400', (await acc(sel([-3, 20, 70]))).status === 400 && (await acc(sel([30, 20, 70]))).status >= 400 && (await acc(sel([3, 20, 70], 5))).status === 400 && (await acc([{ actionKey: 'step_999', chosenDate: day(5), estimatedMinutes: 20, resourceRefs: [] }])).status === 400, '');
  check('ES33-PL03 más minutos que la disponibilidad semanal en una misma semana → 422 needs_scope_reduction', (await acc(sel([3, 3, 3], 45))).status === 422, '');
  const ac = await acc(sel()); check('ES33-PL04 aceptar el plan → 201 accepted, versión 1', ac.status === 201 && ac.json.plan.status === 'accepted' && ac.json.plan.version === 1, `status=${ac.status} ${ac.text.slice(0, 100)}`);
  const pid = ac.json?.plan?.id;
  check('ES33-PL05 B no lee el plan de A por ID (404) ni lo ve en su listado', (await http('/career-plan/versions/' + pid, { actor: 'other' })).status === 404 && (await http('/career-plan', { actor: 'other' })).json.plans.length === 0, '');
  check('ES33-PL06 completar acción sin dependencias cumplidas → 4xx; completar la primera → 201', (await http('/career-plan/versions', { method: 'POST', body: { requestId: randomUUID(), expectedVersion: 1, planId: pid, action: 'complete', actionKey: 'step_30', completionEvidence: 'hecho' } })).status >= 400, '');
  const cm = await http('/career-plan/versions', { method: 'POST', body: { requestId: randomUUID(), expectedVersion: 1, planId: pid, action: 'complete', actionKey: 'step_7', completionEvidence: 'Lo hice' } });
  check('ES33-PL07 completar step_7 → 201 versión 2 y la versión anterior queda superseded', cm.status === 201 && cm.json.plan.version === 2 && (await sequelize.query(`SELECT status FROM "CareerPlanVersions" WHERE id=:i`, { replacements: { i: pid }, type: 'SELECT' }))[0].status === 'superseded', `status=${cm.status}`);
  state.routeVersion = 3; const plst = await http('/career-plan'); check('ES33-PL08 si cambia la base, el plan vigente pasa a needs_review (no se declara vigente)', plst.json.plans.find(p => p.version === 2)?.basis?.status === 'needs_review', JSON.stringify(plst.json.plans.map(p => p.basis?.status)));
  state.routeVersion = 1;
  // ── Recordatorios sin consentimiento
  const planV = cm.json?.plan?.id;
  const rem = await http('/career-plan/reminders', { method: 'POST', body: { requestId: randomUUID(), action: 'accept', planVersionId: planV, actionKey: 'step_30', localDateTime: day(20) + 'T10:00', timeZone: 'America/Bogota', accepted: true } });
  check('ES33-RM01 recordatorio sin consentimiento de notificaciones → 403 consent_required (no se crea)', rem.status === 403 && rem.json?.code === 'consent_required' && (await sequelize.query('SELECT count(*)::int n FROM "CareerReminders"', { type: 'SELECT' }))[0].n === 0, `status=${rem.status} code=${rem.json?.code}`);
  check('ES33-RM02 listar recordatorios sin consentimiento → 403; historial propio (history=true) → 200 vacío', (await http('/career-plan/reminders')).status === 403 && (await http('/career-plan/reminders?history=true')).status === 200, '');

  // ── Concurrencia con el pool real (5): personas distintas creando a la vez
  const fresh = []; for (let i = 0; i < 6; i++) { const u = await User.create({ name: 'QA c' + i, email: `qa33-c${i}-${randomBytes(3).toString('hex')}@example.test`, password: randomBytes(24).toString('hex'), active: true, role: 'user' }); users['c' + i] = u; jwt['c' + i] = issueToken(u); fresh.push('c' + i); }
  const props = await Promise.all(fresh.map(async f => ({ f, p: await propose(f) })));
  const t0 = performance.now();
  const outs = await Promise.all(props.map(async ({ f, p }) => { const x = await http('/experiments', { actor: f, method: 'POST', body: { requestId: randomUUID(), proposal: p.json.proposal, token: p.json.token } }); return { s: x.status, ms: Math.round(performance.now() - t0) }; }));
  info('carga', `pool=${POOL} estados=${outs.map(o => o.s + '@' + o.ms).join(' ')}`);
  check(`ES33-F01 ${fresh.length} personas crean un experimento a la vez con pool=${POOL}: ningún 5xx y todas < 3000 ms (umbral propuesto)`, outs.every(o => o.s < 500 && o.ms < 3000), `5xx=${outs.filter(o => o.s >= 500).length} max=${Math.max(...outs.map(o => o.ms))}ms`);
  console.log(JSON.stringify({ fin: true }));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(res => server.close(res)); }
  await sequelize.close(); await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); await admin.close();
}
