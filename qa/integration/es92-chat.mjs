// [QA-Claude] ES-92 · PR #64: las frases nuevas en el chat real (Postgres real, IA simulada), en modo normal y en modo Brújula.
// Uso: QA_SUT=<clon> QA_API=<servidor> QA_MOCK=<mock> DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es92-chat.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, mock = process.env.QA_MOCK, JWT = process.env.QA_JWT_SECRET;
const req = createRequire(path.join(sut, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const email = `qa92-${Date.now()}@example.test`; await fetch(api + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA92', email, password: randomBytes(12).toString('base64url') + 'aA1!' }) });
const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; const tok = jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '2h', jwtid: randomBytes(8).toString('hex') });
const chat = async (message, extra = {}) => { const r = await fetch(api + '/api/chat', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ message, requestId: 'q92' + randomBytes(6).toString('hex'), ...extra }) }); const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch { /* */ } return { status: r.status, j, text }; };
const calls = async () => (await (await fetch(mock + '/_stats')).json()).calls; const reset = () => fetch(mock + '/_reset');
const HIGH = [['I do not want to live anymore', 'en'], ['I dont want to live anymore', 'en'], ['I don’t want to be alive anymore', 'en'], ['i do not wanna live', 'en']];
const MED = [['me quiero hacer daño', 'es'], ['me quiero lastimar', 'es'], ['me quiero cortar las venas', 'es'], ['I want to harm myself', 'en']];
for (const mode of [undefined, 'compass']) {
  const tag = mode ? 'Brújula' : 'chat normal';
  await reset(); let ok = 0, bad = [];
  for (const [m, lang] of HIGH) { const r = await chat(m, { lang, mode }); if (r.status === 200 && r.j.interrupted === true) ok++; else bad.push(`${m}:${r.status}/${r.j.interrupted}`); }
  check(`ES92-I01 ${tag}: las frases nuevas de nivel alto interrumpen con el mensaje de seguridad`, ok === HIGH.length, bad.join(' | ') || `${ok}/${HIGH.length}`);
  check(`ES92-I02 ${tag}: en nivel alto el proveedor de IA no recibe ninguna llamada`, (await calls()) === 0, `llamadas=${await calls()}`);
  await reset(); ok = 0; bad = [];
  for (const [m, lang] of MED) { const r = await chat(m, { lang, mode }); if (r.status === 200 && r.j.reply && r.j.interrupted !== true && /106|emergenc|línea|line|crisis|apoyo|support|help|ayuda/i.test(r.j.reply)) ok++; else bad.push(`${m}:${r.status}/${(r.j.reply || '').slice(-60)}`); }
  check(`ES92-I03 ${tag}: las de nivel medio responden y añaden la nota de apoyo`, ok === MED.length, bad.join(' | ') || `${ok}/${MED.length}`);
  check(`ES92-I04 ${tag}: en nivel medio el proveedor recibe una llamada por mensaje`, (await calls()) === MED.length, `llamadas=${await calls()}`);
  await reset(); const n = await chat('me quiero cortar el pelo para el nuevo trabajo', { lang: 'es', mode }); check(`ES92-I05 ${tag}: un uso normal («me quiero cortar el pelo…») se responde sin nota de crisis`, n.status === 200 && !n.j.interrupted && !/106|línea de ayuda|emergenc/i.test(n.j.reply || '') && (await calls()) === 1, `status=${n.status}`);
}
const cols = await q(`select table_name, column_name from information_schema.columns where table_schema='public' and column_name ~* '(risk|crisis|riesgo|level|severity)' and table_name not in ('BridgeTransfers','SkillAssessments')`);
check('ES92-P01 ninguna columna guarda nivel de riesgo (nada de riesgo en la base)', cols.length === 0, JSON.stringify(cols));
const msgs = (await q(`select count(*)::int n from "Messages" where "UserId"=$1`, [u.id]))[0].n; check('ES92-P02 los mensajes del usuario se guardan como en el chat normal (cifrados) y sin marca de riesgo', msgs > 0 && (await q(`select count(*)::int n from "Messages" where "UserId"=$1 and content ~* 'daño|live|lastimar'`, [u.id]))[0].n === 0, `mensajes=${msgs}`);
console.log(JSON.stringify({ fin: true })); await db.end();
