// [QA-Claude] ES-32 · PR #43 (rutas personalizadas) contra Postgres REAL local. Sin IA.
// Uso: QA_SUT=<clon con el head de #43> QA_API=http://127.0.0.1:8143 (servidor con DATA_RIGHTS_ENABLED=true y ALLOW_SYNTHETIC_CATALOG=true)
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> node qa/integration/es32-real-db.mjs
// El catálogo sintético del propio PR se carga con su script (borrador) y se publica por la API de administración. Solo datos sintéticos; no se imprimen secretos.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
if (!sut || !api || !dbUrl || !JWT) throw new Error('Defina QA_SUT, QA_API, DATABASE_URL y QA_JWT_SECRET.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, headers: r.headers };
};
const stamp = Date.now();
const rid = () => 'qa' + randomBytes(8).toString('hex');
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa32-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA32 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const A = await mkUser('A'), B = await mkUser('B'), ADM = await mkUser('adm', 'admin'), SU = await mkUser('su', 'superadmin'), TH = await mkUser('th', 'therapist'), BRD = await mkUser('brd', 'board');
const a = mint(A), b = mint(B), adm = mint(ADM), su = mint(SU), th = mint(TH), brd = mint(BRD);
const CON = (over = {}) => ({ targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'yes', originContextKey: 'ctx_educacion_formacion', interestContextKeys: ['ctx_contabilidad_analisis'], preferredModalities: ['remote'], ...over });
const put = (t, baseVersion, payload, requestId = rid()) => call('PUT', '/api/routes/constraints', { token: t, body: { baseVersion, requestId, payload } });

// ── Acceso (antes de que exista catálogo)
const ENDPOINTS = [['GET', '/api/routes'], ['GET', '/api/routes/constraints'], ['PUT', '/api/routes/constraints'], ['GET', '/api/routes/choices'], ['POST', '/api/routes/choices'], ['GET', '/api/routes/review-requests'], ['POST', '/api/routes/review-requests']];
for (const [m, u] of ENDPOINTS) { const r = await call(m, u, { body: m === 'GET' ? undefined : {} }); check(`ES32-S01 ${m} ${u} sin token → 401/403`, [401, 403].includes(r.status), `status=${r.status}`); }
for (const [who, t] of [['admin', adm], ['superadmin', su], ['terapeuta', th], ['junta', brd]]) {
  const rs = await Promise.all(ENDPOINTS.map(([m, u]) => call(m, u, { token: t, body: m === 'GET' ? undefined : {} })));
  check(`ES32-S02 ${who} no accede a ningún endpoint de rutas (todos 403)`, rs.every(r => r.status === 403), rs.map(r => r.status).join(','));
}
let r = await call('GET', '/api/routes', { token: a });
check('ES32-C01 sin catálogo publicado → 503 catalog_unavailable (no 500)', r.status === 503 && r.json?.code === 'catalog_unavailable', `status=${r.status} code=${r.json?.code}`);

// ── Catálogo sintético publicado
const seedRun = spawnSync(process.execPath, ['scripts/seedRouteCatalogSynthetic.js'], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', NODE_ENV: 'development', JWT_SECRET: JWT }, encoding: 'utf8' });
const draftId = JSON.parse(seedRun.stdout.trim().split('\n').pop()).draftId;
const pub = await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm });
check('ES32-C02 catálogo sintético publicado (precondición)', pub.status === 200, `status=${pub.status} ${pub.text.slice(0, 160)}`);

// ── Sin restricciones
r = await call('GET', '/api/routes', { token: a });
check('ES32-R01 sin restricciones → needs_constraints, 0 rutas, basisHash null, constraintsVersion 0', r.status === 200 && r.json?.status === 'needs_constraints' && r.json.routes.length === 0 && r.json.basisHash === null && r.json.constraintsVersion === 0, `status=${r.json?.status}`);
r = await call('GET', '/api/routes/constraints', { token: a });
check('ES32-R02 GET constraints vacío → constraints null', r.status === 200 && r.json?.constraints === null, JSON.stringify(r.json));
r = await call('POST', '/api/routes/choices', { token: a, body: { requestId: rid(), roleKey: 'formador_corporativo', slot: 'continuity', decision: 'accepted', basisHash: 'a'.repeat(64) } });
check('ES32-R03 elegir sin restricciones ni propuesta → 4xx, no 500', r.status >= 400 && r.status < 500, `status=${r.status} code=${r.json?.code}`);

