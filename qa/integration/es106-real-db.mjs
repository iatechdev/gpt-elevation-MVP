// [QA-Claude] ES-106 · PR #80: el GET público de la landing ignora filas `landing.*` guardadas cuyas claves ya no están en el catálogo. Postgres REAL, datos sintéticos.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es106-real-db.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import path from 'node:path';
const E = process.env; const API = E.QA_API; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d })); const info = (id, d) => console.log(JSON.stringify({ id, info: d }));
const stamp = Date.now();
const mk = async (tag, role) => { const email = `qa106-${tag}-${stamp}@example.test`; const r = await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA106 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (r.status !== 201) throw new Error('registro ' + r.status); await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, t: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
const get = async lang => { const t0 = performance.now(); const r = await fetch(API + '/api/landing-content?lang=' + lang); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, text, json, ms: performance.now() - t0 }; };
const put = (t, body) => fetch(API + '/api/landing-content', { method: 'PUT', headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
const ins = (key, lang, value) => q(`insert into "LandingContents" (key, lang, value, updated_by, "createdAt", "updatedAt") values ($1,$2,$3,'qa',now(),now()) on conflict (key, lang) do update set value=excluded.value`, [key, lang, value]);
const SU = await mk('su', 'superadmin'), ADM = await mk('adm', 'admin'), USR = await mk('usr', 'user');
const base = { es: await get('es'), en: await get('en') }; const baseKeys = { es: Object.keys(base.es.json).sort(), en: Object.keys(base.en.json).sort() };
// ── Huérfanas
const MARK = 'HUERFANO-' + randomBytes(3).toString('hex'); const ORPH = ['landing.modules.elevation.status', 'landing.clave.que.ya.no.existe', 'landing.skillmap.routes.continuity.antigua'];
for (const k of ORPH) for (const l of ['es', 'en']) await ins(k, l, `${MARK} ${k} ${l}`);
const o = { es: await get('es'), en: await get('en') };
check('ES106-L01 las claves `landing.*` fuera del catálogo (incluida la eliminada de Elevation) no se publican en ES ni en EN y el GET responde 200', ['es', 'en'].every(l => o[l].status === 200 && !o[l].text.includes(MARK) && ORPH.every(k => !(k in o[l].json))), `es=${o.es.status} en=${o.en.status} huérfano_en_cuerpo=${o.es.text.includes(MARK) || o.en.text.includes(MARK)}`);
check('ES106-L02 el conjunto de claves publicado es idéntico al de antes de insertar las huérfanas', ['es', 'en'].every(l => JSON.stringify(Object.keys(o[l].json).sort()) === JSON.stringify(baseKeys[l])), `claves es=${Object.keys(o.es.json).length} en=${Object.keys(o.en.json).length}`);
// ── Overrides vigentes
const K = 'landing.skillmap.routes.body'; const OV = 'OVERRIDE-VIGENTE-' + randomBytes(2).toString('hex');
const pr = await put(SU.t, { key: K, lang: 'es', value: OV }); const v = { es: await get('es'), en: await get('en') };
check('ES106-L03 el override vigente de una clave del catálogo se publica en ES y no cambia el EN', pr.status === 200 && v.es.json[K] === OV && v.en.json[K] === base.en.json[K], `put=${pr.status}`);
await put(SU.t, { key: K, lang: 'es', value: base.es.json[K] });
// ── Claves heredadas y sin prefijo
const LEG = 'LEGADA-' + randomBytes(2).toString('hex'); await ins('hero_title', 'es', LEG); await ins('cta_primary', 'en', LEG); const NOP = 'SINPREFIJO-' + randomBytes(2).toString('hex'); await ins('otra_clave_sin_prefijo', 'es', NOP);
const l = { es: await get('es'), en: await get('en') };
check('ES106-L04 las claves heredadas (`hero_title`, `cta_primary`) con override siguen publicándose', l.es.json.hero_title === LEG && l.en.json.cta_primary === LEG, `hero_title=${l.es.json.hero_title}`);
info('ES106-L05 [INFO] una clave sin prefijo `landing.` guardada en la base sigue publicándose (comportamiento previo, documentado en el PR)', `publicada=${l.es.json.otra_clave_sin_prefijo === NOP}`);
await q(`delete from "LandingContents" where key in ('hero_title','cta_primary','otra_clave_sin_prefijo')`);
// ── Valor vacío / solo espacios de una clave válida: se ignora (sin cambios)
await ins('landing.skillmap.routes.body', 'es', '   '); const w = await get('es'); check('ES106-L06 un override en blanco de una clave válida se ignora y se conserva el texto por defecto', w.json[K] === base.es.json[K], ''); await q(`delete from "LandingContents" where key=$1 and lang='es'`, [K]);
// ── PUT sin cambios
const nA = await put(null, { key: K, lang: 'es', value: 'x' }); const nU = await put(USR.t, { key: K, lang: 'es', value: 'x' }); const nAd = await put(ADM.t, { key: K, lang: 'es', value: 'x' }); const unk = await put(SU.t, { key: 'landing.nueva.desconocida', lang: 'es', value: 'x' }); const free = await put(SU.t, { key: 'clave_libre_qa', lang: 'es', value: 'x' }); const bad = await put(SU.t, { key: K, lang: 'fr', value: 'x' });
check('ES106-P01 [SEG] PUT: sin sesión 401/403, participante 403, administrador 403; superadmin: clave `landing.*` desconocida 400, idioma inválido 400', [401, 403].includes(nA.status) && nU.status === 403 && nAd.status === 403 && unk.status === 400 && bad.status === 400, `${nA.status}/${nU.status}/${nAd.status}/${unk.status}/${bad.status}`);
info('ES106-P02 [INFO] PUT de clave sin prefijo `landing.` por superadmin (comportamiento previo)', `status=${free.status}`); await q(`delete from "LandingContents" where key='clave_libre_qa'`);
const nothing = (await q(`select count(*)::int n from "LandingContents" where key='landing.nueva.desconocida'`))[0].n; check('ES106-P03 el PUT rechazado no deja fila huérfana en la base', nothing === 0, `filas=${nothing}`);
// ── Rendimiento con 500 huérfanas
const base30 = []; for (let i = 0; i < 30; i++) base30.push((await get('es')).ms);
await db.query(`insert into "LandingContents" (key, lang, value, updated_by, "createdAt", "updatedAt") select 'landing.huerfana.' || g, 'es', 'x' || g, 'qa', now(), now() from generate_series(1,500) g on conflict do nothing`);
const withOrph = []; for (let i = 0; i < 30; i++) withOrph.push((await get('es')).ms); const p95 = a => [...a].sort((x, y) => x - y)[Math.ceil(a.length * 0.95) - 1];
const g500 = await get('es'); check('ES106-R01 [PERF] con 500 filas huérfanas: GET 200, ninguna publicada y p95 < 100 ms (umbral propuesto)', g500.status === 200 && !Object.keys(g500.json).some(k => k.startsWith('landing.huerfana.')) && p95(withOrph) < 100, `p95 sin huérfanas=${p95(base30).toFixed(1)} ms; con 500=${p95(withOrph).toFixed(1)} ms; filas=${(await q(`select count(*)::int n from "LandingContents"`))[0].n}`);
await q(`delete from "LandingContents" where key like 'landing.huerfana.%' or key = any($1)`, [ORPH]);
const fin = await get('es'); check('ES106-R02 tras limpiar, el GET vuelve al estado inicial', JSON.stringify(Object.keys(fin.json).sort()) === JSON.stringify(baseKeys.es), '');
console.log(JSON.stringify({ fin: true })); await db.end();
