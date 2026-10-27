// [QA-Claude] ES-25 + ES-27 + ES-23 combinados (QA-25-02): revocación del puente, guarda de eliminación, exportación y purga de lo profesional.
// Uso: QA_SUT=<clon del head que incluye ES-23, ES-25 y ES-27> QA_API=http://127.0.0.1:8092 (servidor con DATA_RIGHTS_ENABLED=true y presupuesto de IA) QA_MOCK=http://127.0.0.1:9911
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es25-27-23-combined.mjs
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
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag) => {
  const email = `qa-comb-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QAC ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const rid = () => 'qa' + randomBytes(8).toString('hex');
const grant = (t, s = 'granted') => call('PUT', '/api/consents/professional_bridge', { token: t, body: { status: s } });
const TURN = 'Lideré la migración del sistema de facturación y coordiné a cuatro personas durante el segundo trimestre.';
const CAN_BRIDGE = 'CANARIO-PUENTE-' + randomBytes(3).toString('hex'), CAN_EV = 'CANARIO-EVID-' + randomBytes(3).toString('hex');
const claim = (text) => ({ text });
const evPayload = () => ({ title: 'Migración ' + CAN_EV, situation: 'La empresa cambiaba de proveedor.', responsibility: claim('Yo coordiné el plan.'), actions: [claim('Definí el calendario')], delivered: claim('Se migraron 80 clientes'), observedEffect: { known: false }, autonomy: 'autonomous' });
const fn = (code) => { // ejecuta código de servidor del SUT (función del motor)
  const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{try{${code}}catch(e){console.log(JSON.stringify({error:e.code||e.name}))}process.exit(0)})()`], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
  const line = r.stdout.trim().split('\n').filter(l => l.startsWith('{') || l.startsWith('[') || l === 'null').pop();
  try { return JSON.parse(line); } catch { return { raw: (r.stdout + r.stderr).slice(0, 200) }; }
};
const engineBridge = (id) => fn(`const m=require('./utils/careerContext');console.log(JSON.stringify(await m.getApprovedContext(${id},'qa-engine')))`);
const engineEvidence = (id) => fn(`const m=require('./utils/evidence');console.log(JSON.stringify(await m.getConfirmedEvidence(${id},'qa-engine')))`);

// Construye a una persona con puente (camino A + directo) y evidencia del chat, todo confirmado
async function build(tag) {
  const U = await mkUser(tag); const t = mint(U);
  await grant(t);
  await call('POST', '/api/chat', { token: t, body: { message: TURN, requestId: rid() } });
  const dd = await call('POST', '/api/diary', { token: t, body: { date: '2026-10-20', content: 'origen privado del diario' } });
  const turn = (await q('select id from "ChatTurns" where "UserId"=$1 order by id limit 1', [U.id]))[0]?.id;
  const fields = [{ key: 'motivations', text: 'Me motiva ayudar a otros ' + CAN_BRIDGE, origin: { type: 'diary_entry', id: dd.json.id } }, { key: 'values', text: 'Honestidad' }];
  const pv = await call('POST', '/api/career-context/preview', { token: t, body: { fields } });
  const cf = await call('POST', '/api/career-context/confirm', { token: t, body: { fields, token: pv.json?.token, requestId: rid() } });
  const ev = await call('POST', '/api/evidence', { token: t, body: { payload: evPayload(), status: 'confirmed', requestId: rid(), origins: [{ type: 'chat_turn', id: turn, quote: 'coordiné a cuatro personas' }] } });
  const evDirect = await call('POST', '/api/evidence', { token: t, body: { payload: { ...evPayload(), title: 'Directa ' + CAN_EV }, status: 'confirmed', requestId: rid() } });
  return { U, t, turn, dd, cf, ev, evDirect };
}

// ── H1 · revocar professional_bridge actúa en las tres piezas a la vez
const A = await build('A');
check('COMB-H0 alta: puente 201, evidencia del chat 201 y evidencia directa 201', A.cf.status === 201 && A.ev.status === 201 && A.evDirect.status === 201, `puente=${A.cf.status} evChat=${A.ev.status} evDirecta=${A.evDirect.status} ${A.ev.text.slice(0, 100)}`);
const b0 = engineBridge(A.U.id), e0 = engineEvidence(A.U.id);
check('COMB-H0b antes de revocar el motor lee el puente y las dos evidencias', b0.version === 1 && (e0 ?? []).length === 2, `puente=${JSON.stringify(b0).slice(0, 60)} evidencias=${(e0 ?? []).length}`);
const invBefore = (await q(`select "sourceType", reason from "DerivedInvalidations" where "UserId"=$1`, [A.U.id])).length;
const rv = await grant(A.t, 'revoked');
const bAfter = engineBridge(A.U.id), eAfter = engineEvidence(A.U.id);
const vers = await q('select version,status from "CareerContextVersions" where "UserId"=$1 order by version', [A.U.id]);
const inv = await q(`select "sourceType", reason from "DerivedInvalidations" where "UserId"=$1`, [A.U.id]);
check('COMB-H1a revocar: consentimiento revocado (200) y la versión del puente con camino A pasa a revoked', rv.status === 200 && vers.at(-1)?.status === 'revoked', `estados=${vers.map(v => v.status)}`);
check('COMB-H1b el motor deja de leer el puente', !bAfter || bAfter.error || !bAfter.fields, JSON.stringify(bAfter).slice(0, 80));
const evAfterTitles = JSON.stringify(eAfter);
check('COMB-H1c el motor deja de recibir la evidencia que sale del chat y conserva la directa', Array.isArray(eAfter) && eAfter.length === 1 && evAfterTitles.includes('Directa') && !evAfterTitles.includes('Migración ' + CAN_EV), `evidencias=${Array.isArray(eAfter) ? eAfter.length : JSON.stringify(eAfter).slice(0, 80)}`);
check('COMB-H1d se emiten invalidaciones de AMBOS orígenes (puente y evidencia) en la misma revocación', inv.some(x => x.sourceType === 'career_context_version') && inv.some(x => x.sourceType === 'evidence') && inv.length > invBefore, `tipos=${[...new Set(inv.map(x => x.sourceType))]} antes=${invBefore} después=${inv.length}`);
const none = await call('POST', '/api/career-context/confirm', { token: A.t, body: { fields: [{ key: 'motivations', text: 'x', origin: { type: 'diary_entry', id: A.dd.json.id } }], token: 'basura', requestId: rid() } });
check('COMB-H1e con el consentimiento revocado, un camino A nuevo no se confirma (4xx)', none.status >= 400 && none.status < 500, `status=${none.status}`);
const evNew = await call('POST', '/api/evidence', { token: A.t, body: { payload: evPayload(), status: 'confirmed', requestId: rid(), origins: [{ type: 'chat_turn', id: A.turn, quote: 'coordiné a cuatro personas' }] } });
check('COMB-H1f con el consentimiento revocado, una evidencia nueva con origen del chat no se guarda (4xx)', evNew.status >= 400 && evNew.status < 500, `status=${evNew.status}`);