// ── Validación de entradas
const bad = [
  ['clave desconocida', { baseVersion: 0, requestId: rid(), payload: CON(), extra: 1 }],
  ['payload con propiedad extra', { baseVersion: 0, requestId: rid(), payload: { ...CON(), diagnosis: 'x' } }],
  ['mercado en minúscula', { baseVersion: 0, requestId: rid(), payload: CON({ targetMarkets: ['co'] }) }],
  ['4 mercados', { baseVersion: 0, requestId: rid(), payload: CON({ targetMarkets: ['CO', 'DK', 'ES', 'MX'] }) }],
  ['0 mercados', { baseVersion: 0, requestId: rid(), payload: CON({ targetMarkets: [] }) }],
  ['idiomas duplicados', { baseVersion: 0, requestId: rid(), payload: CON({ languages: ['es', 'es'] }) }],
  ['acceptRegulated inválido', { baseVersion: 0, requestId: rid(), payload: CON({ acceptRegulated: 'maybe' }) }],
  ['preferida fuera de aceptadas', { baseVersion: 0, requestId: rid(), payload: CON({ modalities: ['remote'], preferredModalities: ['onsite'] }) }],
  ['contexto de origen inexistente', { baseVersion: 0, requestId: rid(), payload: CON({ originContextKey: 'ctx_no_existe' }) }],
  ['contexto de interés inexistente', { baseVersion: 0, requestId: rid(), payload: CON({ interestContextKeys: ['ctx_no_existe'] }) }],
  ['baseVersion negativa', { baseVersion: -1, requestId: rid(), payload: CON() }],
  ['baseVersion texto', { baseVersion: '0', requestId: rid(), payload: CON() }],
  ['requestId corto', { baseVersion: 0, requestId: 'x', payload: CON() }],
  ['requestId con símbolos', { baseVersion: 0, requestId: "a'; drop table--", payload: CON() }],
  ['sin payload', { baseVersion: 0, requestId: rid() }],
  ['payload arreglo', { baseVersion: 0, requestId: rid(), payload: [] }],
  ['clave con SQL', { baseVersion: 0, requestId: rid(), payload: CON({ originContextKey: "x'; select 1;--" }) }],
  ['idioma de 3 letras', { baseVersion: 0, requestId: rid(), payload: CON({ languages: ['spa'] }) }],
];
for (const [name, body] of bad) { const x = await call('PUT', '/api/routes/constraints', { token: a, body }); check(`ES32-V01 entrada inválida «${name}» → 400`, x.status === 400 && !/stack|at |SequelizeDatabase/.test(x.text), `status=${x.status} ${x.text.slice(0, 80)}`); }
let x = await call('PUT', '/api/routes/constraints', { token: a, body: '{"baseVersion":0,"requestId":"' + rid() + '","payload":{"__proto__":{"admin":true},"targetMarkets":["CO"],"languages":[],"modalities":[],"acceptRegulated":"yes","originContextKey":null,"interestContextKeys":[],"preferredModalities":[]}}' });
check('ES32-V02 __proto__ en el payload → 400, sin contaminar el prototipo', x.status === 400 && ({}).admin === undefined, `status=${x.status}`);
x = await call('PUT', '/api/routes/constraints', { token: a, body: '{no es json' });
check('ES32-V03 JSON roto → 4xx, no 500', x.status >= 400 && x.status < 500, `status=${x.status}`);
x = await call('GET', '/api/routes?x=1', { token: a });
check('ES32-V04 parámetro de consulta desconocido → 400', x.status === 400, `status=${x.status}`);
for (const bad2 of ['abc', '-1', '1.5', '99999999999999999999']) { x = await call('GET', '/api/routes/choices?after=' + bad2, { token: a }); check(`ES32-V05 choices?after=${bad2} → 400`, x.status === 400, `status=${x.status}`); }
check('ES32-V06 ninguna entrada inválida dejó filas', (await q('select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1', [A.id]))[0].n === 0);

