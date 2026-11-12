// ES-281 (ES-189 PR-2) · Matriz A/B de propietario y rol por recurso, y contrato de crisis / diario / no compartir. HTTP REAL contra el server.js real, JWT real, PostgreSQL REAL, pool de 5.
//   ES281_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-281-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-281 PostgreSQL + HTTP: matriz A/B de propietario y rol, y contrato crisis/diario/no compartir (ES-189 PR-2)', { timeout: 600000 }, async (t) => {
  process.env.DATA_RIGHTS_ENABLED = 'true'; // la función de derechos de datos está detrás de un interruptor
  const { q, mkUser, http, MOUNTS, base, provider } = await startRealApi(t, { envVar: 'ES281_TEST_DATABASE_URL', prefix: 'es281' });

  // ── Utilidades ────────────────────────────────────────────────────────────────────────────────────────────────
  const seed = makeSeeder(q);
  // Huella de TODA la base: si una solicitud rechazada cambia una sola fila de cualquier tabla, la huella cambia.
  const tables = (await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")).map((r) => r.table_name);
  const fingerprint = async () => {
    const out = {};
    for (const table of tables) {
      if (table === 'SequelizeMeta') continue;
      out[table] = (await q(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h, count(*)::int AS n FROM "${table}" x`))[0];
    }
    return out;
  };
  const changed = (before, after) => Object.keys(before).filter((k) => before[k].h !== after[k].h);
  const NONEXISTENT = 2147483000; // entero válido que no existe

  // ── 3.1b · Matriz A/B por recurso de la persona ───────────────────────────────────────────────────────────────
  // A usa el id de una fila de B: 404 con EL MISMO estado y cuerpo que un id inexistente (sin oráculo de existencia), y la base no cambia en nada.
  // Control positivo: el dueño (B) sí encuentra su fila (no responde 404), así la prueba no pasa en vacío.
  const A = await mkUser('user'); const B = await mkUser('user');
  const T1 = await mkUser('therapist'); const T2 = await mkUser('therapist');
  const P = await mkUser('user', { therapistId: T1.id });
  const uuid = () => crypto.randomUUID();
  const RESOURCES = [
    { name: 'diario', make: (u) => seed('DiaryEntries', { UserId: u.id }),
      calls: (r) => [['GET', `/api/diary/${r.id}`], ['PUT', `/api/diary/${r.id}`, { content: 'Texto cambiado por A' }], ['DELETE', `/api/diary/${r.id}`]], control: (r) => `/api/diary/${r.id}` },
    { name: 'evidencia', make: async (u) => { const e = await seed('Evidence', { UserId: u.id }); await seed('EvidenceVersions', { EvidenceId: e.id, UserId: u.id, version: 1 }); return e; },
      calls: (r) => [['GET', `/api/evidence/${r.id}`], ['PUT', `/api/evidence/${r.id}`, { payload: { title: 'Cambiada por A', situation: 'x' }, status: 'draft', requestId: uuid(), baseVersion: 1 }], ['DELETE', `/api/evidence/${r.id}`]],
      control: (r) => `/api/evidence/${r.id}` },
    { name: 'hojas de vida', make: (u) => seed('ParticipantResumes', { UserId: u.id }),
      calls: (r) => [['GET', `/api/user/resumes/${r.id}/file`], ['DELETE', `/api/user/resumes/${r.id}`]], control: (r) => `/api/user/resumes/${r.id}/file` },
    { name: 'experimentos', make: async (u) => { const e = await seed('CareerExperiments', { UserId: u.id, currentVersion: 1 }); await seed('CareerExperimentVersions', { UserId: u.id, experimentId: e.id, version: 1 }); return e; },
      calls: (r) => [['GET', `/api/experiments/${r.id}`], ['GET', `/api/experiments/${r.id}/review-requests`], ['POST', `/api/experiments/${r.id}/review-requests`, { requestId: uuid(), expectedVersion: 1, action: 'withdraw', reviewId: 1 }], ['POST', `/api/experiments/${r.id}/versions`, { requestId: uuid(), expectedVersion: 1, change: { action: 'rebase' } }]],
      control: (r) => `/api/experiments/${r.id}` },
    { name: 'versiones del plan', make: (u) => seed('CareerPlanVersions', { UserId: u.id }),
      calls: (r) => [['GET', `/api/career-plan/versions/${r.id}`]], control: (r) => `/api/career-plan/versions/${r.id}` },
    { name: 'elecciones de ruta', make: (u) => seed('RouteChoices', { UserId: u.id, slot: 'continuity', decision: 'accepted', status: 'current' }),
      calls: (r) => [['GET', `/api/routes/choices/${r.id}`]], control: (r) => `/api/routes/choices/${r.id}` },
    { name: 'turnos de chat', make: (u) => seed('ChatTurns', { UserId: u.id, requestId: uuid() }),
      calls: (r) => [['GET', `/api/chat/turns/${r.requestId}`]], control: (r) => `/api/chat/turns/${r.requestId}`, missing: uuid() },
    { name: 'exportaciones', make: (u) => seed('ExportRequests', { UserId: u.id, id: uuid() }),
      calls: (r) => [['POST', `/api/exports/${r.id}/download`, {}]], control: null, missing: uuid() },
    { name: 'trabajos de análisis', make: (u) => seed('AiJobs', { UserId: u.id, kind: 'competency_extraction' }),
      calls: (r) => [['GET', `/api/skill-analysis/jobs/${r.id}`], ['POST', `/api/skill-analysis/jobs/${r.id}/cancel`, {}]], control: (r) => `/api/skill-analysis/jobs/${r.id}` },
    { name: 'candidatas de habilidad', make: async (u) => { const job = await seed('AiJobs', { UserId: u.id, kind: 'competency_extraction' }); return seed('SkillCandidates', { UserId: u.id, jobId: job.id }); },
      calls: (r) => [['POST', `/api/skill-analysis/candidates/${r.id}/review`, { action: 'reject' }]], control: null },
    { name: 'recomendaciones', make: (u) => seed('WellnessRecommendations', { UserId: u.id }),
      calls: (r) => [['PUT', `/api/recommendations/${r.id}/seen`, {}]], control: null },
    { name: 'sesión (la persona entra a la de otra)', make: (u) => seed('TherapySessions', { therapistId: T1.id, patientId: u.id, status: 'scheduled', scheduledAt: new Date(Date.now() + 3600000) }),
      calls: (r) => [['GET', `/api/sessions/user/${r.id}/join`]], control: null },
  ];
  const evaluate = async (label, actor, owner, make, calls, control, missing) => {
    const row = await make(owner);
    const gone = (path) => path.replace(String(row.requestId || row.id), String(missing || NONEXISTENT));
    const problems = [];
    for (const [method, path, body] of calls(row)) {
      const before = await fingerprint();
      const ajeno = await http(actor, method, path, body);
      const inexistente = await http(actor, method, gone(path), body);
      const after = await fingerprint();
      if (ajeno.status !== 404) problems.push(`${label} ${method} ${path}: respondió ${ajeno.status}, se esperaba 404 ${JSON.stringify(ajeno.body).slice(0, 80)}`);
      if (ajeno.status !== inexistente.status || JSON.stringify(ajeno.body) !== JSON.stringify(inexistente.body)) problems.push(`${label} ${method} ${path}: distingue ajeno de inexistente (${ajeno.status} ${JSON.stringify(ajeno.body).slice(0, 60)} vs ${inexistente.status} ${JSON.stringify(inexistente.body).slice(0, 60)})`);
      if (ajeno.status >= 500) problems.push(`${label} ${method} ${path}: 5xx`);
      const diff = changed(before, after);
      if (diff.length) problems.push(`${label} ${method} ${path}: cambió la base (${diff.join(', ')})`);
    }
    if (control) { const own = await http(owner, 'GET', control(row)); if (own.status === 404) problems.push(`${label}: control positivo, el dueño no encuentra su fila (404)`); }
    return problems;
  };

  await t.test('A usa el id de B en cada recurso de la persona: 404 igual al de un id inexistente, y la base no cambia en una sola fila', async () => {
    const problems = [];
    for (const r of RESOURCES) problems.push(...await evaluate(r.name, A, B, r.make, r.calls, r.control, r.missing));
    assert.deepEqual(problems, []);
  });

  // ── Lado profesional: otro profesional (T2) sobre filas de T1 y de su paciente P ────────────────────────────
  const PROFESSIONAL = [
    { name: 'sesión del profesional', make: () => seed('TherapySessions', { therapistId: T1.id, patientId: P.id, status: 'scheduled', scheduledAt: new Date(Date.now() + 3600000) }),
      calls: (r) => [['PUT', `/api/sessions/therapist/${r.id}`, { status: 'cancelled', cancelReason: 'x' }], ['POST', `/api/sessions/therapist/${r.id}/start`, {}],
        ['POST', `/api/sessions/therapist/${r.id}/end`, { therapistNote: 'x', patientMoodAfter: 3 }], ['GET', `/api/sessions/therapist/${r.id}/notes`], ['POST', `/api/sessions/therapist/${r.id}/notes`, { content: 'nota de T2' }]] },
    { name: 'nota de la ficha', make: () => seed('ClinicalNotes', { UserId: P.id, therapistId: T1.id }),
      calls: (r) => [['PUT', `/api/therapist/notas/${r.id}`, { content: 'cambiada por T2' }]] },
  ];
  await t.test('otro profesional (T2) sobre las filas de T1: 404 igual al de un id inexistente y la base no cambia', async () => {
    const problems = [];
    for (const r of PROFESSIONAL) problems.push(...await evaluate(r.name, T2, T1, r.make, r.calls, null));
    assert.deepEqual(problems, []);
  });

  await t.test('otro profesional (T2) sobre la persona P de T1 (con consentimiento): historia, historial, resumen y notas responden como si P no existiera', async () => {
    await q('INSERT INTO "Consents" ("UserId", purpose, scope, status, version, "decidedAt", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,1,now(),now(),now())', [P.id, 'therapist_sharing', `therapist-${T1.id}`, 'granted']);
    const problems = [];
    const routes = [['GET', 'historia'], ['GET', 'historial'], ['GET', 'resumen-ia'], ['POST', 'notas', { content: 'T2 escribe', sessionDate: '2026-10-01', type: 'session' }]];
    for (const [method, tail, body] of routes) {
      const before = await fingerprint();
      const ajeno = await http(T2, method, `/api/therapist/pacientes/${P.id}/${tail}`, body);
      const inexistente = await http(T2, method, `/api/therapist/pacientes/${NONEXISTENT}/${tail}`, body);
      const after = await fingerprint();
      if (ajeno.status !== 404) problems.push(`${method} ${tail}: ${ajeno.status}`);
      if (ajeno.status !== inexistente.status || JSON.stringify(ajeno.body) !== JSON.stringify(inexistente.body)) problems.push(`${method} ${tail}: distingue ajeno de inexistente`);
      if (changed(before, after).length) problems.push(`${method} ${tail}: cambió la base`);
      const dueno = await http(T1, method === 'GET' ? 'GET' : 'GET', `/api/therapist/pacientes/${P.id}/historial`);
      if (dueno.status === 404) problems.push('control positivo: T1 no encuentra a su paciente');
    }
    assert.deepEqual(problems, []);
  });

  // ── Matriz de roles: cada montaje con guarda de rol rechaza a quien no tiene ese rol ──────────────────────────
  // Recorre los montajes del server.js real: persona y profesional ante rutas de administración, administración ante las de superadministración, y nadie sin sesión ante nada protegido.
  // Siempre 401/403 (nunca 2xx ni 5xx) y la base no cambia en una sola fila.
  const auth = require('../../middlewares/auth');
  const adminUser = await mkUser('admin'); const superUser = await mkUser('superadmin');
  const GUARD_ROLES = new Map([[auth.verificarAdmin, ['user', 'therapist']], [auth.verificarSuperAdmin, ['user', 'therapist', 'admin']], [auth.verificarEditorManifiesto, ['user', 'therapist']], [auth.verificarTerapeuta, ['user']]]);
  const routesWithGuards = [];
  // E239-1 (ES-282): se leen las guardas de TRES sitios: las del montaje en server.js, las de router.use(guarda) (valen para las rutas que vienen después) y las puestas en la propia ruta.
  for (const mount of MOUNTS) {
    const denied = new Set(); let tokenGuarded = false;
    const apply = (fn, into) => { for (const role of (GUARD_ROLES.get(fn) || [])) into.denied.add(role); if (fn === auth.verificarToken) into.token = true; };
    const running = { denied, token: false };
    for (const fn of mount.guardFns) apply(fn, running);
    for (const layer of mount.router.stack) {
      if (!layer.route) { apply(layer.handle, running); continue; }
      const own = { denied: new Set(running.denied), token: running.token };
      for (const inner of layer.route.stack) apply(inner.handle, own);
      for (const method of Object.keys(layer.route.methods)) routesWithGuards.push({ method: method.toUpperCase(), path: (mount.prefix === '/' ? '' : mount.prefix) + layer.route.path, denied: [...own.denied], tokenGuarded: own.token || own.denied.size > 0 });
    }
  }
  // E239-1 (ES-282): la expectativa NO sale solo del código (si fuera así, quitar una guarda quitaría también la expectativa). El fixture routes-roles.json es la política escrita:
  // para cada ruta, qué roles se rechazan y si exige sesión. Cambiar una guarda o añadir una ruta obliga a editar el fixture a propósito (ES281_WRITE_FIXTURE=1).
  const rolesFixture = path.join(__dirname, '..', 'fixtures', 'routes-roles.json');
  const derived = {}; for (const r of routesWithGuards) derived[r.method + ' ' + r.path] = { denied: [...r.denied].sort(), session: r.tokenGuarded };
  if (process.env.ES281_WRITE_FIXTURE === '1') fs.writeFileSync(rolesFixture, JSON.stringify(Object.fromEntries(Object.entries(derived).sort(([x], [y]) => (x < y ? -1 : 1))), null, 2) + '\n');
  const policy = JSON.parse(fs.readFileSync(rolesFixture, 'utf8'));
  const fill = (path) => path.replace(/:(id|requestId|noteId)\b/g, String(NONEXISTENT)).replace(/:[A-Za-z]+/g, 'x');
  const BODY = (method) => (method === 'GET' || method === 'DELETE' ? undefined : {});
  const SKIP_ROLE = /\/(logout|logout-all|deletion-requests)$/;
  await t.test('política de roles cerrada: las guardas que lee el código coinciden con el fixture escrito (quitar una guarda o añadir una ruta sin declarar falla)', async () => {
    const problems = [];
    for (const [route, value] of Object.entries(derived)) { if (!policy[route]) problems.push('ruta sin política escrita: ' + route); else if (JSON.stringify(policy[route]) !== JSON.stringify(value)) problems.push(`guarda distinta de la política: ${route} código=${JSON.stringify(value)} política=${JSON.stringify(policy[route])}`); }
    for (const route of Object.keys(policy)) if (!derived[route]) problems.push('ruta de la política que ya no existe: ' + route);
    assert.deepEqual(problems, []);
  });

  await t.test('matriz de roles: 401/403 sin sesión en todo lo protegido; 403 al rol sin permiso en administración, superadministración, manifiesto y profesional; la base no cambia', async () => {
    const actors = { user: await mkUser('user'), therapist: await mkUser('therapist'), admin: adminUser };
    assert.ok(routesWithGuards.filter((r) => r.denied.length).length >= 75, 'rutas con guarda de rol: ' + routesWithGuards.filter((r) => r.denied.length).length);
    const problems = []; const before = await fingerprint(); let probes = 0;
    for (const r of routesWithGuards.map((x) => ({ ...x, ...policy[x.method + ' ' + x.path], tokenGuarded: policy[x.method + ' ' + x.path]?.session ?? x.tokenGuarded }))) {
      if (SKIP_ROLE.test(r.path)) continue;
      const url = fill(r.path);
      if (r.tokenGuarded) {
        const out = await http(null, r.method, url, BODY(r.method)); probes += 1;
        if (![401, 403].includes(out.status)) problems.push(`sin sesión ${r.method} ${r.path}: ${out.status}`);
      }
      for (const role of (policy[r.method + ' ' + r.path]?.denied ?? r.denied)) {
        const out = await http(actors[role], r.method, url, BODY(r.method)); probes += 1;
        if (out.status !== 403) problems.push(`${role} ${r.method} ${r.path}: ${out.status} ${JSON.stringify(out.body).slice(0, 70)}`);
      }
    }
    const diff = changed(before, await fingerprint());
    if (diff.length) problems.push('la base cambió: ' + diff.join(', '));
    assert.ok(probes > 300, 'solicitudes de la matriz: ' + probes);
    assert.deepEqual(problems, []);
  });

  // ── Cuerpo y consulta hostiles en TODAS las rutas (con y sin parámetro) ─────────────────────────────────────
  await t.test('cuerpo y consulta hostiles en todas las rutas: ni 5xx, ni detalle interno, y todo error lleva JSON', { skip: process.env.ES281_SKIP_HOSTILE === '1' ? 'ES281_SKIP_HOSTILE=1 (solo para repetir mutaciones más rápido)' : false }, async () => {
    const big = 'x'.repeat(20000);
    const BODIES = [null, [], 'texto', 123, { __proto__: { admin: true } }, JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}'), { id: 'abc', requestId: 12345, content: ['a'] }, { content: big, note: big }, { a: '\u0000\ud800', requestId: '\u0000' }, { price: 'NaN', order: Infinity }];
    const QUERIES = ['?x=1', '?limit=-1&after=abc&page=0', '?a[]=1&a[]=2&a[b]=3', '?id=2147483648&days=99999999999', '?q=%27%20OR%201%3D1--&sort=%00', '?after=' + 'z'.repeat(2000)];
    const LEAK = /SequelizeDatabaseError|invalid input syntax|out of range for type|violates|relation ".*" does not exist|PROMPT_ENCRYPTION|JWT_SECRET|DATA_ENCRYPTION|\n\s+at \w|node_modules|ECONN/i;
    const actors = [await mkUser('user'), await mkUser('therapist'), await mkUser('superadmin')];
    const problems = []; let probes = 0;
    const seen = new Set();
    for (const r of routesWithGuards) {
      const key = r.method + ' ' + r.path; if (seen.has(key) || SKIP_ROLE.test(r.path)) continue; seen.add(key);
      const url = fill(r.path);
      const jobs = [];
      if (r.method === 'GET') for (const query of QUERIES) jobs.push([url + query, undefined]);
      else for (const body of BODIES) jobs.push([url, body]);
      for (const [target, body] of jobs) {
        const outs = await Promise.all(actors.map(async (actor) => {
          try {
            const res = await fetch(`${base}${target}`, { method: r.method, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, ...(body === undefined || r.method === 'GET' ? {} : { body: typeof body === 'string' && body === 'texto' ? 'texto' : JSON.stringify(body) }) });
            const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
            return { actor, status: res.status, parsed, text };
          } catch (error) { return { actor, status: -1, parsed: null, text: String(error) }; }
        }));
        for (const out of outs) {
          probes += 1;
          // estados, no defectos de la entrada: catálogo vacío, función apagada o la salida del proveedor (un doble de prueba) que no cumple el esquema (502 controlado)
          const state = out.parsed && ((out.status === 503 && ['catalog_unavailable', 'data_rights_unavailable'].includes(out.parsed.code)) || (out.status === 502 && out.parsed.code === 'invalid_model_output'));
          const tag = `${r.method} ${r.path}${target.slice(url.length)} (${out.actor.role})`;
          if ((out.status >= 500 || out.status === -1) && !state) problems.push(`${tag} => ${out.status} ${out.text.slice(0, 60)}`);
          else if (out.status >= 400 && out.parsed === null && out.status !== 404) problems.push(`${tag} => ${out.status} sin JSON`);
          else if (LEAK.test(out.text)) problems.push(`${tag} => ${out.status} FILTRA ${out.text.slice(0, 60)}`);
        }
      }
    }
    assert.ok(probes > 1500, 'solicitudes hostiles: ' + probes);
    assert.deepEqual(problems.slice(0, 20), []);
  });

  // ── 3.2 y 3.3 · Contrato: crisis, diario y datos sin consentimiento nunca llegan al profesional, a administración, a terceros ni a los logs ───────────
  // Lista de campos prohibidos (aprobada por Infra en el comentario 11712 de ES-189; la prueba es su contrato escrito): cualquier clave diary*, risk*, crisis*, interrupted, y el contenido de los mensajes
  // (userContent, replyContent, reply, message[s]). Además, ningún dato de ánimo, valoración, correo o nombre de quien NO autorizó (o retiró) compartir con su profesional.
  const FORBIDDEN_KEY = /^(diary\w*|risk\w*|crisis\w*|interrupted|userContent|replyContent|reply|messages?)$/i;
  const keysOf = (value, out = new Set()) => { if (Array.isArray(value)) value.forEach((v) => keysOf(v, out)); else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.add(k); keysOf(v, out); } return out; };
  const capture = () => {
    const lines = []; const originals = {};
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) { originals[level] = console[level]; console[level] = (...args) => { lines.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); }; }
    return { lines, restore: () => { for (const level of Object.keys(originals)) console[level] = originals[level]; } };
  };

  await t.test('contrato: datos canario de crisis y diario no aparecen en NINGUNA respuesta del profesional, de administración ni de agregados, ni en los logs, ni en lo que se envía a la IA; sin consentimiento solo lo mínimo', async () => {
    const stamp = crypto.randomBytes(4).toString('hex');
    const therapist = await mkUser('therapist'); const sup = await mkUser('superadmin');
    const people = {};
    for (const key of ['con', 'sin', 'revocado']) {
      const person = await mkUser('user', { therapistId: therapist.id });
      const canary = { diary: `CANARIO-DIARIO-${key}-${stamp}`, crisis: `CANARIO-CRISIS-${key}-${stamp}`, chat: `CANARIO-CHAT-${key}-${stamp}`, name: `CanarioNombre${key}${stamp}`, email: `canario-${key}-${stamp}@example.test` };
      await q('UPDATE "Users" SET name=$2, email=$3 WHERE id=$1', [person.id, canary.name, canary.email]);
      people[key] = { ...person, canary };
    }
    const logs = capture();
    let forbiddenInAi; let providerCallsAroundCrisis;
    try {
      for (const key of ['con', 'revocado']) { // la persona autoriza compartir con SU profesional por la API real
        assert.equal((await http(people[key], 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200, 'autorizar ' + key);
      }
      for (const [key, person] of Object.entries(people)) {
        const c = person.canary;
        assert.equal((await http(person, 'POST', '/api/diary', { date: '2026-10-01', content: c.diary })).status, 201);
        assert.equal((await http(person, 'POST', '/api/mood/checkin', { mood: 1 })).status, 200);
        assert.equal((await http(person, 'POST', '/api/rating', { rating: 1 })).status, 200);
        const before = provider.calls;
        const crisis = await http(person, 'POST', '/api/chat', { message: `Quiero morir ${c.crisis}`, requestId: crypto.randomUUID() });
        assert.equal(crisis.status, 200); assert.equal(crisis.body.interrupted, true, 'la frase de crisis interrumpe el flujo');
        providerCallsAroundCrisis = [...(providerCallsAroundCrisis || []), provider.calls - before];
        assert.equal((await http(person, 'POST', '/api/chat', { message: `Hoy me siento cansado ${c.chat}`, requestId: crypto.randomUUID() })).status, 200);
      }
      // A mitad de camino, quien había autorizado retira la autorización. Lecturas en curso pueden terminar; ninguna que EMPIECE después puede ver datos.
      const racing = Promise.all(Array.from({ length: 6 }, () => http(therapist, 'GET', `/api/therapist/pacientes/${people.revocado.id}/historial`)));
      assert.equal((await http(people.revocado, 'PUT', '/api/consents/therapist_sharing', { status: 'revoked' })).status, 200);
      await racing;
      const afterRevoke = await http(therapist, 'GET', `/api/therapist/pacientes/${people.revocado.id}/historial`);
      assert.equal(afterRevoke.status, 403); assert.equal(afterRevoke.body.code, 'consent_required');

      // Todas las lecturas de profesional, administración y agregados
      const reads = [];
      const read = async (label, actor, path) => { const out = await http(actor, 'GET', path); reads.push({ label, ...out, text: JSON.stringify(out.body) }); return out; };
      await read('lista', therapist, '/api/therapist/pacientes'); await read('alertas', therapist, '/api/therapist/alerts');
      await read('sesiones', therapist, '/api/sessions/therapist'); await read('próximas', therapist, '/api/sessions/therapist/upcoming');
      for (const [key, person] of Object.entries(people)) for (const tail of ['historial', 'historia', 'resumen-ia']) await read(`${tail} ${key}`, therapist, `/api/therapist/pacientes/${person.id}/${tail}`);
      for (const [key, person] of Object.entries(people)) await read(`stats ${key}`, sup, `/api/admin/usuarios/${person.id}/stats`);
      for (const path of ['/api/admin/usuarios', '/api/admin/usuarios/alerts', '/api/admin/metrics', '/api/superadmin/ai-usage', '/api/superadmin/audit', '/api/admin/pricing', '/api/admin/matching/pending']) await read(path, sup, path);
      assert.ok(reads.filter((r) => r.status === 200).length >= 15, 'lecturas válidas: ' + reads.filter((r) => r.status === 200).length);

      const allCanaries = Object.values(people).flatMap((p) => [p.canary.diary, p.canary.crisis, p.canary.chat]);
      const problems = [];
      for (const r of reads) {
        for (const c of allCanaries) if (r.text.includes(c)) problems.push(`${r.label}: contiene el canario ${c}`);
        for (const key of keysOf(r.body)) if (FORBIDDEN_KEY.test(key)) problems.push(`${r.label}: clave prohibida «${key}»`);
        if (r.text.includes('Quiero morir')) problems.push(`${r.label}: contiene la frase de crisis`);
      }
      // Sin consentimiento (nunca o retirado): nada identificable ni de ánimo/valoración en ninguna respuesta del profesional
      for (const r of reads.filter((x) => /^(lista|alertas|sesiones|próximas|historial|historia|resumen-ia)/.test(x.label))) {
        for (const key of ['sin', 'revocado']) {
          const c = people[key].canary;
          if (r.text.includes(c.name) || r.text.includes(c.email)) problems.push(`${r.label}: nombre o correo de «${key}» sin autorización`);
        }
      }
      for (const key of ['sin', 'revocado']) {
        const entry = reads.find((r) => r.label === 'lista').body.find((e) => e.id === people[key].id);
        assert.ok(entry, 'la persona sin autorización sigue en la lista, solo como «Persona n»');
        assert.deepEqual({ ...entry, id: 0, ordinal: 0, createdAt: null }, { id: 0, name: null, ordinal: 0, email: '', active: true, createdAt: null, sharing: false, lastMood: null, moodTrend: 'neutral', avgRating: null, totalSessions: 0, sessionsThisWeek: 0, trend: null }, 'mínimo para ' + key);
        for (const tail of ['historial', 'historia', 'resumen-ia']) { const r = reads.find((x) => x.label === `${tail} ${key}`); assert.equal(r.status, 403, `${tail} ${key}`); assert.equal(r.body.code, 'consent_required'); }
        const note = await http(therapist, 'POST', `/api/therapist/pacientes/${people[key].id}/notas`, { content: 'nota', sessionDate: '2026-10-01', type: 'session' });
        assert.equal(note.status, 403, 'no se escriben notas sobre quien no autorizó');
        const scheduled = await http(therapist, 'POST', '/api/sessions/therapist', { patientId: people[key].id, scheduledAt: new Date(Date.now() + 86400000).toISOString() });
        assert.equal(scheduled.status, 403, 'no se agenda con quien no autorizó'); assert.equal(scheduled.body.code, 'consent_required');
      }
      // Con autorización sí hay datos (control positivo: la prueba no pasa en vacío) y aun así sin crisis ni diario
      const conEntry = reads.find((r) => r.label === 'lista').body.find((e) => e.id === people.con.id);
      assert.equal(conEntry.sharing, true); assert.equal(conEntry.name, people.con.canary.name);
      assert.equal(reads.find((r) => r.label === 'historial con').status, 200);
      assert.deepEqual(problems, []);
      forbiddenInAi = provider.requests.join('\n');
    } finally { logs.restore(); }

    // La IA y los logs
    assert.deepEqual(providerCallsAroundCrisis, [0, 0, 0], 'la frase de crisis no se envía al proveedor de IA (ES-21)');
    for (const p of Object.values(people)) assert.ok(!forbiddenInAi.includes(p.canary.diary), 'a la IA no llega el diario de ' + p.canary.diary);
    // E281-1 (decisión pendiente, ver el PR): el turno de crisis NO llama a la IA, pero la frase queda en el HISTORIAL del chat y viaja al proveedor en el SIGUIENTE mensaje ordinario de la misma persona.
    // Se fija ese único camino: cualquier otra solicitud a la IA que lleve la frase (resumen, recomendaciones, puente, análisis) hace fallar la prueba.
    const withCrisis = provider.requests.map((x) => JSON.parse(x)).filter((j) => Object.values(people).some((p) => JSON.stringify(j).includes(p.canary.crisis)));
    assert.equal(withCrisis.length, 3, 'solo el siguiente mensaje de chat de cada persona lleva la frase en su historial');
    for (const j of withCrisis) { assert.ok(String(j.system).startsWith('You are Elevation'), 'es una solicitud de chat'); assert.equal(j.messages[j.messages.length - 1].role, 'user'); assert.deepEqual(Object.keys(j).sort(), ['max_tokens', 'messages', 'model', 'output_config', 'system'], 'ninguna marca de riesgo viaja como parámetro'); }
    for (const p of Object.values(people)) assert.ok(!forbiddenInAi.includes(p.canary.email), 'a la IA no llega el correo');
    const logText = logs.lines.join('\n');
    for (const c of Object.values(people).flatMap((p) => [p.canary.diary, p.canary.crisis, p.canary.chat])) assert.ok(!logText.includes(c), 'los logs no llevan ' + c);
    assert.ok(!logText.includes('Quiero morir'), 'los logs no llevan la frase de crisis');
  });

  await t.test('el nivel de riesgo no se persiste: ninguna columna de la base guarda riesgo, crisis ni interrupción', async () => {
    const columns = await q("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* '(risk|crisis|interrupt|riesgo|suicid)'");
    assert.deepEqual(columns, []);
  });
});
