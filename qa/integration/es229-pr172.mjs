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
const DBN = 'q229', PORT = 8272, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9972'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9972', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-229 · PR #172 · retirar un permiso insights_* marca «para revisión» lo derivado (C1–C11, R1) ──
import { spawnSync } from 'node:child_process';
const rid = () => 'qa' + randomBytes(8).toString('hex');
const tbl = async names => { for (const n of names) { const r = (await q(`select to_regclass('"${n}"') t`))[0].t; if (r) return n; } return null; };
const DI = await tbl(['DerivedInvalidations', 'DerivedInvalidation']), CE = await tbl(['ConsentEvents', 'ConsentEvent']);
const engine = userId => { const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{const m=require('./utils/careerContext');try{console.log(JSON.stringify(await m.getApprovedContext(${userId},'qa-engine')))}catch(e){console.log(JSON.stringify({error:e.code||e.name,status:e.status}))}process.exit(0)})()`], { cwd: BACK, env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK }, encoding: 'utf8' }); const line = r.stdout.trim().split('\n').filter(l => l.startsWith('{') || l === 'null').pop(); try { return JSON.parse(line); } catch { return { raw: (r.stdout + r.stderr).slice(0, 200) }; } };
const setC = (u, p, s) => call('PUT', '/api/consents/' + p, { token: u.token, body: { status: s } });
const fld = (key, text, origin) => ({ key, text, ...(origin ? { origin } : {}) });
const CAN = { direct: 'TEXTO-DIRECTO-QA229', diary: 'TEXTO-DEL-DIARIO-QA229', chat: 'TEXTO-DEL-CHAT-QA229' };
// prepara una persona con diario, un turno de chat y una versión confirmada con 3 campos (directo, de diario, de chat)
const prep = async tag => {
  const u = await mkUser(tag); for (const p of ['professional_bridge', 'insights_diary', 'insights_chat']) await setC(u, p, 'granted');
  const d = await call('POST', '/api/diary', { token: u.token, body: { date: '2026-11-03', content: 'Entrada de diario sintética ' + tag } }); const diaryId = d.json?.id;
  await call('POST', '/api/chat', { token: u.token, body: { message: 'Hola, hablemos de mi trabajo ' + tag, requestId: rid(), lang: 'es' } }); const turnId = (await q('select id from "ChatTurns" where "UserId"=$1 order by id desc limit 1', [u.id]))[0]?.id;
  const fields = [fld('motivations', CAN.direct), fld('values', CAN.diary, { type: 'diary_entry', id: diaryId }), fld('interests', CAN.chat, { type: 'chat_turn', id: turnId })];
  const pv = await call('POST', '/api/career-context/preview', { token: u.token, body: { fields } }); const cf = await call('POST', '/api/career-context/confirm', { token: u.token, body: { fields, token: pv.json?.token, requestId: rid() } });
  return { u, fields, diaryId, turnId, pvStatus: pv.s, cfStatus: cf.s, cfBody: cf.text.slice(0, 120) };
};
const PA = await prep('a229'), PB = await prep('b229');
check('SET dos personas con versión del Puente confirmada (campo directo, de diario y de chat)', PA.cfStatus === 201 && PB.cfStatus === 201, `A preview=${PA.pvStatus} confirm=${PA.cfStatus} ${PA.cfStatus !== 201 ? PA.cfBody : ''} · B confirm=${PB.cfStatus}`);
const eng0 = engine(PA.u.id), texts = e => (e?.fields ?? []).map(f => f.text); const has = (e, c) => texts(e).includes(c);
check('C0 antes de revocar, el motor recibe los 3 textos (directo, diario, chat)', has(eng0, CAN.direct) && has(eng0, CAN.diary) && has(eng0, CAN.chat), `campos=${texts(eng0).length}`);
const verRow = async id => (await q('select id, version, status, origins from "CareerContextVersions" where "UserId"=$1 and status=$2 order by id desc limit 1', [id, 'active']))[0];
const v0A = await verRow(PA.u.id), v0B = await verRow(PB.u.id); const n0A = DI ? (await q(`select count(*)::int n from "${DI}" where "UserId"=$1`, [PA.u.id]))[0].n : -1; const ev0 = CE ? (await q(`select count(*)::int n from "${CE}" where "UserId"=$1`, [PA.u.id]))[0].n : -1;
// ── C1: retirar insights_diary ──
const r1 = await setC(PA.u, 'insights_diary', 'revoked'); const eng1 = engine(PA.u.id); const own1 = await call('GET', '/api/career-context', { token: PA.u.token }); const v1A = await verRow(PA.u.id);
check('C1a retirar insights_diary: el motor deja de recibir el texto del diario en la siguiente lectura; conserva el directo y el del chat', r1.s === 200 && !has(eng1, CAN.diary) && has(eng1, CAN.direct) && has(eng1, CAN.chat), `PUT=${r1.s} textos=${texts(eng1).join(' | ')}`);
check('C1b lo confirmado no se borra ni se reescribe: misma versión y estado activo; el contenido sigue en su sitio', !!v1A && v1A.id === v0A.id && v1A.version === v0A.version && v1A.status === 'active', `versión ${v0A.version}→${v1A?.version} activa=${v1A?.status}`);
const ownS = JSON.stringify(own1.json ?? {}); const active = own1.json?.active ?? own1.json?.current ?? own1.json;
check('C1c la persona ve el estado: needsReview verdadero con reviewReason «source_revoked» en su lectura propia; ni ids de origen ni contenido ajeno', own1.s === 200 && /needsReview["']?\s*:\s*true/.test(ownS) && /source_revoked/.test(ownS) && !/sourceRevokedAt/.test(ownS), `needsReview=${/needsReview["']?\s*:\s*true/.test(ownS)} reviewReason=${/source_revoked/.test(ownS)} fugaMarca=${/sourceRevokedAt/.test(ownS)}`);
const n1A = DI ? (await q(`select count(*)::int n from "${DI}" where "UserId"=$1`, [PA.u.id]))[0].n : -1;
check('C1d se registra la invalidación de lo derivado (una fila nueva) y se invalidan jobs derivados', n1A === n0A + 1, `invalidaciones ${n0A}→${n1A}`);
// ── C2: solo esa fuente ──
const r2 = await setC(PA.u, 'insights_chat', 'revoked'); const eng2 = engine(PA.u.id);
check('C2 retirar después insights_chat: solo entonces desaparece el texto del chat; el directo permanece', r2.s === 200 && !has(eng2, CAN.chat) && has(eng2, CAN.direct), `textos=${texts(eng2).join(' | ')}`);
// ── C3: aislamiento A/B ──
const engB = engine(PB.u.id); const v1B = await verRow(PB.u.id);
check('C3 la otra persona (B) no cambia cuando A retira permisos: el motor sigue recibiendo sus 3 textos y su versión no cambia', texts(engB).length === 3 && v1B.id === v0B.id && JSON.stringify(v1B.origins) === JSON.stringify(v0B.origins), `B textos=${texts(engB).length} origins iguales=${JSON.stringify(v1B.origins) === JSON.stringify(v0B.origins)}`);
// ── C4: doble retiro y simultáneo ──
const PC = await prep('c229'); const nC0 = DI ? (await q(`select count(*)::int n from "${DI}" where "UserId"=$1`, [PC.u.id]))[0].n : -1; const evC0 = CE ? (await q(`select count(*)::int n from "${CE}" where "UserId"=$1`, [PC.u.id]))[0].n : -1;
const rr = await Promise.all(Array.from({ length: 10 }, () => setC(PC.u, 'insights_diary', 'revoked'))); const nC1 = DI ? (await q(`select count(*)::int n from "${DI}" where "UserId"=$1`, [PC.u.id]))[0].n : -1; const evC1 = CE ? (await q(`select count(*)::int n from "${CE}" where "UserId"=$1`, [PC.u.id]))[0].n : -1; const again = await setC(PC.u, 'insights_diary', 'revoked'); const nC2 = DI ? (await q(`select count(*)::int n from "${DI}" where "UserId"=$1`, [PC.u.id]))[0].n : -1;
const origC = (await verRow(PC.u.id)).origins; const marcas = origC.filter(o => o.sourceRevokedAt).length;
check('C4 10 retiros simultáneos + uno repetido: sin 5xx, UNA sola invalidación, UNA sola marca (la del diario) y ningún evento duplicado', rr.every(r => r.s < 500) && again.s < 500 && nC1 === nC0 + 1 && nC2 === nC1 && marcas === 1, `estados=${[...new Set(rr.map(r => r.s))]} invalidaciones ${nC0}→${nC1}→${nC2} marcas=${marcas} eventosDeConsentimiento ${evC0}→${evC1}`);
const evOne = CE ? (await q(`select count(*)::int n from "${CE}" where "UserId"=$1 and purpose='insights_diary' and status='revoked'`, [PC.u.id]))[0].n : -1;
check('C9 historial: un solo evento «revoked» de insights_diary por el cambio real (las repeticiones idénticas no crean otro)', evOne === 1, `eventos revoked=${evOne}`);
// ── C5: volver a conceder ──
const PD = await prep('d229'); await setC(PD.u, 'insights_diary', 'revoked'); const vD = await verRow(PD.u.id); const re = await setC(PD.u, 'insights_diary', 'granted'); const engD = engine(PD.u.id); const vD2 = await verRow(PD.u.id); const ownD = JSON.stringify((await call('GET', '/api/career-context', { token: PD.u.token })).json ?? {});
check('C5 volver a conceder el permiso NO devuelve lo marcado a vigente: el motor sigue sin el texto del diario, la versión no cambia y la persona sigue viendo «para revisión»; no se crea versión sola', re.s === 200 && !has(engD, CAN.diary) && vD2.id === vD.id && /source_revoked/.test(ownD), `PUT=${re.s} textoDiarioEntregado=${has(engD, CAN.diary)} misma versión=${vD2.id === vD.id} sigueMarcada=${/source_revoked/.test(ownD)}`);
// ── C8: atomicidad ──
const PE = await prep('e229'); let c8 = { note: 'sin tabla' };
if (DI) { await q(`alter table "${DI}" rename to "${DI}_qa"`); const rf = await setC(PE.u, 'insights_diary', 'revoked'); await q(`alter table "${DI}_qa" rename to "${DI}"`); const cons = (await q(`select status from "Consents" where "UserId"=$1 and purpose='insights_diary'`, [PE.u.id]))[0]?.status; const vE = await verRow(PE.u.id); c8 = { rf: rf.s, cons, marcas: (vE.origins || []).filter(o => o.sourceRevokedAt).length, body: rf.text.slice(0, 80) }; }
check('C8 atomicidad: si falla la marca (tabla de invalidaciones inaccesible), el retiro del permiso se revierte (no queda retirado sin marca) y la respuesta es un error controlado', DI && c8.rf >= 400 && c8.rf < 600 && c8.cons !== 'revoked' && c8.marcas === 0, JSON.stringify(c8));
const afterRestore = await setC(PE.u, 'insights_diary', 'revoked'); check('C8b tras restaurar la tabla, el retiro funciona y marca', afterRestore.s === 200 && (await verRow(PE.u.id)).origins.some(o => o.sourceRevokedAt), `PUT=${afterRestore.s}`);
// ── C10: otros permisos ──
const PF = await prep('f229'); const nec = await setC(PF.u, 'necessary', 'revoked'); const th = await setC(PF.u, 'therapist_sharing', 'revoked'); const br = await setC(PF.u, 'professional_bridge', 'revoked'); const engF = engine(PF.u.id); const vF = (await q(`select status from "CareerContextVersions" where "UserId"=$1 order by id desc limit 1`, [PF.u.id]))[0];
check('C10 otros permisos: necessary no se puede retirar (409); therapist_sharing sin terapeuta 409; professional_bridge revoca la versión (revoked) y el motor no entrega nada', nec.s === 409 && [200, 409].includes(th.s) && br.s === 200 && vF.status === 'revoked' && !engF.fields, `necessary=${nec.s} therapist=${th.s} bridge=${br.s} versión=${vF.status} motor=${JSON.stringify(engF).slice(0, 60)}`);
// ── C11: el hueco declarado: confirm no comprueba el permiso insights_* de la fuente ──
const PG0 = await mkUser('g229'); for (const p of ['professional_bridge', 'insights_diary']) await setC(PG0, p, 'granted'); const gu = PG0;
const gd = await call('POST', '/api/diary', { token: gu.token, body: { date: '2026-11-03', content: 'Diario de G' } }); const gf = [fld('values', 'TEXTO-DE-FUENTE-RETIRADA-QA229', { type: 'diary_entry', id: gd.json?.id })];
const gpv = await call('POST', '/api/career-context/preview', { token: gu.token, body: { fields: gf } }); // pestaña vieja: el token se emitió con el permiso vigente
const gr = await setC(gu, 'insights_diary', 'revoked'); // en otra pestaña se retira el permiso
const gnew = await call('POST', '/api/career-context/preview', { token: gu.token, body: { fields: gf } }); // ¿una vista previa NUEVA con la fuente retirada se rechaza?
const gcf = await call('POST', '/api/career-context/confirm', { token: gu.token, body: { fields: gf, token: gpv.json?.token, requestId: rid() } }); const engG = engine(gu.id);
check('C11a (hueco declarado) una vista previa NUEVA que cita una fuente con el permiso retirado: se rechaza (4xx)', gnew.s >= 400 && gnew.s < 500, `estado=${gnew.s} ${gnew.text.slice(0, 100)}`);
check('C11b (hueco declarado) confirmar con la vista previa de ANTES de retirar el permiso: se rechaza y no entrega al motor el texto de la fuente retirada', gr.s === 200 && (gcf.s >= 400 && gcf.s < 500 || !has(engG, 'TEXTO-DE-FUENTE-RETIRADA-QA229')), `retiro=${gr.s} confirmación=${gcf.s} ${gcf.text.slice(0, 80)} · motor entrega el texto de la fuente retirada=${has(engG, 'TEXTO-DE-FUENTE-RETIRADA-QA229')}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-229-pr172.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES229 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length, fallan: out.filter(o => !o.ok).map(o => o.id.slice(0, 50)) }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