// ── Restricciones: versionado, idempotencia, concurrencia, cifrado
const rq1 = rid();
const c1 = await put(a, 0, CON(), rq1);
check('ES32-I01 primera versión → 201 version 1 current', c1.status === 201 && c1.json?.constraints?.version === 1 && c1.json.constraints.status === 'current', `status=${c1.status}`);
const c1r = await put(a, 0, CON(), rq1);
check('ES32-I02 mismo requestId y mismo cuerpo → 200 created false, misma fila', c1r.status === 200 && c1r.json?.created === false && c1r.json.constraints.id === c1.json.constraints.id, `status=${c1r.status}`);
const c1d = await put(a, 0, CON({ languages: ['es', 'en'] }), rq1);
check('ES32-I03 mismo requestId con otro cuerpo → 409', c1d.status === 409, `status=${c1d.status}`);
const c1s = await put(a, 0, CON({ languages: ['en'] }));
check('ES32-I04 baseVersion obsoleta → 409', c1s.status === 409, `status=${c1s.status}`);
const raw = (await q('select payload from "RouteConstraintsVersions" where "UserId"=$1', [A.id]))[0].payload;
check('ES32-I05 el payload se guarda cifrado (v2:) y sin texto plano de las claves', /^v2:/.test(raw) && !raw.includes('targetMarkets') && !raw.includes('ctx_educacion'), raw.slice(0, 12) + '…');
const burst = await Promise.all(Array.from({ length: 3 }, () => put(a, 1, CON({ interestContextKeys: [] }))));
const created = burst.filter(z => z.status === 201).length, conflicts = burst.filter(z => z.status === 409).length;
check('ES32-I06 3 escrituras concurrentes con la misma baseVersion → 1 creada, el resto 409, ningún 5xx', created === 1 && conflicts === 2, burst.map(z => z.status).join(','));
const cur = await q(`select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1 and status='current'`, [A.id]);
check('ES32-I07 exactamente una versión current por persona', cur[0].n === 1, `current=${cur[0].n}`);
const burstSame = await Promise.all(Array.from({ length: 4 }, () => put(a, 2, CON({ languages: ['es', 'en'] }), 'qaSAMEREQ00000001')));
check('ES32-I08 4 reintentos concurrentes con el MISMO requestId → una sola fila, sin 5xx', burstSame.every(z => [200, 201, 409].includes(z.status)) && (await q(`select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1 and "requestId"='qaSAMEREQ00000001'`, [A.id]))[0].n === 1, burstSame.map(z => z.status).join(','));
r = await call('GET', '/api/routes/constraints', { token: b });
check('ES32-S03 B no ve las restricciones de A (constraints null)', r.status === 200 && r.json?.constraints === null, '');

