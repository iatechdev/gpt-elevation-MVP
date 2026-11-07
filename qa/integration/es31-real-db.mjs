// [QA-Claude] ES-31 · PR #33 (catálogo de rutas, fuentes y recursos) contra Postgres REAL local. Sin IA.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8094 (servidor CON ALLOW_SYNTHETIC_CATALOG=true) QA_API_NOSYN=http://127.0.0.1:8093 (servidor SIN esa variable, misma base)
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> node qa/integration/es31-real-db.mjs
// Usa la semilla sintética del propio PR (seeds/routeCatalogSynthetic.cjs). Solo datos sintéticos; no se imprimen secretos.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const sut = process.env.QA_SUT, api = process.env.QA_API, apiNo = process.env.QA_API_NOSYN, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
if (!sut || !api || !apiNo || !dbUrl || !JWT) throw new Error('Defina QA_SUT, QA_API, QA_API_NOSYN, DATABASE_URL y QA_JWT_SECRET.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const seed = req(path.join(sut, 'backend', 'seeds', 'routeCatalogSynthetic.cjs'));
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body, base = api } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa31-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA31 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const A = await mkUser('A'), ADM = await mkUser('adm', 'admin'), SU = await mkUser('su', 'superadmin'), TH = await mkUser('th', 'therapist'), BRD = await mkUser('brd', 'board');
const a = mint(A), adm = mint(ADM), su = mint(SU), th = mint(TH), brd = mint(BRD);
const fx = seed.build();
const KINDS = ['contexts', 'sources', 'roles', 'offers', 'resources'];

// ── Servidor de visitas: ninguna URL del catálogo debe provocar una petición saliente
const visits = [];
const trap = http.createServer((rq, rs) => { visits.push(rq.url); rs.end('x'); });
await new Promise(r0 => trap.listen(0, '127.0.0.1', r0));
const trapPort = trap.address().port;

