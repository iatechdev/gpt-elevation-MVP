// [QA-Claude] ES-171 · PR #178 · el texto «Tu profesional dejará de ver este contexto» es CIERTO con Postgres REAL (retiro directo, A/B, no reaparece, versión nueva, consentimiento+derivados, abuso). 0 IA, datos sintéticos.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8091 DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es25-real-db.mjs
// Solo datos sintéticos (@example.test). No se imprimen contraseñas ni tokens.
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
  const t0 = performance.now();
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa171-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA171 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
const rid = () => 'qa' + randomBytes(8).toString('hex');
const tag = () => randomBytes(4).toString('hex');
const CAN_DIARY = 'CANARIO-DIARIO-' + tag(), CAN_CHAT = 'CANARIO-CHAT-' + tag(), CAN_CRISIS = 'CANARIO-CRISIS-' + tag();
const A = await mkUser('A'), B = await mkUser('B'), ADM = await mkUser('adm', 'admin'), TH = await mkUser('th', 'therapist');
const a = mint(A), b = mint(B);
const grant = (t, s = 'granted') => call('PUT', '/api/consents/professional_bridge', { token: t, body: { status: s } });
const motiv = (text, extra = {}) => ({ key: 'motivations', text, ...extra });
const engine = (userId) => { // ejecuta getApprovedContext directamente, como lo haría el motor
  const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{const m=require('./utils/careerContext');try{console.log(JSON.stringify(await m.getApprovedContext(${userId},'qa-engine')))}catch(e){console.log(JSON.stringify({error:e.code||e.name,status:e.status}))}process.exit(0)})()`],
    { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
  const line = r.stdout.trim().split('\n').filter(l => l.startsWith('{') || l === 'null').pop();
  try { return JSON.parse(line); } catch { return { raw: (r.stdout + r.stderr).slice(0, 200) }; }
};

// ── ES-171 · P1–P7 (cola; la cabeza es la de es25-real-db.mjs con prefijo qa171)
import { spawn } from 'node:child_process';
const engineAsync = (userId) => new Promise((resolve) => {
  const p = spawn(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{const m=require('./utils/careerContext');try{console.log(JSON.stringify(await m.getApprovedContext(${userId},'qa-engine')))}catch(e){console.log(JSON.stringify({error:e.code||e.name,status:e.status}))}process.exit(0)})()`],
    { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT } });
  let out = ''; p.stdout.on('data', d => out += d); p.on('close', () => { const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop(); try { resolve(JSON.parse(line)); } catch { resolve({ raw: out.slice(0, 200) }); } });
});
const noText = (o, s) => !JSON.stringify(o).includes(s);
const direct171 = (t) => [{ key: 'motivations', text: t }];
const approve = async (tok, fields, requestId = rid()) => { const pv = await call('POST', '/api/career-context/preview', { token: tok, body: { fields } }); const cf = await call('POST', '/api/career-context/confirm', { token: tok, body: { fields, token: pv.json?.token, requestId } }); return { pv, cf, requestId }; };
const TA = 'TEXTO-DIRECTO-A-' + tag(), TB = 'TEXTO-DIRECTO-B-' + tag();

// P1 retiro directo
const apA = await approve(a, direct171(TA), 'qa171-same-rid-0001');
const apB = await approve(b, direct171(TA), 'qa171-same-rid-0001'); // MISMO texto y MISMO requestId que A
check('P0 A y B aprueban el mismo texto con el mismo requestId: cada una su versión (201/201)', apA.cf.status === 201 && apB.cf.status === 201 && apA.cf.json?.version === 1 && apB.cf.json?.version === 1, `A=${apA.cf.status} B=${apB.cf.status}`);
const e0 = engine(A.id);
check('P1a antes de retirar, el motor recibe el texto de A', e0.fields?.[0]?.text === TA, JSON.stringify(e0).slice(0, 120));
const rv = await call('POST', '/api/career-context/revoke', { token: a });
check('P1b POST /revoke → 200 revoked:true', rv.status === 200 && rv.json?.revoked === true, `status=${rv.status} ${JSON.stringify(rv.json)}`);
const e1 = engine(A.id);
check('P1c tras retirar, la lectura del motor para A es 404 no_context y NO devuelve texto ni campos', e1.error === 'no_context' && e1.status === 404 && noText(e1, TA) && !e1.fields, JSON.stringify(e1));
const rowsA = await q('select version,status,"revokedAt" from "CareerContextVersions" where "UserId"=$1 order by version', [A.id]);
const gl = await call('GET', '/api/career-context', { token: a });
check('P1d la fila queda revoked con revokedAt y GET no trae versión activa', rowsA.length === 1 && rowsA[0].status === 'revoked' && rowsA[0].revokedAt && gl.json?.active == null, JSON.stringify(rowsA) + ' active=' + JSON.stringify(gl.json?.active));
check('P1e el texto está cifrado en la base (no en claro)', !(JSON.stringify(await q('select payload from "CareerContextVersions" where "UserId"=$1', [A.id]))).includes(TA), '');

