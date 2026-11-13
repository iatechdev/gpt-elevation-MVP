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
const DBN = 'q223', PORT = 8258, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9958'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9958', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-223 · PR #165 · no se puede solicitar el plan actual (P1–P9, R1) ──
const ADM = await mkUser('adm', 'admin');
// planes sintéticos (si el sembrado no los trae): 3 activos y 1 inactivo
const mkPlan = async (slug, active = true) => { const ex = (await q('select id from "PricingPlans" where slug=$1', [slug]))[0]; if (ex) { await q('update "PricingPlans" set "isActive"=$2 where id=$1', [ex.id, active]); return ex.id; } return (await q(`insert into "PricingPlans"(slug,name_es,name_en,price,currency,"isActive","createdAt","updatedAt") values($1,$2,$2,0,'USD',$3,now(),now()) returning id`, [slug, 'Plan ' + slug, active]))[0].id; };
const pA = await mkPlan('qa223a'), pB = await mkPlan('qa223b'), pC = await mkPlan('qa223c'), pX = await mkPlan('qa223x', false);
const setPlan = (u, id) => q('update "Users" set "planId"=$2 where id=$1', [u.id, id]);
const rows = async uid => (await q('select count(*)::int n from "PlanRequests" where "userId"=$1', [uid]))[0].n;
const post = (u, body) => call('POST', '/api/plan-requests', { token: u.token, body });
await setPlan(A, pA); await setPlan(B, pB);
// P1
const n0 = await rows(A.id); const p1 = await post(A, { planId: pA }); const n1 = await rows(A.id);
check('P1 solicitar el plan ACTUAL → 409 already_on_plan, mensaje ES/EN y NINGUNA fila nueva', p1.s === 409 && p1.json?.code === 'already_on_plan' && /Ya tienes/.test(p1.text) && /already have/.test(p1.text) && n1 === n0, `estado=${p1.s} código=${p1.json?.code} filas ${n0}→${n1}`);
// P2
const p2 = await post(A, { planId: pC }); const n2 = await rows(A.id); const noPlan = await mkUser('np'); const p2b = await post(noPlan, { planId: pA }); const p2c = await post(noPlan, { planId: pB });
check('P2 otro plan → 201 y una fila; una persona SIN plan puede pedir cualquiera (la segunda queda como pendiente → 409 de siempre)', p2.s === 201 && n2 === n1 + 1 && p2b.s === 201 && p2c.s === 409 && p2c.json?.code !== 'already_on_plan', `otro=${p2.s} filas=${n2} sinPlan=${p2b.s} segunda=${p2c.s} ${p2c.json?.code ?? ''}`);
// P3 cuerpo con campos extra
const C = await mkUser('C'); await setPlan(C, pA); const extras = [{ planId: pA, currentPlanId: pB }, { planId: pA, userId: B.id }, { planId: pA, status: 'approved' }, { planId: pA, plan: { id: pC } }]; const p3 = []; for (const b of extras) p3.push((await post(C, b)).s); const nC = await rows(C.id);
check('P3 el plan actual sale de la fila del dueño: cuerpos con currentPlanId/userId/status/plan extra → 400 (se rechazan), sin 5xx y sin filas', p3.every(s => s >= 400 && s < 500) && nC === 0, `estados=${p3.join(',')} filas=${nC}`);
// P4 id ajeno
const D = await mkUser('D'), E = await mkUser('E'); await setPlan(D, pA); await setPlan(E, pB);
const p4a = await post(E, { planId: pA }), p4b = await post(D, { planId: pB }), p4c = await post(D, { planId: pA }), p4d = await post(E, { planId: pB });
check('P4 cada persona se evalúa con SU plan: E (plan B) pide A → 201; D (plan A) pide B → 201 (pendiente propia); D pide A → 409 ya tienes / E pide B → 409 ya tienes o pendiente, sin cruces', p4a.s === 201 && p4b.s === 201 && [p4c, p4d].every(r => r.s === 409), `E→A=${p4a.s} D→B=${p4b.s} D→A=${p4c.s}/${p4c.json?.code} E→B=${p4d.s}/${p4d.json?.code}`);
const own = await call('GET', '/api/plan-requests/me', { token: E.token }); check('P4b la lista propia no trae solicitudes de otra persona', own.s === 200 && !own.text.includes(String(D.id) + '","userId'), `estado=${own.s}`);
// P5 pendiente previa
const F = await mkUser('F'); await setPlan(F, pA); const f1 = await post(F, { planId: pB }), f2 = await post(F, { planId: pC }), f3 = await post(F, { planId: pA });
check('P5 con una solicitud pendiente: otro plan → 409 (pendiente de siempre); el plan actual → 409 already_on_plan; ninguna fila nueva', f1.s === 201 && f2.s === 409 && f2.json?.code !== 'already_on_plan' && f3.s === 409 && f3.json?.code === 'already_on_plan' && (await rows(F.id)) === 1, `1ª=${f1.s} otro=${f2.s} (${f2.json?.code ?? 'pendiente'}) actual=${f3.s} (${f3.json?.code}) filas=${await rows(F.id)}`);
// P6 aprobación del administrador
const reqId = f1.json?.request?.id; const ap = await call('PUT', `/api/plan-requests/admin/${reqId}/approve`, { token: ADM.token, body: {} }); const planNow = (await q('select "planId" from "Users" where id=$1', [F.id]))[0].planId; const g1 = await post(F, { planId: pB }), g2 = await post(F, { planId: pA });
check('P6 tras aprobar el cambio (A→B): el plan nuevo es el «actual» (pedir B → 409 already_on_plan) y se puede volver a pedir el anterior (A → 201)', ap.s === 200 && Number(planNow) === pB && g1.s === 409 && g1.json?.code === 'already_on_plan' && g2.s === 201, `aprobar=${ap.s} plan=${planNow} pedirB=${g1.s}/${g1.json?.code} pedirA=${g2.s}`);
// P7 concurrencia
const G = await mkUser('G'); await setPlan(G, pA); const c1 = await Promise.all(Array.from({ length: 10 }, () => post(G, { planId: pA }))); const nG = await rows(G.id);
const H = await mkUser('H'); await setPlan(H, pA); const c2 = await Promise.all(Array.from({ length: 10 }, () => post(H, { planId: pB }))); const nH = await rows(H.id);
check('P7 10 envíos simultáneos del plan ACTUAL → 10×409 y 0 filas; 10 del MISMO plan distinto → una sola fila (1×201 y 9×409), sin 5xx', c1.every(r => r.s === 409) && nG === 0 && c2.filter(r => r.s === 201).length === 1 && c2.filter(r => r.s === 409).length === 9 && nH === 1, `actual: ${c1.map(r => r.s).join(',')} filas=${nG} · distinto: 201×${c2.filter(r => r.s === 201).length} 409×${c2.filter(r => r.s === 409).length} filas=${nH}`);
// P8 carrera con el administrador
const res8 = []; for (let k = 0; k < 6; k++) { const U = await mkUser('r' + k); await setPlan(U, pA); const [a, b] = await Promise.all([post(U, { planId: pB }), call('PUT', `/api/admin/usuarios/${U.id}/plan`, { token: ADM.token, body: { planId: pB } })]); const n = await rows(U.id); res8.push({ post: a.s, admin: b.s, filas: n, plan: (await q('select "planId" from "Users" where id=$1', [U.id]))[0].planId }); }
check('P8 carrera: la persona pide B mientras el administrador le cambia el plan a B (6 rondas): sin 5xx; si el plan ya es B → 409 sin fila; si no → 201', res8.every(r => r.post < 500 && r.admin < 500 && ((r.post === 409 && r.filas === 0) || (r.post === 201 && r.filas === 1))), JSON.stringify(res8));
// P9 entradas raras
const I = await mkUser('I'); await setPlan(I, pA); const odd = []; for (const b of [{ planId: 'abc' }, { planId: -1 }, { planId: 0 }, { planId: 1.5 }, { planId: 99999999999 }, { planId: { a: 1 } }, { planId: [pA] }, { planId: null }, {}, { planId: pX }, { planId: 999999 }, { planId: String(pA) }]) odd.push((await post(I, b)).s);
check('P9 entradas raras (texto, negativo, 0, decimal, enorme, objeto, arreglo, nulo, vacío, plan inactivo, inexistente): 4xx, nunca 5xx; el plan actual como texto numérico → 409', odd.every(s => s >= 400 && s < 500) && odd[11] === 409, odd.join(','));
const noAuth = await fetch(api + '/api/plan-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: pA }) });
check('P9b sin sesión → 401/403', [401, 403].includes(noAuth.status), `estado=${noAuth.status}`);
// R1 regresión
const lst = await call('GET', '/api/plan-requests/admin', { token: ADM.token }); const rej = await call('PUT', `/api/plan-requests/admin/${p2.json?.request?.id}/reject`, { token: ADM.token, body: { adminNote: 'QA' } }); const plans = await call('GET', '/api/plans'); const asUser = await call('GET', '/api/plan-requests/admin', { token: A.token });
check('R1 regresión: el administrador lista y rechaza; /api/plans responde; una persona no accede a la lista de administración (403)', lst.s === 200 && rej.s === 200 && plans.s === 200 && asUser.s === 403, `listar=${lst.s} rechazar=${rej.s} planes=${plans.s} persona→admin=${asUser.s}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-223-pr165.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES223 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