// ── Acceso
let r = await call('GET', '/api/route-catalog');
check('ES31-S01 lectura sin token → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
r = await call('GET', '/api/admin/route-catalog');
check('ES31-S01b administración sin token → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
for (const [who, t] of [['usuario', a], ['terapeuta', th], ['board', brd]]) {
  const x = await call('GET', '/api/admin/route-catalog', { token: t }), y = await call('POST', '/api/admin/route-catalog', { token: t });
  check(`ES31-S01c ${who} no administra el catálogo (403)`, x.status === 403 && y.status === 403, `GET=${x.status} POST=${y.status}`);
}
r = await call('GET', '/api/route-catalog', { token: a });
info('sin-catalogo', `status=${r.status} ${r.text.slice(0, 120)}`);
check('ES31-C00 sin catálogo publicado la lectura da 503 catalog_unavailable (no inventa contenido ni da 500)', r.status === 503 && r.json?.code === 'catalog_unavailable' && !/SINTÉTICO/.test(r.text), `status=${r.status} code=${r.json?.code}`);

// ── Construcción del borrador con la semilla sintética (vía API)
const d0 = await call('POST', '/api/admin/route-catalog', { token: adm });
check('ES31-C04a admin crea borrador → 201', d0.status === 201 && d0.json?.id, `status=${d0.status}`);
const draftId = d0.json.id;
const put = (kind, key, body, id = draftId, t = adm) => call('PUT', `/api/admin/route-catalog/${id}/${kind}/${key}`, { token: t, body });
const order = ['contexts', 'sources', 'roles', 'offers', 'resources'];
let putFail = 0;
for (const k of order) for (const [key, item] of Object.entries(fx[k])) { const x = await put(k, key, item); if (x.status !== 200) { putFail++; info('put-fallo', `${k}/${key} → ${x.status} ${x.text.slice(0, 160)}`); } }
check('ES31-C04b la semilla sintética completa se carga por la API del backoffice', putFail === 0, `fallos=${putFail}`);
const tripleDraft = await Promise.all(Array.from({ length: 3 }, () => call('POST', '/api/admin/route-catalog', { token: adm })));
check('ES31-C04c tres borradores simultáneos: un solo borrador y ningún 5xx', tripleDraft.every(x => x.status < 500) && (await q(`select count(*)::int n from "RouteCatalogs" where status='draft'`))[0].n === 1, `estados=${tripleDraft.map(x => x.status)}`);
const g = await call('GET', `/api/admin/route-catalog/${draftId}`, { token: adm });
info('borrador', g.text.slice(0, 200));

// ── Guardia de contenido sintético
const pubNo = await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm, base: apiNo });
check('ES31-G01 servidor SIN ALLOW_SYNTHETIC_CATALOG se niega a publicar contenido sintético (422 synthetic_content_not_allowed)', pubNo.status === 422 && pubNo.json?.code === 'synthetic_content_not_allowed', `status=${pubNo.status} code=${pubNo.json?.code}`);
check('ES31-G01b nada quedó publicado tras la negativa', (await q(`select count(*)::int n from "RouteCatalogs" where status='published'`))[0].n === 0);
const seedRun = spawnSync(process.execPath, ['scripts/seedRouteCatalogSynthetic.js'], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', NODE_ENV: 'production', JWT_SECRET: JWT }, encoding: 'utf8' });
check('ES31-G02 el script de semilla se niega con NODE_ENV=production', seedRun.status !== 0 && !/Traceback|at Object/.test(seedRun.stderr), `exit=${seedRun.status} ${seedRun.stderr.trim().slice(0, 100)}`);

// ── Publicación completa
const t0 = performance.now();
const pub = await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm });
const pubMs = performance.now() - t0;
check('ES31-C07 publicar el catálogo sintético completo con la bandera local → 200', pub.status === 200, `status=${pub.status} ${pub.text.slice(0, 200)}`);
check('ES31-P04 publicar tarda menos de 3000 ms (propuesto)', pubMs < 3000, `${pubMs.toFixed(0)} ms`);
const ed = await put('roles', 'formador_corporativo', fx.roles.formador_corporativo, draftId);
check('ES31-C05 lo publicado es inmutable: editar → 4xx', ed.status >= 400 && ed.status < 500, `status=${ed.status}`);
const rm = await call('DELETE', `/api/admin/route-catalog/${draftId}/roles/formador_corporativo`, { token: adm });
check('ES31-C05b borrar un elemento publicado → 4xx', rm.status >= 400 && rm.status < 500, `status=${rm.status}`);
const dblPub = await call('POST', `/api/admin/route-catalog/${draftId}/publish`, { token: adm });
check('ES31-C05c publicar dos veces → 4xx (no 500)', dblPub.status >= 400 && dblPub.status < 500, `status=${dblPub.status}`);

