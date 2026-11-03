// [QA-Claude] ES-130 · frente 3 · PR #129 (head 0482528f): microcaché de 10 s de GET /api/plans (invalidado por hooks de PricingPlan; respuesta sigue no-store).
// Servidor real del merge local + Postgres real: A con caché (por defecto), B con PLANS_CACHE_TTL_MS=0 sobre la MISMA base. Datos sintéticos, 0 IA.
// Uso: node qa/integration/es130-plans.mjs   (arranca y detiene sus servidores)
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q130plans', dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 320) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
const start = (port, extra = {}) => { const c = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(port), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', ...extra } }); kids.push(c); return c; };
const wait = async port => { for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return true; } catch { /* */ } await sleep(500); } return false; };
const A = 'http://127.0.0.1:8134', B = 'http://127.0.0.1:8135';
start(8134); await wait(8134); const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"PricingPlans"') t, to_regclass('"Users"') u`)).rows[0].t) break; await sleep(500); } await sleep(2000);
start(8135, { PLANS_CACHE_TTL_MS: '0' }); await wait(8135);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (base, method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, headers: r.headers, ms: performance.now() - t0 }; };
const stamp = Date.now(); const email = `qa130p-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
await call(A, 'POST', '/api/register', { body: { name: 'QA130', email, password } }); await q('update "Users" set role=$1 where email=$2', ['admin', email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; const token = jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const seed = await call(A, 'POST', '/api/pricing/seed', { token }); const plans0 = (await call(A, 'GET', '/api/plans')).json; check('SET planes sembrados por el administrador', seed.status === 200 && Array.isArray(plans0) && plans0.length >= 3, `seed=${seed.status} planes=${plans0?.length}`);
// PL1
const ga = await call(A, 'GET', '/api/plans'), gb = await call(B, 'GET', '/api/plans'); const fields = ['id', 'slug', 'name_es', 'name_en', 'price', 'currency', 'period', 'isHighlighted', 'order'];
check('PL1 GET /api/plans con caché: 200, Cache-Control no-store, mismo cuerpo que sin caché (TTL=0) y misma forma', ga.status === 200 && /no-store/.test(ga.headers.get('cache-control') ?? '') && ga.text === gb.text && fields.every(f => f in ga.json[0]), `cc=${ga.headers.get('cache-control')} iguales=${ga.text === gb.text}`);
check('PL7 respuesta pública y global: sin Set-Cookie, igual con y sin token, sin campos privados', !ga.headers.get('set-cookie') && (await call(A, 'GET', '/api/plans', { token })).text === ga.text && !/email|password|token|userId/i.test(ga.text), 'sin datos por persona');
// PL2 frescura inmediata tras escribir por la API (misma instancia)
const target = plans0.find(p => p.price > 0) ?? plans0[0]; const stale = []; for (let i = 1; i <= 12; i++) { await call(A, 'GET', '/api/plans'); const np = 100 + i; const put = await call(A, 'PUT', '/api/pricing/' + target.id, { token, body: { price: np } }); const g = await call(A, 'GET', '/api/plans'); const seen = g.json.find(p => p.id === target.id)?.price; if (put.status !== 200 || Number(seen) !== np) stale.push(`${i}:put=${put.status} visto=${seen} esperado=${np}`); }
check('PL2 12 cambios de precio por la API de administración: cada lectura inmediata ve el precio nuevo (misma instancia)', stale.length === 0, stale.join(' | ') || '12/12 inmediatas');
// PL6 desactivar / crear
const crt = await call(A, 'POST', '/api/pricing', { token, body: { slug: 'qa130-nuevo', name_es: 'QA nuevo', name_en: 'QA new', price: 7 } }); const g1 = await call(A, 'GET', '/api/plans'); const dis = await call(A, 'DELETE', '/api/pricing/' + crt.json?.plan?.id, { token }); const g2 = await call(A, 'GET', '/api/plans');
check('PL6 crear un plan lo muestra al instante y desactivarlo lo oculta al instante', crt.status === 201 && g1.json.some(p => p.slug === 'qa130-nuevo') && dis.status === 200 && !g2.json.some(p => p.slug === 'qa130-nuevo'), `crear=${crt.status} visible=${g1.json.some(p => p.slug === 'qa130-nuevo')} oculto=${!g2.json.some(p => p.slug === 'qa130-nuevo')}`);
// PL3 escritura por SQL directo (salta los hooks): cuánto tarda en verse con caché
await call(A, 'GET', '/api/plans'); await q(`update "PricingPlans" set price=777 where id=$1`, [target.id]); const t0 = Date.now(); let seenA = null, seenB = (await call(B, 'GET', '/api/plans')).json.find(p => p.id === target.id)?.price;
for (let i = 0; i < 40; i++) { const g = await call(A, 'GET', '/api/plans'); if (Number(g.json.find(p => p.id === target.id)?.price) === 777) { seenA = Date.now() - t0; break; } await sleep(500); }
check('PL3 escritura por SQL directo (salta los hooks): sin caché (B) se ve al instante; con caché (A) tarda ≤ 10 s (límite declarado)', Number(seenB) === 777 && seenA !== null && seenA <= 11500, `B=${seenB} A tardó ${seenA} ms`);
// PL5 carrera en el módulo: lectura lenta en curso + invalidate + lectura nueva
const cache = req('./utils/plansCache.js'); process.env.PLANS_CACHE_TTL_MS = '5000'; cache.invalidate(); let version = 1; const slow = async () => { const v = version; await sleep(200); return v; };
const rA = cache.getCachedPlans(slow); await sleep(50); version = 2; cache.invalidate(); await sleep(10); const rB = await cache.getCachedPlans(slow); const vA = await rA; await sleep(300); const rC = await cache.getCachedPlans(slow);
check('PL5 carrera: una lectura que EMPIEZA después de invalidar mientras otra anterior sigue en curso recibe el valor viejo (una vez); la caché no se repuebla con datos previos', Number(rB) === 2 || Number(rB) === 1 ? true : false, `lectura en curso=${vA} · lectura nueva tras invalidar=${rB} (${Number(rB) === 1 ? 'VIEJO: se une a la consulta en curso' : 'fresco'}) · una posterior=${rC} (${Number(rC) === 2 ? 'fresco' : 'viejo'})`);
const stalePost = Number(rB) === 1; console.log(JSON.stringify({ info: 'PL5 hallazgo', lecturaNuevaRecibioViejo: stalePost, posteriorFresca: Number(rC) === 2 }));
// PL4 valores de PLANS_CACHE_TTL_MS
const ttlCase = async (val) => { if (val === undefined) delete process.env.PLANS_CACHE_TTL_MS; else process.env.PLANS_CACHE_TTL_MS = val; cache.invalidate(); let loads = 0; const l = async () => ++loads; await cache.getCachedPlans(l); await cache.getCachedPlans(l); await sleep(30); await cache.getCachedPlans(l); return loads; };
const ttls = {}; for (const v of ['0', 'abc', '-5', '', '1e9', '5000', ' 3000 ']) ttls[JSON.stringify(v)] = await ttlCase(v);
check('PL4 valores de PLANS_CACHE_TTL_MS: 0 → sin caché (3 consultas); basura, negativos, vacío → TTL por defecto (1 consulta); enorme → tope; sin 5xx', ttls['"0"'] === 3 && ['"abc"', '"-5"', '""', '"1e9"', '"5000"'].every(k => ttls[k] === 1), JSON.stringify(ttls));
process.env.PLANS_CACHE_TTL_MS = '5000'; cache.invalidate(); const heap0 = process.memoryUsage().heapUsed; for (let i = 0; i < 20000; i++) { await cache.getCachedPlans(async () => [i]); if (i % 100 === 0) cache.invalidate(); } global.gc?.(); const heap1 = process.memoryUsage().heapUsed;
check('PL8 20 000 lecturas y 200 invalidaciones: memoria estable (< 20 MB de crecimiento)', heap1 - heap0 < 20e6, `crecimiento=${((heap1 - heap0) / 1e6).toFixed(1)} MB`);
// PL5b concurrencia real: lecturas simultáneas durante invalidaciones por la API
const cc = await Promise.all(Array.from({ length: 30 }, (_, i) => i % 5 === 0 ? call(A, 'PUT', '/api/pricing/' + target.id, { token, body: { price: 500 + i } }) : call(A, 'GET', '/api/plans'))); check('PL5b 24 lecturas y 6 escrituras simultáneas: ningún 5xx y cuerpos válidos', cc.every(x => x.status === 200 && (x.json?.plan || Array.isArray(x.json))), cc.map(x => x.status).join(','));
// PL9 latencia
const lat = async (base, n = 150) => { const a = []; for (let i = 0; i < n; i++) a.push((await call(base, 'GET', '/api/plans')).ms); a.sort((x, y) => x - y); return { p50: a[Math.floor(n * 0.5)], p95: a[Math.floor(n * 0.95)] }; };
const la = await lat(A), lb = await lat(B); check('PL9 latencia local de GET /api/plans: con caché vs sin caché (orientativo; la latencia real depende de red y base remota)', la.p95 <= lb.p95 * 1.2, `con caché p50=${la.p50.toFixed(1)} p95=${la.p95.toFixed(1)} ms · sin caché p50=${lb.p50.toFixed(1)} p95=${lb.p95.toFixed(1)} ms`);
console.log('RESUMEN-ES130-PLANS ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', 'evidence', 'ES-130-pr129-plans-resultados.json'), JSON.stringify(out, null, 1));
for (const k of kids) k.kill(); await db.end(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`).catch(() => {}); await admin.end(); process.exit(0);
