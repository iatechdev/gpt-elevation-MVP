// [QA-Claude] ES-33 · QA-33-02 · PR #132 (head c82abdf2): huella por capacidades de la ruta + evidencia citada, rebase que conserva el trabajo, adopt/discard.
// HTTP contra el servidor del merge local con Postgres REAL (ES-14 + ES-32 + ES-33 reales, sin dobles), datos sintéticos, 0 tokens de IA.
// Uso: node qa/integration/es33-qa132.mjs   (arranca y detiene su propio servidor; no imprime secretos)
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'C:/Users/Usuario/Documents/qa-pr-test', BACK = ROOT + '/backend', S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q216', PORT = 8252, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 330) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', ALLOW_SYNTHETIC_CATALOG: 'true', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', AI_BUDGET_TOKENS_PER_USER: '1000', AI_BUDGET_TOKENS_COHORT: '10000', NODE_ENV: 'development' } });
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { const t = (await db.query(`select to_regclass('"Users"') t, to_regclass('"CareerExperimentVersions"') c, to_regclass('"RouteChoices"') r`)).rows[0]; if (t.t && t.c && t.r) break; await sleep(500); } await sleep(2000); const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const rid = () => 'qa' + randomBytes(8).toString('hex');
const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa33r-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA33R ' + tag, email, password } }); if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
// catálogos sintéticos
const adm = await mkUser('adm', 'admin'); const seed = spawnSync(process.execPath, ['scripts/seedRouteCatalogSynthetic.js'], { cwd: BACK, env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', NODE_ENV: 'development', ALLOW_SYNTHETIC_CATALOG: 'true', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK }, encoding: 'utf8' });
const draftId = JSON.parse(seed.stdout.trim().split('\n').pop()).draftId; await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm.token });
const lv = p => Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: p + ' nivel ' + n, en: p + ' level ' + n }]));
const sd = await call('POST', '/api/admin/skill-catalog', { token: adm.token }); const sid = sd.json?.id ?? sd.json?.draftId; const SK = ['comunicacion', 'planificacion_organizacion', 'analisis_informacion', 'resolucion_problemas', 'trabajo_en_equipo', 'influencia_liderazgo', 'adaptabilidad', 'aprendizaje_autonomo'];
for (const k of SK) await call('PUT', `/api/admin/skill-catalog/${sid}/skills/${k}`, { token: adm.token, body: { type: 'transversal', labels: { es: k, en: k }, rubric: { levels: lv(k), source: 'Sintética QA', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } } });
check('SET catálogos sintéticos publicados', (await call('POST', `/api/admin/skill-catalog/${sid}/publish`, { token: adm.token })).status === 200);
const ctx = (over = {}) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: 'Docente ficticia', interests: 'datos', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [], ...over });
const putCtx = async (u, action, over) => { const v = (await q('select version from "ParticipantContexts" where "UserId"=$1', [u.id]))[0]?.version ?? 0; return call('PUT', '/api/user/context', { token: u.token, body: { schemaVersion: 2, expectedVersion: v, action, context: ctx(over) } }); };
const CON = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'yes', originContextKey: 'ctx_educacion_formacion', interestContextKeys: [], preferredModalities: [] };
const putCon = (u, base, over = {}) => call('PUT', '/api/routes/constraints', { token: u.token, body: { baseVersion: base, requestId: rid(), payload: { ...CON, ...over } } });
const accept = async u => { const r = await call('GET', '/api/routes', { token: u.token }); const route = r.json?.routes?.[0]; const c = await call('POST', '/api/routes/choices', { token: u.token, body: { requestId: rid(), roleKey: route.roleKey, slot: route.slot, decision: 'accepted', basisHash: r.json.basisHash } }); return { id: c.json?.choice?.id, route, status: c.status }; };
const ready = async tag => { const u = await mkUser(tag); const pc = await putCtx(u, 'continue'); if (pc.status >= 300) console.log(JSON.stringify({ info: 'putCtx', status: pc.status, text: pc.text.slice(0, 200) })); await putCon(u, 0); const c = await accept(u); return { u, choice: c }; };
const EV = t => ({ title: 'Evidencia sintética ' + t, situation: 'Situación sintética', responsibility: { text: 'Yo reuní la información y la expliqué.' }, actions: [{ text: 'Reuní tres fuentes' }, { text: 'Separé datos de interpretaciones' }], delivered: { text: 'Informe entregado' }, observedEffect: { known: false }, autonomy: 'assisted' });
const mkEv = async (u, t = 'x') => { const r = await call('POST', '/api/evidence', { token: u.token, body: { requestId: rid(), status: 'confirmed', payload: EV(t), origins: [] } }); return { id: r.json?.id, version: r.json?.version ?? 1, status: r.status }; };
const selfAssess = (u, skillKey, ev, level = 2) => call('POST', '/api/skill-map/self', { token: u.token, body: { skillKey, level, evidenceRefs: [{ evidenceId: ev.id, version: ev.version }], requestId: rid() } });
const propose = (u, choiceId) => call('POST', '/api/experiments/proposals', { token: u.token, body: { choiceId, taskIndex: 0, minutes: 20 } });
const create = async (u, choiceId) => { const p = await propose(u, choiceId); const c = await call('POST', '/api/experiments', { token: u.token, body: { requestId: rid(), proposal: p.json?.proposal, token: p.json?.token } }); if (c.status !== 201) console.log(JSON.stringify({ info: 'create falló', propose: p.status, pcode: p.json?.code, create: c.status, ccode: c.json?.code, text: c.text.slice(0, 160) })); return { id: c.json?.experimentId, status: c.status }; };
const ch = (u, id, change, v, requestId = rid()) => call('POST', `/api/experiments/${id}/versions`, { token: u.token, body: { requestId, expectedVersion: v, change } });
const view = (u, id) => call('GET', '/api/experiments/' + id, { token: u.token });
const reasonsOf = r => r.json?.basis?.reasons ?? [];
const capsOf = async u => (await call('GET', '/api/routes', { token: u.token })).json.routes[0].dimensions.demonstratedTransfer.capabilities.map(c => c.skillKey);
const decide = async (u, id, evRefs = []) => { let v = 1; for (const c of [{ action: 'start' }, { action: 'submit', sample: 'Muestra sintética propia', evidenceRefs: evRefs, assistance: 'none' }, { action: 'reflect', observation: 'obs propia', interpretation: 'interp propia' }, { action: 'decide', decision: 'continue', reason: 'razón propia' }]) { const z = await ch(u, id, c, v); v = z.json?.version?.version ?? v; } return v; };