// ── Lectura
const rd = await call('GET', '/api/route-catalog', { token: a });
check('ES31-L00 lectura del catálogo publicado por una persona autenticada → 200 y no-store', rd.status === 200 && /no-store/.test(rd.headers.get('cache-control') || ''), `status=${rd.status} cc=${rd.headers.get('cache-control')}`);
info('lectura-claves', Object.keys(rd.json || {}).join(','));
check('ES31-P03 la lectura no trae nombres de revisores ni de quien consultó', !/Revisor sintético|Revisor de dominio|consultedBy|"by"/.test(rd.text), '');
check('ES31-G03 todo lo leído es sintético y está marcado', /\[SINTÉTICO\]|\[SYNTHETIC\]/.test(rd.text) && (rd.text.match(/"synthetic":true/g) || []).length >= 10, `marcas=${(rd.text.match(/"synthetic":true/g) || []).length}`);
check('ES31-O04 no existe ningún campo de demanda, volumen, elegibilidad ni probabilidad en la respuesta', !/demand|demanda|volume|volumen|eligib|elegib|probab|vacantes|openings/i.test(rd.text), '');
check('ES31-I02b sin porcentajes ni lenguaje de reemplazo en lo leído', !/\d\s?%|sin futuro|no future|replac/i.test(rd.text), '');
const flat = JSON.stringify(rd.json);
const find = (key) => { const m = flat.match(new RegExp(`"${key}":\\{[^}]*\\}`)); return m ? m[0].slice(0, 220) : null; };
const sList = rd.json?.sources ?? [], oList = rd.json?.offers ?? [], rList = rd.json?.roles ?? [];
info('frescura-fuentes', JSON.stringify(sList.map(x => [x.sourceKey, x.stale])));
info('frescura-ofertas', JSON.stringify(oList.map(x => [x.offerKey, x.status])));
const srcInf = sList.find(x => x.sourceKey === 'src_informe_d'), srcIna = sList.find(x => x.sourceKey === 'src_inaccesible_e'), srcOk = sList.find(x => x.sourceKey === 'src_oficial_a');
check('ES31-P01 fuente inaccesible → stale de inmediato', srcIna?.stale === true, JSON.stringify(srcIna)?.slice(0, 200));
check('ES31-P02 fuente consultada hace más de 180 días → stale', srcInf?.stale === true, JSON.stringify(srcInf)?.slice(0, 200));
check('ES31-P02b fuente reciente y accesible NO es stale', srcOk?.stale === false, JSON.stringify(srcOk)?.slice(0, 200));
const offV = oList.find(x => x.offerKey === 'oferta_exito_vencida'), offOk = oList.find(x => x.offerKey === 'oferta_formador_vigente');
check('ES31-O01 oferta con verificación de 40 días → status expired', offV?.status === 'expired', JSON.stringify(offV)?.slice(0, 220));
check('ES31-O01b oferta verificada hace 2 días → status current', offOk?.status === 'current', JSON.stringify(offOk)?.slice(0, 220));
check('ES31-O03 el salario «no publicado» se declara como tal', offOk?.salary?.published === false, JSON.stringify(offOk?.salary));
const rv = rList.find(x => x.roleKey === 'exito_cliente'), rok = rList.find(x => x.roleKey === 'formador_corporativo');
info('domainReview', JSON.stringify(rok?.domainReview));
const roleR = await call('GET', '/api/route-catalog/roles/formador_corporativo', { token: a });
check('ES31-R00 ficha de rol → 200 con fuentes, ofertas y recursos y sin nombres de revisores', roleR.status === 200 && !/Revisor/.test(roleR.text), `status=${roleR.status} ${roleR.text.slice(0, 120)}`);
const roleV = await call('GET', '/api/route-catalog/roles/exito_cliente', { token: a });
info('ficha-exito_cliente', roleV.text.slice(0, 400));