// ── H2 · volver a conceder y reconstruir
await grant(A.t);
const pv2 = await call('POST', '/api/career-context/preview', { token: A.t, body: { fields: [{ key: 'values', text: 'Curiosidad' }] } });
const cf2 = await call('POST', '/api/career-context/confirm', { token: A.t, body: { fields: [{ key: 'values', text: 'Curiosidad' }], token: pv2.json?.token, requestId: rid() } });
check('COMB-H2 volver a conceder y confirmar crea una versión nueva (201) y el motor la lee', cf2.status === 201 && engineBridge(A.U.id)?.fields?.[0]?.text === 'Curiosidad', `status=${cf2.status}`);

// ── H3 · exportación personal: ¿incluye lo profesional?
const A2 = await build('A2');
const exp = await call('POST', '/api/exports/preview', { token: A2.t, body: { type: 'personal', locale: 'es' } });
info('exportacion-personal', `status=${exp.status} claves=${Object.keys(exp.json?.data ?? {}).join(',')}`);
const expHasBridge = exp.text.includes(CAN_BRIDGE), expHasEv = exp.text.includes(CAN_EV);
check('COMB-X01 la exportación personal incluye el puente y la evidencia profesional del dueño (ES-23 integrada con ES-25/27)', exp.status === 201 && expHasBridge && expHasEv, `status=${exp.status} puente=${expHasBridge} evidencia=${expHasEv}`);

// ── H4 · eliminación: guarda y purga
const D = await build('D');
const del = await call('POST', '/api/account/deletion-requests', { token: D.t, body: { confirm: true } });
check('COMB-E01 solicitud de eliminación aceptada (202)', del.status === 202, `status=${del.status} ${del.text.slice(0, 100)}`);
const guard1 = await call('POST', '/api/career-context/preview', { token: D.t, body: { fields: [{ key: 'values', text: 'x' }] } });
const guard2 = await call('POST', '/api/evidence', { token: D.t, body: { payload: evPayload(), status: 'confirmed', requestId: rid() } });
const guard3 = await call('GET', '/api/career-context', { token: D.t });
check('COMB-E02 con la solicitud aceptada la sesión no abre el puente ni la evidencia (4xx)', [guard1, guard2, guard3].every(x => x.status >= 400 && x.status < 500), `preview=${guard1.status} evidencia=${guard2.status} lectura=${guard3.status}`);
const eng = engineBridge(D.U.id);
check('COMB-E03 el motor no recibe el puente de una cuenta con solicitud de eliminación', !eng || eng.error || !eng.fields, JSON.stringify(eng).slice(0, 100));
const reqId = (await q('select id from "DeletionRequests" where "UserId"=$1', [D.U.id]))[0].id;
const purge = spawnSync(process.execPath, ['scripts/purgePersonalData.js', reqId, '--producers-stopped-and-drained'], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
info('purga', `exit=${purge.status} ${purge.stdout.trim().split('\n').pop()}`);
const left = {
  CareerContextVersions: (await q('select count(*)::int n from "CareerContextVersions" where "UserId"=$1', [D.U.id]))[0].n,
  BridgeTransfers: (await q('select count(*)::int n from "BridgeTransfers" where "UserId"=$1', [D.U.id]))[0].n,
  Evidence: (await q('select count(*)::int n from "Evidence" where "UserId"=$1', [D.U.id]))[0].n,
  EvidenceVersions: (await q('select count(*)::int n from "EvidenceVersions" where "UserId"=$1', [D.U.id]))[0].n,
  Diary: (await q('select count(*)::int n from "DiaryEntries" where "UserId"=$1', [D.U.id]))[0].n,
};
check('COMB-E04 la purga de la cuenta deja 0 filas del puente profesional, su auditoría y la evidencia (ES-25/27 registradas en ES-23)', purge.status === 0 && left.CareerContextVersions === 0 && left.Evidence === 0 && left.EvidenceVersions === 0, JSON.stringify(left));
const stillReadable = (await q('select payload from "CareerContextVersions" where "UserId"=$1', [D.U.id])).length;
info('rastro-tras-purga', `versiones del puente=${left.CareerContextVersions} evidencias=${left.Evidence} versiones de evidencia=${left.EvidenceVersions} diario=${left.Diary} (el diario sí lo purga ES-23)`);
console.log(JSON.stringify({ fin: true }));
await db.end();
