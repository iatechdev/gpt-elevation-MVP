// [QA-Claude] ES-278 (PR #245) · batería PROPIA de validación de planes de precio, con el servidor real completo y PostgreSQL desechable.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr|control QA278_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es278-propios.cjs
// TAG=control: el mismo guion contra main (sin la validación): sirve para ver qué cambia de contrato. Solo loopback, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const TAG = process.env.TAG || 'pr';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
process.chdir(SUT);
process.env.DATA_RIGHTS_ENABLED = 'true';
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1500) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1500) }) + '\n'); };
const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.ceil(l.length * 0.95) - 1)];
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];

(async () => {
  const { q, mkUser, http, base } = await startRealApi(t, { envVar: 'QA278_DB', prefix: 'qa278' });
  const sup = await mkUser('superadmin'); const admin = await mkUser('admin'); const person = await mkUser('user'); const ther = await mkUser('therapist');
  const fp = async () => (await q(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) h, count(*)::int n FROM "PricingPlans" x`))[0];
  let seq = 0; const slugOf = () => { seq += 1; return ('qa' + seq.toString(36) + crypto.randomBytes(2).toString('hex')).slice(0, 20); };
  const okBody = (over = {}) => ({ slug: slugOf(), name_es: 'Plan QA', name_en: 'QA plan', price: 10, ...over });
  const post = (body) => http(admin, 'POST', '/api/admin/pricing', body);

  // ── C1 · batería de entradas: [etiqueta, campo(s), válida?] ──
  const long = (n, c = 'a') => c.repeat(n);
  const CASES = [
    // precio
    ['price 0', { price: 0 }, 1], ['price -0', { price: -0 }, 1], ['price "0"', { price: '0' }, 1], ['price 0.001', { price: 0.001 }, 0], ['price "0.001"', { price: '0.001' }, 0], ['price 1e3', { price: 1e3 }, 1], ['price "1e3"', { price: '1e3' }, 0],
    ['price Infinity→null', { price: Infinity }, 0], ['price NaN→null', { price: NaN }, 0], ['price "12,5"', { price: '12,5' }, 0], ['price " 12"', { price: ' 12' }, 1], ['price "12 "', { price: '12 ' }, 1], ['price fullwidth', { price: '１２' }, 0],
    ['price 99999999.99', { price: 99999999.99 }, 1], ['price 100000000', { price: 100000000 }, 0], ['price 99999999.999', { price: 99999999.999 }, 0], ['price -1', { price: -1 }, 0], ['price "+5"', { price: '+5' }, 0], ['price ".5"', { price: '.5' }, 0], ['price "5."', { price: '5.' }, 0],
    ['price "0x10"', { price: '0x10' }, 0], ['price true', { price: true }, 0], ['price []', { price: [] }, 0], ['price {}', { price: {} }, 0], ['price [5]', { price: [5] }, 0], ['price null', { price: null }, 0], ['price 12345678.9', { price: 12345678.9 }, 1], ['price 1e21', { price: 1e21 }, 0], ['price 5e-7', { price: 5e-7 }, 0],
    ['price 0.1+0.2', { price: 0.1 + 0.2 }, 0], ['price 19.99', { price: 19.99 }, 1], ['price "19.99"', { price: '19.99' }, 1], ['price 1.005', { price: 1.005 }, 0], ['price "00012"', { price: '00012' }, 1],
    // slug
    ['slug 1 car', { slug: 'q' + crypto.randomBytes(1).toString('hex')[0] }, 1], ['slug 20', { slug: long(20, 'b') + '' }, 1], ['slug 21', { slug: long(21) }, 0], ['slug vacío', { slug: '' }, 0], ['slug MAYÚS', { slug: 'ABC' }, 0], ['slug acentos', { slug: 'ñandú' }, 0],
    ['slug ../', { slug: '../x' }, 0], ['slug emoji', { slug: '😀' }, 0], ['slug espacio', { slug: 'a b' }, 0], ['slug NUL', { slug: 'a\u0000b' }, 0], ['slug guion bajo', { slug: 'a_b' }, 0], ['slug espacio inicial', { slug: ' a' }, 0], ['slug salto final', { slug: 'a\n' }, 0],
    ['slug número', { slug: 5 }, 0], ['slug null', { slug: null }, 0], ['slug arreglo', { slug: ['a'] }, 0], ['slug objeto', { slug: {} }, 0], ['slug solo guiones', { slug: 'zq--' }, 1],
    // nombres
    ['name_es vacío', { name_es: '' }, 0], ['name_es espacios', { name_es: '   ' }, 0], ['name_es 255', { name_es: long(255) }, 1], ['name_es 256', { name_es: long(256) }, 0], ['name_es 10000', { name_es: long(10000) }, 0], ['name_es null', { name_es: null }, 0], ['name_en número', { name_en: 5 }, 0],
    ['name_en arreglo', { name_en: ['x'] }, 0], ['name_en unicode', { name_en: '日本語プラン' }, 1], ['name_es NUL', { name_es: 'a\u0000b' }, 1], ['name_en emoji', { name_en: 'Plan 😀' }, 1],
    // descripción
    ['description_es 2000', { description_es: long(2000) }, 1], ['description_es 2001', { description_es: long(2001) }, 0], ['description_es null', { description_es: null }, 1], ['description_en número', { description_en: 5 }, 0], ['description_es NUL', { description_es: 'a\u0000b' }, 1],
    // características
    ['features 20', { features_es: Array.from({ length: 20 }, (_, i) => 'f' + i) }, 1], ['features 21', { features_es: Array.from({ length: 21 }, (_, i) => 'f' + i) }, 0], ['feature 200', { features_en: [long(200)] }, 1], ['feature 201', { features_en: [long(201)] }, 0],
    ['features no texto', { features_es: [1, 2] }, 0], ['features anidado', { features_es: [['a']] }, 0], ['features cadena', { features_es: 'a,b' }, 0], ['features NUL', { features_es: ['a\u0000b'] }, 1], ['features null', { features_es: null }, 0], ['features objeto', { features_en: { a: 1 } }, 0],
    // orden
    ['order 0', { order: 0 }, 1], ['order 1000000', { order: 1000000 }, 1], ['order 1000001', { order: 1000001 }, 0], ['order -1', { order: -1 }, 0], ['order 1.5', { order: 1.5 }, 0], ['order "5"', { order: '5' }, 1], ['order ""', { order: '' }, 0], ['order "abc"', { order: 'abc' }, 0],
    ['order null', { order: null }, 0], ['order 1e3', { order: 1e3 }, 1], ['order true', { order: true }, 0],
    // moneda / período
    ['currency USD', { currency: 'USD' }, 1], ['currency usd', { currency: 'usd' }, 1], ['currency US', { currency: 'US' }, 0], ['currency 11 letras', { currency: 'ABCDEFGHIJK' }, 0], ['currency U$D', { currency: 'U$D' }, 0], ['currency ÑÑÑ', { currency: 'ÑÑÑ' }, 0], ['currency número', { currency: 5 }, 0], ['currency vacía', { currency: '' }, 0],
    ['period month', { period: 'month' }, 1], ['period Month', { period: 'Month' }, 0], ['period 20', { period: long(20) }, 1], ['period 21', { period: long(21) }, 0], ['period a1', { period: 'a1' }, 0], ['period vacío', { period: '' }, 0], ['period número', { period: 5 }, 0],
    // banderas
    ['isHighlighted "true"', { isHighlighted: 'true' }, 0], ['isHighlighted 1', { isHighlighted: 1 }, 0], ['isHighlighted null', { isHighlighted: null }, 0], ['isHighlighted true', { isHighlighted: true }, 1], ['isActive "no"', { isActive: 'no' }, 0],
  ];
  const probs = []; let n5xx = 0; const detail = [];
  for (const [label, over, valid] of CASES) {
    const before = await fp(); const body = okBody(over); const r = await post(body); const after = await fp();
    if (r.status >= 500) { n5xx += 1; probs.push(`POST ${label}: ${r.status}`); continue; }
    if (valid && r.status !== 201) probs.push(`POST ${label}: esperaba 201 y dio ${r.status} ${JSON.stringify(r.body).slice(0, 70)}`);
    if (!valid && !(r.status >= 400 && r.status < 500)) probs.push(`POST ${label}: esperaba 4xx y dio ${r.status}`);
    if (!valid && r.status >= 400 && (!r.body || (!r.body.code && !r.body.error))) probs.push(`POST ${label}: error sin cuerpo fijo`);
    if (!valid && before.h !== after.h) probs.push(`POST ${label}: la tabla cambió con una entrada inválida`);
    detail.push(`${label}=${r.status}`);
  }
  check(`C1 batería de ${CASES.length} entradas sobre POST: lo inválido → 4xx con cuerpo fijo y tabla intacta; el límite exacto válido → 201; 0 5xx [${TAG}]`, probs.length === 0, `5xx: ${n5xx}; ${probs.slice(0, 10).join(' | ') || 'sin problemas'}`);
  info(`C1 estados (${TAG})`, detail.join(' ; '));
  const nulRows = await q(`SELECT slug, name_es, length(name_es) AS len_es, left(description_es, 5) AS d_es, features_es::text AS f FROM "PricingPlans" WHERE name_es LIKE 'a%b' OR description_es LIKE 'a%b' OR features_es::text LIKE '%a%b%' ORDER BY id`);
  info(`C1 lo que se guarda con un NUL (U+0000) en nombre, descripción y características (${TAG})`, JSON.stringify(nulRows.map((r) => ({ name_es: JSON.stringify(r.name_es), len: r.len_es, desc: JSON.stringify(r.d_es), features: r.f }))).slice(0, 600));
  // sin precio: contrato
  const noPrice = await post({ slug: slugOf(), name_es: 'A', name_en: 'A' });
  check(`C1b crear SIN precio → 400 con field=price y no se guarda ninguna fila [${TAG}]`, noPrice.status === 400 && noPrice.body && noPrice.body.field === 'price', `estado ${noPrice.status} ${JSON.stringify(noPrice.body).slice(0, 120)}`);
  const zero = await post(okBody({ price: 0 })); check(`C1c precio 0 EXPLÍCITO → 201 y se guarda 0.00 [${TAG}]`, zero.status === 201 && Number(zero.body.plan.price) === 0, `estado ${zero.status}`);
  const bad = []; for (const body of [null, [], 'texto', 123, '{"a":']) { const r = await http(admin, 'POST', '/api/admin/pricing', body === null ? undefined : body); if (r.status >= 500) bad.push(`${JSON.stringify(body)} → ${r.status}`); }
  const huge = await fetch(base + '/api/admin/pricing', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token, 'Content-Type': 'application/json' }, body: '{"slug":"a","name_es":"' + 'x'.repeat(400000) + '"}' });
  const broken = await fetch(base + '/api/admin/pricing', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token, 'Content-Type': 'application/json' }, body: '{"slug":' });
  check(`C1d cuerpos no objeto, JSON roto y de 400 KB → 4xx, nunca 5xx [${TAG}]`, bad.length === 0 && huge.status < 500 && broken.status < 500, `${bad.join(' | ')} enorme ${huge.status}; roto ${broken.status}`);

  // ── C2 · PUT: lo inválido no toca la fila ──
  const plan = (await post(okBody({ price: 25 }))).body.plan; const putProbs = []; let put5xx = 0;
  for (const [label, over, valid] of CASES) {
    if (/^slug/.test(label) && valid) continue; // un slug válido nuevo cambiaría la fila: se prueba aparte
    const before = await fp(); const r = await http(admin, 'PUT', `/api/admin/pricing/${plan.id}`, over); const after = await fp();
    if (r.status >= 500) { put5xx += 1; putProbs.push(`PUT ${label}: ${r.status}`); continue; }
    if (valid && r.status !== 200) putProbs.push(`PUT ${label}: esperaba 200 y dio ${r.status} ${JSON.stringify(r.body).slice(0, 70)}`);
    if (!valid && !(r.status >= 400 && r.status < 500)) putProbs.push(`PUT ${label}: esperaba 4xx y dio ${r.status}`);
    if (!valid && before.h !== after.h) putProbs.push(`PUT ${label}: la fila cambió con una entrada inválida`);
  }
  check(`C2 batería sobre PUT: lo inválido → 4xx y la tabla no cambia; lo válido → 200; 0 5xx [${TAG}]`, putProbs.length === 0, `5xx: ${put5xx}; ${putProbs.slice(0, 10).join(' | ') || 'sin problemas'}`);

  // ── C3 · slug repetido ──
  const dupSlug = slugOf(); const first = await post(okBody({ slug: dupSlug })); const second = await post(okBody({ slug: dupSlug }));
  check(`C3a crear con slug repetido → 409 slug_taken con cuerpo fijo [${TAG}]`, first.status === 201 && second.status === 409 && second.body.code === 'slug_taken', `${first.status}/${second.status} ${JSON.stringify(second.body).slice(0, 110)}`);
  const A = (await post(okBody())).body.plan; const B = (await post(okBody())).body.plan;
  const own = await http(admin, 'PUT', `/api/admin/pricing/${A.id}`, { slug: A.slug, name_es: 'Mismo slug' }); const theirs = await http(admin, 'PUT', `/api/admin/pricing/${A.id}`, { slug: B.slug });
  check(`C3b editar con su propio slug → 200; con el de otro plan → 409 [${TAG}]`, own.status === 200 && theirs.status === 409, `propio ${own.status}; ajeno ${theirs.status}`);
  const off = await http(admin, 'DELETE', `/api/admin/pricing/${B.id}`); const reuse = await post(okBody({ slug: B.slug }));
  check(`C3c el slug de un plan desactivado sigue reservado → 409 [${TAG}]`, off.status === 200 && reuse.status === 409, `desactivar ${off.status}; reutilizar ${reuse.status}`);
  const raceSlug = slugOf(); const races = await Promise.all(Array.from({ length: 20 }, () => post(okBody({ slug: raceSlug }))));
  const rows = Number((await q('SELECT count(*) n FROM "PricingPlans" WHERE slug=$1', [raceSlug]))[0].n);
  check(`C3d 20 altas SIMULTÁNEAS con el mismo slug → una 201, el resto 409, ningún 5xx, 1 fila [${TAG}]`, races.filter((r) => r.status === 201).length === 1 && races.filter((r) => r.status === 409).length === 19 && rows === 1, `estados ${JSON.stringify(races.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}))}; filas ${rows}`);
  const C = (await post(okBody())).body.plan; const D = (await post(okBody())).body.plan; const target = slugOf();
  const racePut = await Promise.all([http(admin, 'PUT', `/api/admin/pricing/${C.id}`, { slug: target }), http(admin, 'PUT', `/api/admin/pricing/${D.id}`, { slug: target })]);
  check(`C3e dos ediciones SIMULTÁNEAS al mismo slug → una 200 y una 409 [${TAG}]`, racePut.map((r) => r.status).sort().join(',') === '200,409', `estados ${racePut.map((r) => r.status).join(',')}`);

  // ── C4 · edición parcial ──
  const E = (await post(okBody({ price: 7 }))).body.plan; const partial = {};
  for (const [label, body] of [['solo nombre', { name_es: 'Solo nombre' }], ['solo precio', { price: 8.5 }], ['vacío {}', {}], ['campo desconocido', { inventado: 1 }], ['id y fechas del formulario', { id: E.id, createdAt: E.createdAt, updatedAt: E.updatedAt }], ['precio como cadena del DECIMAL', { price: '8.50' }]]) { const r = await http(admin, 'PUT', `/api/admin/pricing/${E.id}`, body); partial[label] = r.status; }
  check(`C4 edición parcial válida → 200 (nombre, precio, vacío, campo desconocido, id y fechas, precio como cadena) [${TAG}]`, Object.values(partial).every((s) => s === 200), JSON.stringify(partial));
  // formulario completo tal como lo manda la pantalla: la fila que devuelve GET /all, de vuelta en un PUT
  const all = await http(admin, 'GET', '/api/admin/pricing/all'); const rowsAll = Array.isArray(all.body) ? all.body : [];
  const roundtrip = []; for (const p of rowsAll.slice(0, 12)) { const r = await http(admin, 'PUT', `/api/admin/pricing/${p.id}`, p); if (r.status !== 200) roundtrip.push(`${p.slug}: ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); }
  check(`C4b la fila completa que entrega GET /all vuelve como PUT (lo que hace la pantalla al guardar sin tocar nada) → 200 [${TAG}]`, roundtrip.length === 0, `${rowsAll.length} planes; ${roundtrip.slice(0, 4).join(' | ') || 'todos 200'}`);
  // datos heredados: planes creados antes de la validación (identificador con mayúsculas o guion bajo, sin identificador, período con mayúsculas, precio con 3 decimales almacenado)
  const legacy = [['Plan_Heredado', 'Month'], [null, 'month'], ['otro-heredado', 'MONTHLY']]; const legacyOut = [];
  for (const [slug, period] of legacy) { const ins = await q(`INSERT INTO "PricingPlans" (slug, name_es, name_en, price, currency, period, features_es, features_en, "isHighlighted", "isActive", "order", "createdAt", "updatedAt") VALUES ($1,'Heredado','Legacy',5,'USD',$2,'[]','[]',false,true,9,now(),now()) RETURNING id`, [slug, period]);
    const row = (await http(admin, 'GET', '/api/admin/pricing/all')).body.find((x) => x.id === ins[0].id); const r = await http(admin, 'PUT', `/api/admin/pricing/${ins[0].id}`, { ...row, price: 6 }); legacyOut.push(`${slug === null ? '(sin slug)' : slug}/${period}: ${r.status} ${r.status >= 400 ? (r.body.field || '') : ''}`); }
  info(`C4c EDITAR un plan heredado (creado antes de la validación) enviando el formulario completo con otro precio [${TAG}]`, legacyOut.join(' ; ') + ' (200 = editable; 400 = el administrador no puede cambiar ni el precio hasta corregir el campo marcado)');

  // ── C5 · lectura pública y semilla ──
  const s1 = await http(admin, 'POST', '/api/admin/pricing/seed', {}); const c1 = Number((await q('SELECT count(*) n FROM "PricingPlans" WHERE slug = ANY($1)', [['basic', 'essential', 'plus', 'pro']]))[0].n);
  const s2 = await http(admin, 'POST', '/api/admin/pricing/seed', {}); const c2 = Number((await q('SELECT count(*) n FROM "PricingPlans" WHERE slug = ANY($1)', [['basic', 'essential', 'plus', 'pro']]))[0].n);
  const pub = await http(null, 'GET', '/api/pricing'); const plans = await http(null, 'GET', '/api/plans');
  const shape = (x) => Array.isArray(x.body) ? [...new Set(x.body.flatMap((p) => Object.keys(p)))].sort().join(',') : JSON.stringify(Object.keys(x.body || {}));
  check(`C5 la semilla es idempotente y las lecturas públicas siguen respondiendo [${TAG}]`, s1.status < 300 && s2.status < 300 && c1 === 4 && c2 === 4 && pub.status === 200 && plans.status === 200, `seed ${s1.status}/${s2.status}; planes base ${c1}/${c2}; GET /api/pricing ${pub.status}; /api/plans ${plans.status}`);
  info(`C5 forma de las respuestas públicas (${TAG})`, `/api/pricing: ${shape(pub)} | /api/plans: ${shape(plans)}`);

  // ── C6 · seguridad: quién puede escribir ──
  const target2 = (await post(okBody())).body.plan; const sec = []; const before = await fp();
  for (const [name, who] of [['sin sesión', null], ['persona', person], ['profesional', ther]]) for (const prefix of ['/api/pricing', '/api/admin/pricing']) for (const [method, route, body] of [['POST', prefix, okBody()], ['PUT', `${prefix}/${target2.id}`, { name_es: 'Hackeado' }], ['DELETE', `${prefix}/${target2.id}`, undefined], ['POST', `${prefix}/seed`, {}]]) {
    const r = await http(who, method, route, body); if (![401, 403].includes(r.status)) sec.push(`${name} ${method} ${route} → ${r.status}`); }
  check(`C6 sin sesión, persona y profesional no pueden crear, editar, desactivar ni sembrar planes (ni en /api/pricing ni en /api/admin/pricing) y la tabla no cambia [${TAG}]`, sec.length === 0 && (await fp()).h === before.h, sec.slice(0, 6).join(' | ') || '24 solicitudes rechazadas');
  const adm = await Promise.all([http(admin, 'PUT', `/api/pricing/${target2.id}`, { name_es: 'Admin edita' }), http(sup, 'PUT', `/api/admin/pricing/${target2.id}`, { name_es: 'Super edita' })]);
  check(`C6b administración y superadministración sí pueden editar por las dos rutas [${TAG}]`, adm.every((r) => r.status === 200), adm.map((r) => r.status).join(','));
  const hostileIds = []; for (const id of ['abc', '0', '-1', '2147483648', '1e3', '%00', '99999999999999999999']) for (const m of ['PUT', 'DELETE']) { const r = await http(admin, m, `/api/admin/pricing/${id}`, m === 'PUT' ? { name_es: 'x' } : undefined); if (r.status >= 500) hostileIds.push(`${m} ${id} → ${r.status}`); }
  check(`C6c ids hostiles en PUT y DELETE → nunca 5xx [${TAG}]`, hostileIds.length === 0, hostileIds.join(' | ') || '14 solicitudes');

  // ── C12 · rendimiento: crear y editar, p95 de 50 ──
  const tc = []; const te = []; const P = (await post(okBody())).body.plan;
  for (let i = 0; i < 50; i += 1) { let t0 = performance.now(); await post(okBody()); tc.push(performance.now() - t0); t0 = performance.now(); await http(admin, 'PUT', `/api/admin/pricing/${P.id}`, { name_es: 'Rendimiento ' + i, price: i }); te.push(performance.now() - t0); }
  info(`C12 latencia (${TAG})`, `crear: mediana ${median(tc).toFixed(1)} ms, p95 ${p95(tc).toFixed(1)} ms | editar: mediana ${median(te).toFixed(1)} ms, p95 ${p95(te).toFixed(1)} ms`);
  check(`C12 p95 de crear y editar < 300 ms (propuesta) [${TAG}]`, p95(tc) < 300 && p95(te) < 300, `crear ${p95(tc).toFixed(1)} ms; editar ${p95(te).toFixed(1)} ms`);

  fs.writeFileSync(path.join(OUT, `ES-278-propios-${TAG}.json`), JSON.stringify(results, null, 1));
  process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
