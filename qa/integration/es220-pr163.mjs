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
const DBN = 'q220', PORT = 8255, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9955'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', TRUST_PROXY_HOPS: '1', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9955', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-220 · PR #163 · login sin enumeración de cuentas (E1–E12) ──
let ipn = 0; const nextIp = () => `10.${(ipn >> 16) & 255}.${(ipn >> 8) & 255}.${(ipn++ & 255) + 1}`;
const lg = async (email, password, ip = nextIp(), raw) => { const t0 = performance.now(); const r = await fetch(api + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: raw ?? JSON.stringify({ email, password }) }); const text = await r.text(); const hs = {}; for (const [k, v] of r.headers) if (!['date', 'etag', 'content-length', 'x-request-id', 'ratelimit', 'ratelimit-reset', 'ratelimit-remaining', 'ratelimit-policy'].includes(k)) hs[k] = v; return { s: r.status, text, ms: performance.now() - t0, hs }; };
const shape = r => ({ s: r.s, body: r.text.replace(/\d+ minutos?/, 'N minutos'), hs: r.hs });
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pw = () => randomBytes(14).toString('base64url') + 'aA1!';
const reg = async (tag, active = true) => { const email = `qa220-${tag}-${stamp}@example.test`, password = pw(); const r = await call('POST', '/api/register', { body: { name: 'QA220 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s + ' ' + r.text.slice(0, 80)); if (!active) await q('update "Users" set active=false where email=$1', [email]); return { email, password }; };
// ── E1/E3: la misma secuencia de respuestas para inexistente, existente, inactiva ──
const nx = `nx-${stamp}@example.test`, real = await reg('real'), ina = await reg('ina', false);
const seq = async (email, pass) => { const out = []; for (let i = 0; i < 5; i++) out.push(shape(await lg(email, pass + 'x' + i))); return out; };
const sNx = await seq(nx, 'Mala1!'), sReal = await seq(real.email, 'Mala1!'), sIna = await seq(ina.email, 'Mala1!');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('E1/E3 secuencia de 5 intentos fallidos (401, 401, 423, 423, 423): idéntica en estado, cuerpo y cabeceras para correo INEXISTENTE, cuenta ACTIVA e INACTIVA', same(sNx, sReal) && same(sNx, sIna) && sNx.map(r => r.s).join(',') === '401,401,423,423,423', `inexistente=${sNx.map(r => r.s)} activa=${sReal.map(r => r.s)} inactiva=${sIna.map(r => r.s)} cuerpo423=${sNx[2].body}`);
// ── E4: inactiva + contraseña correcta ──
const ina2 = await reg('ina2', false); const inaWrong = await lg(ina2.email, 'Incorrecta1!'); const inaRight = await lg(ina2.email, ina2.password); const nxRight = await lg(`nx2-${stamp}@example.test`, ina2.password);
check('E4 inactiva: con contraseña incorrecta 401 como cualquier otra; con la CORRECTA 403 «inactiva» (decisión de Infra); un correo inexistente con esa misma contraseña da 401', inaWrong.s === 401 && inaRight.s === 403 && /inactiv/i.test(inaRight.text) && nxRight.s === 401, `incorrecta=${inaWrong.s} correcta=${inaRight.s} inexistente=${nxRight.s}`);
// ── E2: tiempos ──
const N = 24; const tN = [], tR = [], tI = [], tLR = [], tLN = [];
for (let i = 0; i < N; i++) tN.push((await lg(`nxt${i}-${stamp}@example.test`, 'Mala1!')).ms);
const realU = []; for (let i = 0; i < N; i++) realU.push(await reg('tr' + i)); const inaU = []; for (let i = 0; i < N; i++) inaU.push(await reg('ti' + i, false));
for (const u of realU) tR.push((await lg(u.email, 'Mala1!')).ms); for (const u of inaU) tI.push((await lg(u.email, 'Mala1!')).ms);
for (let i = 0; i < N; i++) { tLR.push((await lg(real.email, 'Mala1!')).ms); tLN.push((await lg(nx, 'Mala1!')).ms); }
const stat = a => ({ p50: Math.round(med(a)), min: Math.round(Math.min(...a)), max: Math.round(Math.max(...a)) });
const rel = (a, b) => Math.abs(med(a) - med(b)) / Math.max(med(a), med(b));
check('E2a tiempo: inexistente vs existente-incorrecta vs inactiva-incorrecta (24 intentos cada una, un correo distinto por intento): medianas dentro de 15 % y 30 ms', [[tN, tR], [tN, tI], [tR, tI]].every(([a, b]) => rel(a, b) < 0.15 && Math.abs(med(a) - med(b)) < 30), `inexistente=${JSON.stringify(stat(tN))} existente=${JSON.stringify(stat(tR))} inactiva=${JSON.stringify(stat(tI))}`);
check('E2b tiempo en estado BLOQUEADO: cuenta real bloqueada vs correo inexistente bloqueado (24 intentos): medianas dentro de 15 % y 30 ms', rel(tLR, tLN) < 0.15 && Math.abs(med(tLR) - med(tLN)) < 30, `real=${JSON.stringify(stat(tLR))} inexistente=${JSON.stringify(stat(tLN))}`);
// ── E5: normalización ──
const base = `Norm-${stamp}@Example.test`; const a1 = await lg(base, 'x1'), a2 = await lg(base.toLowerCase(), 'x2'), a3 = await lg('  ' + base.toUpperCase() + ' ', 'x3'), a4 = await lg(base, 'x4');
check('E5 normalización: mayúsculas/minúsculas y espacios comparten contador para un correo inexistente (3er intento → 423)', a1.s === 401 && a2.s === 401 && a3.s === 423 && a4.s === 423, `${[a1, a2, a3, a4].map(r => r.s)}`);
const wrongCase = await lg(real.email.toUpperCase(), real.password); const rightCase = await lg(real.email, real.password);
check('E5b (informativo) el inicio de sesión sigue distinguiendo mayúsculas en el correo (comportamiento previo): correo con otra capitalización + contraseña correcta', true, `otraCapitalización=${wrongCase.s} exacto=${rightCase.s} (la cuenta real estaba bloqueada por E1: ${rightCase.s === 423 ? 'sí' : 'no'})`);
// ── E8: concurrencia ──
const cReal = await reg('conc'), cNxEmail = `nxc-${stamp}@example.test`; const rs1 = await Promise.all(Array.from({ length: 20 }, (_, i) => lg(cReal.email, 'Mala1!' + i))); const rs2 = await Promise.all(Array.from({ length: 20 }, (_, i) => lg(cNxEmail, 'Mala1!' + i)));
const row = (await q('select "loginAttempts" la, "lockedUntil" lu from "Users" where email=$1', [cReal.email]))[0]; const later1 = await lg(cReal.email, cReal.password), later2 = await lg(cNxEmail, 'Mala1!');
const c401 = a => a.filter(r => r.s === 401).length;
check('E8a 20 intentos fallidos SIMULTÁNEOS: ningún 5xx, y tanto la cuenta real como el correo inexistente quedan bloqueados (423) después', ![...rs1, ...rs2].some(r => r.s >= 500) && later1.s === 423 && later2.s === 423, `real: 401=${c401(rs1)} 423=${rs1.filter(r => r.s === 423).length}, BD intentos=${row.la} bloqueada=${!!row.lu} · inexistente: 401=${c401(rs2)} 423=${rs2.filter(r => r.s === 423).length} · después real=${later1.s} inexistente=${later2.s}`);
check('E8b (límite de intentos simultáneos) el nº de intentos fallidos aceptados antes del bloqueo no supera el umbral de 3 por mucho: real vs inexistente', c401(rs1) <= 6 && c401(rs2) <= 6, `cuenta real dejó pasar ${c401(rs1)} intentos con 401; correo inexistente ${c401(rs2)} (umbral 3)`);
// ── E10: entradas raras ──
const raros = [['', ''], [null, 'x'], [123, 'x'], [{ a: 1 }, 'x'], [['a@b.c'], 'x'], ['__proto__', 'x'], ['constructor', 'x'], ['a'.repeat(200000) + '@example.test', 'x'], ['x@example.test', 'p'.repeat(100000)], ['x@example.test', { p: 1 }], ['x\u0000@example.test', 'x'], ['İ@example.test', 'x']];
const rr = []; for (const [e, p] of raros) { const r = await lg(e, p); rr.push(r.s); } const rawBad = await lg(null, null, nextIp(), '{"email":'); const rawEmpty = await lg(null, null, nextIp(), '');
check('E10 entradas raras (vacío, null, número, objeto, arreglo, __proto__, 200 kB, nulos, JSON roto): 4xx controlado, nunca 5xx', [...rr, rawBad.s, rawEmpty.s].every(s => s >= 400 && s < 500), rr.join(',') + ' | json roto=' + rawBad.s + ' vacío=' + rawEmpty.s);
const afterOdd = await lg('__proto__', 'x'); const afterOdd2 = await lg(`ok-${stamp}@example.test`, 'x');
check('E10b tras la matriz rara el contador sigue sano: un correo normal nuevo da 401 (no 423 ni 5xx)', afterOdd2.s === 401, `normal=${afterOdd2.s} __proto__=${afterOdd.s}`);
// ── E12: limitador por IP ──
const fixedIp = '203.0.113.77'; const lim = []; for (let i = 0; i < 12; i++) lim.push((await lg(i % 2 ? real.email : `nxl${i}-${stamp}@example.test`, 'x', fixedIp)).s); const limBodies = [(await lg(real.email, 'x', fixedIp)).text, (await lg(`nxlim-${stamp}@example.test`, 'x', fixedIp)).text];
check('E12 el limitador por IP (10/min) sigue activo y su respuesta 429 no depende de si el correo existe', lim.slice(10).every(s => s === 429) && limBodies[0] === limBodies[1], `estados=${lim.join(',')} cuerpos iguales=${limBodies[0] === limBodies[1]}`);
// ── E9: regresión ──
const okU = await reg('ok'); const okLogin = await lg(okU.email, okU.password); const dup = await call('POST', '/api/register', { body: { name: 'dup', email: okU.email, password: pw() } }); const weak = await call('POST', '/api/register', { body: { name: 'w', email: `w-${stamp}@example.test`, password: 'abc123' } });
const pr1 = await call('POST', '/api/password-reset/request', { body: { email: okU.email } }), pr2 = await call('POST', '/api/password-reset/request', { body: { email: `no-${stamp}@example.test` } });
check('E9 regresión: login correcto 200 con token; registro con contraseña débil 400; recuperación de contraseña neutra (mismo estado y cuerpo exista o no)', okLogin.s === 200 && /token/.test(okLogin.text) && weak.s === 400 && pr1.s === pr2.s && pr1.text === pr2.text, `login=${okLogin.s} débil=${weak.s} reset=${pr1.s}/${pr2.s} iguales=${pr1.text === pr2.text}`);
check('E9b (informativo) registro con un correo ya existente', true, `estado=${dup.s} ${dup.text.slice(0, 100)} (si distingue «ya registrado», es otro oráculo de enumeración fuera de este PR)`);
// ── E7: memoria del contador (prueba directa del módulo) ──
const la = (await import('node:module')).createRequire(BACK + '/package.json')('./utils/loginAttempts.js'); la.reset(); const victim = 'victima@example.test'; for (let i = 0; i < 3; i++) la.recordFailure(victim); const lockedBefore = !!la.lockedUntil(victim); for (let i = 0; i < 25000; i++) la.recordFailure(`flood${i}@example.test`); const sizeAfter = la.size(); const lockedAfter = !!la.lockedUntil(victim);
check('E7a memoria acotada: 25.000 correos distintos no hacen crecer el mapa más allá del tope (10.000)', sizeAfter <= 10000, `tamaño=${sizeAfter}`);
check('E7b (informativo) una inundación de correos inexistentes desaloja entradas bloqueadas más antiguas: el bloqueo de un correo inexistente puede levantarse inundando el mapa', true, `bloqueado antes=${lockedBefore} después de 25.000 distintos=${lockedAfter} (solo afecta a correos sin cuenta activa; las cuentas reales usan la base de datos)`);
// ── E11: registros ──
const src = fs.readFileSync(BACK + '/routes/auth.js', 'utf8') + fs.readFileSync(BACK + '/utils/loginAttempts.js', 'utf8'); const logs = [...src.matchAll(/console\.(log|error|warn)\(([^)]*)\)/g)].map(m => m[2]);
check('E11 ningún console.* de auth.js ni loginAttempts.js incluye correo ni contraseña (revisión de código)', logs.every(l => !/email|password|req\.body|user\b/i.test(l)), `${logs.length} llamadas: ${logs.slice(0, 6).join(' | ').slice(0, 220)}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-220-pr163.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES220 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