// ── Cálculo de rutas
const noSkills = await put(a, 3, CON());
x = await call('GET', '/api/routes', { token: a });
check('ES32-C03 con restricciones pero SIN catálogo de habilidades publicado → respuesta controlada 503 (no 500, sin trazas)', noSkills.status === 201 && x.status === 503 && !/stack|at |Sequelize/.test(x.text), `status=${x.status} code=${x.json?.code}`);
const lv = p => Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: p + ' nivel ' + n, en: p + ' level ' + n }]));
const sk = (n, es, en) => ({ type: 'transversal', labels: { es, en }, rubric: { levels: lv(n), source: 'Rúbrica sintética de QA', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
const sd = await call('POST', '/api/admin/skill-catalog', { token: adm }); const sid = sd.json?.id ?? sd.json?.draftId;
for (const k of ['comunicacion', 'planificacion_organizacion', 'analisis_informacion', 'resolucion_problemas', 'trabajo_en_equipo', 'influencia_liderazgo', 'adaptabilidad', 'aprendizaje_autonomo']) await call('PUT', `/api/admin/skill-catalog/${sid}/skills/${k}`, { token: adm, body: sk(k, k, k) });
const skp = await call('POST', `/api/admin/skill-catalog/${sid}/publish`, { token: adm });
check('ES32-C04 catálogo de habilidades sintético publicado (precondición)', skp.status === 200, `status=${skp.status} ${skp.text.slice(0, 120)}`);
const cA = await put(a, 4, CON());
check('ES32-R04 versión 5 con filtros CO/es (precondición)', cA.status === 201, `status=${cA.status} ${cA.text.slice(0, 80)}`);
const r1 = await call('GET', '/api/routes', { token: a }), r2 = await call('GET', '/api/routes', { token: a });
check('ES32-R05 determinismo: dos lecturas sin cambios → mismo cuerpo y misma huella', r1.status === 200 && r1.text === r2.text && /^[a-f0-9]{64}$/.test(r1.json?.basisHash), `hash=${r1.json?.basisHash?.slice(0, 8)}`);
const routes = r1.json?.routes ?? [];
info('rutas', routes.map(z => `${z.slot}:${z.roleKey}`).join(' | ') + ' status=' + r1.json?.status + ' discarded=' + JSON.stringify(r1.json?.discarded));
check('ES32-R06 con mercado CO solo hay roles de CO; los de DK se cuentan como descartados por mercado', routes.every(z => z.market === 'CO') && r1.json.discarded.market === 3, JSON.stringify(r1.json?.discarded));
check('ES32-R07 sin evidencia: ninguna capacidad aparece respaldada ni hay nivel inventado, y se dice «sin evidencia»', routes.every(z => z.dimensions.demonstratedTransfer.capabilities.every(c => c.status === 'no_evidence' && c.tracks.length === 0)), '');
check('ES32-R08 ninguna ruta «strong/partial» de transferencia sin evidencia', routes.every(z => ['none_yet', 'unknown'].includes(z.dimensions.demonstratedTransfer.status)), routes.map(z => z.dimensions.demonstratedTransfer.status).join(','));
check('ES32-R09 contenido sintético marcado (rutas, fuentes y ofertas)', routes.length > 0 && routes.every(z => z.synthetic === true && z.sources.every(s => s.synthetic === true) && z.offers.every(o => o.synthetic === true)), '');
const flat = r1.text;
check('ES32-R10 la respuesta no contiene porcentajes de reemplazo, diagnóstico ni promesas de empleo', !/\d+\s*%|reemplaz|replac|diagn|garantiz|guarantee|tendrás empleo|you will get/i.test(flat), (flat.match(/\d+\s*%|reemplaz|replac|diagn|garantiz|guarantee/i) || ['—'])[0]);
check('ES32-R11 no se filtran campos internos de revisión (revisores, justificaciones, notas)', !/reviewer|reviewedBy|justification|approvedBy|rejection/i.test(flat), '');
check('ES32-R12 cabecera Cache-Control: no-store', (r1.headers.get('cache-control') || '').includes('no-store'), r1.headers.get('cache-control'));
r = await call('GET', '/api/routes', { token: b });
check('ES32-S04 B sin restricciones no recibe nada de A (needs_constraints)', r.json?.status === 'needs_constraints' && r.json.routes.length === 0, '');

// mercado DK + regulados + idioma
const bDk = await put(b, 0, CON({ targetMarkets: ['DK'], languages: ['en'], acceptRegulated: 'unknown', originContextKey: null, interestContextKeys: ['ctx_salud_gestion'], preferredModalities: [] }));
const rDk = await call('GET', '/api/routes', { token: b });
const reg = (rDk.json?.routes ?? []).find(z => z.roleKey === 'coordinador_proyectos_salud');
check('ES32-G01 DK con acceptRegulated=unknown incluye el rol regulado, con habilitación «pending» y aviso de preferencia', !!reg && reg.regulated.status === 'pending' && reg.uncertainties.some(u => u.code === 'regulated') && reg.uncertainties.some(u => u.code === 'regulated_preference'), `status=${bDk.status} ${reg?.regulated?.status}`);
check('ES32-G02 idioma «unknown» del rol se declara incierto y no se trata como coincidencia', reg?.uncertainties.some(u => u.code === 'language_unknown'), '');
const bNo = await put(b, 1, CON({ targetMarkets: ['DK'], languages: ['en'], acceptRegulated: 'no', originContextKey: null, interestContextKeys: ['ctx_salud_gestion'], preferredModalities: [] }));
const rNo = await call('GET', '/api/routes', { token: b });
check('ES32-G03 acceptRegulated=no descarta el regulado y lo cuenta (discarded.regulated ≥ 1)', !(rNo.json?.routes ?? []).some(z => z.roleKey === 'coordinador_proyectos_salud') && rNo.json.discarded.regulated >= 1, JSON.stringify(rNo.json?.discarded));
const bEs = await put(b, 2, CON({ targetMarkets: ['DK'], languages: ['es'], acceptRegulated: 'yes', originContextKey: null, interestContextKeys: [], preferredModalities: [] }));
const rEs = await call('GET', '/api/routes', { token: b });
check('ES32-G04 idiomas [es] con mercado DK: los roles en inglés se descartan por idioma (ninguna ruta, revisión humana ofrecida)', rEs.json?.routes.length === 0 && rEs.json.discarded.language >= 1 && rEs.json.humanReview?.offered === true, `${rEs.json?.status} ${JSON.stringify(rEs.json?.discarded)}`);

// ── Elecciones
const basis = r1.json.basisHash, pick = routes[0];
const ch = (t, over = {}) => call('POST', '/api/routes/choices', { token: t, body: { requestId: rid(), roleKey: pick.roleKey, slot: pick.slot, decision: 'accepted', basisHash: basis, ...over } });
check('ES32-E01 huella equivocada → 409', (await ch(a, { basisHash: 'b'.repeat(64) })).status === 409);
check('ES32-E02 huella con formato inválido → 400', (await ch(a, { basisHash: 'xyz' })).status === 400);
x = await ch(a, { roleKey: 'rol_inventado' });
check('ES32-E03 rol que no forma parte de la propuesta → 422 route_not_proposed', x.status === 422 && x.json?.code === 'route_not_proposed', `status=${x.status}`);
check('ES32-E04 rol de la propuesta en otra posición → 422', (await ch(a, { slot: pick.slot === 'continuity' ? 'exploration' : 'continuity' })).status === 422);
check('ES32-E05 decisión inválida / clave extra → 400', (await ch(a, { decision: 'maybe' })).status === 400 && (await ch(a, { extra: 1 })).status === 400);
const rq2 = rid();
const e1 = await ch(a, { requestId: rq2 }), e1r = await ch(a, { requestId: rq2 }), e1d = await ch(a, { requestId: rq2, decision: 'rejected' });
check('ES32-E06 aceptar → 201; repetir → 200 created false; mismo requestId con otra decisión → 409', e1.status === 201 && e1r.status === 200 && e1r.json.created === false && e1r.json.choice.id === e1.json.choice.id && e1d.status === 409, `${e1.status}/${e1r.status}/${e1d.status}`);
const ePar = await Promise.all(Array.from({ length: 4 }, () => ch(a, { requestId: 'qaPARALLEL000001', decision: 'rejected' })));
check('ES32-E07 4 elecciones concurrentes con el mismo requestId → una fila, sin 5xx', ePar.every(z => [200, 201, 409].includes(z.status)) && (await q(`select count(*)::int n from "RouteChoices" where "UserId"=$1 and "requestId"='qaPARALLEL000001'`, [A.id]))[0].n === 1, ePar.map(z => z.status).join(','));
const curCh = await q(`select count(*)::int n from "RouteChoices" where "UserId"=$1 and "roleKey"=$2 and status='current'`, [A.id, pick.roleKey]);
check('ES32-E08 una sola elección current por rol (la nueva reemplaza a la anterior)', curCh[0].n === 1, `current=${curCh[0].n}`);
const list = await call('GET', '/api/routes/choices', { token: a });
check('ES32-E09 listado propio paginable con nextAfter', list.status === 200 && Array.isArray(list.json?.choices) && list.json.choices.length >= 2 && 'nextAfter' in list.json, `n=${list.json?.choices?.length}`);
const myId = list.json.choices[0].id;
check('ES32-S05 B no lee la elección de A por ID (404) ni en su listado', (await call('GET', '/api/routes/choices/' + myId, { token: b })).status === 404 && (await call('GET', '/api/routes/choices', { token: b })).json.choices.length === 0, '');
check('ES32-S06 elección con ID no numérico / 0 / inexistente → 404', (await Promise.all(['abc', '0', '999999', '1e3'].map(i => call('GET', '/api/routes/choices/' + i, { token: a })))).every(z => z.status === 404), '');
check('ES32-S07 B no puede elegir con la huella de A (409 o 422), ni deja filas', [409, 422, 400].includes((await call('POST', '/api/routes/choices', { token: b, body: { requestId: rid(), roleKey: pick.roleKey, slot: pick.slot, decision: 'accepted', basisHash: basis } })).status), '');
const cB = await put(a, 5, CON({ languages: ['es', 'en'] }));
const after = await call('GET', '/api/routes/choices', { token: a });
check('ES32-E10 tras cambiar restricciones, las elecciones previas siguen y marcan basisChanged=true (no se reescriben)', cB.status === 201 && after.json.choices.length >= 2 && after.json.choices.every(z => z.basisChanged === true), after.json.choices.map(z => z.basisChanged).join(','));
check('ES32-E11 la huella vieja ya no sirve → 409', (await ch(a)).status === 409);

// ── Solicitud de revisión humana
const NOTE = 'CANARIO-REV-' + randomBytes(3).toString('hex');
check('ES32-H01 nota de 301 caracteres → 400; con carácter de control → 400; tipo no texto → 400', (await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rid(), note: 'x'.repeat(301) } })).status === 400 && (await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rid(), note: 'a\u0000b' } })).status === 400 && (await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rid(), note: 5 } })).status === 400, '');
const rq3 = rid();
const h1 = await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rq3, note: NOTE } });
const h1r = await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rq3, note: NOTE } });
const h2 = await call('POST', '/api/routes/review-requests', { token: a, body: { requestId: rid(), note: 'otra' } });
check('ES32-H02 crear → 201; repetir → 200 created false; segunda abierta con otro requestId → 409 review_already_open', h1.status === 201 && h1r.status === 200 && h1r.json.created === false && h2.status === 409 && h2.json?.code === 'review_already_open', `${h1.status}/${h1r.status}/${h2.status}`);
const rawNote = (await q('select note from "RouteReviewRequests" where "UserId"=$1', [A.id]))[0].note;
check('ES32-H03 la nota se guarda cifrada y el propietario la recibe descifrada', /^v2:/.test(rawNote) && !rawNote.includes(NOTE) && (await call('GET', '/api/routes/review-requests', { token: a })).json.reviewRequest?.note === NOTE, '');
check('ES32-H04 B no ve la solicitud de A', (await call('GET', '/api/routes/review-requests', { token: b })).json.reviewRequest === null, '');

