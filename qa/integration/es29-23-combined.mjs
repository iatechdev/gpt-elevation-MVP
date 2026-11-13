// [QA-Claude] ES-29 + ES-25/27 + ES-23 combinados: Skill Map frente a la revocación del puente, la exportación y la purga.
// Uso: QA_SUT=<clon del head de #31> QA_API=http://127.0.0.1:8092 (DATA_RIGHTS_ENABLED=true, presupuesto de IA) QA_MOCK=http://127.0.0.1:9911
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es29-23-combined.mjs
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
const mkUser = async (tag, role = 'user') => {
  const email = `qa-sk-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QASK ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const rid = () => 'qa' + randomBytes(8).toString('hex');
const claim = (text) => ({ text });
const levels = (p) => Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `${p} nivel ${n}`, en: `${p} level ${n}` }]));
const skillBody = (n) => ({ type: 'transversal', labels: { es: `Habilidad ${n}`, en: `Skill ${n}` }, rubric: { levels: levels(n), source: 'Rúbrica sintética de QA', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
const TURN = 'Lideré la migración del sistema de facturación y coordiné a cuatro personas durante el segundo trimestre.';
const CAN = 'CANARIO-SKILL-' + randomBytes(3).toString('hex');
const evPayload = (title) => ({ title: title + ' ' + CAN, situation: 'Situación sintética', responsibility: claim('Mi parte'), actions: [claim('Hice algo')], delivered: claim('Entregué algo'), observedEffect: { known: false }, autonomy: 'assisted' });

// Catálogo publicado por un administrador
const ADM = await mkUser('adm', 'admin'); const adm = mint(ADM);
let cat = await call('GET', '/api/skill-map', { token: adm });
if (cat.status === 503) {
  const d = await call('POST', '/api/admin/skill-catalog', { token: adm });
  for (const n of ['comunicacion', 'planificacion']) await call('PUT', `/api/admin/skill-catalog/${d.json.id}/skills/${n}`, { token: adm, body: skillBody(n) });
  const p = await call('POST', `/api/admin/skill-catalog/${d.json.id}/publish`, { token: adm });
  check('SK-H00 catálogo publicado por el administrador', p.status === 200, `status=${p.status}`);
}

async function build(tag) {
  const U = await mkUser(tag); const t = mint(U);
  await call('PUT', '/api/consents/professional_bridge', { token: t, body: { status: 'granted' } });
  await call('POST', '/api/chat', { token: t, body: { message: TURN, requestId: rid() } });
  const turn = (await q('select id from "ChatTurns" where "UserId"=$1 order by id limit 1', [U.id]))[0]?.id;
  const evChat = await call('POST', '/api/evidence', { token: t, body: { payload: evPayload('Del chat'), status: 'confirmed', requestId: rid(), origins: [{ type: 'chat_turn', id: turn, quote: 'coordiné a cuatro personas' }] } });
  const evDirect = await call('POST', '/api/evidence', { token: t, body: { payload: evPayload('Directa'), status: 'confirmed', requestId: rid() } });
  const s1 = await call('POST', '/api/skill-map/self', { token: t, body: { requestId: rid(), skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: evChat.json?.id, version: 1 }], rationale: 'Coordiné al equipo' } });
  const s2 = await call('POST', '/api/skill-map/self', { token: t, body: { requestId: rid(), skillKey: 'planificacion', level: 2, evidenceRefs: [{ evidenceId: evDirect.json?.id, version: 1 }], rationale: 'Planifiqué' } });
  return { U, t, evChat, evDirect, s1, s2 };
}
const lvl = (map, key) => (map.json?.skills ?? []).find(x => x.skillKey === key)?.self;

// ── Revocación del puente con evaluaciones apoyadas en evidencia del chat
const A = await build('A');
check('SK-H0 alta: evidencia del chat 201, directa 201 y dos autoevaluaciones 201', [A.evChat.status, A.evDirect.status, A.s1.status, A.s2.status].every(s => s === 201), `${A.evChat.status}/${A.evDirect.status}/${A.s1.status}/${A.s2.status} ${A.s1.text.slice(0, 100)}`);
let m0 = await call('GET', '/api/skill-map', { token: A.t });
check('SK-H0b antes de revocar ambas habilidades tienen nivel 2', lvl(m0, 'comunicacion')?.level === 2 && lvl(m0, 'planificacion')?.level === 2, JSON.stringify([lvl(m0, 'comunicacion')?.level, lvl(m0, 'planificacion')?.level]));
const rv = await call('PUT', '/api/consents/professional_bridge', { token: A.t, body: { status: 'revoked' } });
const m1 = await call('GET', '/api/skill-map', { token: A.t });
check('SK-H1 revocar professional_bridge: la habilidad apoyada en evidencia del chat pasa a null (stale) y la apoyada en evidencia directa se conserva', rv.status === 200 && lvl(m1, 'comunicacion')?.level === null && lvl(m1, 'comunicacion')?.stale === true && lvl(m1, 'planificacion')?.level === 2, JSON.stringify([rv.status, lvl(m1, 'comunicacion')?.level, lvl(m1, 'comunicacion')?.stale, lvl(m1, 'planificacion')?.level]));
const sNew = await call('POST', '/api/skill-map/self', { token: A.t, body: { requestId: rid(), skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: A.evChat.json?.id, version: 1 }] } });
check('SK-H2 con el consentimiento revocado no se puede volver a evaluar apoyándose en la evidencia del chat (4xx)', sNew.status >= 400 && sNew.status < 500, `status=${sNew.status}`);

// ── Exportación y purga
const E = await build('E');
const exp = await call('POST', '/api/exports/preview', { token: E.t, body: { type: 'personal', locale: 'es' } });
info('exportacion', `status=${exp.status} claves=${Object.keys(exp.json?.data ?? {}).join(',')}`);
check('SK-X01 la exportación personal incluye las evaluaciones del Skill Map (con el nivel y las evidencias citadas) y no las de otra persona', exp.status === 201 && Array.isArray(exp.json?.data?.skillAssessments) && exp.json.data.skillAssessments.length >= 2 && !exp.text.includes('QASK A'), `status=${exp.status} n=${exp.json?.data?.skillAssessments?.length}`);
check('SK-X02 la exportación descifra la justificación de la persona (sin texto cifrado v2:)', exp.status === 201 && exp.text.includes('Coordiné al equipo') && !/"rationale":"v2:/.test(exp.text), '');
const D = await build('D');
const before = (await q('select count(*)::int n from "SkillAssessments" where "UserId"=$1', [D.U.id]))[0].n;
const del = await call('POST', '/api/account/deletion-requests', { token: D.t, body: { confirm: true } });
const reqId = (await q('select id from "DeletionRequests" where "UserId"=$1', [D.U.id]))[0]?.id;
const purge = spawnSync(process.execPath, ['scripts/purgePersonalData.js', reqId, '--producers-stopped-and-drained'], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const after = (await q('select count(*)::int n from "SkillAssessments" where "UserId"=$1', [D.U.id]))[0].n;
const left = { puente: (await q('select count(*)::int n from "CareerContextVersions" where "UserId"=$1', [D.U.id]))[0].n, evidencia: (await q('select count(*)::int n from "Evidence" where "UserId"=$1', [D.U.id]))[0].n };
check('SK-E01 antes de la purga hay evaluaciones y después de purgar quedan 0 (y 0 de puente y de evidencia)', del.status === 202 && before >= 2 && purge.status === 0 && after === 0 && left.puente === 0 && left.evidencia === 0, `solicitud=${del.status} antes=${before} después=${after} ${JSON.stringify(left)} exit=${purge.status}`);
const mapDel = await call('GET', '/api/skill-map', { token: D.t });
check('SK-E02 con la solicitud aceptada la sesión no lee el Skill Map (4xx)', mapDel.status >= 400 && mapDel.status < 500, `status=${mapDel.status}`);
// ── contador del catálogo no se purga
check('SK-E03 el catálogo y sus habilidades (no son datos personales) siguen intactos tras la purga', (await q(`select count(*)::int n from "SkillDefinitions"`))[0].n >= 2, '');
console.log(JSON.stringify({ fin: true }));
await db.end();