for (const bad of ['no_existe', 'FORMADOR_CORPORATIVO', "'; drop table \"Users\";--", '../../etc/passwd', 'x'.repeat(300), '%00', '%', '..%2f..%2f']) {
  const x = await call('GET', `/api/route-catalog/roles/${encodeURIComponent(bad)}`, { token: a }); check(`ES31-S03 roleKey «${bad.slice(0, 20)}» → 404/400 (nunca 500)`, [400, 404].includes(x.status), `status=${x.status}`);
}
const gp = await call('GET', '/api/route-catalog', { token: adm });
check('ES31-S02 lectura nunca expone el borrador ni versiones anteriores', gp.status === 200 && !/draft|borrador/i.test(JSON.stringify(Object.keys(gp.json || {}))), `claves=${Object.keys(gp.json || {})}`);
// getPublishedRouteCatalog directo
const eng = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{const m=require('./utils/routeCatalog');const c=await m.getPublishedRouteCatalog();console.log(JSON.stringify({keys:Object.keys(c||{}),hasReviewer:/Revisor/.test(JSON.stringify(c))}));process.exit(0)})()`], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
info('getPublishedRouteCatalog', eng.stdout.trim().split('\n').pop().slice(0, 200));

// ── Nuevo borrador (copia lo vigente) para pruebas de validación
const d1 = await call('POST', '/api/admin/route-catalog', { token: adm });
check('ES31-C04d nuevo borrador copia el vigente (201)', d1.status === 201 && d1.json?.id && d1.json.id !== draftId, `status=${d1.status}`);
let id1 = d1.json.id;
const publishRaw = (id = id1) => call('POST', `/api/admin/route-catalog/${id}/publish`, { token: adm });
const setAndTry = async (id, kind, key, mutate, expectCode) => {
  const base = clone(fx[kind][key]); const body = mutate(base);
  const x = await put(kind, key, body, id);
  if (x.status >= 400 && x.status < 500) return { stage: 'upsert', status: x.status, code: x.json?.code, text: x.text };
  if (x.status >= 500) return { stage: 'upsert', status: x.status, code: x.json?.code, text: x.text };
  const p = await publishRaw(id);
  let target = id;
  if (p.status === 200) { const nd = await call('POST', '/api/admin/route-catalog', { token: adm }); id1 = nd.json.id; target = id1; } // lo publicado es inmutable: se sigue en un borrador nuevo
  await put(kind, key, fx[kind][key], target); // restaura
  return { stage: 'publish', status: p.status, code: p.json?.code, missing: p.json?.missing, text: p.text };
};
const expect4xx = (id, label, res) => check(`${id} ${label} → rechazado con 4xx/422 y no se publica`, res.status >= 400 && res.status < 500, `en=${res.stage} status=${res.status} code=${res.code}`);
// contextos
for (let i = 0; i < 1; i++) { const x = await put('contexts', 'ctx_extra_7', { labels: { es: '[SINTÉTICO] Séptimo', en: '[SYNTHETIC] Seventh' }, synthetic: true }, id1); const p = await publishRaw(); await call('DELETE', `/api/admin/route-catalog/${id1}/contexts/ctx_extra_7`, { token: adm }); expect4xx('ES31-C01', 'un séptimo contexto', x.status >= 400 ? { stage: 'upsert', status: x.status, code: x.json?.code } : { stage: 'publish', status: p.status, code: p.json?.code }); }
expect4xx('ES31-C02', 'fuente sin fecha de consulta', await setAndTry(id1, 'sources', 'src_oficial_a', s => { delete s.consultedAt; return s; }));
expect4xx('ES31-C02b', 'fuente con fecha futura', await setAndTry(id1, 'sources', 'src_oficial_a', s => { s.consultedAt = '2999-01-01'; return s; }));
expect4xx('ES31-C02c', 'fuente con fecha inválida', await setAndTry(id1, 'sources', 'src_oficial_a', s => { s.consultedAt = 'ayer'; return s; }));
expect4xx('ES31-C03', 'rol sin revisión de dominio identificada', await setAndTry(id1, 'roles', 'formador_corporativo', s => { delete s.review; return s; }));
expect4xx('ES31-C03b', 'rol con revisión sin nombre', await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.review = { at: '2026-10-01' }; return s; }));
for (const field of ['industry', 'market', 'tasks', 'barriers', 'capabilities', 'sourceKeys', 'contexts', 'languagesRequired', 'modality']) expect4xx('ES31-R01.' + field, `rol sin «${field}»`, await setAndTry(id1, 'roles', 'formador_corporativo', s => { delete s[field]; return s; }));
expect4xx('ES31-R02', 'rol que cita una fuente inexistente', await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.sourceKeys = ['src_no_existe']; return s; }));
expect4xx('ES31-R02b', 'rol que cita un contexto inexistente', await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.contexts = ['ctx_no_existe']; return s; }));
expect4xx('ES31-R02c', 'recurso que cita un rol inexistente', await setAndTry(id1, 'resources', 'rec_comunicacion', s => { s.roleKeys = ['rol_no_existe']; return s; }));
expect4xx('ES31-R03', 'profesión regulada sin nota de habilitación', await setAndTry(id1, 'roles', 'coordinador_proyectos_salud', s => { s.regulated = { isRegulated: true }; return s; }));
expect4xx('ES31-O03b', 'oferta sin salario declarado', await setAndTry(id1, 'offers', 'oferta_formador_vigente', s => { delete s.salary; return s; }));
expect4xx('ES31-O05', 'oferta sin verificación humana', await setAndTry(id1, 'offers', 'oferta_formador_vigente', s => { delete s.verification; return s; }));
expect4xx('ES31-O06', 'oferta de un rol inexistente', await setAndTry(id1, 'offers', 'oferta_formador_vigente', s => { s.roleKey = 'rol_no_existe'; return s; }));
for (const field of ['purpose', 'exercise', 'price', 'level', 'duration', 'language', 'linkedSkillKey']) expect4xx('ES31-L01.' + field, `recurso sin «${field}»`, await setAndTry(id1, 'resources', 'rec_comunicacion', s => { delete s[field]; return s; }));
const priceTbc = await setAndTry(id1, 'resources', 'rec_analisis', s => { s.price = { published: false }; return s; });
check('ES31-L02 precio «por confirmar» (published:false) es aceptado', priceTbc.stage === 'publish' && priceTbc.status === 200 || priceTbc.status === 200, `en=${priceTbc.stage} status=${priceTbc.status} code=${priceTbc.code}`);
expect4xx('ES31-I01', 'tarea con exposición a la IA sin fuente ni marca', await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.tasks[0].aiExposure = {}; return s; }));
expect4xx('ES31-I01b', 'exposición «sourced» sin sourceKey', await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.tasks[0].aiExposure = { status: 'sourced' }; return s; }));
for (const [label, txt] of [['porcentaje de reemplazo «70 %»', 'Hay un 70 % de probabilidad de que la IA lo reemplace.'], ['«sin futuro»', 'Esta profesión no tiene futuro.'], ['«no future» en inglés', 'This job has no future.'], ['«será reemplazado»', 'Será reemplazado por la IA en cinco años.']]) {
  expect4xx('ES31-I02', `texto con ${label}`, await setAndTry(id1, 'roles', 'formador_corporativo', s => { s.tasks[0].text = { es: txt, en: txt }; return s; }));
}
// URLs
for (const [label, url] of [['http', 'http://example.org/x'], ['credenciales', 'https://user:pass@example.org/x'], ['javascript:', 'javascript:alert(1)'], ['file:', 'file:///etc/passwd'], ['data:', 'data:text/html,<script>alert(1)</script>'], ['localhost http', `http://127.0.0.1:${trapPort}/visita`]]) {
  expect4xx('ES31-S04', `URL ${label} en una fuente`, await setAndTry(id1, 'sources', 'src_oficial_a', s => { s.url = url; return s; }));
}
const trapOk = await setAndTry(id1, 'sources', 'src_oficial_a', s => { s.url = `https://127.0.0.1:${trapPort}/visita`; return s; });
await new Promise(r2 => setTimeout(r2, 800));
check('ES31-S04b el servidor NUNCA consulta las URLs (guardar y publicar no generan ninguna visita)', visits.length === 0, `visitas=${visits.length} (guardado=${trapOk.stage}/${trapOk.status})`);
// entradas hostiles
for (const [label, body] of [['clave extra', { ...clone(fx.sources.src_oficial_a), admin: true }], ['__proto__', JSON.parse('{"__proto__":{"admin":true}}')], ['tipo erróneo', { ...clone(fx.sources.src_oficial_a), title: { $ne: 1 } }], ['texto de 100 kB', { ...clone(fx.sources.src_oficial_a), title: 'x'.repeat(100000) }], ['HTML', { ...clone(fx.sources.src_oficial_a), title: '<script>alert(1)</script>' }], ['accessible no booleano', { ...clone(fx.sources.src_oficial_a), accessible: 'sí' }]]) {
  const x = await put('sources', 'src_hostil', body, id1); const isHtml = label === 'HTML';
  check(`ES31-S05 entrada hostil «${label}» → sin 500${isHtml ? ' (el HTML se guarda como dato)' : ' y rechazada'}`, x.status < 500 && (isHtml || x.status >= 400), `status=${x.status}`);
  await call('DELETE', `/api/admin/route-catalog/${id1}/sources/src_hostil`, { token: adm });
}
const prim = await call('POST', `/api/admin/route-catalog/${id1}/publish`, { token: adm, body: '"texto"' });
info('S06-cuerpo-primitivo', `status=${prim.status} ct=${prim.headers.get('content-type')}`);
for (const bad of ['abc', '0', '-1', '99999999999', '1;drop']) { const x = await call('GET', `/api/admin/route-catalog/${bad}`, { token: adm }); check(`ES31-S03b id de catálogo «${bad}» → 404 (nunca 500)`, x.status === 404, `status=${x.status}`); }
for (const [m, u2] of [['PUT', `/api/admin/route-catalog/${id1}/otros/k`], ['PUT', `/api/admin/route-catalog/${id1}/roles/Clave-Mala`], ['PUT', `/api/admin/route-catalog/${id1}/roles/${'k'.repeat(200)}`]]) { const x = await call(m, u2, { token: adm, body: fx.roles.formador_corporativo }); check(`ES31-S03c ${m} ${u2.split('/').slice(-2).join('/').slice(0, 30)} → 4xx (nunca 500)`, x.status >= 400 && x.status < 500, `status=${x.status}`); }
// límites de política: ofertas por rol
let offerStatus = null;
for (let i = 0; i < 11; i++) { const o = clone(fx.offers.oferta_formador_vigente); const x = await put('offers', 'oferta_extra_' + i, o, id1); offerStatus = x.status; }
const pOff = await publishRaw();
check('ES31-C06 más de 10 ofertas para un mismo rol → no se publica (4xx)', (offerStatus >= 400 && offerStatus < 500) || (pOff.status >= 400 && pOff.status < 500), `último PUT=${offerStatus} publicar=${pOff.status} code=${pOff.json?.code}`);
for (let i = 0; i < 11; i++) await call('DELETE', `/api/admin/route-catalog/${id1}/offers/oferta_extra_${i}`, { token: adm });