// P2 B intacta
const eB = engine(B.id), glB = await call('GET', '/api/career-context', { token: b });
check('P2a B sigue entregándose al motor y su versión sigue activa', eB.fields?.[0]?.text === TA && glB.json?.active?.version === 1, JSON.stringify(eB).slice(0, 100));
const rvB0 = await call('POST', '/api/career-context/revoke', { token: a });
check('P2b el reintento de revoke de A es idempotente (revoked:false) y no toca a B', rvB0.status === 200 && rvB0.json?.revoked === false && engine(B.id).fields?.[0]?.text === TA, JSON.stringify(rvB0.json));

// P3 no reaparece
const reads = []; for (let i = 0; i < 5; i++) reads.push(engine(A.id));
check('P3a 5 relecturas del motor tras retirar: ninguna devuelve texto', reads.every(r2 => r2.error === 'no_context' && noText(r2, TA)), '');
const re = await call('POST', '/api/career-context/confirm', { token: a, body: { fields: direct171(TA), token: apA.pv.json.token, requestId: apA.requestId } });
const afterRe = engine(A.id), cntA = (await q('select count(*)::int n from "CareerContextVersions" where "UserId"=$1', [A.id]))[0];
info('P3b', `reenvío del confirm anterior (mismo requestId y token) tras retirar: status=${re.status} versiones=${cntA.n} motor=${afterRe.error || 'ENTREGA'} body=${JSON.stringify(re.json).slice(0, 160)}`);
check('P3b reenviar el confirm anterior tras retirar NO resucita el texto retirado en silencio (se rechaza o devuelve la misma versión ya retirada; si crea versión nueva se declara)', afterRe.error === 'no_context' || (cntA.n === 2 && re.status === 201), `status=${re.status} versiones=${cntA.n} motor=${afterRe.error || 'entrega'}`);
const apA2 = await approve(a, direct171(TB), 'qa171-rid-nuevo-0002');
check('P4a un contexto NUEVO crea versión nueva (no resucita la retirada)', apA2.cf.status === 201 && apA2.cf.json?.version > 1, `status=${apA2.cf.status} v=${apA2.cf.json?.version}`);
const st = await q('select version,status from "CareerContextVersions" where "UserId"=$1 order by version', [A.id]);
const eN = engine(A.id);
check('P4b el historial conserva la retirada como revoked y el motor entrega solo el texto nuevo, nunca el retirado', st[0].status === 'revoked' && eN.fields?.[0]?.text === TB && noText(eN, TA), JSON.stringify(st) + ' ' + JSON.stringify(eN).slice(0, 100));
const lst = await call('GET', '/api/career-context', { token: a });
info('P4c', lst.text.includes(TA) ? 'el texto de la versión retirada SIGUE visible para su dueña en GET /api/career-context (no para el motor)' : 'el texto retirado no aparece en GET');

// P3c concurrencia: retiro + 12 lecturas del motor
const ap3 = await approve(a, direct171('CONCURRENTE-' + tag()), 'qa171-rid-conc-0003');
const [rvc, ...conc] = await Promise.all([call('POST', '/api/career-context/revoke', { token: a }), ...Array.from({ length: 12 }, () => engineAsync(A.id))]);
const after3 = await engineAsync(A.id);
check('P3c retiro concurrente con 12 lecturas: retiro 200, lecturas = entrega o no_context (nunca otro error) y la lectura posterior es no_context', ap3.cf.status === 201 && rvc.status === 200 && conc.every(r2 => r2.fields || r2.error === 'no_context') && after3.error === 'no_context', `retiro=${rvc.status} entregas=${conc.filter(r2 => r2.fields).length} vacias=${conc.filter(r2 => r2.error === 'no_context').length} otras=${conc.filter(r2 => !r2.fields && r2.error !== 'no_context').length}`);

