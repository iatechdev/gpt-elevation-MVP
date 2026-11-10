// [QA-Claude] ES-252 · PR #202 guardián de caracteres de control/formato Unicode en correos (registro, invitaciones, solicitud profesional) · servidor REAL (Postgres con migraciones). Datos sintéticos, 0 IA.
// Uso: QA_SUT QA_API DATABASE_URL QA_JWT_SECRET node qa/integration/es252-email-pr202.cjs   (servidor con PRO_APP_RATE_MAX alto)
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 480) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 480) })); }; const info = (id, d) => { results.push({ id, info: String(d).slice(0, 480) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 480) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}]/u;
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now(); let n = 0;
  const pw = () => randomBytes(12).toString('base64url') + 'aA1!';
  const raw = async (m, p, body, headers = {}) => { const r = await fetch(API + p, { method: m, headers, body }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers }; };
  const jpost = (p, body, token) => raw('POST', p, JSON.stringify(body), { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });
  const register = (email, password = pw()) => jpost('/api/register', { name: 'QA252', email, password });
  const mkSA = async (role) => { const email = `qa252-${role}-${stamp}@example.test`; await register(email); await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const SA = await mkSA('superadmin');
  const invite = (email, role = 'user') => jpost('/api/admin/invitations', { email, role }, SA.token);
  const pdf = new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')], { type: 'application/pdf' });
  const apply = (email, extra = {}) => { const f = new FormData(); const v = { name: 'Profesional Sintético', email, country: 'Colombia', profession: 'Psicología', consent: 'true', ...extra }; for (const [k, x] of Object.entries(v)) f.append(k, x); f.append('cv', pdf, 'cv.pdf'); return raw('POST', '/api/professional-applications', f); };
  const count = async (t, col, v) => (await q(`select count(*)::int n from "${t}" where lower("${col}")=lower($1)`, [v]))[0].n;
  const appRows = async (email) => q(`select email from "ProfessionalApplications" where email=$1`, [email]);

  const CH = [['U+202E RLO', '‮'], ['U+202D LRO', '‭'], ['U+202A LRE', '‪'], ['U+202B RLE', '‫'], ['U+202C PDF', '‬'], ['U+2066 LRI', '⁦'], ['U+2067 RLI', '⁧'], ['U+2068 FSI', '⁨'], ['U+2069 PDI', '⁩'], ['U+200B ancho cero', '​'], ['U+FEFF BOM', '﻿'], ['U+2060 word joiner', '⁠'], ['U+00AD soft hyphen', '­'], ['U+200C ZWNJ (declarado)', '‌'], ['U+200D ZWJ (declarado)', '‍'], ['U+061C ALM', '؜'], ['U+180E', '᠎'], ['U+200E LRM', '‎'], ['U+200F RLM', '‏'],
    ['LF', '\n'], ['CR', '\r'], ['TAB', '\t'], ['NUL', '\u0000'], ['DEL', '\u007f'], ['U+0085 NEL', '\u0085'], ['U+001B ESC', '\u001b'], ['U+2028 LS', ' '], ['U+2029 PS', ' '], ['U+E000 uso privado', ''], ['U+F8FF uso privado', ''], ['U+0378 sin asignar', '͸'], ['U+FFFF no-carácter', '￿'], ['U+E0001 tag (Cf)', '\u{e0001}'], ['U+10FFFD privado sup.', '\u{10fffd}']];

  // E1 · rechazados en los tres sitios, en la parte local y en el dominio
  const regBad = [], invBad = [], appRes = [], leaks = [];
  for (const [name, ch] of CH) for (const where of ['local', 'domain']) {
    const email = where === 'local' ? `qa252${ch}x${++n}-${stamp}@example.test` : `qa252x${++n}-${stamp}@exam${ch}ple.test`;
    const r1 = await register(email); const created = (await q('select count(*)::int n from "Users" where email like $1', [`qa252%x${n}-${stamp}@%`]))[0].n;
    if (!(r1.status === 400 && r1.json?.code === 'invalid_email') || created) regBad.push(`${name}/${where}:${r1.status}/${created}`);
    const r2 = await invite(email); const inv = (await q('select count(*)::int n from "Invitations" where email like $1', [`qa252%x${n}-${stamp}@%`]))[0].n;
    if (!(r2.status === 400 && r2.json?.code === 'invalid_email') || inv) invBad.push(`${name}/${where}:${r2.status}/${inv}`);
    const r3 = await apply(email); const rows = await q(`select email from "ProfessionalApplications" where email like $1 or email like $2`, [`qa252%x${n}-${stamp}@%`, `qa252x${n}-${stamp}@%`]);
    appRes.push([name + '/' + where, r3.status, rows.length ? rows[0].email : null]); if (rows.some(x => UNSAFE.test(x.email))) leaks.push(name + '/' + where);
  }
  check(`E1a REGISTRO: ${CH.length * 2} correos con un carácter de control/formato (en la parte local y en el dominio) → 400 invalid_email y ninguna cuenta creada`, regBad.length === 0, regBad.slice(0, 6).join(' | ') || `${CH.length * 2}/${CH.length * 2}`);
  check(`E1b INVITACIONES: ${CH.length * 2} correos con un carácter de control/formato → 400 invalid_email y ninguna invitación creada`, invBad.length === 0, invBad.slice(0, 6).join(' | ') || `${CH.length * 2}/${CH.length * 2}`);
  const appBad = appRes.filter(([, s]) => s !== 400 && s !== 200 && s !== 201), appAcc = appRes.filter(([, s]) => s === 200 || s === 201);
  check('E1c SOLICITUD PROFESIONAL: ningún correo con carácter inseguro queda GUARDADO tal cual (se rechaza con 400 o se guarda ya limpio) y no hay 5xx', leaks.length === 0 && appBad.length === 0, `inseguros guardados=${leaks.join(',') || 'ninguno'} otros estados=${appBad.map(x => x[0] + ':' + x[1]).join(',') || 'ninguno'}`);
  info('E1d solicitud profesional: casos que se aceptaron tras LIMPIAR el carácter (correo guardado distinto del enviado)', appAcc.length + ' de ' + appRes.length + ': ' + appAcc.slice(0, 8).map(x => `${x[0]}→${x[1]}:${x[2]}`).join(' ‖ '));
  const rej400 = appRes.filter(([, s]) => s === 400).map(x => x[0].split('/')[0]); info('E1e solicitud profesional: rechazados con 400 (categorías)', [...new Set(rej400)].join(', '));

  // E2 · válidos intactos
  const valids = [['acentos', `josé.pérez${++n}-${stamp}@example.test`], ['eñe', `ñandú${++n}-${stamp}@example.test`], ['IDN dominio', `usuario${++n}-${stamp}@bücher.example`], ['+tag', `ana+tag${++n}-${stamp}@example.test`], ['puntos', `a.b.c${++n}-${stamp}@example.test`], ['MAYÚSCULAS', `ANA${++n}-${stamp}@EXAMPLE.TEST`], ['CJK local', `用户${++n}-${stamp}@example.test`], ['árabe local', `مستخدم${++n}-${stamp}@example.test`], ['hebreo local', `משתמש${++n}-${stamp}@example.test`], ['marcas combinadas (NFD)', `josé${++n}-${stamp}@example.test`], ['cirílico', `иван${++n}-${stamp}@example.test`], ['local 64', `${'a'.repeat(50)}${++n}-${stamp}`.slice(0, 64) + '@example.test']];
  const vReg = [], vInv = [], vApp = [];
  for (const [name, email] of valids) {
    const r1 = await register(email); if (r1.status >= 400) vReg.push(`${name}:${r1.status}`);
    const r2 = await invite(name === 'local 64' ? email.replace(/^a/, 'b') : email.replace(/^(.*)@/, (m, a) => a + 'i@')); if (r2.status !== 201) vInv.push(`${name}:${r2.status}:${r2.json?.code}`);
    const r3 = await apply(email); if (![200, 201].includes(r3.status)) vApp.push(`${name}:${r3.status}`);
  }
  check('E2a correos legítimos con acentos, ñ, IDN, CJK, árabe, hebreo, marcas combinadas, +tag y mayúsculas siguen valiendo en REGISTRO', vReg.length === 0, vReg.join(' | ') || `${valids.length}/${valids.length}`);
  check('E2b ... y en INVITACIONES (201)', vInv.length === 0, vInv.join(' | ') || `${valids.length}/${valids.length}`);
  check('E2c ... y en SOLICITUD PROFESIONAL', vApp.length === 0, vApp.join(' | ') || `${valids.length}/${valids.length}`);
  const up = await q('select email from "Users" where email like $1', [`ana%${stamp}@example.test`]); const lc = await q(`select email from "Invitations" where email like $1`, [`ana%${stamp}%`]);
  info('E2d normalización a minúsculas', `usuario=${up.map(x => x.email).join()} invitación=${lc.map(x => x.email).join()}`);

  // E3 · la forma no se debilita
  const forms = [['sin @', 'sin-arroba'], ['doble @', 'a@@b.co'], ['espacio', 'a b@x.co'], ['<>', '<a>@x.co'], ['comilla', "o'n@x.co"], ['coma', 'a,b@x.co'], ['vacío', ''], ['solo espacios', '   '], ['254+', 'x'.repeat(260) + '@x.co'], ['sin dominio', 'a@'], ['sin TLD', 'a@b']];
  const fInv = [], fApp = [], fReg = []; for (const [name, email] of forms) { const r = await invite(email); if (r.status !== 400) fInv.push(`invitación:${name}:${r.status}`); const a = await apply(email); if (a.status !== 400) fApp.push(`solicitud:${name}:${a.status}`); const g = await register(email); if (g.status >= 500) fReg.push(`registro:${name}:${g.status}`); }
  const appPre = fApp.filter(x => x.startsWith('solicitud:coma:')); const regPre = fReg.filter(x => x.startsWith('registro:254+:')); check('E3a la forma que el PR no tocó sigue exigiéndose: sin @, doble @, espacios, <>, comillas, vacío, enormes → 400 en INVITACIONES y SOLICITUD; el registro no da 5xx (salvo lo preexistente de E3c)', fInv.length === 0 && fApp.filter(x => !appPre.includes(x)).length === 0 && fReg.filter(x => !regPre.includes(x)).length === 0, [...fInv, ...fApp, ...fReg].join(' | ') || `${forms.length}/${forms.length}`); info('E3c PREEXISTENTE (el PR no toca ese código; se anota): la solicitud profesional acepta una coma en el correo (201) y el registro responde 500 con un correo de 260+ caracteres', [...appPre, ...regPre].join(' | '));
  const types = []; for (const v of [123, ['a@b.co'], { a: 1 }, null, true]) { const r = await jpost('/api/admin/invitations', { email: v, role: 'user' }, SA.token); const g = await jpost('/api/register', { name: 'x', email: v, password: pw() }); types.push(r.status + '/' + g.status); }
  check('E3b email con tipos raros (número, lista, objeto, null, booleano) → 4xx en invitaciones y registro, nunca 5xx', types.every(s => s.split('/').every(x => +x >= 400 && +x < 500)), types.join(' '));

  // E4 · restablecimiento y login sin cambio (BLOQUEANTE)
  const legacyEmail = `qa252​legacy${stamp}@example.test`; const legacyPw = pw();
  const lr = await register(`qa252legacy${stamp}@example.test`, legacyPw); await q('update "Users" set email=$1 where email=$2', [legacyEmail, `qa252legacy${stamp}@example.test`]);
  const L = (await q('select id,email from "Users" where id=(select max(id) from "Users" where email=$1)', [legacyEmail]))[0];
  const login1 = await jpost('/api/login', { email: legacyEmail, password: legacyPw });
  check('E4a una cuenta HEREDADA con un carácter hoy rechazado (la inserto en la base) puede seguir entrando con su correo exacto', lr.status < 300 && login1.status === 200 && !!login1.json?.token, `registro=${lr.status} login=${login1.status}`);
  await jpost('/api/password-reset/request', { email: legacyEmail }); await sleep(1500);
  const pr = (await q('select count(*)::int n from "PasswordResets" where "UserId"=$1', [L.id]))[0].n; check('E4b la cuenta heredada puede PEDIR restablecimiento: se genera su fila de enlace', pr >= 1, `filas=${pr}`);
  const rl = await raw('POST', `/api/admin/usuarios/${L.id}/reset-link`, JSON.stringify({}), { 'content-type': 'application/json', Authorization: 'Bearer ' + SA.token }); check('E4c el enlace de restablecimiento desde administración a la cuenta heredada sigue en 202', rl.status === 202, String(rl.status));
  const ex = `qa252ex${stamp}@example.test`; await register(ex);
  const t = async (email) => { const t0 = Date.now(); const r = await jpost('/api/password-reset/request', { email }); return { s: r.status, b: r.text, ms: Date.now() - t0 }; };
  const rExist = await t(ex), rNone = await t(`noexiste-${stamp}@example.test`), rBad = await t(`qa252‮bad${stamp}@example.test`), rLegacy = await t(legacyEmail);
  check('E4d SIN enumeración: pedir restablecimiento de un correo existente, inexistente, con carácter inseguro y heredado da el MISMO estado y el MISMO cuerpo', [rExist, rNone, rBad, rLegacy].every(x => x.s === 202 && x.b === rExist.b), JSON.stringify([rExist, rNone, rBad, rLegacy].map(x => [x.s, x.ms])));
  const lExist = await jpost('/api/login', { email: ex, password: 'incorrecta-aA1!' }), lNone = await jpost('/api/login', { email: `noexiste-${stamp}@example.test`, password: 'incorrecta-aA1!' }), lBad = await jpost('/api/login', { email: `qa252‮bad${stamp}@example.test`, password: 'incorrecta-aA1!' });
  check('E4e el login con credenciales erróneas no distingue existente / inexistente / con carácter inseguro (mismo estado y mensaje)', lExist.status === lNone.status && lNone.status === lBad.status && lExist.json?.error === lNone.json?.error && lNone.json?.error === lBad.json?.error, `${lExist.status}/${lNone.status}/${lBad.status} "${lExist.json?.error}"`);

  // E5/E6
  info('E5 otros puntos de entrada de un correo en el backend (grep de req.body.email)', 'solo registro, login, invitaciones y restablecimiento; la aceptación de invitación toma el correo de la invitación (no del cuerpo)');
  const base = `qa252dup${stamp}@example.test`; const first = await register(base); const withZw = await register(`qa252​dup${stamp}@example.test`); const dupRows = await count('Users', 'email', base); const zwRows = (await q('select count(*)::int n from "Users" where email like $1', [`qa252%dup${stamp}@%`]))[0].n;
  check('E6a registro con ancho cero ya NO crea una cuenta distinta que se ve igual: 400 y una sola cuenta', first.status < 300 && withZw.status === 400 && zwRows === 1 && dupRows === 1, `primero=${first.status} zw=${withZw.status} cuentas=${zwRows}`);
  const again = await register(base); info('E6b registro repetido del mismo correo (respuesta existente, sin cambio)', `${again.status} ${again.text.slice(0, 80)}`);

  // E7
  const e1 = await register(`qa252‮x${stamp}@example.test`); check('E7a el 400 trae code invalid_email y texto ES/EN, sin eco del correo enviado, y Cache-Control', e1.status === 400 && e1.json?.code === 'invalid_email' && /\/ /.test(e1.json?.error || '') && !/qa252/.test(e1.text), `${e1.status} ${e1.text.slice(0, 100)} cc=${e1.headers.get('cache-control')}`);
  const rnd = (len) => Array.from({ length: len }, () => String.fromCodePoint(Math.floor(Math.random() * 0x2fff) + 1)).join(''); const fz = [];
  for (let i = 0; i < 40; i++) { const email = `q${rnd(6)}${i}@${rnd(3)}.co`; const rs = [await register(email), await invite(email), await apply(email)]; if (rs.some(r => r.status >= 500)) fz.push(`${JSON.stringify(email)}:${rs.map(r => r.status)}`); }
  check('E7b 40 correos con Unicode aleatorio × 3 sitios → nunca 5xx', fz.length === 0, fz.slice(0, 3).join(' | ') || '120/120');
  const t0 = Date.now(); const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => i % 2 ? register(`qa252‮b${i}${stamp}@example.test`) : register(`qa252burst${i}-${stamp}@example.test`))); const ok = burst.filter((_, i) => i % 2 === 0), bad = burst.filter((_, i) => i % 2);
  check('E7c 12 solicitudes simultáneas (válidas e inseguras): sin 5xx, las inseguras 400 y el servidor sigue respondiendo', burst.every(r => r.status < 500) && bad.every(r => r.status === 400) && ok.every(r => r.status < 300) && (await raw('GET', '/api/health')).status === 200, `${Date.now() - t0}ms`);

  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-252-email-pr202.json'), JSON.stringify(results, null, 1));
  console.log('RESUMEN-ES252 ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id.slice(0, 40)) }));
  await db.end(); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