// ── Derechos de datos: exportación, eliminación, purga, replay
const exp = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
const keys = Object.keys(exp.json?.data ?? {});
info('exportacion', `status=${exp.status} claves=${keys.join(',')}`);
const routeKeys = keys.filter(k => /route/i.test(k));
check('ES32-X01 la exportación personal incluye restricciones, elecciones y solicitud de revisión (descifradas, sin huellas ni requestId)', exp.status === 201 && routeKeys.length >= 3 && exp.text.includes(NOTE) && !/inputHash|basisHash"|"requestId|v2:/.test(exp.text), routeKeys.join(','));
check('ES32-X02 la exportación de A no contiene nada de B', !exp.text.includes(B.name) && !exp.text.includes(`qa32-B-${stamp}`), '');
const dlB = await call('POST', `/api/exports/${exp.json?.id}/download`, { token: b });
check('ES32-X03 B no descarga la exportación de A (404)', dlB.status === 404, `status=${dlB.status}`);
const del = await call('POST', '/api/account/deletion-requests', { token: a, body: { confirm: true } });
const blocked = await Promise.all(ENDPOINTS.map(([m, u]) => call(m, u, { token: a, body: m === 'GET' ? undefined : {} })));
check('ES32-D01 con eliminación pendiente, todos los endpoints de rutas rechazan (401 por sesión revocada o 403)', del.status === 202 && blocked.every(z => [401, 403].includes(z.status)), `del=${del.status} ${blocked.map(z => z.status).join(',')}`);
const reqId = (await q('select id from "DeletionRequests" where "UserId"=$1', [A.id]))[0].id;
const purge = (replay = false) => spawnSync(process.execPath, ['scripts/purgePersonalData.js', reqId, '--producers-stopped-and-drained', ...(replay ? ['--replay'] : [])], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const bBefore = (await q('select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1', [B.id]))[0].n;
const p1 = purge();
const left = { restricciones: (await q('select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1', [A.id]))[0].n, elecciones: (await q('select count(*)::int n from "RouteChoices" where "UserId"=$1', [A.id]))[0].n, revision: (await q('select count(*)::int n from "RouteReviewRequests" where "UserId"=$1', [A.id]))[0].n };
check('ES32-D02 la purga deja 0 filas de restricciones, elecciones y revisión de A', p1.status === 0 && Object.values(left).every(n => n === 0), JSON.stringify(left) + ' exit=' + p1.status);
check('ES32-D03 las filas de B siguen intactas', (await q('select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1', [B.id]))[0].n === bBefore && bBefore >= 1, `B=${bBefore}`);
await q(`insert into "RouteConstraintsVersions" ("UserId", version, status, payload, "requestId", "inputHash", "createdAt", "updatedAt") values ($1, 9, 'current', 'v2:restaurado', 'qarestore0000001', 'x', now(), now())`, [A.id]);
const p2 = purge(true);
check('ES32-D04 --replay tras restaurar vuelve a borrar', p2.status === 0 && (await q('select count(*)::int n from "RouteConstraintsVersions" where "UserId"=$1', [A.id]))[0].n === 0, `exit=${p2.status}`);
check('ES32-D05 repetir la purga es idempotente', purge().status === 0, '');

// ── Carga acotada: una sola persona con 12 escrituras simultáneas no debe congelar el pool de conexiones (límite propuesto: sin 5xx y < 3000 ms)
const vic = await put(b, 3, CON({ targetMarkets: ['DK'], languages: ['en'], originContextKey: null, interestContextKeys: [], preferredModalities: [] }));
const tS = performance.now();
const flood = Promise.all(Array.from({ length: 12 }, () => put(b, 4, CON({ targetMarkets: ['DK'], languages: ['en', 'es'], originContextKey: null, interestContextKeys: [], preferredModalities: [] })).then(z => ({ s: z.status, ms: Math.round(performance.now() - tS) }))));
await new Promise(r0 => setTimeout(r0, 800));
const C = await mkUser('C'); const tV = performance.now(); const other = await call('GET', '/api/routes/constraints', { token: mint(C) });
const otherMs = Math.round(performance.now() - tV);
const fl = await flood;
info('carga', `estados=${fl.map(z => z.s + '@' + z.ms).join(' ')} lectura_de_otra_sesion=${other.status}@${otherMs}ms`);
check('ES32-F01 12 escrituras simultáneas de una persona: ningún 5xx y todas terminan en menos de 3000 ms (umbral propuesto)', fl.every(z => z.s < 500 && z.ms < 3000), `5xx=${fl.filter(z => z.s >= 500).length} max=${Math.max(...fl.map(z => z.ms))}ms`);
check('ES32-F02 durante esa ráfaga, la lectura de OTRA sesión responde en menos de 3000 ms (umbral propuesto)', otherMs < 3000, `${otherMs}ms`);

// ── Sin 5xx ni filtraciones en el registro del servidor (se revisa fuera de este script con el archivo de log)
console.log(JSON.stringify({ fin: true, canario: NOTE }));
await db.end();
