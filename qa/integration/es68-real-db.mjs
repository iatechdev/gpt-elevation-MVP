// [QA-Claude] ES-68 · PR #51 (landing S3-S5 y contenido editable ES-66) contra Postgres REAL local. Sin IA.
// Uso: QA_SUT=<clon con el head de #51> QA_API=http://127.0.0.1:8168 DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> node qa/integration/es68-real-db.mjs
// Solo datos sintéticos (@example.test). No se imprimen contraseñas ni tokens.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
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
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, headers: r.headers };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa68-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA68 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const U = await mkUser('u'), ADM = await mkUser('adm', 'admin'), SU = await mkUser('su', 'superadmin'), TH = await mkUser('th', 'therapist'), BRD = await mkUser('brd', 'board');
const t = { u: mint(U), adm: mint(ADM), su: mint(SU), th: mint(TH), brd: mint(BRD) };
const put = (token, body) => call('PUT', '/api/landing-content', { token, body });
const KEY = 'landing.problem.title'; // se comprueba más abajo contra el catálogo real

// Contenido por defecto (GET público)
const es = await call('GET', '/api/landing-content?lang=es'), en = await call('GET', '/api/landing-content?lang=en');
const keysEs = Object.keys(es.json ?? {}).filter(k => k.startsWith('landing.')), keysEn = Object.keys(en.json ?? {}).filter(k => k.startsWith('landing.'));
info('claves', `es=${keysEs.length} en=${keysEn.length}`);
check('ES68-G01 GET público (sin token) responde 200 con claves landing.* en ES y EN, mismas claves en ambos idiomas', es.status === 200 && en.status === 200 && keysEs.length > 10 && keysEs.sort().join() === keysEn.sort().join(), `es=${keysEs.length} en=${keysEn.length}`);
const problemKeys = keysEs.filter(k => /problem|module|journey/.test(k));
check('ES68-G02 existen las claves de S3, S4 y S5', problemKeys.length >= 10, problemKeys.slice(0, 4).join(','));
check('ES68-G03 los valores por defecto de ES y EN no están vacíos ni son iguales entre idiomas (traducción presente)', keysEs.every(k => es.json[k]?.trim() && en.json[k]?.trim()) && keysEs.filter(k => es.json[k] === en.json[k] && !/.number$|^landing.header.(es|en)$/.test(k)).length === 0, `iguales=${keysEs.filter(k => es.json[k] === en.json[k] && !/.number$|^landing.header.(es|en)$/.test(k)).join(',')}`);
check('ES68-G04 el GET público no contiene datos personales, correos ni secretos', !/@|password|token|secret|Bearer/i.test(es.text + en.text), '');
const textAll = (es.text + en.text);
check('ES68-G05 sin promesas de empleo, cifras de eficacia ni diagnóstico afirmativo en los textos por defecto', !/garantiz|guarante(?!e)|empleabilidad|employability|\d+\s?%|testimon/i.test(textAll.replace(/no (garantiz|guarant)\w*/gi, '')), (textAll.match(/garantiz\w*|empleabilidad|\d+\s?%/i) || ['—'])[0]);
const firstKey = keysEs.find(k => /problem.*title/.test(k)) ?? problemKeys[0]; const bodyKey = keysEs.find(k => /problem.*(body|text|description)/.test(k)) ?? problemKeys[1]; const thirdKey = keysEs.find(k => /modules?.*title/.test(k)) ?? thirdKey;

// Permisos
for (const [who, tk] of [['sin token', undefined], ['usuario', t.u], ['administrador', t.adm], ['terapeuta', t.th], ['junta', t.brd]]) {
  const r = await put(tk, { key: firstKey, lang: 'es', value: 'Intento de ' + who });
  check(`ES68-P01 PUT de ${who} → 401/403 y no cambia el contenido`, [401, 403].includes(r.status), `status=${r.status}`);
}
check('ES68-P02 tras los intentos no autorizados el contenido sigue igual', (await call('GET', '/api/landing-content?lang=es')).json[firstKey] === es.json[firstKey], '');
const ok = await put(t.su, { key: firstKey, lang: 'es', value: 'Título editado por superadmin' });
check('ES68-P03 superadmin edita una clave aprobada → 200', ok.status === 200, `status=${ok.status}`);
check('ES68-P04 la edición se ve en el GET público (ES) y no altera EN', (await call('GET', '/api/landing-content?lang=es')).json[firstKey] === 'Título editado por superadmin' && (await call('GET', '/api/landing-content?lang=en')).json[firstKey] === en.json[firstKey], '');

// Validación
const bad = [['clave landing desconocida', { key: 'landing.no.existe', lang: 'es', value: 'x' }], ['idioma inválido', { key: firstKey, lang: 'fr', value: 'x' }], ['valor vacío', { key: firstKey, lang: 'es', value: '   ' }], ['valor no texto', { key: firstKey, lang: 'es', value: 5 }], ['sin clave', { lang: 'es', value: 'x' }], ['valor de 5001 caracteres', { key: firstKey, lang: 'es', value: 'x'.repeat(5001) }], ['clave de 256 caracteres', { key: 'k'.repeat(256), lang: 'es', value: 'x' }], ['clave objeto', { key: { a: 1 }, lang: 'es', value: 'x' }]];
for (const [n, body] of bad) { const r = await put(t.su, body); check(`ES68-V01 «${n}» → 400, no 500`, r.status === 400 && !/stack|at |Sequelize/.test(r.text), `status=${r.status}`); }
let r = await put(t.su, '{no json'); check('ES68-V02 JSON roto → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
r = await put(t.su, []); check('ES68-V03 cuerpo arreglo → 400', r.status === 400, `status=${r.status}`);
r = await put(t.su, '{"key":"' + firstKey + '","lang":"es","value":"x","__proto__":{"polluted":true}}'); check('ES68-V04 __proto__ en el cuerpo no contamina el prototipo', ({}).polluted === undefined && r.status < 500, `status=${r.status}`);
const XSS = '<img src=x onerror=window.__xss=1> "comillas" &amp; <script>1</script>';
r = await put(t.su, { key: firstKey, lang: 'en', value: XSS }); check('ES68-V05 HTML en el valor se guarda como texto y se devuelve tal cual (el escape lo hace la interfaz)', r.status === 200 && (await call('GET', '/api/landing-content?lang=en')).json[firstKey] === XSS, `status=${r.status}`);
const LONG = 'palabra'.repeat(400);
r = await put(t.su, { key: bodyKey, lang: 'es', value: LONG }); check('ES68-V06 cadena larga sin espacios (2800 caracteres) se acepta', r.status === 200, `status=${r.status}`);
const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => put(t.su, { key: thirdKey, lang: 'es', value: 'Concurrente ' + i })));
check('ES68-V07 12 ediciones concurrentes de la misma clave: sin 5xx y una sola fila', burst.every(x => x.status < 500) && (await q(`select count(*)::int n from "LandingContents" where key=$1 and lang='es'`, [thirdKey]))[0].n === 1, burst.map(x => x.status).join(','));
const dos = await Promise.all(Array.from({ length: 30 }, () => call('GET', '/api/landing-content?lang=es')));
check('ES68-V08 30 lecturas públicas simultáneas sin error', dos.every(x => x.status === 200), '');
console.log(JSON.stringify({ fin: true, claveEditada: firstKey, claveLarga: bodyKey, claveHtml: firstKey }));
await db.end();
