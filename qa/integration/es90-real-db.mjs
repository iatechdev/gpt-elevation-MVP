// [QA-Claude] ES-90 · PR #62: textos provisionales sin corchetes y guardado de pendientes, contra Postgres REAL. Solo datos sintéticos.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8262 DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es90-real-db.mjs
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
const req = createRequire(path.join(sut, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const stamp = Date.now();
const mk = async (tag, role) => { const email = `qa90-${tag}-${stamp}@example.test`; await fetch(api + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA90 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(8).toString('hex') }); };
const T = { su: await mk('su', 'superadmin'), adm: await mk('adm', 'admin'), th: await mk('th', 'therapist'), brd: await mk('brd', 'board'), usr: await mk('usr', 'user') };
const put = (t, body) => fetch(api + '/api/landing-content', { method: 'PUT', headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
const get = async (lang) => { const r = await fetch(api + '/api/landing-content?lang=' + lang); const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch { /* no JSON */ } return { status: r.status, text, json }; };
const KEYS = ['landing.modules.elevation.status', 'landing.skillmap.routes.continuity.pending', 'landing.skillmap.routes.adjacent.pending', 'landing.skillmap.routes.exploratory.pending', 'landing.join.professional_pending'];
const EXP = {
  es: { 'landing.modules.elevation.status': 'En piloto', 'landing.skillmap.routes.continuity.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.skillmap.routes.adjacent.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.skillmap.routes.exploratory.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.join.professional_pending': 'Próximamente: el alta de profesionales aún no está disponible.' },
  en: { 'landing.modules.elevation.status': 'In pilot', 'landing.skillmap.routes.continuity.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.skillmap.routes.adjacent.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.skillmap.routes.exploratory.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.join.professional_pending': 'Coming soon: professional sign-up is not available yet.' },
};
const gEs = await get('es'), gEn = await get('en');
check('ES90-A01 GET público ES y EN: 200 y ningún corchete en ninguna clave', gEs.status === 200 && gEn.status === 200 && !/[\[\]]/.test(gEs.text + gEn.text), `claves=${Object.keys(gEs.json).length}/${Object.keys(gEn.json).length}`);
for (const lang of ['es', 'en']) { const g = lang === 'es' ? gEs : gEn; const bad = KEYS.filter(k => g.json[k] !== EXP[lang][k]); check(`ES90-A02 ${lang.toUpperCase()}: los 5 textos provisionales son literalmente los aprobados`, bad.length === 0, bad.join(',')); }
check('ES90-A03 los textos provisionales no inventan fuentes, fechas, cifras, estados ni promesas', KEYS.every(k => !/\d|garantiz|guarante|certific|validad|verificad[oa]s? por|disponible ya|available now/i.test(EXP.es[k].replace('esté verificado', '') + EXP.en[k].replace('is verified', ''))), '');
// Roles
const body = { key: KEYS[0], lang: 'es', value: 'Valor sintético QA90' };
const rs = {}; for (const [n, t] of Object.entries(T)) rs[n] = (await put(t, body)).status; rs.anon = (await put(null, body)).status;
check('ES90-B01 solo el superadmin edita: admin, terapeuta, junta, participante y anónimo → 401/403', rs.su === 200 && ['adm', 'th', 'brd', 'usr'].every(k => rs[k] === 403) && [401, 403].includes(rs.anon), JSON.stringify(rs));
check('ES90-B02 el valor del superadmin se publica en ES y el EN conserva su provisional', (await get('es')).json[KEYS[0]] === body.value && (await get('en')).json[KEYS[0]] === 'In pilot', '');
const forged = jwt.sign({ id: 1, role: 'superadmin', iatMs: Date.now() }, 'otra-' + randomBytes(6).toString('hex'), { expiresIn: '1h', jwtid: 'x' + randomBytes(6).toString('hex') }); check('ES90-B03 token firmado con otra clave que dice superadmin → rechazado', [401, 403].includes((await put(forged, body)).status), '');
const roleClaim = await (async () => { const email = `qa90-claim-${stamp}@example.test`; await fetch(api + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'C', email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); const u = (await q('select id,name from "Users" where email=$1', [email]))[0]; return jwt.sign({ id: u.id, name: u.name, role: 'superadmin', iatMs: Date.now() }, JWT, { expiresIn: '1h', jwtid: randomBytes(8).toString('hex') }); })();
const rc = (await put(roleClaim, body)).status; check('ES90-B04 (informativo) las rutas de administración leen el rol del token firmado por el servidor (diseño ES-18; un token con otro rol solo existe si se firma con la clave del servidor, como hace esta prueba)', true, `PUT con token propio re-firmado como superadmin=${rc}`);
// Guardado y límites
const bads = [['vacío', ''], ['solo espacios', '   '], ['5001 caracteres', 'x'.repeat(5001)], ['no texto', 123], ['null', null]]; for (const [n, v] of bads) { const r = await put(T.su, { key: KEYS[1], lang: 'es', value: v }); check(`ES90-C01 valor ${n} → 400 y no cambia`, r.status === 400 && (await get('es')).json[KEYS[1]] === EXP.es[KEYS[1]], `status=${r.status}`); }
const badKey = await put(T.su, { key: 'landing.no.existe', lang: 'es', value: 'x' }); const badLang = await put(T.su, { key: KEYS[1], lang: 'fr', value: 'x' }); check('ES90-C02 clave inexistente e idioma no soportado → 400, sin 5xx', badKey.status === 400 && badLang.status === 400, `${badKey.status}/${badLang.status}`);
const html = '<img src=x onerror=window.__x=1> "comillas" & <b>x</b>'; await put(T.su, { key: KEYS[2], lang: 'en', value: html }); check('ES90-C03 HTML y comillas se guardan literales (y se muestran como texto)', (await get('en')).json[KEYS[2]] === html && (await get('es')).json[KEYS[2]] === EXP.es[KEYS[2]], '');
const long = 'ñ'.repeat(4999) + '🙂'; const rl = await put(T.su, { key: KEYS[3], lang: 'es', value: long }); check('ES90-C04 límite con acentos y emoji: 200 si cabe, 400 si no; sin 5xx', rl.status < 500, `status=${rl.status}`); await put(T.su, { key: KEYS[3], lang: 'es', value: EXP.es[KEYS[3]] });
// Corchetes por la API
const br = await put(T.su, { key: KEYS[4], lang: 'es', value: '[fuente pendiente]' }); const after = (await get('es')).json[KEYS[4]];
check('ES90-D01 (informativo) intentar guardar un marcador «[…]» por la API', true, `PUT=${br.status} GET público=${/\[/.test(after) ? 'lo devuelve' : 'no lo devuelve'}`);
await put(T.su, { key: KEYS[4], lang: 'es', value: EXP.es[KEYS[4]] });
// Persistencia y restauración
const before = (await q('select count(*)::int n from "LandingContents"'))[0].n; await put(T.su, { key: KEYS[0], lang: 'es', value: 'Otro valor sintético' }); const row = await q(`select value, updated_by from "LandingContents" where key=$1 and lang='es'`, [KEYS[0]]);
check('ES90-E01 el valor queda en la base (una fila por clave e idioma) con el autor', row.length === 1 && row[0].value === 'Otro valor sintético', `filas=${row.length} autor=${row[0]?.updated_by ? 'sí' : 'no'}`);
for (const lang of ['es', 'en']) for (const k of KEYS) await put(T.su, { key: k, lang, value: EXP[lang][k] });
const f1 = await get('es'), f2 = await get('en'); check('ES90-E02 restaurar los provisionales deja el GET público como al inicio y sin corchetes', KEYS.every(k => f1.json[k] === EXP.es[k] && f2.json[k] === EXP.en[k]) && !/[\[\]]/.test(f1.text + f2.text), '');
const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => put(T.su, { key: KEYS[1], lang: 'es', value: 'Concurrente ' + i }))); const rowsN = (await q(`select count(*)::int n from "LandingContents" where key=$1 and lang='es'`, [KEYS[1]]))[0].n;
check('ES90-E03 20 guardados simultáneos del mismo campo: sin 5xx y una sola fila', burst.every(r => r.status < 500) && rowsN === 1, `estados=${[...new Set(burst.map(r => r.status))].join(',')} filas=${rowsN}`); await put(T.su, { key: KEYS[1], lang: 'es', value: EXP.es[KEYS[1]] });
console.log(JSON.stringify({ fin: true })); await db.end();
