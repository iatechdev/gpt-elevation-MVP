// [QA-Claude] ES-222 · PR #164 · seguimiento de ES-220: LOGIN_RATE_LIMIT_MAX ignorada en producción/Railway y desalojo que conserva bloqueos vigentes.
// Servidor real (3 variantes de entorno) + módulos directos. PostgreSQL embebido, datos sintéticos, 0 IA. No imprime secretos.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13', EVID = 'C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 380) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
const adm = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await adm.connect();
const boot = async (tag, port, extra) => {
  const db = 'q222' + tag; await adm.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); await adm.query(`CREATE DATABASE ${db}`);
  const dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${db}`;
  let log = ''; const srv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', TRUST_PROXY_HOPS: '1', ...extra } });
  srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; }); kids.push(srv);
  let up = false; for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) { up = true; break; } } catch { /* */ } if (srv.exitCode !== null) break; await sleep(500); }
  if (up) { const c = new Client({ connectionString: dbUrl, ssl: false }); await c.connect(); for (let i = 0; i < 120; i++) { if ((await c.query(`select to_regclass('"Users"') u, to_regclass('"RevokedTokens"') r`)).rows[0].u) break; await sleep(500); } await c.end(); await sleep(3000); }
  return { up, port, log: () => log, db };
};
const login = async (port, email, ip, password = 'Mala1!x') => (await fetch(`http://127.0.0.1:${port}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password }) })).status;
const burst = async (port, n, ip) => { const s = []; for (let i = 0; i < n; i++) s.push(await login(port, `nx${i}-${Date.now()}@example.test`, ip)); return s; };
// L1/L2: tres variantes de entorno
const vDev = await boot('a', 8260, { NODE_ENV: 'development', LOGIN_RATE_LIMIT_MAX: '1000' });
const sDev = vDev.up ? await burst(8260, 30, '203.0.113.1') : [];
check('L2 fuera de producción y sin Railway, LOGIN_RATE_LIMIT_MAX=1000 sí aplica (30 intentos desde una IP sin 429 y sin 5xx)', vDev.up && !sDev.includes(429) && !sDev.some(x => x >= 500), `arranca=${vDev.up} estados=${[...new Set(sDev)]}`);
const vRail = await boot('b', 8261, { NODE_ENV: 'development', LOGIN_RATE_LIMIT_MAX: '1000', RAILWAY_ENVIRONMENT_ID: 'qa-sintetico' });
const sRail = vRail.up ? await burst(8261, 13, '203.0.113.2') : [];
check('L1a con RAILWAY_ENVIRONMENT_ID definida, la variable se ignora: 429 al 11.º intento (10 pasan)', vRail.up && sRail.slice(0, 10).every(s => s === 401) && sRail.slice(10).every(s => s === 429), `arranca=${vRail.up} estados=${sRail.join(',')}`);
const vProd = await boot('c', 8262, { NODE_ENV: 'production', LOGIN_RATE_LIMIT_MAX: '1000' });
const sProd = vProd.up ? await burst(8262, 13, '203.0.113.3') : [];
check('L1b con NODE_ENV=production, la variable se ignora: 429 al 11.º intento', vProd.up && sProd.slice(0, 10).every(s => s === 401) && sProd.slice(10).every(s => s === 429), vProd.up ? `estados=${sProd.join(',')}` : `NO arrancó en modo producción con mi configuración sintética: ${vProd.log().split('\n').filter(l => /error|requ|falta|missing/i.test(l)).slice(0, 2).join(' | ').slice(0, 200)}`);
const vBoth = await boot('d', 8263, { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_ID: 'qa-sintetico', LOGIN_RATE_LIMIT_MAX: '1000' });
const sBoth = vBoth.up ? await burst(8263, 12, '203.0.113.4') : [];
check('L1c con producción y Railway a la vez: 429 al 11.º intento', vBoth.up && sBoth.slice(10).every(s => s === 429), vBoth.up ? `estados=${sBoth.join(',')}` : 'no arrancó');
// L3: valores raros (módulo directo)
const rl = req('./utils/loginRateLimit.js'); const weird = ['0', '-5', 'abc', '1e9', '', 'Infinity', '1.5', ' 7 ', '0x10', 'NaN', '9007199254740993', undefined];
const prodOk = weird.every(v => rl.loginRateMax({ NODE_ENV: 'production', LOGIN_RATE_LIMIT_MAX: v }) === 10 && rl.loginRateMax({ RAILWAY_ENVIRONMENT_ID: 'x', LOGIN_RATE_LIMIT_MAX: v }) === 10);
const devVals = Object.fromEntries(weird.map(v => [String(v), rl.loginRateMax({ NODE_ENV: 'development', LOGIN_RATE_LIMIT_MAX: v })]));
check('L3a producción/Railway: cualquier valor raro de la variable → 10', prodOk, 'valores probados: ' + weird.map(String).join(' | '));
check('L3b fuera de producción: valores inválidos (0, negativo, texto, vacío, Infinity, decimal) caen a 10; solo enteros positivos aplican', ['0', '-5', 'abc', '', 'Infinity', '1.5', 'NaN', undefined].every(v => devVals[String(v)] === 10), JSON.stringify(devVals));
check('L3c (informativo) NODE_ENV con otra capitalización o espacios («Production», «production »): ¿se respeta la variable?', true, `Production=${rl.loginRateMax({ NODE_ENV: 'Production', LOGIN_RATE_LIMIT_MAX: '1000' })} «production »=${rl.loginRateMax({ NODE_ENV: 'production ', LOGIN_RATE_LIMIT_MAX: '1000' })} (1000 = se respetó; el despliegue real sí fija RAILWAY_ENVIRONMENT_ID, que lo cubre)`);
// D1–D3 (módulo directo con reloj controlado)
const la = req('./utils/loginAttempts.js'); la.reset(); const t0 = Date.now(); const victim = 'victima@example.test';
for (let i = 0; i < 3; i++) la.recordFailure(victim, t0 + i); const lockedBefore = !!la.lockedUntil(victim, t0 + 10);
for (let i = 0; i < 25000; i++) la.recordFailure(`flood${i}@example.test`, t0 + 100 + i);
check('D1 inundar con 25.000 correos distintos NO libera un bloqueo vigente (antes de #164 sí lo liberaba)', lockedBefore && !!la.lockedUntil(victim, t0 + 30000) && la.size() <= 10000, `bloqueado antes=${lockedBefore} después=${!!la.lockedUntil(victim, t0 + 30000)} tamaño=${la.size()}`);
la.reset(); for (let k = 0; k < 10000; k++) for (let i = 0; i < 3; i++) la.recordFailure(`bloq${k}@example.test`, t0 + k * 3 + i); const lockedAll = la.size(); const oldestLocked = !!la.lockedUntil('bloq0@example.test', t0 + 40000);
for (let i = 0; i < 50; i++) la.recordFailure(`nuevo${i}@example.test`, t0 + 40000 + i); const sizeAfter = la.size(); const oldestAfter = !!la.lockedUntil('bloq0@example.test', t0 + 40100); const newerKept = !!la.lockedUntil('bloq9999@example.test', t0 + 40100);
check('D2a mapa lleno de bloqueos vigentes + 50 correos nuevos: la memoria sigue acotada (≤ 10.000) y sin errores', lockedAll === 10000 && sizeAfter <= 10000, `lleno=${lockedAll} tras 50 nuevos=${sizeAfter}`);
check('D2b (informativo) con TODAS las entradas bloqueadas, qué se descarta: el bloqueo más antiguo', true, `bloq0 bloqueado antes=${oldestLocked} después=${oldestAfter} · el más reciente se conserva=${newerKept} (si el más antiguo se libera, un atacante con ≥ 30.000 intentos distribuidos puede liberar bloqueos viejos; coste alto, ver riesgo)`);
const tScan0 = performance.now(); for (let i = 0; i < 200; i++) la.recordFailure(`perf${i}@example.test`, t0 + 50000 + i); const msPer = (performance.now() - tScan0) / 200;
check('D2c coste del desalojo con el mapa lleno de bloqueos: por correo nuevo < 5 ms (recorrido lineal del mapa)', msPer < 5, `${msPer.toFixed(3)} ms por correo nuevo`);
la.reset(); for (let i = 0; i < 9000; i++) la.recordFailure(`libre${i}@example.test`, t0 + i); for (let k = 0; k < 1000; k++) for (let j = 0; j < 3; j++) la.recordFailure(`lock${k}@example.test`, t0 + 20000 + k * 3 + j);
for (let i = 0; i < 3000; i++) la.recordFailure(`extra${i}@example.test`, t0 + 30000 + i); const lockKept = Array.from({ length: 1000 }, (_, k) => !!la.lockedUntil(`lock${k}@example.test`, t0 + 40000)).every(Boolean); const oldFreeGone = la.lockedUntil('libre0@example.test', t0 + 40000) === null && la.size() <= 10000;
check('D3 orden de desalojo: primero las entradas NO bloqueadas más antiguas; las 1.000 bloqueadas vigentes se conservan', lockKept && oldFreeGone, `bloqueos conservados=${lockKept} tamaño=${la.size()}`);
// E2E de la inundación sobre un servidor real: bloqueo de un correo inexistente + 120 correos distintos (no llega al tope; verifica que el flujo HTTP sigue igual)
const ipSeq = i => `198.51.${(i >> 8) & 255}.${(i & 255) + 1}`; const vic = `victima-http-${Date.now()}@example.test`; const seqs = []; for (let i = 0; i < 3; i++) seqs.push(await login(8260, vic, ipSeq(i)));
for (let i = 0; i < 120; i++) await login(8260, `fl${i}-${Date.now()}@example.test`, ipSeq(100 + i)); const still = await login(8260, vic, ipSeq(999));
check('D1b por HTTP: un correo inexistente bloqueado (401,401,423) sigue bloqueado tras 120 correos distintos', seqs.join(',') === '401,401,423' && still === 423, `secuencia=${seqs} después=${still}`);
fs.writeFileSync(path.join(EVID, 'ES-222-pr164.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES222 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length, fallan: out.filter(o => !o.ok).map(o => o.id.slice(0, 40)) }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } await adm.end(); process.exit(0);