// P5 camino por consentimiento + derivados
const dY = await call('POST', '/api/diary', { token: a, body: { date: '2026-10-21', content: 'entrada de prueba P5 ' + tag() } });
await grant(a);
const originF = [motiv('P5 con origen del diario', { origin: { type: 'diary_entry', id: dY.json.id } })];
const ap5 = await approve(a, originF, 'qa171-rid-p5-0004');
const e5 = engine(A.id);
const inv0 = (await q(`select count(*)::int n from "DerivedInvalidations" where "UserId"=$1 and "sourceType"='career_context_version'`, [A.id]))[0].n;
const rv5 = await call('POST', '/api/career-context/revoke', { token: a });
const e5b = engine(A.id), inv1 = (await q(`select count(*)::int n from "DerivedInvalidations" where "UserId"=$1 and "sourceType"='career_context_version'`, [A.id]))[0].n;
check('P5a camino con consentimiento: antes se entrega; tras POST /revoke el motor no recibe nada y se emite DerivedInvalidation', ap5.cf.status === 201 && !!e5.fields && rv5.json?.revoked === true && e5b.error === 'no_context' && inv1 > inv0, `confirm=${ap5.cf.status} entrega=${!!e5.fields} motor=${e5b.error} inv ${inv0}->${inv1}`);
const ap5b = await approve(a, originF, 'qa171-rid-p5-0005');
await grant(a, 'revoked');
const e5c = engine(A.id);
check('P5b retirar el consentimiento professional_bridge también deja al motor sin contexto', ap5b.cf.status === 201 && e5c.error === 'no_context', `confirm=${ap5b.cf.status} motor=${e5c.error}`);

// P6 qué queda
const bt = await q('select * from "BridgeTransfers" where "UserId"=$1', [A.id]);
check('P6a BridgeTransfers conserva solo claves y hash: ningún texto aprobado de A', bt.length >= 1 && ![TA, TB].some(s => JSON.stringify(bt).includes(s)), 'filas=' + bt.length + ' columnas=' + Object.keys(bt[0] || {}).join(','));
const adm = mint(ADM), th = mint(TH);
let leaked = false;
for (const tok of [adm, th]) for (const u of ['/api/career-context', '/api/admin/career-context/' + A.id, '/api/career-context/' + A.id, '/api/therapist/career-context/' + A.id]) { const x = await call('GET', u, { token: tok }); if (x.text.includes(TA) || x.text.includes(TB)) leaked = true; }
check('P6b admin y terapeuta no leen el contexto de A por ninguna de 4 rutas probadas', !leaked, '');

// P7 abuso
const s401 = await call('POST', '/api/career-context/revoke', {});
const s400 = await call('POST', '/api/career-context/revoke', { token: b, body: { UserId: A.id } });
check('P7a revoke sin sesión → 401/403; con cuerpo no vacío (UserId ajeno) → 400; B intacta', [401, 403].includes(s401.status) && s400.status === 400 && engine(B.id).fields?.[0]?.text === TA, `sinSesion=${s401.status} conCuerpo=${s400.status}`);
const rvTh = await call('POST', '/api/career-context/revoke', { token: th, body: {} });
const rvAdm = await call('POST', '/api/career-context/revoke', { token: adm, body: {} });
check('P7b terapeuta y admin llamando revoke solo afectan a lo propio (200 revoked:false, B intacta)', [rvTh, rvAdm].every(x => x.status === 200 && x.json?.revoked === false) && engine(B.id).fields?.[0]?.text === TA, `th=${rvTh.status} adm=${rvAdm.status}`);
const rvBad = await call('POST', '/api/career-context/revoke', { token: b, body: 'no-json{' });
check('P7c cuerpo malformado → 4xx, nunca 5xx', rvBad.status >= 400 && rvBad.status < 500, `status=${rvBad.status}`);
check('P7d B sigue intacta al final de todo', engine(B.id).fields?.[0]?.text === TA, '');
console.log('FIN-ES171'); await db.end(); process.exit(0);
