// [QA-Claude] ES-186 · PR #186 (parche «Invitar persona» y «Enviar enlace de restablecimiento») · servidor REAL, Postgres con migraciones, datos sintéticos, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log del servidor> MODE=plain|base node qa/integration/es186-servidor-pr186.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const MODE = E.MODE || 'plain';
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); }; const info = (id, d) => { results.push({ id, info: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 400) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa186-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA186 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body, hdr = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...hdr }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers }; };
  const inv = (u, email, role = 'user', extra = {}) => call(u, 'POST', '/api/admin/invitations', { email, role, ...extra });
  const SA = await mk('sa', 'superadmin'), AD = await mk('ad', 'admin'), TH = await mk('th', 'therapist'), PE = await mk('pe', 'user'), BO = await mk('bo', 'board'), SA2 = await mk('sa2', 'superadmin'), PE2 = await mk('pe2', 'user');
  const em = t => `qa186-inv-${t}-${stamp}@example.test`;

  // R1 · forma REAL
  const r1 = await inv(SA, em('r1'), 'therapist', { locale: 'en' });
  const keys = r1.json ? Object.keys(r1.json).sort().join(',') : '';
  const fx = JSON.parse(fs.readFileSync(path.join(E.QA_SUT, 'frontend/test/fixtures/es-186-invite-recorded.json'), 'utf8'));
  check('R1a invitar (superadmin): 201 con {id,email,role,invitedBy,expiresAt,status,emailSent…}; misma forma que el fixture del PR', r1.status === 201 && keys === Object.keys(fx.body).sort().join(',') && r1.json.status === 'pending', `${r1.status} claves=${keys}`);
  check('R1b sin proveedor de correo: emailSent === false (booleano) y la respuesta NO trae enlace, token, hash ni url', r1.json.emailSent === false && !/token|link|url|hash|accept-invitation/i.test(r1.text), r1.text.slice(0, 200));
  const hash = (await q('select "tokenHash" from "Invitations" where id=$1', [r1.json.id]))[0].tokenHash;
  check('R1c en la base solo queda el hash del token (64 hex), no el token', /^[0-9a-f]{64}$/.test(hash), hash.length + ' hex');
  const rl = await call(SA, 'POST', `/api/admin/usuarios/${PE.id}/reset-link`, { locale: 'es' });
  const fxr = JSON.parse(fs.readFileSync(path.join(E.QA_SUT, 'frontend/test/fixtures/es-186-reset-link.json'), 'utf8'));
  check('R1d reset-link: 202 con solo {message}, sin enlace ni token; misma forma que el fixture', rl.status === 202 && Object.keys(rl.json).join() === Object.keys(fxr.body).join() && !/token|link=|http|reset-password#/i.test(rl.json.message.replace(/enlace de restablecimiento|reset link/gi, '')), rl.text.slice(0, 200));
  const resetRows = await q('select "tokenHash" from "PasswordResets" where "UserId"=$1', [PE.id]);
  info('R1e fila de restablecimiento sin proveedor/base', `${resetRows.length} fila(s)` + (resetRows[0] ? ` hash=${/^[0-9a-f]{64}$/.test(resetRows[0].tokenHash)}` : ''));

  // S1 · quién puede
  const rolesOk = async (u) => { const out = []; for (const role of ['user', 'therapist', 'board', 'admin', 'superadmin']) { const r = await inv(u, em(`s1-${u.role}-${role}`), role); out.push(role + ':' + r.status); } return out; };
  const saRoles = await rolesOk(SA), adRoles = await rolesOk(AD);
  check('S1a superadmin invita a los 5 roles (201)', saRoles.every(x => x.endsWith(':201')), saRoles.join(' '));
  check('S1b admin invita solo user/therapist (201) y recibe 403 role_not_allowed para board/admin/superadmin', adRoles.join(' ') === 'user:201 therapist:201 board:403 admin:403 superadmin:403', adRoles.join(' '));
  const adBad = await inv(AD, em('s1-adm-bad'), 'superadmin'); check('S1c el 403 trae code role_not_allowed (la pantalla lo traduce por código)', adBad.json?.code === 'role_not_allowed', adBad.text.slice(0, 160));
  const others = {}; for (const [n, u] of [['terapeuta', TH], ['persona', PE], ['junta', BO]]) { others[n] = (await inv(u, em('s1-' + n), 'user')).status; }
  const anon = (await inv(null, em('s1-anon'), 'user')).status; const bad = (await call({ token: 'x.y.z' }, 'POST', '/api/admin/invitations', { email: em('s1-bad'), role: 'user' })).status;
  check('S1d profesional, persona, junta, sin sesión y token falso → 401/403 en invitar (sin cabecera: 403 por convención del servidor; token falso: 401)', [others.terapeuta, others.persona, others.junta].every(s => s === 403) && (anon === 401 || anon === 403) && bad === 401, JSON.stringify(others) + ' anon=' + anon + ' falso=' + bad);
  const rlRole = async (u, id) => (await call(u, 'POST', `/api/admin/usuarios/${id}/reset-link`, {})).status;
  const rs = { admin: await rlRole(AD, PE.id), terapeuta: await rlRole(TH, PE.id), persona: await rlRole(PE, PE2.id), junta: await rlRole(BO, PE.id), anon: (await call(null, 'POST', `/api/admin/usuarios/${PE.id}/reset-link`, {})).status };
  check('S1e reset-link: admin, profesional, persona, junta → 403; sin sesión → 401/403', rs.admin === 403 && rs.terapeuta === 403 && rs.persona === 403 && rs.junta === 403 && (rs.anon === 401 || rs.anon === 403), JSON.stringify(rs));
  const toSA2 = await rlRole(SA, SA2.id), toSelf = await rlRole(SA, SA.id), toTh = await rlRole(SA, TH.id), toAd = await rlRole(SA, AD.id), none = await rlRole(SA, 99999999);
  check('S1f reset-link superadmin → otro superadmin 403; a sí mismo/persona/profesional/admin 202; inexistente 404', toSA2 === 403 && toSelf === 202 && toTh === 202 && toAd === 202 && none === 404, `otroSA=${toSA2} propio=${toSelf} prof=${toTh} admin=${toAd} inexistente=${none}`);
  const weird = []; for (const id of ['abc', '1;drop', '-1', '0', '9'.repeat(30), '%00', '1e3', '1.5']) { const r = await call(SA, 'POST', `/api/admin/usuarios/${encodeURIComponent(id)}/reset-link`, {}); weird.push(r.status); }
  check('S1g ids raros en reset-link → 4xx, nunca 5xx', weird.every(s => s >= 400 && s < 500), weird.join(','));

  // I1 · invitación
  const e1 = em('i1'); const a = await inv(SA, e1, 'user'), b = await inv(SA, e1, 'user'), c = await inv(SA, e1, 'therapist');
  const live = await q(`select count(*)::int n from "Invitations" where lower(email)=$1 and "usedAt" is null`, [e1]);
  check('I1a invitación repetida (mismo correo): 201 cada vez, sin 5xx, y queda UN solo enlace vivo (el último)', a.status === 201 && b.status === 201 && c.status === 201 && live[0].n === 1, `${a.status}/${b.status}/${c.status} vivos=${live[0].n}`);
  const exist = await inv(SA, PE.email, 'user'); const existUp = await inv(SA, PE.email.toUpperCase(), 'user'); const rows = await q('select count(*)::int n from "Invitations" where lower(email)=$1', [PE.email.toLowerCase()]);
  check('I1b correo ya registrado (también en mayúsculas) → 409 email_taken y NO se crea invitación', exist.status === 409 && exist.json?.code === 'email_taken' && existUp.status === 409 && rows[0].n === 0, `${exist.status}/${existUp.status} filas=${rows[0].n}`);
  const bads = [['', 'user'], ['   ', 'user'], ['sin-arroba', 'user'], ['a@b', 'user'], ['<script>alert(1)</script>@x.co', 'user'], ['a@b.co\nBcc: x@y.co', 'user'], ['x'.repeat(300) + '@mail.co', 'user'], ['ñandú@mail.co', 'user'], ["o'neil@mail.co", 'user'], ['a b@mail.co', 'user'], ['‮a@mail.co', 'user']];
  const bs = []; for (const [email] of bads) { bs.push((await inv(SA, email, 'user')).status); }
  check('I1c correos vacío/inválido/HTML/CRLF/enorme/Unicode/comilla → 400 (nunca 5xx ni 201)', bs.every(s => s === 400), bs.join(','));
  const roles = []; for (const role of ['', 'root', 'Superadmin', '__proto__', 'user ', 'USER', 123, null, ['user'], { a: 1 }]) { const r = await call(SA, 'POST', '/api/admin/invitations', { email: em('i1-r' + roles.length), role }); roles.push(r.status); }
  check('I1d rol inventado, vacío, con otro tipo o con mayúsculas → 400/403, nunca 5xx ni 201', roles.every(s => s === 400 || s === 403), roles.join(','));
  const malformed = [(await call(SA, 'POST', '/api/admin/invitations', '{"email":')).status, (await call(SA, 'POST', '/api/admin/invitations', 'null', { 'content-type': 'application/json' })).status, (await call(SA, 'POST', '/api/admin/invitations', '[]', { 'content-type': 'application/json' })).status, (await call(SA, 'POST', '/api/admin/invitations', {})).status];
  check('I1e cuerpo roto, null, lista o vacío → 400, nunca 5xx', malformed.every(s => s >= 400 && s < 500), malformed.join(','));
  const loc = await inv(SA, em('i1-loc'), 'user', { locale: 'fr' }); check('I1f locale desconocido se acepta sin error (cae a es)', loc.status === 201, String(loc.status));
  // límite de ritmo por quien invita (30/h): con otro admin sintético
  const AD2 = await mk('ad2', 'admin'); let last = 0, first429 = 0; for (let i = 1; i <= 33; i++) { const r = await inv(AD2, em('rate' + i), 'user'); last = r.status; if (r.status === 429 && !first429) first429 = i; }
  const r429 = await inv(AD2, em('rate-final'), 'user');
  check('I1g límite por quien invita: 429 con code rate_limited a partir de la invitación 31, y no afecta a otro invitador', first429 === 31 && r429.json?.code === 'rate_limited' && (await inv(SA, em('after-rate'), 'user')).status === 201, `primer429=${first429} final=${r429.status}`);
  // la lista nunca devuelve token
  const list = await call(SA, 'GET', '/api/admin/invitations'); check('I1h el listado de invitaciones nunca incluye token/hash', list.status === 200 && !/token/i.test(list.text), `${list.status} ${list.json?.length} filas`);
  check('I1i las respuestas de invitar no se guardan en caché (Cache-Control: no-store)', /no-store/.test(r1.headers.get('cache-control') || ''), r1.headers.get('cache-control'));

  // E1 · endpoints retirados
  const r410a = await call(SA, 'POST', '/api/admin/usuarios', { name: 'x', email: em('e1'), password: 'Aa1!aaaaaa', role: 'user' }); const r410b = await call(SA, 'PUT', `/api/admin/usuarios/${PE.id}/reset-password`, { newPassword: 'Aa1!aaaaaa' });
  const pw = (await q('select password from "Users" where id=$1', [PE.id]))[0].password; const created = await q('select count(*)::int n from "Users" where email=$1', [em('e1')]);
  check('E1a POST /api/admin/usuarios y PUT …/reset-password siguen en 410, sin crear la cuenta ni cambiar la contraseña', r410a.status === 410 && r410b.status === 410 && created[0].n === 0, `${r410a.status}/${r410b.status} creada=${created[0].n}`);
  const frontend = (function walk(d) { return fs.readdirSync(d).flatMap(n => { const f = path.join(d, n); return fs.statSync(f).isDirectory() ? walk(f) : /\.(tsx?|jsx?)$/.test(n) ? [f] : []; }); })(path.join(E.QA_SUT, 'frontend/src'));
  const hits = frontend.filter(f => /reset-password`|\/api\/admin\/usuarios`\s*,/.test(fs.readFileSync(f, 'utf8').replace(/\r/g, '')) && !/pages\/ResetPassword|ResetPassword/.test(f)).map(f => path.relative(E.QA_SUT, f));
  const loose = frontend.filter(f => /admin\/usuarios\/\$\{[^}]*\}\/reset-password/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(E.QA_SUT, f));
  check('E1b ninguna referencia en frontend/src a POST /api/admin/usuarios ni a …/reset-password de administración', hits.length === 0 && loose.length === 0, 'hits=' + hits.join(',') + ' sueltas=' + loose.join(','));
  // autoprueba del detector del PR: si se reintroduce la llamada, la prueba del PR debe fallar
  const tf = path.join(E.QA_SUT, 'frontend/src/pages/admin/AdminUsers.tsx'); const orig = fs.readFileSync(tf, 'utf8'); let detects = null;
  try { fs.writeFileSync(tf, orig + '\nconst _x = async () => fetch(`${API}/api/admin/usuarios/${1}/reset-password`, { method: "PUT" })\n'); const { spawnSync } = require('node:child_process'); const r = spawnSync(process.execPath, ['--test', 'test/es-186-parche-botones.test.mjs'], { cwd: path.join(E.QA_SUT, 'frontend'), encoding: 'utf8' }); detects = r.status !== 0; } finally { fs.writeFileSync(tf, orig); }
  check('E1c autoprueba: si se reintroduce una llamada a …/reset-password, la prueba del PR falla (el detector funciona)', detects === true, 'falla=' + detects);

  // S2 · sesión y rangos
  const revoked = await mk('rev', 'superadmin'); await call(revoked, 'POST', '/api/auth/logout', {}).catch(() => {});
  const expired = { token: jwt.sign({ id: SA.id, name: SA.name, role: 'superadmin', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '-10s' }) };
  const exInv = (await inv(expired, em('s2-ex'), 'user')).status, exRl = (await call(expired, 'POST', `/api/admin/usuarios/${PE.id}/reset-link`, {})).status;
  check('S2a token vencido → 401 en invitar y en reset-link', exInv === 401 && exRl === 401, `${exInv}/${exRl}`);
  const wrongKey = { token: jwt.sign({ id: SA.id, role: 'superadmin', iatMs: Date.now() }, 'otra-clave-sintetica', { expiresIn: '1h' }) };
  check('S2b token firmado con otra clave → 401', (await inv(wrongKey, em('s2-wk'), 'user')).status === 401, '');
  const demoted = await mk('dem', 'superadmin'); const dg = await call(SA, 'PUT', '/api/admin/usuarios/' + demoted.id, { role: 'user' });
  const dm = (await inv(demoted, em('s2-dem'), 'user')).status, dm2 = await rlRole(demoted, PE.id);
  check('S2c degradar a un superadmin por la ruta real (PUT) revoca su sesión: el JWT antiguo recibe 401/403 en invitar y reset-link', dg.status === 200 && [401,403].includes(dm) && [401,403].includes(dm2), `PUT=${dg.status} invitar=${dm} reset=${dm2}`);
  const pend = await mk('pend', 'user'); await q('insert into "DeletionRequests"(id,"UserId",status,attempts,"createdAt","updatedAt") values(gen_random_uuid(),$1,\'accepted\',0,now(),now())', [pend.id]).catch(e => info('S2d-nota', e.message.slice(0, 120)));