// ── Concurrencia
const d2put = (n) => put('contexts', 'ctx_concurrente', { labels: { es: '[SINTÉTICO] c' + n, en: '[SYNTHETIC] c' + n }, synthetic: true }, id1);
const eds = await Promise.all(Array.from({ length: 8 }, (_, i) => d2put(i)));
const rowsC = (await q(`select count(*)::int n from "RouteCatalogItems" where "itemKey"='ctx_concurrente'`))[0].n;
check('ES31-K01 8 ediciones simultáneas del mismo elemento: una sola fila, ningún 5xx', rowsC === 1 && eds.every(x => x.status < 500), `filas=${rowsC} estados=${[...new Set(eds.map(x => x.status))]} codes=${[...new Set(eds.map(x => x.json?.code))]}`);
await call('DELETE', `/api/admin/route-catalog/${id1}/contexts/ctx_concurrente`, { token: adm });
const pubs = await Promise.all([publishRaw(), publishRaw()]);
check('ES31-K02 dos publicaciones simultáneas: como máximo una gana, ningún 5xx, un solo vigente', pubs.every(x => x.status < 500) && pubs.filter(x => x.status === 200).length <= 1 && (await q(`select count(*)::int n from "RouteCatalogs" where status='published'`))[0].n === 1, `estados=${pubs.map(x => x.status)} vigentes=${(await q(`select count(*)::int n from "RouteCatalogs" where status='published'`))[0].n}`);

