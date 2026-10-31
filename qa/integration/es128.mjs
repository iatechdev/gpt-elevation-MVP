// [QA-Claude] ES-128 · PR #114 (política de contraseña en el registro). Postgres REAL, servidor local con el merge del head y main fresco, datos SINTÉTICOS, 0 llamadas a la IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> node qa/integration/es128.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import path from 'node:path';
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg'); const bcrypt = (() => { try { return req('bcryptjs'); } catch { return req('bcrypt'); } })(); const API = E.QA_API;
const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now(); let n = 0;
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
const em = () => `qa128-${stamp}-${++n}@example.test`; const reg = async (password, extra = {}, email = em()) => { const t0 = performance.now(); const r = await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA128', email, password, ...extra }) }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { /* */ } return { s: r.status, j, text, ms: performance.now() - t0, email }; };
const rows = async email => (await q('select id, role, active, password from "Users" where email=$1', [email])); const pol = r => r.s === 400 && r.j?.code === 'password_policy';
// F1 longitud
const a11 = await reg('Ñandú1234ñ'); check('F1a 10 caracteres rechazada', pol(a11), `${a11.s} ${a11.j?.code}`); const c11 = 'abcdefghi🙂x'; const l11 = [...c11].length; const r11 = await reg('Ab1!Ab1!Ab1'); check('F1b 11 caracteres rechazada con política', pol(r11), `${r11.s} ${r11.j?.code}`);
const r12 = await reg('Ab1!Ab1!Ab1!'); check('F1c 12 caracteres exactos aceptada (201)', r12.s === 201, `${r12.s}`); const r13 = await reg('Ab1!Ab1!Ab1!Z'); check('F1d 13 caracteres aceptada (201)', r13.s === 201, `${r13.s}`);
const acc = await reg('ñandú-ñoño-ÁÉÍÓÚ'); check('F1e 12+ caracteres con acentos y ñ aceptada (cuenta caracteres, no bytes)', acc.s === 201, `${acc.s}`); const short = await reg('Ñandú-ñoño1'); check('F1f 11 caracteres con acentos (más de 11 bytes) sigue rechazada', pol(short), `${short.s}`);
// F2 bytes
const b72 = await reg('Aa1!' + 'x'.repeat(68)); check('F2a 72 bytes exactos (ASCII) aceptada', b72.s === 201, `${b72.s}`); const b73 = await reg('Aa1!' + 'x'.repeat(69)); check('F2b 73 bytes rechazada con política', pol(b73), `${b73.s} ${b73.j?.code}`);
const em18 = await reg('🙂'.repeat(18)); check('F2c 18 emojis (72 bytes, 18 caracteres) aceptada', em18.s === 201, `${em18.s}`); const em19 = await reg('🙂'.repeat(19)); check('F2d 19 emojis (76 bytes; pasa 12 caracteres, supera 72 bytes) rechazada', pol(em19), `${em19.s} ${em19.j?.code}`);
const cjk = await reg('密码'.repeat(13)); check('F2e 26 caracteres de 3 bytes (78 bytes) rechazada, sin 5xx', pol(cjk), `${cjk.s}`);
// F3 comunes
for (const pw of ['password1234', '123456789012', 'Password1234', '  123456789012  ', 'PASSWORD123456', 'qwertyuiop12']) { const r = await reg(pw); check(`F3 contraseña común «${pw.trim()}»: rechazada`, pol(r) || r.s === 201 && false, `${r.s} ${r.j?.code ?? ''}`); }
const nc = await reg('password12345x'); check('F3b una variante que no está en la lista se acepta (límite documentado, no defecto)', nc.s === 201, `${nc.s}`);
const sp = await reg('            '); check('F3c 12 espacios rechazada', pol(sp), `${sp.s}`);
// F5 tipos
for (const [nm, v] of [['null', null], ['número', 123456789012], ['arreglo', ['Ab1!Ab1!Ab1!']], ['objeto', { a: 1 }], ['booleano', true], ['cadena de 1 MB', 'x'.repeat(1024 * 1024)], ['cadena vacía', '']]) { const r = await reg(v); check(`F5 contraseña ${nm}: 4xx controlado (no 5xx)`, r.s >= 400 && r.s < 500, `${r.s} ${r.j?.code ?? ''}`); }
// F6 registro válido y hash
const ok = await reg('Contraseña-Segura-2026'); const rw = (await rows(ok.email))[0]; check('F6 registro válido: 201, rol «user», contraseña con hash bcrypt (no en claro)', ok.s === 201 && rw?.role === 'user' && /^\$2[aby]\$/.test(rw?.password) && !rw.password.includes('Contraseña'), `${ok.s} rol=${rw?.role} hash=${String(rw?.password).slice(0, 4)}`);
// F7 compatibilidad con cuenta antigua de contraseña corta
const old = await reg('Contraseña-Antigua-1'); const hash = await bcrypt.hash('corta1', 10); await q('update "Users" set password=$1 where email=$2', [hash, old.email]); const lg = await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: old.email, password: 'corta1' }) }); check('F7 una cuenta antigua con contraseña corta sigue entrando (200)', lg.status === 200, `${lg.status}`);
// F8 orden de validación / enumeración
const dupWeak = await reg('corta1', {}, ok.email); const dupStrong = await reg('Otra-Contraseña-2026', {}, ok.email); check('F8a correo ya registrado + contraseña débil: política (400), sin revelar si el correo existe', pol(dupWeak) && !/registrado|already/i.test(dupWeak.text), `${dupWeak.s} ${dupWeak.j?.code}`); check('F8b correo ya registrado + contraseña válida: sigue el comportamiento anterior (4xx de duplicado)', dupStrong.s >= 400 && dupStrong.s < 500 && dupStrong.j?.code !== 'password_policy', `${dupStrong.s} ${JSON.stringify(dupStrong.j).slice(0, 80)}`);
// F6b cuenta inactiva no se reactiva
const ina = await reg('Contraseña-Inactiva-1'); await q('update "Users" set active=false where email=$1', [ina.email]); const again = await reg('Contraseña-Inactiva-1', {}, ina.email); const st = (await rows(ina.email))[0]; check('F6b registrar de nuevo una cuenta inactiva: 403 y NO se reactiva', again.s === 403 && st.active === false, `${again.s} active=${st.active}`);
// S4 campos extra
const priv = await reg('Contraseña-Privilegio-1', { role: 'superadmin', active: true, id: 1 }); const pr = (await rows(priv.email))[0]; check('S4 el registro público no acepta rol ni propietario del cliente (rol final «user» o rechazo)', priv.s >= 400 || pr?.role === 'user', `${priv.s} rol=${pr?.role}`);
// S1 no eco de la contraseña, S3 inyección
const echo = await reg('Contraseña-Eco-12345'); check('S1 la respuesta no devuelve la contraseña ni el hash', !/Contraseña-Eco|\$2[aby]\$/.test(echo.text), '');
for (const [nm, name, email] of [['SQL', "x'); DROP TABLE \"Users\"; --", em()], ['HTML', '<img src=x onerror=alert(1)>', em()], ['nulos y RTL', 'a\u0000b‮c', em()]]) { const r = await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password: 'Contraseña-Inyeccion-1' }) }); check(`S3 nombre con ${nm}: sin 5xx`, r.status < 500, `${r.status}`); }
check('S3b la tabla Users sigue íntegra tras la inyección', (await q('select count(*)::int n from "Users"'))[0].n > 5, '');
// S5 truncado de bcrypt: dos contraseñas que difieren después del byte 72 no pueden coexistir
const A = 'Aa1!' + 'x'.repeat(68); const Bb = 'Aa1!' + 'x'.repeat(68) + 'DIFERENTE'; const rb = await reg(Bb); check('S5 una contraseña que difiere solo después del byte 72 se rechaza (evita el truncado silencioso de bcrypt)', pol(rb), `${rb.s}`);
// P: latencias
const pl = []; for (let i = 0; i < 10; i++) pl.push((await reg('corta1')).ms); pl.sort((x, y) => x - y); const vl = []; for (let i = 0; i < 5; i++) vl.push((await reg('Valida-Contraseña-' + i + 'Z')).ms); vl.sort((x, y) => x - y);
check('P3 el rechazo por política responde en < 100 ms (mediana) y mucho antes que un registro válido', pl[5] < 100 && pl[5] < vl[2], `rechazo mediana=${Math.round(pl[5])}ms registro válido mediana=${Math.round(vl[2])}ms`); check('P1 registro válido: mediana < 1 s', vl[2] < 1000, `${Math.round(vl[2])}ms`);
const conc = await Promise.all(Array.from({ length: 10 }, (_, i) => reg(i % 2 ? 'corta1' : 'Concurrente-Valida-' + i + 'Q'))); check('P2 10 registros simultáneos (5 válidos, 5 débiles): 201/400 correctos y 0 errores 5xx', conc.every((r, i) => (i % 2 ? pol(r) : r.s === 201)), conc.map(r => r.s).join(','));
console.log('RESUMEN ' + JSON.stringify({ total: out.length, ok: out.filter(o => o.ok).length, fallos: out.filter(o => !o.ok).map(o => o.id) })); await db.end();
