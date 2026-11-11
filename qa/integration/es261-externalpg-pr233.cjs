// [QA-Claude] ES-261 · PR #233 · prueba directa de backend/test/support/externalPostgres.cjs (solo loopback, base propia, limpieza). Postgres local desechable, 0 IA.
// Uso: QA_SUT=<clon> PGADMIN=postgres://usuario:clave@127.0.0.1:54459/postgres node qa/integration/es261-externalpg-pr233.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const pg = req('pg');
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 500) })); };
// espía de conexiones: cuenta cada Client construido por el módulo
let built = 0; const RealClient = pg.Client; pg.Client = class extends RealClient { constructor(...a) { built++; super(...a); } };
const mod = req('./test/support/externalPostgres.cjs'); const open = mod.openExternalPostgres;
(async () => {
  const admin = new RealClient({ connectionString: E.PGADMIN }); await admin.connect();
  const dbs = async () => (await admin.query(`select datname from pg_database where datname ~ '^qa261_test_'`)).rows.map(r => r.datname);
  const before = await dbs();
  const SECRET = 'S3cr3tPassw0rd!zz';
  const hostile = [`postgres://u:${SECRET}@evil.com:5432/postgres`, `postgres://u:${SECRET}@127.0.0.1.evil.com/postgres`, `postgres://127.0.0.1:${SECRET}@evil.com/postgres`, `postgres://u:${SECRET}@localhost.evil.net/postgres`, `postgres://u:${SECRET}@10.0.0.5/postgres`, `postgres://u:${SECRET}@192.168.1.10/postgres`, `postgres://u:${SECRET}@0.0.0.0/postgres`, `postgres://u:${SECRET}@db.supabase.co/postgres`, `postgres://u:${SECRET}@[2001:db8::1]/postgres`, `postgres://u:${SECRET}@%31%32%37.0.0.1.evil.com/postgres`];
  const notRejected = []; let leak = false;
  for (const h of hostile) { const b = built; process.env.QA_EXT = h; try { const r = await open('QA_EXT', 'qa261'); notRejected.push(h.replace(SECRET, '***') + ' → ' + (r ? 'abrió' : 'null')); } catch (e) { if (String(e.message).includes(SECRET) || String(e.stack).includes(SECRET)) leak = true; if (built !== b) notRejected.push(h.replace(SECRET, '***') + ' → conectó antes de rechazar'); } }
  check('E1a (bloqueante) 10 destinos no locales (evil.com, 127.0.0.1.evil.com, userinfo engañoso, localhost.evil.net, 10.x, 192.168.x, 0.0.0.0, supabase, IPv6 pública, host codificado) → error ANTES de crear ningún Client; la clave no aparece en el error', notRejected.length === 0 && !leak, notRejected.join(' | ') + ' fuga=' + leak);
  const inv = []; for (const bad of ['no es una url', 'postgres://', '://x', 'http://', ' ']) { const b = built; process.env.QA_EXT = bad; try { await open('QA_EXT', 'qa261'); inv.push(bad + ' → abrió'); } catch (e) { if (built !== b) inv.push(bad + ' → conectó'); } }
  delete process.env.QA_NOPE; process.env.QA_EMPTY = '';
  check('E1b URL inválida → error sin conectar; variable ausente o vacía → null (modo embebido)', inv.length === 0 && (await open('QA_NOPE', 'qa261')) === null && (await open('QA_EMPTY', 'qa261')) === null, inv.join(' | '));
  const info = []; for (const lo of ['127.0.0.2', 'LOCALHOST']) { process.env.QA_EXT = E.PGADMIN.replace('127.0.0.1', lo); try { const r = await open('QA_EXT', 'qa261'); info.push(lo + ' → ' + (r ? 'acepta' : 'null')); if (r) await r.shim.stop(); } catch (e) { info.push(lo + ' → rechaza (' + e.message.slice(0, 40) + ')'); } }
  console.log(JSON.stringify({ id: 'E1c info', info: info.join(' ; ') })); results.push({ id: 'E1c info', info: info.join(' ; ') });
  // loopback legítimo
  const okHosts = [E.PGADMIN, E.PGADMIN.replace('127.0.0.1', 'localhost')]; const bad = [];
  for (const u of okHosts) {
    process.env.QA_EXT = u; const r = await open('QA_EXT', 'qa261'); if (!r) { bad.push('null ' + u); continue; }
    const name = new URL(r.url).pathname.slice(1); const created = (await dbs()).includes(name);
    const c = new RealClient({ connectionString: r.url }); await c.connect(); const cur = (await c.query('select current_database() d')).rows[0].d; await c.query('create table t(x int)'); await c.end();
    await r.shim.initialise(); await r.shim.start(); await r.shim.stop(); await r.shim.stop(); const gone = !(await dbs()).includes(name);
    if (!(created && cur === name && /^qa261_test_[0-9a-f]{16}$/.test(name) && gone)) bad.push(`${u.split('@')[1]}: creada=${created} actual=${cur} nombre=${name} borrada=${gone}`);
  }
  check('E2a (bloqueante) 127.0.0.1 y localhost: crea una base aleatoria propia (qa261_test_<16 hex>), la suite trabaja en ella y stop() la borra; stop() doble es inocuo; la base original no recibe tablas', bad.length === 0, bad.join(' | ') || 'ok');
  // dos aperturas en paralelo: nombres distintos
  process.env.QA_EXT = E.PGADMIN; const par = await Promise.all(Array.from({ length: 6 }, () => open('QA_EXT', 'qa261'))); const names = par.map(r => new URL(r.url).pathname); const distinct = new Set(names).size === 6;
  await Promise.all(par.map(r => r.shim.stop()));
  check('E2b seis aperturas en paralelo → seis bases distintas, todas borradas al terminar', distinct && (await dbs()).length === before.length, names.join(','));
  // fallo a mitad: la suite no llama a stop → limpieza queda a cargo de la suite (documento) ; con stop en finally
  const leftover = (await dbs()).filter(n => !before.includes(n));
  check('E2c sin bases residuales qa261_test_* tras todas las pruebas', leftover.length === 0, leftover.join(','));
  // la tabla 't' no debe haber quedado en la base original
  const t = (await admin.query(`select to_regclass('public.t') x`)).rows[0].x;
  check('E2d la base administrativa original no recibió tablas de prueba', t === null, String(t));
  await admin.end();
  fs.writeFileSync(path.join(E.QA_OUT || '.', 'ES-261-externalpg-pr233.json'), JSON.stringify(results, null, 1));
  console.log('RESUMEN ' + results.filter(r => r.ok).length + '/' + results.filter(r => 'ok' in r).length); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
