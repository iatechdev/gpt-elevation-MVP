// ES-280 (ES-189 PR-1) · IDs hostiles sobre TODAS las rutas con parámetro, montadas como en server.js: nunca 5xx ni detalle interno. HTTP REAL, JWT real, PostgreSQL REAL, pool de 5.
//   ES280_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-280-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-280 PostgreSQL + HTTP: IDs hostiles en todas las rutas con parámetro (ES-189 PR-1)', { timeout: 600000 }, async (t) => {
  const { base, q, mkUser, http, MOUNTS, api, routesOf } = await startRealApi(t, { envVar: 'ES280_TEST_DATABASE_URL', prefix: 'es280' });

  // ES-280 (ES-189 PR-1) · IDs hostiles en TODAS las rutas con parámetro, montadas como en server.js: ninguna responde 5xx, ningún cuerpo filtra detalle interno (PostgreSQL, trazas,
  // nombres de variables) y el registro de rutas con parámetro es CERRADO: una ruta nueva debe añadirse al fixture (y, con ella, pasa por esta batería).
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'routes-with-params.json');
  const { routes: all, nested } = routesOf(MOUNTS, api);
  const seen = new Set(); const routes = all.filter(([m, p]) => { const k = m + ' ' + p; if (seen.has(k)) return false; seen.add(k); return /:[A-Za-z]+/.test(p); });
  const listing = routes.map(([m, p]) => m + ' ' + p).sort();

  await t.test('registro cerrado: la lista de rutas con parámetro coincide con el fixture (una ruta nueva se añade a propósito y entra a esta batería)', async () => {
    if (process.env.ES280_WRITE_FIXTURE === '1') fs.writeFileSync(fixturePath, JSON.stringify(listing, null, 2) + '\n');
    const expected = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.deepEqual(listing.filter((r) => !expected.includes(r)), [], 'rutas con parámetro NUEVAS: añádelas al fixture con ES280_WRITE_FIXTURE=1');
    assert.deepEqual(expected.filter((r) => !listing.includes(r)), [], 'rutas del fixture que ya no existen');
    assert.ok(listing.length >= 90, 'el recorrido de rutas encontró ' + listing.length);
  });

  await t.test('IDs hostiles: ninguna de las rutas con parámetro responde 5xx ni filtra detalle interno, con persona, profesional, administración y superadministración', async () => {
    process.env.DATA_RIGHTS_ENABLED = 'true'; // la función de derechos de datos está detrás de un interruptor: con él apagado todo responde 503 y no se ejercita el id
  const HOSTILE = ['abc', '0', '-1', '1.5', '01', '1e3', '99999999999', '2147483648', 'NaN', '%20', '1%3BDROP', '%D9%A3', '%00', '%27%20OR%201%3D1--', '%E0%A4%A', 'x'.repeat(200)];
    const sup = await mkUser('superadmin'); const th = await mkUser('therapist'); const person = await mkUser('user', { therapistId: th.id });
    const who = [person, th, sup]; // superadmin atraviesa también las guardas de administración; el rol sin permiso se corta antes de leer el id
    const LEAK = /SequelizeDatabaseError|invalid input syntax|out of range for type|violates|relation ".*" does not exist|PROMPT_ENCRYPTION|JWT_SECRET|DATA_ENCRYPTION|\n\s+at \w|node_modules|ECONN/i;
    const failures = []; const times = [];
    for (const [method, pattern] of routes) {
      if (/\/(logout|logout-all)$/.test(pattern)) continue;
      for (const hostile of HOSTILE) {
        const url = pattern.replace(/:[A-Za-z]+/g, hostile);
        const outs = await Promise.all(who.map(async (actor) => { const t0 = performance.now(); let out; try { out = await http(actor, method, url, ['GET', 'DELETE'].includes(method) ? undefined : {}); times.push(performance.now() - t0); } catch (e) { out = { status: -1, body: { e: String(e) } }; } return [actor, out]; }));
        for (const [actor, out] of outs) {
          const text = JSON.stringify(out.body || {});
          const stateDependent = out.status === 503 && out.body && out.body.code === 'catalog_unavailable'; // catálogo vacío: pasa con cualquier id, no depende de él
          if ((out.status >= 500 || out.status === -1) && !stateDependent) failures.push(`${method} ${pattern} <- ${JSON.stringify(hostile).slice(0, 18)} as ${actor.role} => ${out.status} ${text.slice(0, 70)}`);
          else if (out.status >= 400 && out.body === null) failures.push(`${method} ${pattern} <- ${JSON.stringify(hostile).slice(0, 18)} as ${actor.role} => ${out.status} SIN JSON (página HTML o vacía)`);
          else if (LEAK.test(text)) failures.push(`${method} ${pattern} <- ${JSON.stringify(hostile).slice(0, 18)} as ${actor.role} => ${out.status} FILTRA ${text.slice(0, 70)}`);
        }
      }
    }
    const byRoute = {}; for (const f of failures) (byRoute[f.split(' <- ')[0]] ||= []).push(f);
    times.sort((x, y) => x - y); console.log('# TIEMPOS ids hostiles (ms): n=' + times.length + ' p50=' + times[Math.floor(times.length * 0.5)].toFixed(1) + ' p95=' + times[Math.floor(times.length * 0.95)].toFixed(1) + ' max=' + times[times.length - 1].toFixed(1));
    assert.deepEqual(Object.keys(byRoute), [], Object.entries(byRoute).map(([k, v]) => `${k} x${v.length} p.ej. ${v[0].split(' <- ')[1]}`).join('\n'));
  });

  await t.test('porcentaje mal formado en la URL: 400 JSON fijo, sin página HTML ni traza (también en rutas sin parámetro)', async () => {
    const person = await mkUser('user');
    for (const url of ['/api/diary/%E0%A4%A', '/api/mood/history?x=1', '/api/user/resumes/%E0%A4%A/file']) {
      const res = await fetch(base + url, { headers: { Authorization: 'Bearer ' + person.token } });
      const raw = await res.text();
      if (url.includes('%E0%A4%A')) {
        assert.equal(res.status, 400, url + ' ' + raw.slice(0, 80));
        assert.ok((res.headers.get('content-type') || '').includes('application/json'), 'JSON');
        assert.deepEqual(JSON.parse(raw), { code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' });
        assert.ok(!/<html|<pre>|node_modules/i.test(raw) && !raw.includes(' at '), 'sin página HTML ni traza');
      }
    }
  });

  await t.test('E236-1 · sin routers anidados ni montajes sin registrar: todo router que server.js monta se recorre entero (un router dentro de otro no tiene prefijo cierto)', async () => {
    assert.deepEqual(nested, [], 'routers anidados: declara su prefijo en la batería');
    assert.ok(MOUNTS.length >= 55, 'server.js real monta ' + MOUNTS.length + ' routers');
    assert.ok(MOUNTS.some((m) => m.prefix === '/api/manifest') && MOUNTS.some((m) => m.prefix === '/api/board'), 'los dos montajes del manifiesto');
  });

  await t.test('E236-1 · apiErrors: la rama 500 y las 4xx responden cuerpo FIJO; ni el mensaje del error ni la traza salen al cliente ni al log', async () => {
    const { apiErrors, FAILED, BAD_REQUEST } = require('../../middlewares/apiErrors');
    const run = (error) => {
      const out = { headers: {} }; const logged = []; const realError = console.error; console.error = (...a) => logged.push(a.map(String).join(' '));
      const res = { headersSent: false, set(k, v) { out.headers[k] = v; return this; }, status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
      try { apiErrors(error, {}, res, () => { out.next = true; }); } finally { console.error = realError; }
      return { ...out, logged: logged.join('\n') };
    };
    const secret = Object.assign(new Error('SELECT secreto FROM tabla_interna'), { status: 500 });
    const a = run(secret); assert.equal(a.status, 500); assert.deepEqual(a.body, FAILED); assert.ok(!/secreto|tabla_interna|SELECT/.test(JSON.stringify(a.body) + a.logged), 'ni cuerpo ni log llevan el mensaje');
    const b = run(Object.assign(new Error('SELECT secreto'), { status: 400 })); assert.equal(b.status, 400); assert.deepEqual(b.body, BAD_REQUEST);
    const c = run(Object.assign(new Error('secreto'), { status: 418 })); assert.equal(c.status, 418); assert.ok(!JSON.stringify(c.body).includes('secreto'));
    const d = run(new URIError('secreto')); assert.equal(d.status, 400); assert.deepEqual(d.body, BAD_REQUEST);
    assert.equal(a.headers['Cache-Control'], 'no-store');
  });

  await t.test('E236-1 · fallo REAL de la base al aprobar, rechazar y volver a una versión: 500 con cuerpo fijo, sin SQL ni texto del error (admin y superadmin)', async () => {
    const sup = await mkUser('superadmin');
    const { PromptVault, encryptPrompt } = require('../../promptVault');
    const mk = (version, status) => PromptVault.create({ key: 'es281_falla', contentEncrypted: encryptPrompt('Texto sintético de prueba.'), version, status, isActive: false, proposed_by: 'sintetico@example.test',
      reviewOutcome: 'passed', reviewReasons: '[]', reviewedAt: new Date() });
    const pending = await mk(1, 'pending_review'); const archived = await mk(2, 'approved');
    await q('CREATE FUNCTION es281_falla() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION \'SELECT secreto FROM tabla_interna\'; END $$ LANGUAGE plpgsql');
    await q('CREATE TRIGGER es281_falla BEFORE UPDATE ON "PromptVaults" FOR EACH ROW EXECUTE FUNCTION es281_falla()');
    const realError = console.error; console.error = () => {}; // el detalle va al log del servidor, no a esta salida
    try {
      for (const prefix of ['/api/admin', '/api/superadmin']) {
        const cases = [['approve', pending.id, {}, 'No se pudo aprobar la versión. / The version could not be approved.'],
          ['reject', pending.id, { note: 'nota sintética válida' }, 'No se pudo rechazar la versión. / The version could not be rejected.'],
          ['rollback', archived.id, {}, 'No se pudo hacer el rollback. / The rollback could not be done.']];
        for (const [action, id, body, message] of cases) {
          const out = await http(sup, 'POST', prefix + '/prompt/' + id + '/' + action, body);
          assert.equal(out.status, 500, prefix + ' ' + action + ' ' + JSON.stringify(out.body));
          assert.deepEqual(out.body, { error: message }, prefix + ' ' + action + ' cuerpo fijo');
          assert.ok(!/secreto|SELECT|tabla_interna|PromptVault|trigger|SQL/i.test(JSON.stringify(out.body)), 'sin detalle interno');
        }
      }
    } finally {
      console.error = realError;
      await q('DROP TRIGGER es281_falla ON "PromptVaults"'); await q('DROP FUNCTION es281_falla()');
    }
    const after = await q('SELECT version, status FROM "PromptVaults" WHERE key=$1 ORDER BY version', ['es281_falla']);
    assert.deepEqual(after, [{ version: 1, status: 'pending_review' }, { version: 2, status: 'approved' }], 'ningún intento fallido cambió la fila');
  });

  await t.test('el parámetro válido sigue funcionando igual: un id existente se atiende y uno inexistente da 404 (recomendaciones, planes de precio, invitaciones, guías)', async () => {
    const person = await mkUser('user'); const sup = await mkUser('superadmin');
    assert.equal((await http(person, 'PUT', '/api/recommendations/99999999/seen', {})).status, 404);
    assert.equal((await http(sup, 'PUT', '/api/admin/pricing/99999999', { name_es: 'x' })).status < 500, true);
    assert.equal((await http(sup, 'DELETE', '/api/admin/pricing/99999999')).status, 404);
    assert.equal((await http(sup, 'POST', '/api/admin/invitations/99999999/revoke', {})).status, 404);
    assert.equal((await http(sup, 'POST', '/api/superadmin/prompt/99999999/approve', {})).status, 404);
    assert.equal((await http(sup, 'POST', '/api/superadmin/prompt/99999999/rollback', {})).status, 404);
    assert.equal((await http(sup, 'PUT', '/api/board/manifest/99999999/activate', {})).status, 404);
  });
});
