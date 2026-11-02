// [QA-Claude] ES-132 · PR #128: recuperación de contraseña, casos de API (F1–F7, S1–S9, P1). Servidores locales con el merge del PR, Postgres real, proveedor de correo de PRUEBA que guarda el enlace en un archivo local.
// Uso: A=http://127.0.0.1:8128 B=http://127.0.0.1:8129 C=http://127.0.0.1:8130 MAILDIR=<carpeta con mail-a/b/c.jsonl> LOGA=<log servidor A> OUT=<carpeta> node qa/integration/es132-api.cjs
// A: límites altos (para repetir casos); B: límites por defecto (S4); C: enlace con TTL de 3 s (F3). Datos SINTÉTICOS, 0 tokens de IA. No imprime enlaces ni contraseñas.
const fs = require('fs'); const path = require('path'); const E = process.env; const { Client } = require('C:/Users/Usuario/Documents/qa-pr-test/backend/node_modules/pg');
const A = E.A, B = E.B, C = E.C, OUT = E.OUT; fs.mkdirSync(OUT, { recursive: true }); const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const stamp = Date.now();
const call = async (base, p, body, { method = 'POST', headers = {}, raw } = {}) => { const t0 = performance.now(); const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: method === 'GET' ? undefined : (raw !== undefined ? raw : JSON.stringify(body)) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch { /* */ } return { s: r.status, j, txt, ms: performance.now() - t0, h: r.headers }; };
const db = async q => { const c = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/es132test' }); await c.connect(); const r = await c.query(q.text, q.values); await c.end(); return r; };
const STRONG = 'Nueva-Clave-QA132-' + stamp + 'aA!', OLD = 'Clave-Original-QA132-' + stamp + 'aA!';
const mailFile = base => path.join(E.MAILDIR, base === A ? 'mail-a.jsonl' : base === B ? 'mail-b.jsonl' : 'mail-c.jsonl');
const mails = (base, to) => fs.readFileSync(mailFile(base), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(m => !to || m.to === to);
const tokenOf = m => decodeURIComponent((m.text.match(/#token=([^\s]+)/) || [])[1] || '');
const waitMail = async (base, to, n) => { for (let i = 0; i < 40; i++) { const m = mails(base, to); if (m.length >= n) return m; await sleep(150); } return mails(base, to); };
let seq = 0; const mkUser = async (base, role = 'user', tag = 'u') => { const email = `qa132-${tag}-${stamp}-${seq++}@example.test`; const r = await call(base, '/api/register', { name: 'QA132 ' + tag, email, password: OLD }); if (role !== 'user') await db({ text: 'update "Users" set role=$1 where email=$2', values: [role, email] }); return { email, regStatus: r.s }; };
const login = async (base, email, password) => { for (let i = 0; i < 8; i++) { const r = await call(base, '/api/login', { email, password }); if (r.s !== 429) return r; await sleep(8000); } return { s: 429 }; };
const request = (base, email, extra = {}) => call(base, '/api/password-reset/request', { email, ...extra });
const confirm = (base, token, password) => call(base, '/api/password-reset/confirm', { token, password });
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }; const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const stable = r => JSON.stringify({ s: r.s, txt: r.txt, ct: r.h.get('content-type'), cl: r.h.get('content-length') });
(async () => {
  // --- F1: misma respuesta exista o no la cuenta
  const ex = await mkUser(A, 'user', 'f1'); const ina = await mkUser(A, 'user', 'inact'); await db({ text: 'update "Users" set active=false where email=$1', values: [ina.email] });
  const rs = { existe: await request(A, ex.email), inexistente: await request(A, `noexiste-${stamp}@example.test`), inactivo: await request(A, ina.email), mayusculas: await request(A, ex.email.toUpperCase()) };
  check('F1-misma-respuesta', Object.values(rs).every(r => r.s === 202) && new Set(Object.values(rs).map(stable)).size === 1, JSON.stringify(Object.fromEntries(Object.entries(rs).map(([k, v]) => [k, v.s]))));
  await sleep(600); check('F1b-solo-la-cuenta-activa-recibe-correo', mails(A, ex.email).length >= 1 && mails(A, ina.email).length === 0 && mails(A, `noexiste-${stamp}@example.test`).length === 0, `existe=${mails(A, ex.email).length} inactivo=${mails(A, ina.email).length}`);
  // --- S1: tiempos
  const tE = [], tN = []; for (let i = 0; i < 30; i++) { tE.push((await request(A, ex.email)).ms); tN.push((await request(A, `n${i}-${stamp}@example.test`)).ms); }
  check('S1-enumeracion-por-tiempo', Math.abs(med(tE) - med(tN)) < 20, `mediana existe=${med(tE).toFixed(1)} ms, inexistente=${med(tN).toFixed(1)} ms, diferencia=${Math.abs(med(tE) - med(tN)).toFixed(1)} ms; p95 ${p95(tE).toFixed(1)}/${p95(tN).toFixed(1)}`);
  // --- F2/F6/F7/S5: flujo completo
  const u = await mkUser(A, 'user', 'flujo'); const l0 = await login(A, u.email, OLD); const T0 = l0.j && l0.j.token; const before = await (await fetch(A + '/api/diary', { headers: { Authorization: 'Bearer ' + T0 } })).status;
  for (let i = 0; i < 6; i++) await login(A, u.email, 'incorrecta-' + i); const locked = await login(A, u.email, OLD);
  await request(A, u.email); const m1 = (await waitMail(A, u.email, 1))[0]; const tok = tokenOf(m1);
  check('F2pre-correo-con-enlace-en-fragmento', /\/reset-password#token=/.test(m1.text) && !/\?token=/.test(m1.text) && m1.text.includes('30 minutos'), 'enlace en #fragmento, caducidad 30 min en el texto');
  const rowsAntes = await db({ text: 'select * from "PasswordResets" pr join "Users" u on u.id=pr."UserId" where u.email=$1', values: [u.email] });
  check('S5-solo-hash-en-bd', rowsAntes.rows.length >= 1 && rowsAntes.rows.every(r => /^[0-9a-f]{64}$/.test(r.tokenHash)) && !JSON.stringify(rowsAntes.rows).includes(tok), `filas=${rowsAntes.rows.length} columnas=${Object.keys(rowsAntes.rows[0] || {}).filter(k => /token|hash|used|expires/i.test(k)).join(',')}`);
  const ok1 = await confirm(A, tok, STRONG); const ok2 = await confirm(A, tok, STRONG + 'x');
  check('F2-un-solo-uso', ok1.s === 200 && ok2.s === 400 && ok2.j && ok2.j.code === 'reset_invalid', `1.º=${ok1.s} 2.º=${ok2.s}`);
  const after = await (await fetch(A + '/api/diary', { headers: { Authorization: 'Bearer ' + T0 } })).status; const oldLogin = await login(A, u.email, OLD); const newLogin = await login(A, u.email, STRONG);
  check('F6-revoca-sesiones-previas', before === 200 && after === 401 && oldLogin.s === 401 && newLogin.s === 200, `token previo antes=${before} despues=${after}; clave vieja=${oldLogin.s}; nueva=${newLogin.s}`);
  check('F7-desbloquea-cuenta', newLogin.s === 200 && locked.s !== 200, `bloqueada antes del reset: login con clave correcta=${locked.s}; tras el reset=${newLogin.s}`);
  // --- S2: concurrencia
  const uc = await mkUser(A, 'user', 'conc'); await request(A, uc.email); const tc = tokenOf((await waitMail(A, uc.email, 1))[0]);
  const rr = await Promise.all(Array.from({ length: 10 }, (_, i) => confirm(A, tc, STRONG + i))); const wins = rr.filter(r => r.s === 200).length;
  check('S2-concurrencia-10-confirm', wins === 1 && rr.filter(r => r.s === 400).length === 9, `éxitos=${wins}; estados=${rr.map(r => r.s).join(',')}`);
  // --- F4: último enlace gana
  const u4 = await mkUser(A, 'user', 'ultimo'); await request(A, u4.email); await request(A, u4.email); const m4 = await waitMail(A, u4.email, 2); const [t4a, t4b] = [tokenOf(m4[0]), tokenOf(m4[1])];
  const c4a = await confirm(A, t4a, STRONG), c4b = await confirm(A, t4b, STRONG);
  check('F4-ultimo-enlace-gana', m4.length === 2 && c4a.s === 400 && c4b.s === 200, `primero=${c4a.s} segundo=${c4b.s}`);
  // --- S3: límite por cuenta
  const u3 = await mkUser(A, 'user', 'limite'); const r3 = []; for (let i = 0; i < 4; i++) r3.push(await request(A, u3.email)); await sleep(800);
  check('S3-limite-3-enlaces-por-hora', mails(A, u3.email).length === 3 && r3.every(r => r.s === 202) && new Set(r3.map(stable)).size === 1, `correos=${mails(A, u3.email).length} respuestas=${r3.map(r => r.s).join(',')}`);
  // --- F5: política ES-128 sin gastar el enlace
  const u5 = await mkUser(A, 'user', 'politica'); await request(A, u5.email); const t5 = tokenOf((await waitMail(A, u5.email, 1))[0]);
  const weak = ['corta1A', 'sinmayuscula123!', 'SINMINUSCULA123!', 'SinDigitos-Largo!', 'SinEspecial12345Aa', '']; const wr = []; for (const w of weak) wr.push(await confirm(A, t5, w));
  const strongAfter = await confirm(A, t5, STRONG);
  check('F5-politica-ES128-no-gasta-el-enlace', wr.slice(0, 5).every(r => r.s === 400 && r.j && r.j.code === 'password_policy' && Array.isArray(r.j.missing)) && wr[5].s === 400 && strongAfter.s === 200, `débiles=${wr.map(r => r.s + (r.j && r.j.code ? ':' + r.j.code : '')).join(' | ')}; luego válida=${strongAfter.s}`);
  // --- S8: roles
  const roles = []; for (const role of ['admin', 'therapist', 'board']) { const ur = await mkUser(A, role, role); const r = await request(A, ur.email); roles.push([role, r.s, stable(r) === stable(rs.existe)]); }
  check('S8-roles-misma-respuesta', roles.every(r => r[1] === 202 && r[2]), JSON.stringify(roles));
  // --- S9: mayúsculas/espacios
  const u9 = await mkUser(A, 'user', 'caso'); const v = [u9.email.toUpperCase(), ' ' + u9.email + ' ', u9.email]; const r9 = []; for (const e of v) r9.push((await request(A, e)).s); await sleep(800);
  check('S9-correo-capitalizacion-y-espacios', r9.every(s => s === 202), `respuestas=${r9.join(',')}; correos emitidos=${mails(A, u9.email).length} (se documenta: el servidor compara el correo tal cual lo recibe)`);
  // --- S7: entradas maliciosas
  const bad = [{}, { email: null }, { email: 123 }, { email: [] }, { email: { $ne: 1 } }, { email: { toString: 1 } }, { email: "x' OR '1'='1" }, { email: '<script>alert(1)</script>@x.test' }, { email: 'a'.repeat(10000) + '@x.test' }, { email: 'ñandú-😀@example.test' }, { email: ['a@b.test', 'c@d.test'] }];
  const s7 = []; for (const b of bad) { const r = await request(A, b.email, {}).catch(() => null); const r2 = await call(A, '/api/password-reset/request', b); s7.push(r2.s); }
  const badC = [{}, { token: null, password: STRONG }, { token: 1, password: STRONG }, { token: [], password: STRONG }, { token: { a: 1 }, password: STRONG }, { token: 'a'.repeat(129), password: STRONG }, { token: 'x', password: { a: 1 } }, { token: "x' OR 1=1 --", password: STRONG }, { token: 'a'.repeat(100000), password: STRONG }, { token: 'abc', password: 'a'.repeat(100000) + 'Aa1!' }];
  const s7c = []; for (const b of badC) s7c.push((await call(A, '/api/password-reset/confirm', b)).s); const raw = await call(A, '/api/password-reset/request', null, { raw: '{no es json' }); const get = await call(A, '/api/password-reset/request', null, { method: 'GET' });
  check('S7-entradas-maliciosas-sin-500', [...s7, ...s7c, raw.s, get.s].every(s => s < 500), `request=${s7.join(',')}; confirm=${s7c.join(',')}; json roto=${raw.s}; GET=${get.s}`);
  // --- S6: logs del servidor
  const log = fs.readFileSync(E.LOGA, 'utf8'); const tokensVistos = [tok, tc, t4a, t4b, t5]; const mailAll = mails(A).map(m => m.to);
  check('S6-token-correo-y-enlace-fuera-de-logs', tokensVistos.every(t => t && !log.includes(t)) && !/reset-password#/.test(log) && !mailAll.some(e => e && log.includes(e)), `log de ${log.length} caracteres revisado: sin tokens, sin enlaces, sin correos`);
  // --- F3: caducidad (servidor C, TTL 3 s)
  const uC = await mkUser(C, 'user', 'ttl'); await request(C, uC.email); const tC = tokenOf((await waitMail(C, uC.email, 1))[0]); await sleep(4500); const cC = await confirm(C, tC, STRONG); const lC = await login(C, uC.email, OLD);
  check('F3-caducidad', cC.s === 400 && cC.j && cC.j.code === 'reset_invalid' && lC.s === 200, `confirm tras vencer=${cC.s}; la clave original sigue valiendo=${lC.s}`);
  // --- S4: límites 429 (servidor B, valores por defecto)
  const uB = await mkUser(B, 'user', 'rate'); const rq = []; for (let i = 0; i < 7; i++) rq.push(await request(B, uB.email)); const cf = []; for (let i = 0; i < 12; i++) cf.push(await confirm(B, 'x' + i, STRONG));
  check('S4-429-request-y-confirm', rq.slice(0, 5).every(r => r.s === 202) && rq[5].s === 429 && rq[5].j && rq[5].j.code === 'rate_limited' && cf.slice(0, 10).every(r => r.s === 400) && cf[10].s === 429 && /Espera|Wait/.test(rq[5].txt), `request: ${rq.map(r => r.s).join(',')}; confirm: ${cf.map(r => r.s).join(',')}`);
  // --- P1: rendimiento
  const lat = []; for (let i = 0; i < 50; i++) lat.push((await request(A, `p${i}-${stamp}@example.test`)).ms);
  const up = await mkUser(A, 'user', 'perf'); const latC = []; for (let i = 0; i < 20; i++) { await request(A, up.email); await sleep(100); }
  const ms = mails(A, up.email); const tk = ms.slice(-1).map(tokenOf)[0]; const cl = await confirm(A, tk, STRONG); latC.push(cl.ms);
  const upl = []; for (let i = 0; i < 12; i++) { const uu = await mkUser(A, 'user', 'p' + i); await request(A, uu.email); const t = tokenOf((await waitMail(A, uu.email, 1))[0]); upl.push((await confirm(A, t, STRONG)).ms); }
  check('P1-rendimiento', p95(lat) < 200 && p95(upl) < 500, `request p50=${med(lat).toFixed(1)} p95=${p95(lat).toFixed(1)} ms (n=50); confirm p50=${med(upl).toFixed(1)} p95=${p95(upl).toFixed(1)} ms (n=12; incluye bcrypt)`);
  fs.writeFileSync(path.join(OUT, 'resultados-api-132.json'), JSON.stringify(out, null, 1)); console.log('RESUMEN', out.filter(o => o.ok).length + '/' + out.length);
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR', detail: String(e.stack).slice(0, 700) })); process.exit(1); });
