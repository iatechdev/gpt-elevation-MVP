// [QA-Claude] ES-41 · Corte 2 «Brújula profesional» (tono y límites), versión release 1 SIN guía del especialista. Servidor real de main (3ab3a41) + Postgres + proveedor de IA SIMULADO que registra lo que recibe. 0 tokens.
// Uso: node qa/integration/es41-gate.mjs   (arranca y detiene sus servidores; el texto del prompt NO se guarda, solo comprobaciones booleanas)
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'C:/Users/Usuario/Documents/qa-pr-test', BACK = ROOT + '/backend', S = 'C:/Users/Usuario/Documents/qa13', EVID = 'C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q41b', PORT = 8241, MOCK = 'http://127.0.0.1:9941', api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/es41mock.cjs', '9941'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: MOCK, AI_BUDGET_TOKENS_PER_USER: '500000000', AI_BUDGET_TOKENS_COHORT: '5000000000', AI_MAX_RETRIES: '0' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') u, to_regclass('"Messages"') m, to_regclass('"ChatTurns"') c`)).rows[0].c) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const mock = async p => (await (await fetch(MOCK + p)).json().catch(() => null)); const mset = p => fetch(MOCK + p);
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa41-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA41 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const rid = () => 'qa' + randomBytes(8).toString('hex'); const chat = (u, message, lang = 'es', requestId = rid()) => call('POST', '/api/chat', { token: u.token, body: { message, requestId, lang } });
// ── ES-41 · Corte 2 · complemento: idioma activo (G5), crisis con contactos editables (G4), números del modelo filtrados (G4c) ──
const SUP = await mkUser('sup41', 'superadmin'); const Pz = await mkUser('pz41');
const bodies = async () => (await (await fetch(MOCK + '/_bodies')).json());
const sysOf = b => typeof b?.system === 'string' ? b.system : JSON.stringify(b?.system ?? '');
await fetch(MOCK + '/_reset'); await fetch(MOCK + '/_text?v=' + encodeURIComponent('Gracias por contarlo. ¿Qué te gustaría explorar primero?'));
const rEs = await chat(Pz, 'Hola, quiero ordenar mis ideas sobre trabajo', 'es'); const rEn = await chat(Pz, 'Hi, I want to sort out my thoughts about work', 'en'); const bs = await bodies();
check('G5 idioma activo: la instrucción de idioma del prompt sigue a `lang` (es → español, en → inglés)', rEs.s === 200 && rEn.s === 200 && bs.length >= 2 && /Reply in Spanish/.test(sysOf(bs[0])) && /Reply in English/.test(sysOf(bs[1])), `es=${rEs.s} en=${rEn.s} llamadas=${bs.length}`);
// G4c: el modelo intenta dar un teléfono propio → se filtra (ES-208)
await fetch(MOCK + '/_text?v=' + encodeURIComponent('Puedes llamar a la línea 311 456 7890 o al +57 601 234 5678 ahora mismo.'));
const phone = await chat(Pz, 'Necesito hablar con alguien sobre mi trabajo', 'es'); const replyTxt = JSON.stringify(phone.json ?? phone.text);
check('G4c un número de teléfono que el modelo escriba por su cuenta no llega a la persona', phone.s === 200 && !/311\s?456\s?7890/.test(replyTxt) && !/601\s?234\s?5678/.test(replyTxt), `status=${phone.s} contieneNumero=${/456\s?7890|234\s?5678/.test(replyTxt)}`);
// G4a: crisis sin entradas activas → mensaje de seguridad genérico, sin llamada al modelo y sin ningún número
await fetch(MOCK + '/_reset'); const crisis0 = await chat(Pz, 'Quiero morirme, no quiero seguir viviendo', 'es'); const c0 = JSON.stringify(crisis0.json ?? crisis0.text); const calls0 = (await bodies()).length;
check('G4a crisis sin entradas activas: respuesta de seguridad sin número, sin llamar al modelo', crisis0.s === 200 && !/\d{3}/.test((crisis0.json?.reply ?? crisis0.json?.response ?? c0).replace(/\b20\d\d\b/g, '')) && calls0 === 0, `status=${crisis0.s} llamadasModelo=${calls0} interrupted=${crisis0.json?.interrupted ?? '-'}`);
// G4b: con una entrada activa (número ficticio) la crisis la usa
const mk0 = await call('POST', '/api/admin/contact-entries', { token: SUP.token, body: { name: 'Línea ficticia QA', contact: '000 000 0001', country: 'CO', descriptionEs: 'Entrada sintética de QA', descriptionEn: 'QA synthetic entry', source: 'QA sintética (no real)', verifiedBy: 'QA', verifiedAt: new Date().toISOString().slice(0, 10), active: true } });
const act = await call('PUT', '/api/admin/contact-entries/' + mk0.json?.id, { token: SUP.token, body: { active: true, version: mk0.json?.version } }); const pub = await call('GET', '/api/contact-entries?country=CO'); const crisis1 = await call('POST', '/api/chat', { token: Pz.token, body: { message: 'Quiero morirme, no quiero seguir viviendo', requestId: rid(), lang: 'es', country: 'CO' } }); const c1 = JSON.stringify(crisis1.json ?? crisis1.text);
check('G4b con una entrada activa, la lista pública la muestra y la respuesta de crisis usa ese número (no uno del código)', mk0.s === 201 && act.s === 200 && JSON.stringify(pub.json ?? '').includes('000 000 0001') && c1.includes('000 000 0001'), `crear=${mk0.s} activar=${act.s} ${act.text.slice(0, 80)} · publico=${pub.s} · crisis usa=${c1.includes('000 000 0001')}`);
// G4d: desactivar la entrada → la crisis vuelve al texto genérico (nunca un número viejo)
const id = mk0.json?.id; const cur = act.json?.version ?? mk0.json?.version; const off = id ? await call('PUT', '/api/admin/contact-entries/' + id, { token: SUP.token, body: { active: false, version: cur } }) : { s: 0 }; const crisis2 = await call('POST', '/api/chat', { token: Pz.token, body: { message: 'Quiero morirme, no quiero seguir viviendo', requestId: rid(), lang: 'es', country: 'CO' } }); const c2 = JSON.stringify(crisis2.json ?? crisis2.text);
check('G4d al desactivar la entrada, la crisis ya no muestra el número anterior', off.s === 200 && !c2.includes('000 000 0001'), `desactivar=${off.s} muestraNumeroViejo=${c2.includes('000 000 0001')}`);
fs.writeFileSync(path.join(EVID, 'ES-41-complemento.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES41B ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