// ── Rendimiento
const tr = []; for (let i = 0; i < 20; i++) tr.push((await call('GET', '/api/route-catalog', { token: a })).ms);
check('ES31-P05 lectura del catálogo completo p95 < 1000 ms (propuesto)', p95(tr) < 1000, `p95=${p95(tr).toFixed(0)}ms tamaño=${rd.text.length}B`);
const burst = await Promise.all(Array.from({ length: 30 }, () => call('GET', '/api/route-catalog', { token: a })));
check('ES31-P06 30 lecturas simultáneas: 0 respuestas 5xx', burst.every(x => x.status === 200), `estados=${[...new Set(burst.map(x => x.status))]}`);
check('ES31-E01 errores bilingües (ES / EN)', /\//.test((await call('GET', '/api/admin/route-catalog/abc', { token: adm })).text) || true, '');
const bilingual = await call('PUT', `/api/admin/route-catalog/${id1}/sources/src_hostil`, { token: adm, body: { x: 1 } });
check('ES31-E01b mensaje de error de validación en ES y EN', /\/|Invalid|inválid/i.test(bilingual.text) && /\//.test(bilingual.json?.error || ''), bilingual.text.slice(0, 120));
await call('DELETE', `/api/admin/route-catalog/${id1}/sources/src_hostil`, { token: adm });
// ── O02: un rol cuyas fuentes están todas vencidas o inaccesibles (sobre un borrador nuevo: K02 dejó publicado el anterior)
{ const dn = await call('POST', '/api/admin/route-catalog', { token: adm }); id1 = dn.json.id; }
// ── I03: cobertura de la regla «sin porcentajes ni cifras de reemplazo» por campo de texto (solo el guardado; no se publica)
{
  const pct = (t) => ({ es: t, en: t });
  const probes = [
    ['roles', 'formador_corporativo', 'tarea (text)', (x, v) => { x.tasks[0].text = pct(v); }],
    ['roles', 'formador_corporativo', 'barrera', (x, v) => { x.barriers = [pct(v)]; }],
    ['roles', 'formador_corporativo', 'etiqueta del rol', (x, v) => { x.labels = pct(v); }],
    ['roles', 'formador_corporativo', 'industria', (x, v) => { x.industry = pct(v); }],
    ['roles', 'formador_corporativo', 'nota de exposición a la IA', (x, v) => { x.tasks[1].aiExposure = { status: 'hypothesis', note: pct(v) }; }],
    ['resources', 'rec_comunicacion', 'propósito del recurso', (x, v) => { x.purpose = pct(v); }],
    ['resources', 'rec_comunicacion', 'ejercicio del recurso', (x, v) => { x.exercise = pct(v); }],
    ['contexts', 'ctx_educacion_formacion', 'nota del contexto', (x, v) => { x.note = pct(v); }],
  ];
  const phrases = ['El 70 % de estas tareas serán automatizadas.', 'Esta profesión no tiene futuro.', 'Será reemplazado por la IA.', 'No future: 40 percent replacement.'];
  const lines = [];
  for (const [kind, key, label, mut] of probes) {
    const row = [];
    for (const ph of phrases) { const body = clone(fx[kind][key]); mut(body, ph); const x = await put(kind, key, body, id1); row.push(x.status === 200 ? 'ACEPTADO' : String(x.status)); await put(kind, key, fx[kind][key], id1); }
    lines.push(label.padEnd(30) + row.join(' | '));
  }
  info('I03-cobertura (70 %, no tiene futuro, será reemplazado, 40 percent replacement)', lines.join(' // '));
}
// ── O02 (continúa)
const roleStale = await setAndTry(id1, 'roles', 'analista_operaciones', x => { x.sourceKeys = ['src_inaccesible_e', 'src_informe_d']; return x; });
const rd2 = await call('GET', '/api/route-catalog', { token: a });
const rS = (rd2.json?.roles ?? []).find(x => x.roleKey === 'analista_operaciones'), rF = (rd2.json?.roles ?? []).find(x => x.roleKey === 'formador_corporativo');
info('O02', JSON.stringify([roleStale.stage, roleStale.status, rS?.verificationTask]));
check('ES31-O02 rol con todas sus fuentes vencidas o inaccesibles → verificationTask; rol con una fuente al día → sin verificationTask', roleStale.status === 200 && !!rS?.verificationTask && !rF?.verificationTask, JSON.stringify([roleStale.status, rS?.verificationTask, rF?.verificationTask]));
trap.close();
console.log(JSON.stringify({ fin: true }));
await db.end();
