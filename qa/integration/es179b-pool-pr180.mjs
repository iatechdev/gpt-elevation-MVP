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
  const email = `qa179b-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA179B ' + tag, email, password } });
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

// ── ES-179 · E179-1: impacto del agotamiento del pool (5 conexiones) con solicitudes simultáneas de start
import fs from 'node:fs';
const CTL = process.env.QA_DAILY_CTRL; fs.writeFileSync(CTL, JSON.stringify({ delay: 300 }));
const T1 = TH, T2 = await mkUser('t2', 'therapist');
const t1 = mint(T1), t2 = mint(T2), aT = mint(A);
await q('update "Users" set "therapistId"=$1 where id=$2', [T1.id, A.id]);
await call('PUT', '/api/consents/therapist_sharing', { token: aT, body: { status: 'granted' } });
let slot = 0; const fresh = async () => (await call('POST', '/api/sessions/therapist', { token: t1, body: { patientId: A.id, scheduledAt: new Date(Date.now() + (24 + 3 * (slot++)) * 36e5).toISOString(), duration: 50 } })).json.session.id;
const start = (id) => call('POST', `/api/sessions/therapist/${id}/start`, { token: t1 });
for (const n of [2, 3, 4, 5, 5, 5, 6]) {
  const id = await fresh(); const t0 = Date.now();
  const starts = Array.from({ length: n }, () => start(id));
  await new Promise(r => setTimeout(r, 1500));
  const t1ms = Date.now(); const other = await call('GET', '/api/sessions/therapist', { token: t2 }); const otherMs = Date.now() - t1ms;
  const reg = await call('GET', '/api/career-context', { token: aT }); const regMs = Date.now() - t1ms;
  const rs = await Promise.all(starts);
  info('E179-1', `n=${n}: ${rs.filter(r => r.status === 200).length}×200, ${rs.filter(r => r.status >= 500).length}×5xx; total=${Date.now() - t0} ms; OTRO profesional (T2) GET sesiones a +1,5 s: ${other.status} tras ${otherMs} ms; otra persona GET contexto: ${reg.status} tras ${regMs} ms`);
  await new Promise(r => setTimeout(r, 1000));
}
console.log('FIN-ES179B'); await db.end(); process.exit(0);