// ── ES-216 · PR #158 · rendimiento de la lectura del experimento con muchas evidencias (A/B) ──
const LABEL = process.env.LABEL || 'x'; const EVNS = (process.env.EVNS || '30,100,200').split(',').map(Number);
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.max(0, Math.ceil(s.length * 0.95) - 1)]; };
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const scans = async () => { await sleep(1800); const r = await q(`select relname, coalesce(seq_scan,0)+coalesce(idx_scan,0) n from pg_stat_user_tables where relname in ('Evidence','EvidenceVersions')`); return Object.fromEntries(r.map(x => [x.relname, Number(x.n)])); };
const strip = (k, v) => /(At$|^ts$|token|hash|Hash)/.test(k) ? undefined : v;
const res = { label: LABEL, runs: {} }; const writes = []; let norm = null;
for (const N of EVNS) {
  const P = await ready('P' + N); const e = await create(P.u, P.choice.id); const evs = []; globalThis.__last = { P, e, evs };
  for (let i = 0; i < N; i++) { const t0 = performance.now(); const r = await mkEv(P.u, 'p' + i); writes.push(performance.now() - t0); evs.push(r); }
  await view(P.u, e.id); const s0 = await scans(); await view(P.u, e.id); const s1 = await scans();
  const lat = []; for (let i = 0; i < 40; i++) lat.push((await view(P.u, e.id)).ms);
  const conc = []; for (let k = 0; k < 5; k++) { const rs = await Promise.all(Array.from({ length: 6 }, () => view(P.u, e.id))); conc.push(...rs.map(r => r.ms)); }
  res.runs[N] = { scansEvidencesPorGET: s1.Evidence - s0.Evidence, scansVersionsPorGET: s1.EvidenceVersions - s0.EvidenceVersions, seqP50: Math.round(med(lat)), seqP95: Math.round(p95(lat)), concP95: Math.round(p95(conc)), status: (await view(P.u, e.id)).status };
  if (N === EVNS[0]) {
    const B = await mkUser('B' + N); const foreign = await view(B, e.id); const foreignEv = await call('GET', '/api/evidence/' + evs[0].id, { token: B.token });
    res.s1 = { experimentoAjeno: foreign.status, evidenciaAjena: foreignEv.status };
    const g = async () => ({ exp: (await view(P.u, e.id)).json, ev: (await call('GET', '/api/evidence', { token: P.u.token })).json, map: (await call('GET', '/api/skill-map', { token: P.u.token })).json, routes: (await call('GET', '/api/routes', { token: P.u.token })).json });
    const before = await g(); const del = await call('DELETE', '/api/evidence/' + evs[1].id, { token: P.u.token }); const put = await call('PUT', '/api/evidence/' + evs[2].id, { token: P.u.token, body: { requestId: rid(), expectedVersion: 1, status: 'confirmed', payload: EV('editada'), origins: [] } }); const after = await g();
    res.s2 = { delete: del.status, put: put.status, evBefore: before.ev?.evidence?.length ?? before.ev?.items?.length ?? null, evAfter: after.ev?.evidence?.length ?? after.ev?.items?.length ?? null };
    norm = JSON.stringify({ before, after, del: del.status, put: put.status }, strip); fs.writeFileSync(`${S}/c1-${LABEL}.json`, norm);
    res.c1sha = (await import('node:crypto')).createHash('sha256').update(norm).digest('hex').slice(0, 16); res.c1bytes = norm.length;
  }
}
const chain = []; { const { P, e, evs } = globalThis.__last; const caps = await capsOf(P.u); const T = async (n, fn) => { const t0 = performance.now(); const r = await fn(); chain.push({ n, ms: Math.round(performance.now() - t0), s: r?.status }); return r; }; for (let i = 0; i < 3; i++) await T('autoevaluacion', () => selfAssess(P.u, caps[i % caps.length], evs[i])); let v = 1; const steps = [{ action: 'start' }, { action: 'submit', sample: 'Muestra sintética propia', evidenceRefs: [], assistance: 'none' }, { action: 'reflect', observation: 'obs propia', interpretation: 'interp propia' }]; for (const c of steps) { const r = await T('experimento:' + c.action, () => ch(P.u, e.id, c, v)); if (r.status === 201 || r.status === 200) v = (r.json?.version ?? v + 1); } for (let i = 0; i < 3; i++) await T('lectura', () => view(P.u, e.id)); } res.cadena = chain;
const sa = await mkUser('selfa'); const w2 = []; // escrituras de la cadena con el último usuario grande
const big = (await q(`select "UserId" from "Evidence" group by "UserId" order by count(*) desc limit 1`))[0].UserId; const bigU = { id: big, name: 'x', role: 'user', token: mint({ id: big, name: 'x', role: 'user' }) };
for (let i = 0; i < 20; i++) { const t0 = performance.now(); await mkEv(bigU, 'w' + i); w2.push(performance.now() - t0); }
const ex = (await q(`select "id" from "CareerExperiments" where "UserId"=$1 limit 1`, [big]))[0]?.id; const ch2 = []; if (ex) { for (let i = 0; i < 8; i++) { const t0 = performance.now(); await view(bigU, ex); ch2.push(performance.now() - t0); } }
res.escrituras = { evidenciasP95: Math.round(p95([...writes, ...w2])), evidenciasMax: Math.round(Math.max(...writes, ...w2)), n: writes.length + w2.length };
fs.writeFileSync(`${S}/perf-${LABEL}.json`, JSON.stringify(res, null, 1)); console.log('RESULT ' + JSON.stringify(res));
srv.kill(); await db.end(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`).catch(() => {}); await admin.end(); process.exit(0);
