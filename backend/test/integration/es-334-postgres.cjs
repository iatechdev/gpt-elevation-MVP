// ES-334 · Superadmin accede a toda la plataforma (compuerta del cliente), pero el SERVIDOR no abre más rutas: HTTP REAL contra el server.js real, JWT real y PostgreSQL REAL.
//   Lo que se verifica: (1) la superadministración usa SU chat y SU diario (control positivo) y nunca lee ni toca los de otra persona (404 igual al de un id inexistente, sin cambiar ni una fila);
//   (2) listas y chat de la superadministración no contienen datos canario de otra persona, ni en la respuesta ni en lo que se envía a la IA; (3) ninguna guarda de rol se abrió:
//   el lado profesional y el contexto/hojas de vida de la persona siguen negando a la superadministración, y administración sigue sin entrar a lo de las personas ajenas.
//   ES334_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-334-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-334 PostgreSQL + HTTP: superadmin usa su chat/diario y no lee los ajenos; las guardas de rol del servidor no se abrieron', { timeout: 600000 }, async (t) => {
  const { q, mkUser, http, provider } = await startRealApi(t, { envVar: 'ES334_TEST_DATABASE_URL', prefix: 'es334' });
  const seed = makeSeeder(q);
  const tables = (await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")).map((r) => r.table_name);
  const fingerprint = async () => {
    const out = {};
    for (const table of tables) { if (table === 'SequelizeMeta') continue; out[table] = (await q(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h, count(*)::int AS n FROM "${table}" x`))[0]; }
    return out;
  };
  const changed = (before, after) => Object.keys(before).filter((k) => before[k].h !== after[k].h);
  const NONEXISTENT = 2147483000;
  const uuid = () => crypto.randomUUID();
  const stamp = crypto.randomBytes(4).toString('hex');

  const SA = await mkUser('superadmin'); const AD = await mkUser('admin'); const A = await mkUser('user'); const T = await mkUser('therapist');

  // Mismos recursos de la persona que la matriz A/B de ES-281, ahora con la superadministración (y administración) como quien intenta.
  const RESOURCES = [
    { name: 'diario', make: (u) => seed('DiaryEntries', { UserId: u.id }),
      calls: (r) => [['GET', `/api/diary/${r.id}`], ['PUT', `/api/diary/${r.id}`, { content: 'Texto cambiado' }], ['DELETE', `/api/diary/${r.id}`]], control: (r) => `/api/diary/${r.id}` },
    { name: 'evidencia', make: async (u) => { const e = await seed('Evidence', { UserId: u.id }); await seed('EvidenceVersions', { EvidenceId: e.id, UserId: u.id, version: 1 }); return e; },
      calls: (r) => [['GET', `/api/evidence/${r.id}`], ['DELETE', `/api/evidence/${r.id}`]], control: (r) => `/api/evidence/${r.id}` },
    { name: 'hojas de vida', make: (u) => seed('ParticipantResumes', { UserId: u.id }),
      calls: (r) => [['GET', `/api/user/resumes/${r.id}/file`], ['DELETE', `/api/user/resumes/${r.id}`]], control: (r) => `/api/user/resumes/${r.id}/file` },
    { name: 'turnos de chat', make: (u) => seed('ChatTurns', { UserId: u.id, requestId: uuid() }),
      calls: (r) => [['GET', `/api/chat/turns/${r.requestId}`]], control: (r) => `/api/chat/turns/${r.requestId}`, missing: uuid() },
  ];
  const evaluate = async (label, actor, owner, resource) => {
    const row = await resource.make(owner); const problems = [];
    const gone = (path) => path.replace(String(row.requestId || row.id), String(resource.missing || NONEXISTENT));
    for (const [method, path, body] of resource.calls(row)) {
      const before = await fingerprint();
      const ajeno = await http(actor, method, path, body); const inexistente = await http(actor, method, gone(path), body);
      const after = await fingerprint();
      if (ajeno.status !== 404 && ajeno.status !== 403) problems.push(`${label} ${resource.name} ${method} ${path}: respondió ${ajeno.status}, se esperaba 404/403`);
      if (ajeno.status !== inexistente.status || JSON.stringify(ajeno.body) !== JSON.stringify(inexistente.body)) problems.push(`${label} ${resource.name} ${method} ${path}: distingue ajeno de inexistente`);
      if (ajeno.status >= 500) problems.push(`${label} ${resource.name} ${method} ${path}: 5xx`);
      const diff = changed(before, after); if (diff.length) problems.push(`${label} ${resource.name} ${method} ${path}: cambió la base (${diff.join(', ')})`);
    }
    const own = await http(owner, 'GET', resource.control(row)); if (own.status === 404) problems.push(`${label} ${resource.name}: control positivo, el dueño no encuentra su fila`);
    return problems;
  };

  await t.test('superadministración y administración sobre filas de la persona A: 404/403 igual al de un id inexistente y la base no cambia', async () => {
    const problems = [];
    for (const actor of [['superadmin', SA], ['admin', AD]]) for (const r of RESOURCES) problems.push(...await evaluate(actor[0], actor[1], await mkUser('user'), r)); // una persona dueña nueva por recurso: algunas tablas admiten una fila por persona
    assert.deepEqual(problems, []);
  });

  await t.test('superadministración: SU chat y SU diario funcionan (control positivo) y las listas y el modelo no contienen datos canario de la persona A', async () => {
    const canary = { diary: `CANARIO-DIARIO-${stamp}`, chat: `CANARIO-CHAT-${stamp}` };
    assert.equal((await http(A, 'POST', '/api/diary', { date: '2026-10-01', content: canary.diary })).status, 201);
    assert.equal((await http(A, 'POST', '/api/chat', { message: `Hoy me siento cansado ${canary.chat}`, requestId: uuid() })).status, 200);
    const own = { diary: `PROPIO-SA-DIARIO-${stamp}`, chat: `PROPIO-SA-CHAT-${stamp}` };
    const mark = provider.requests.length;
    assert.equal((await http(SA, 'POST', '/api/diary', { date: '2026-10-02', content: own.diary })).status, 201, 'su diario');
    assert.equal((await http(SA, 'POST', '/api/chat', { message: `Mi mensaje ${own.chat}`, requestId: uuid() })).status, 200, 'su chat');
    const fromModel = provider.requests.slice(mark).join('\n');
    assert.ok(fromModel.includes(own.chat), 'el modelo recibe su propio mensaje');
    assert.ok(!fromModel.includes(canary.chat) && !fromModel.includes(canary.diary), 'el modelo no recibe nada de la persona A');
    for (const route of ['/api/diary', '/api/messages', '/api/mood/history']) {
      const res = await http(SA, 'GET', route); const text = JSON.stringify(res.body);
      assert.ok(!text.includes(canary.diary) && !text.includes(canary.chat), `${route} no devuelve datos de A`);
      assert.ok(res.status < 500, `${route}: ${res.status}`);
    }
    assert.ok(JSON.stringify((await http(SA, 'GET', '/api/diary')).body).includes(own.diary), 'su propio diario sí aparece');
    assert.ok(JSON.stringify((await http(SA, 'GET', '/api/messages')).body).includes(own.chat), 'su propio chat sí aparece');
  });

  await t.test('las guardas de rol no se abrieron: lado profesional, contexto y hojas de vida de la persona siguen negando a la superadministración', async () => {
    const before = await fingerprint(); const problems = [];
    const denied = [['GET', '/api/therapist/pacientes'], ['GET', `/api/therapist/pacientes/${A.id}/historial`], ['GET', '/api/reviewer/requests'], ['GET', '/api/user/context'], ['GET', '/api/user/resumes'], ['GET', '/api/user/resume-skills']];
    for (const [method, route] of denied) { const res = await http(SA, method, route); if (![401, 403, 404].includes(res.status)) problems.push(`${method} ${route} (superadmin): ${res.status}`); }
    for (const [method, route] of [['GET', '/api/admin/usuarios'], ['GET', '/api/admin/metrics']]) { // la persona y el profesional siguen sin administración
      for (const who of [A, T]) { const res = await http(who, method, route); if (res.status !== 403) problems.push(`${method} ${route} (${who.role}): ${res.status}`); }
    }
    assert.deepEqual(problems, []); assert.deepEqual(changed(before, await fingerprint()), [], 'la base no cambió');
    assert.equal((await http(SA, 'GET', '/api/admin/usuarios')).status, 200, 'control positivo: la superadministración sigue en administración');
  });
});
