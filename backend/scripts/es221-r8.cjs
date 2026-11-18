// ES-221 (E305-1, R8): mide cuánto tarda /api/health mientras entra una ráfaga de registros simultáneos desde una misma IP. El servidor corre en un PROCESO APARTE (si compartiera
// proceso con el cliente, el hash del cliente ensuciaría la medida). PostgreSQL desechable en loopback; datos sintéticos; sin IA; nada contra staging ni producción.
// Uso (desde backend/):  ES221_R8_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node scripts/es221-r8.cjs [ráfaga=30] [corridas=3] [duplicados=0]
// Umbral aprobado por Infra: p95 de /api/health < 1000 ms durante 30 registros simultáneos. No es una prueba de CI (depende de la máquina): imprime la medida.
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const net = require('node:net');
const { Client } = require('pg');

const burst = Number(process.argv[2] || 30); const runs = Number(process.argv[3] || 3); const duplicates = process.argv[4] === 'dup';
const source = process.env.ES221_R8_DATABASE_URL;
if (!source) { console.error('Falta ES221_R8_DATABASE_URL (PostgreSQL desechable en loopback)'); process.exit(2); }
const target = new URL(source);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) { console.error('Solo loopback'); process.exit(2); }
const backend = path.resolve(__dirname, '..');
const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]; };
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });

(async () => {
  const dbName = `es221r8_${crypto.randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: source, ssl: false }); await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  const url = new URL(source); url.pathname = `/${dbName}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), DB_SSL: 'false', NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    PROMPT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') };
  let child;
  try {
    const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env });
    if (migrated.status !== 0) throw new Error('Fallaron las migraciones: ' + (migrated.stdout + migrated.stderr).slice(-400));
    const port = await freePort();
    child = spawn(process.execPath, ['server.js'], { cwd: backend, env: { ...env, PORT: String(port) }, stdio: 'ignore' });
    const base = `http://127.0.0.1:${port}`;
    for (let n = 0; n < 60; n++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* arrancando */ } await new Promise(r => setTimeout(r, 500)); }
    const post = (mail) => fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Persona Sintética', email: mail, password: 'Sintetica-Clave-2026!', acceptedTerms: true, termsVersion: '2026-11-v2' }) });
    const seed = `r8-semilla-${crypto.randomBytes(3).toString('hex')}@example.test`;
    if (duplicates) await post(seed);
    const results = [];
    for (let run = 1; run <= runs; run++) {
      // Las corridas usan otra «IP» de origen vía X-Forwarded-For solo si el servidor confía en el proxy; aquí no: el límite es de 30 por hora por IP, así que cada corrida reinicia el servidor.
      if (run > 1) { child.kill(); await new Promise(r => setTimeout(r, 500)); child = spawn(process.execPath, ['server.js'], { cwd: backend, env: { ...env, PORT: String(port) }, stdio: 'ignore' });
        for (let n = 0; n < 60; n++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* arrancando */ } await new Promise(r => setTimeout(r, 500)); } }
      const idle = []; for (let n = 0; n < 10; n++) { const s = performance.now(); await fetch(base + '/api/health'); idle.push(performance.now() - s); }
      const health = []; let stop = false;
      const poller = (async () => { while (!stop) { const s = performance.now(); try { await fetch(base + '/api/health'); health.push(performance.now() - s); } catch { health.push(Infinity); } await new Promise(r => setTimeout(r, 50)); } })();
      const started = performance.now();
      const statuses = await Promise.all(Array.from({ length: burst }, (_, i) => post(duplicates ? seed : `r8-${run}-${i}-${crypto.randomBytes(3).toString('hex')}@example.test`).then(r => r.status)));
      const total = performance.now() - started; stop = true; await poller;
      const count = statuses.reduce((acc, code) => ({ ...acc, [code]: (acc[code] || 0) + 1 }), {});
      results.push({ p95: percentile(health, 0.95), max: Math.max(...health), samples: health.length });
      console.log(`corrida ${run}: reposo p50=${percentile(idle, 0.5).toFixed(1)} ms · durante la ráfaga de ${burst}${duplicates ? ' duplicados' : ''}: /api/health p95=${percentile(health, 0.95).toFixed(0)} ms, máx=${Math.max(...health).toFixed(0)} ms (${health.length} muestras) · ráfaga completa ${total.toFixed(0)} ms · estados ${JSON.stringify(count)}`);
    }
    const worst = Math.max(...results.map(r => r.p95));
    console.log(`peor p95 de /api/health: ${worst.toFixed(0)} ms (umbral aprobado: < 1000 ms) → ${worst < 1000 ? 'CUMPLE' : 'NO CUMPLE'}`);
  } finally {
    if (child) child.kill();
    await new Promise(r => setTimeout(r, 500));
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {}); await admin.end().catch(() => {});
  }
})().catch(error => { console.error('FALLA', error.message); process.exit(1); });