const rlPend = await rlRole(SA, pend.id); await sleep(600); const pendRows = (await q('select count(*)::int n from "PasswordResets" where "UserId"=$1', [pend.id]))[0].n;
check('S2d reset-link a una cuenta con eliminación pendiente (ES-23) → 409 deletion_pending y no se genera enlace', rlPend === 409 && pendRows === 0, 'estado=' + rlPend + ' filas=' + pendRows);
  const off = await mk('off', 'user'); await q('update "Users" set active=false where id=$1', [off.id]);
  const before = (await q('select count(*)::int n from "PasswordResets" where "UserId"=$1', [off.id]))[0].n; const rOff = await rlRole(SA, off.id); await sleep(800); const after = (await q('select count(*)::int n from "PasswordResets" where "UserId"=$1', [off.id]))[0].n;
  check('S2e reset-link a cuenta INACTIVA: no se genera enlace (0 filas nuevas) y la respuesta no revela el estado (202 igual que a una activa)', rOff === 202 && after === before, `status=${rOff} filas ${before}->${after}`);
  const adSa = await call(AD, 'POST', `/api/admin/usuarios/${SA2.id}/reset-link`, {}); check('S2f admin → reset-link sobre superadmin: 403 (rango, ES-215)', adSa.status === 403, String(adSa.status));

  // reset-link concurrente + límite por cuenta
  const burst = await Promise.all(Array.from({ length: 8 }, () => call(SA, 'POST', `/api/admin/usuarios/${PE2.id}/reset-link`, {})));
  await sleep(1500); const alive = (await q('select count(*)::int n from "PasswordResets" where "UserId"=$1 and "usedAt" is null', [PE2.id]))[0].n;
  check('R3 8 solicitudes simultáneas de enlace a la misma persona: todas 202, sin 5xx, y EXACTAMENTE un enlace vivo', burst.every(r => r.status === 202) && alive === 1, `${burst.map(r => r.status).join(',')} vivos=${alive}`);

  await rlRole(SA, TH.id); await sleep(1200); const thRows = (await q('select count(*)::int n, bool_and("tokenHash" ~ $2) h from "PasswordResets" where "UserId"=$1', [TH.id, '^[0-9a-f]{64}$']))[0];
  check('S2g reset-link a una cuenta activa SÍ genera su fila (solo hash) aunque no haya proveedor: el caso inactivo de S2e no es vacío', thRows.n >= 1 && thRows.h === true, JSON.stringify(thRows));

  // P1 · logs
  await sleep(500); const log = fs.existsSync(E.SRVLOG) ? fs.readFileSync(E.SRVLOG, 'utf8') : '';
  const leaks = [/accept-invitation/i, /reset-password#/i, /token=/i, /#token/i, new RegExp(r1.json.email.split('@')[0]), /qa186-[a-z0-9]+-\d+@example\.test/, /Bearer /i].filter(rx => rx.test(log)).map(String);
  check(`P1 [${MODE}] el log del servidor (${log.length} bytes) no contiene enlace, token, fragmento #token ni correos completos de las personas invitadas`, log.length > 0 && leaks.length === 0, 'fugas=' + leaks.join(' | '));
  info(`P1b [${MODE}] líneas del log relacionadas`, [...new Set(log.split('\n').filter(l => /invit|restablec|recuper|correo/i.test(l)).map(l => l.trim()))].slice(0, 6).join(' ‖ '));

  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-186-servidor-pr186-${MODE}.json`), JSON.stringify(results, null, 1));
  console.log('RESUMEN-ES186 ' + MODE + ' ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id) }));
  await db.end(); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
