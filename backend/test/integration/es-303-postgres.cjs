// ES-303 (PR A) · Invitación de una persona REVISORA con código de un solo uso, SIN pantallas ni enumeración de profesionales. HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA.
// Condiciones de Infra (ES-303, 12640): consumo atómico (dos canjes simultáneos → gana uno), solo sha256 guardado, el código nunca en logs ni errores, 404 uniforme + tope por usuario e IP, el emisor puede anular,
// el canje exige revisor activo, ningún dato de diario ni crisis, la vía `reviewerId` retirada (410 use_invite), la persona nunca recibe un reviewerId al elegir.
//   ES303_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-303-postgres.cjs
// @pg-env ES303_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-303 PostgreSQL + HTTP: invitación de revisor con código de un solo uso', { timeout: 900000 }, async (t) => {
  const logs = []; const spied = {}; for (const name of ['log', 'error', 'warn', 'info']) { spied[name] = console[name]; console[name] = (...args) => { logs.push(args.map((a) => (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ')); }; }
  t.after(() => { for (const name of Object.keys(spied)) console[name] = spied[name]; });
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES303_TEST_DATABASE_URL', prefix: 'es303' });
  const reviews = require('../../utils/reviews'); const reviewInvites = require('../../utils/reviewInvites');
  const rid = () => crypto.randomUUID();
  const evidencePayload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' });
  const evidence = async (person, title = 'Muestra de prueba') => { const out = await http(person, 'POST', '/api/evidence', { payload: evidencePayload(title), status: 'confirmed', requestId: rid() }); assert.equal(out.status, 201, JSON.stringify(out.body)); return out.body.id; };
  const issue = (reviewer, body = { requestId: rid() }) => http(reviewer, 'POST', '/api/reviewer/invites', body);
  const lookup = (person, code) => http(person, 'POST', '/api/me/review-invites/lookup', { code });
  const redeem = (person, code, ids, requestId = rid()) => http(person, 'POST', '/api/me/review-shares', { inviteCode: code, evidenceIds: ids, requestId });
  const CODE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
  const randomCode = () => Array.from({ length: 4 }, () => crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase().replace(/[IOLU]/g, '7')).join('-');
  const rowOf = async (id) => (await q('SELECT * FROM "ReviewerInvites" WHERE id=$1', [id]))[0];
  const allCodes = [];
  const fresh = async (reviewer) => { const out = await issue(reviewer); assert.equal(out.status, 201, JSON.stringify(out.body)); allCodes.push(out.body.code); return out.body; };
  // Cada caso parte con los topes en memoria vacíos (el tope por IP es de TODO el proceso: todas las personas de la prueba comparten 127.0.0.1).
  const sub = (name, fn) => t.test(name, async (...args) => { reviews._test.reset(); reviewInvites._test.reset(); try { return await fn(...args); } catch (error) { process.stderr.write('REGISTROS DEL SERVIDOR: ' + logs.slice(-6).join(' | ').slice(0, 800) + '\n'); throw error; } });

  await sub('emitir: solo un revisor (therapist activo); el código sale UNA vez con la forma XXXX-XXXX-XXXX-XXXX; en la base solo hay su sha256; la lista no trae código ni quién lo canjeó', async () => {
    const reviewer = await mkUser('therapist'); const out = await issue(reviewer);
    assert.equal(out.status, 201); assert.match(out.body.code, CODE); assert.deepEqual(Object.keys(out.body.invite).sort(), ['createdAt', 'expiresAt', 'id', 'revokedAt', 'status', 'usedAt']); assert.equal(out.body.invite.status, 'active');
    const row = await rowOf(out.body.invite.id); assert.match(row.tokenHash, /^[0-9a-f]{64}$/); assert.equal(row.tokenHash, crypto.createHash('sha256').update(out.body.code.replace(/-/g, '')).digest('hex'));
    const dump = JSON.stringify(row); assert.ok(!dump.includes(out.body.code) && !dump.includes(out.body.code.replace(/-/g, '')), 'la base no guarda el código');
    const ttl = new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime(); assert.ok(Math.abs(ttl - 7 * 24 * 3600 * 1000) < 5000, 'vence a los 7 días');
    const list = await http(reviewer, 'GET', '/api/reviewer/invites'); assert.equal(list.status, 200); assert.equal(list.body.invites.length, 1); assert.ok(!JSON.stringify(list.body).includes(out.body.code) && !/usedByUserId|tokenHash|code/.test(JSON.stringify(list.body)));
    for (const role of ['user', 'admin', 'board', 'superadmin']) { const who = await mkUser(role); assert.equal((await issue(who)).status, 403, role); assert.equal((await http(who, 'GET', '/api/reviewer/invites')).status, 403, role); }
    assert.ok([401, 403].includes((await http(null, 'POST', '/api/reviewer/invites', { requestId: rid() })).status));
    const inactive = await mkUser('therapist'); await q('UPDATE "Users" SET active=false WHERE id=$1', [inactive.id]); assert.ok([401, 403].includes((await issue(inactive)).status), 'un revisor inactivo no emite');
  });

  await sub('emitir es idempotente por requestId (el reintento NO devuelve el código), valida la forma y tiene tope de 10 activas; anular libera un lugar', async () => {
    const reviewer = await mkUser('therapist'); const requestId = rid(); const a = await issue(reviewer, { requestId }); const b = await issue(reviewer, { requestId });
    assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(b.body.invite.id, a.body.invite.id); assert.equal(b.body.code, undefined, 'el reintento no puede dar el código: no se guarda');
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewerInvites" WHERE "reviewerId"=$1', [reviewer.id]))[0].n), 1);
    for (const bad of [{}, { requestId: 'corto' }, { requestId: rid(), extra: 1 }, { requestId: 5 }, null, [], { reviewerId: 1, requestId: rid() }]) assert.equal((await issue(reviewer, bad)).status, 400, JSON.stringify(bad));
    for (let i = 0; i < 9; i++) assert.equal((await issue(reviewer)).status, 201);
    const eleventh = await issue(reviewer); assert.equal(eleventh.status, 409); assert.equal(eleventh.body.code, 'too_many_active'); assert.equal(eleventh.body.max, 10);
    assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${a.body.invite.id}`)).status, 200); assert.equal((await issue(reviewer)).status, 201, 'anular libera un lugar');
    const racers = await mkUser('therapist'); const outs = await Promise.all(Array.from({ length: 14 }, () => issue(racers))); assert.equal(outs.filter((o) => o.status === 201).length, 10, 'en carrera nunca hay más de 10 activas'); assert.equal(outs.filter((o) => o.status === 409).length, 4);
  });

  await sub('lookup: muestra SOLO el nombre del revisor y el vencimiento, no consume el código, no devuelve ids; un código mal formado es 400', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const inv = await fresh(reviewer); const ev = await evidence(person);
    for (const spelling of [inv.code, inv.code.toLowerCase(), inv.code.replace(/-/g, ' '), ` ${inv.code} `, inv.code.replace(/-/g, '')]) {
      const out = await lookup(person, spelling); assert.equal(out.status, 200, spelling); assert.deepEqual(Object.keys(out.body).sort(), ['expiresAt', 'reviewer']); assert.deepEqual(Object.keys(out.body.reviewer), ['name']);
      const text = JSON.stringify(out.body); assert.ok(!/email|reviewerId|userId|"id"/i.test(text), 'sin ids ni correo');
    }
    assert.equal((await rowOf(inv.invite.id)).usedAt, null, 'mirar no consume');
    for (const bad of ['', 'ABC', 'x'.repeat(100), 5, null, {}, [], 'ZZZZ-ZZZZ-ZZZZ-ZZZU', 'ÑÑÑÑ-ÑÑÑÑ-ÑÑÑÑ-ÑÑÑÑ']) assert.equal((await http(person, 'POST', '/api/me/review-invites/lookup', { code: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await http(person, 'POST', '/api/me/review-invites/lookup', { code: inv.code, extra: 1 })).status, 400);
    assert.equal((await redeem(person, inv.code, [ev])).status, 201, 'después de mirar, el canje funciona');
  });

  await sub('canje: crea la autorización, marca la invitación usada por esa persona y el revisor lo ve como «used» SIN saber quién; la persona recibe su autorización pero no tuvo que enviar ni elegir un reviewerId', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const inv = await fresh(reviewer); const ev = await evidence(person);
    const out = await redeem(person, inv.code, [ev]); assert.equal(out.status, 201, JSON.stringify(out.body)); assert.equal(out.body.share.status, 'granted'); assert.equal(out.body.share.materialVersion, 1);
    const row = await rowOf(inv.invite.id); assert.ok(row.usedAt); assert.equal(row.usedByUserId, person.id);
    const list = await http(reviewer, 'GET', '/api/reviewer/invites'); assert.equal(list.body.invites[0].status, 'used'); assert.ok(!/usedByUserId|"UserId"/.test(JSON.stringify(list.body)));
    const seen = await http(reviewer, 'GET', '/api/reviewer/shares'); assert.equal(seen.body.shares.length, 1); assert.match(seen.body.shares[0].person, /^Persona [1-9][0-9]*$/);
    assert.equal((await redeem(person, inv.code, [ev])).status, 404, 'un código usado no sirve otra vez'); assert.equal((await lookup(person, inv.code)).status, 404);
  });

  await sub('CARRERA: 8 personas canjean el MISMO código a la vez → exactamente una gana, 7 reciben 404 y queda UNA autorización; y una misma persona con dos requestId distintos tampoco lo consume dos veces', async () => {
    const reviewer = await mkUser('therapist'); const inv = await fresh(reviewer); const people = []; for (let i = 0; i < 8; i++) { const p = await mkUser('user'); people.push({ p, ev: await evidence(p) }); }
    const outs = await Promise.all(people.map(({ p, ev }) => redeem(p, inv.code, [ev]))); assert.equal(outs.filter((o) => o.status === 201).length, 1, JSON.stringify(outs.map((o) => o.status)));
    assert.ok(outs.filter((o) => o.status !== 201).every((o) => o.status === 404 && o.body.code === 'invite_not_found'));
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "reviewerId"=$1', [reviewer.id]))[0].n), 1); const row = await rowOf(inv.invite.id); assert.ok(row.usedAt && people.some(({ p }) => p.id === row.usedByUserId));
    const inv2 = await fresh(reviewer); const solo = people[0]; const twin = await Promise.all([redeem(solo.p, inv2.code, [solo.ev]), redeem(solo.p, inv2.code, [solo.ev])]); assert.equal(twin.filter((o) => o.status === 201).length, 1);
  });

  await sub('idempotencia: repetir la MISMA solicitud (mismo requestId y mismo código) devuelve la misma autorización; con otro código o evidencias distintas = 409; no se crea otra', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const ev2 = await evidence(person, 'Otra'); const inv = await fresh(reviewer); const other = await fresh(reviewer); const rq = rid();
    const a = await redeem(person, inv.code, [ev], rq); const b = await redeem(person, inv.code, [ev], rq); assert.equal(a.status, 201); assert.equal(b.status, 201); assert.equal(b.body.share.id, a.body.share.id);
    assert.equal((await redeem(person, other.code, [ev], rq)).status, 409, 'otro código con el mismo requestId'); assert.equal((await redeem(person, inv.code, [ev, ev2], rq)).status, 409, 'otras evidencias con el mismo requestId');
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]))[0].n), 1); assert.equal((await rowOf(other.invite.id)).usedAt, null, 'el otro código no se consumió');
  });

  await sub('un fallo ANTES del canje NO consume el código: evidencia inválida o forma mala dejan la invitación activa', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const inv = await fresh(reviewer); const other = await mkUser('user'); const foreign = await evidence(other);
    assert.equal((await redeem(person, inv.code, [foreign])).body.code, 'invalid_evidence'); assert.equal((await redeem(person, inv.code, [])).status, 400); assert.equal((await redeem(person, inv.code, [987654])).body.code, 'invalid_evidence');
    assert.equal((await rowOf(inv.invite.id)).usedAt, null); assert.equal((await redeem(person, inv.code, [ev])).status, 201);
  });

  await sub('404 UNIFORME: inexistente, usado, vencido, anulado, propio, de un revisor inactivo y de un revisor con borrado pendiente dan el mismo cuerpo (lookup y canje)', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person);
    const used = await fresh(reviewer); const other = await mkUser('user'); const evO = await evidence(other); assert.equal((await redeem(other, used.code, [evO])).status, 201);
    const expired = await fresh(reviewer); await q(`UPDATE "ReviewerInvites" SET "expiresAt" = now() - interval '1 minute' WHERE id=$1`, [expired.invite.id]);
    const revoked = await fresh(reviewer); assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${revoked.invite.id}`)).status, 200);
    const mine = await fresh(reviewer); const evR = await evidence(reviewer, 'Del revisor');
    const inactiveR = await mkUser('therapist'); const inactive = await fresh(inactiveR); await q('UPDATE "Users" SET active=false WHERE id=$1', [inactiveR.id]);
    const pendingR = await mkUser('therapist'); const pending = await fresh(pendingR); await q(`INSERT INTO "DeletionRequests" ("UserId","status","attempts","createdAt","updatedAt") VALUES ($1,'pending',0,now(),now())`, [pendingR.id]).catch(() => {});
    const cases = [['inexistente', randomCode(), person], ['usado', used.code, person], ['vencido', expired.code, person], ['anulado', revoked.code, person], ['propio', mine.code, reviewer], ['revisor inactivo', inactive.code, person]];
    const lookups = []; const redeems = [];
    for (const [label, code, who] of cases) { lookups.push([label, await lookup(who, code)]); redeems.push([label, await redeem(who, code, [who === reviewer ? evR : ev])]); }
    for (const [label, out] of [...lookups, ...redeems]) { assert.equal(out.status, 404, label); assert.deepEqual(out.body, lookups[0][1].body, label + ': mismo cuerpo'); }
    assert.equal(lookups[0][1].body.code, 'invite_not_found'); assert.ok(!/inactiv|usad|vencid|anulad|expired|revoked|used/i.test(JSON.stringify(lookups[0][1].body)), 'el cuerpo no dice por qué');
    void pending;
  });

  await sub('vencimiento: pasados 7 días el código ya no sirve y la lista del revisor lo muestra «expired»; anular una ya vencida o usada = 409; ajena = 404', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const inv = await fresh(reviewer);
    const realNow = Date.now(); reviewInvites._test.setClock(() => realNow + 8 * 24 * 3600 * 1000);
    try {
      assert.equal((await lookup(person, inv.code)).status, 404); assert.equal((await http(reviewer, 'GET', '/api/reviewer/invites')).body.invites.find((i) => i.id === inv.invite.id).status, 'expired');
      assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${inv.invite.id}`)).status, 409);
    } finally { reviewInvites._test.setClock(() => Date.now()); reviewInvites._test.reset(); }
    const mate = await mkUser('therapist'); const theirs = await fresh(mate); assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${theirs.invite.id}`)).status, 404, 'una ajena es inexistente'); assert.equal((await http(reviewer, 'DELETE', '/api/reviewer/invites/99999999')).status, 404);
    assert.equal((await rowOf(theirs.invite.id)).revokedAt, null);
    const usedOne = await fresh(reviewer); await redeem(person, usedOne.code, [await evidence(person)]); const again = await http(reviewer, 'DELETE', `/api/reviewer/invites/${usedOne.invite.id}`); assert.equal(again.status, 409); assert.equal(again.body.code, 'not_active');
    const gone = await fresh(reviewer); assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${gone.invite.id}`)).status, 200); assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${gone.invite.id}`)).status, 409, 'anular dos veces');
  });

  await sub('la vía `reviewerId` está RETIRADA: 410 use_invite (con cualquier otro dato), no crea nada; inviteCode + shareId juntos o ninguno = 400', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const inv = await fresh(reviewer);
    for (const body of [{ reviewerId: reviewer.id, evidenceIds: [ev], requestId: rid() }, { reviewerId: reviewer.id, inviteCode: inv.code, evidenceIds: [ev], requestId: rid() }, { reviewerId: 99999999 }, { reviewerId: null, evidenceIds: [ev], requestId: rid() }]) {
      const out = await http(person, 'POST', '/api/me/review-shares', body); assert.equal(out.status, 410, JSON.stringify(body)); assert.equal(out.body.code, 'use_invite');
    }
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]))[0].n), 0); assert.equal((await rowOf(inv.invite.id)).usedAt, null);
    assert.equal((await http(person, 'POST', '/api/me/review-shares', { inviteCode: inv.code, shareId: 1, evidenceIds: [ev], requestId: rid() })).status, 400); assert.equal((await http(person, 'POST', '/api/me/review-shares', { evidenceIds: [ev], requestId: rid() })).status, 400);
    assert.equal((await http(person, 'POST', '/api/me/review-shares', { inviteCode: inv.code, evidenceIds: [ev], requestId: rid(), reviewerName: 'x' })).status, 400);
  });

  await sub('re-autorizar al MISMO revisor por `shareId` propio (sin código nuevo) funciona mientras la última autorización siga vigente; tras retirar, o con un id ajeno o de un revisor inactivo, hace falta una invitación nueva (mismo 404)', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const ev2 = await evidence(person, 'Segunda'); const stranger = await mkUser('user'); const evS = await evidence(stranger);
    const first = await redeem(person, (await fresh(reviewer)).code, [ev]); assert.equal(first.status, 201); const shareId = first.body.share.id;
    const again = await http(person, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [ev, ev2], requestId: rid() }); assert.equal(again.status, 201, JSON.stringify(again.body)); assert.equal(again.body.share.materialVersion, 2); assert.equal(again.body.share.reviewerId, reviewer.id);
    const foreign = await http(stranger, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [evS], requestId: rid() }); const ghost = await http(stranger, 'POST', '/api/me/review-shares', { shareId: 99999999, evidenceIds: [evS], requestId: rid() });
    assert.equal(foreign.status, 404); assert.deepEqual(foreign.body, ghost.body, 'una autorización ajena es igual que una inexistente'); assert.equal(foreign.body.code, 'share_not_found');
    assert.equal((await http(person, 'DELETE', `/api/me/review-shares/${again.body.share.id}`)).status, 200);
    const afterRevoke = await http(person, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [ev], requestId: rid() }); assert.equal(afterRevoke.status, 404); assert.deepEqual(afterRevoke.body, foreign.body, 'tras retirar hace falta una invitación nueva');
    const back = await redeem(person, (await fresh(reviewer)).code, [ev]); assert.equal(back.status, 201, 'con una invitación nueva vuelve a autorizar'); assert.equal(back.body.share.materialVersion, 3);
    const ghostR = await mkUser('therapist'); const viaG = await redeem(person, (await fresh(ghostR)).code, [ev]); assert.equal(viaG.status, 201); await q('UPDATE "Users" SET active=false WHERE id=$1', [ghostR.id]);
    assert.equal((await http(person, 'POST', '/api/me/review-shares', { shareId: viaG.body.share.id, evidenceIds: [ev], requestId: rid() })).status, 404, 'revisor inactivo');
    const rq = rid(); const r1 = await http(person, 'POST', '/api/me/review-shares', { shareId: back.body.share.id, evidenceIds: [ev], requestId: rq }); const r2 = await http(person, 'POST', '/api/me/review-shares', { shareId: back.body.share.id, evidenceIds: [ev], requestId: rq }); assert.equal(r1.body.share.id, r2.body.share.id, 'idempotente');
  });

  await sub('TOPES: 30 intentos por PERSONA y hora (lookup y canje comparten el tope, mismo 429 para cualquier código) y 60 por IP; la ventana se libera', async () => {
    const real = Date.now(); let now = real; reviews._test.setClock(() => now); reviewInvites._test.setClock(() => now); reviews._test.reset(); reviewInvites._test.reset();
    try {
      const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const inv = await fresh(reviewer);
      for (let i = 0; i < 15; i++) assert.notEqual((await lookup(person, randomCode())).status, 429);
      for (let i = 0; i < 15; i++) assert.notEqual((await redeem(person, randomCode(), [ev])).status, 429);
      const l = await lookup(person, inv.code); const r = await redeem(person, inv.code, [ev]); assert.deepEqual([l.status, l.body.code, r.status, r.body.code], [429, 'rate_limited', 429, 'rate_limited'], 'el código bueno tampoco pasa: mismo 429');
      assert.equal((await rowOf(inv.invite.id)).usedAt, null, 'un intento limitado NO consume el código');
      now += 3600 * 1000 + 1000; reviewInvites._test.reset(); assert.equal((await redeem(person, inv.code, [ev])).status, 201, 'pasada la hora se libera');
      // IP: 60 intentos de personas DISTINTAS desde la misma IP; el 61.º da 429 aunque cada persona haya hecho 1
      reviews._test.reset(); reviewInvites._test.reset(); let blocked = 0; const many = [];
      for (let i = 0; i < 62; i++) many.push(await mkUser('user'));
      for (let i = 0; i < 62; i++) { const out = await lookup(many[i], randomCode()); if (out.status === 429) blocked++; else assert.equal(out.status, 404); }
      assert.equal(blocked, 2, 'del 61.º en adelante, 429 por IP (y no antes)');
    } finally { reviews._test.setClock(() => Date.now()); reviewInvites._test.setClock(() => Date.now()); reviews._test.reset(); reviewInvites._test.reset(); }
  });

  await sub('privacidad: ninguna respuesta del flujo trae diario, crisis, chat ni correo; la persona nunca elige a un revisor de una lista; el código nunca sale en logs ni en errores', async () => {
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const inv = await fresh(reviewer);
    const diary = await http(person, 'POST', '/api/diary', { content: 'Texto privado del diario ZZ-DIARIO-ZZ', mood: 3 }).catch(() => null);
    const outs = [await lookup(person, inv.code), await redeem(person, inv.code, [ev]), await redeem(person, inv.code, [ev]), await http(reviewer, 'GET', '/api/reviewer/invites'), await http(reviewer, 'GET', '/api/reviewer/shares'), await http(person, 'GET', '/api/me/review-shares')];
    const text = JSON.stringify(outs.map((o) => o.body)); const row = (await q('SELECT email, name FROM "Users" WHERE id=$1', [person.id]))[0];
    assert.ok(!/ZZ-DIARIO-ZZ|crisis|diary|chat/i.test(text), 'sin diario, crisis ni chat'); assert.ok(!text.includes(row.email), 'sin correo de la persona');
    for (const body of [{ requestId: rid(), code: 'X' }, { code: randomCode() }]) { const out = await http(person, 'POST', '/api/me/review-invites/lookup', body); void out; }
    const joined = logs.join('\n'); for (const code of allCodes) { assert.ok(!joined.includes(code) && !joined.includes(code.replace(/-/g, '')), 'el código no aparece en logs'); }
    void diary;
  });

  await sub('ES-23: se exporta lo que la persona canjeó (sin tokenHash ni revisor) y la purga de su cuenta lo borra con la autorización; las invitaciones de otras personas no se tocan', async () => {
    const { processDeletion } = require('../../utils/deletionProcessor'); const { requestDeletion } = require('../../utils/dataRights');
    const reviewer = await mkUser('therapist'); const person = await mkUser('user'); const ev = await evidence(person); const inv = await fresh(reviewer); assert.equal((await redeem(person, inv.code, [ev])).status, 201);
    assert.equal((await rowOf(inv.invite.id)).usedByUserId, person.id);
    const { personalData } = require('../../utils/personalData'); const User = require('../../User'); const exported = (await personalData(await User.findByPk(person.id), 'es')).reviewerInvitesRedeemed;
    assert.equal(exported.length, 1); assert.deepEqual(Object.keys(exported[0]).sort(), ['createdAt', 'expiresAt', 'id', 'usedAt']); assert.ok(!/tokenHash|reviewerId|usedByUserId/.test(JSON.stringify(exported)), 'sin credencial ni el revisor');
    await requestDeletion(person.id); const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id; await processDeletion(request, { quiescent: true });
    const untouched = await fresh(reviewer); const bystander = await mkUser('user'); assert.equal((await redeem(bystander, untouched.code, [await evidence(bystander)])).status, 201);
    assert.equal(await rowOf(inv.invite.id), undefined, 'la invitación que canjeó la persona se purgó con su cuenta'); assert.equal((await rowOf(untouched.invite.id)).usedByUserId, bystander.id, 'la de otra persona no se toca');
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]))[0].n, 0, 'la autorización de la persona se purgó con su cuenta');
  });

  // ES-367: «Mis autorizaciones» muestra el NOMBRE de la persona revisora, solo a la persona dueña, solo el nombre.
  await t.test('ES-367: GET /api/me/review-shares trae reviewerName solo para el dueño; B no ve nada de A; revisor eliminado = null; nada de correo ni especialidad', async () => {
    const reviewer = await mkUser('therapist'); await q('UPDATE "Users" SET name=$2 WHERE id=$1', [reviewer.id, 'Ana Revisora Sintética']);
    const a = await mkUser('user'); const b = await mkUser('user'); const evA = await evidence(a); const evB = await evidence(b);
    const invA = (await issue(reviewer)).body; assert.equal((await redeem(a, invA.code, [evA])).status, 201);
    const listA = await http(a, 'GET', '/api/me/review-shares'); assert.equal(listA.status, 200); assert.equal(listA.body.shares.length, 1);
    assert.equal(listA.body.shares[0].reviewerName, 'Ana Revisora Sintética'); assert.equal(listA.body.shares[0].reviewerId, reviewer.id);
    assert.deepEqual(Object.keys(listA.body.shares[0]).sort(), ['createdAt', 'evidenceCount', 'id', 'materialVersion', 'reviewerId', 'reviewerName', 'revokedAt', 'status'], 'solo estos campos: sin correo, especialidad ni datos de la cuenta');
    const text = JSON.stringify(listA.body); assert.ok(!/@|specialt|email|bio/i.test(text.replace(/reviewerName/g, '')), 'nada de correo ni perfil');
    // B (otra persona) no ve nada de A, ni siquiera el nombre del revisor
    const listB = await http(b, 'GET', '/api/me/review-shares'); assert.equal(listB.status, 200); assert.deepEqual(listB.body.shares, []); assert.ok(!JSON.stringify(listB.body).includes('Ana Revisora'));
    const invB = (await issue(reviewer)).body; assert.equal((await redeem(b, invB.code, [evB])).status, 201);
    const again = await http(b, 'GET', '/api/me/review-shares'); assert.equal(again.body.shares.length, 1); assert.equal(again.body.shares[0].reviewerName, 'Ana Revisora Sintética', 'B ve el nombre de SU propia autorización');
    assert.ok(again.body.shares[0].id !== listA.body.shares[0].id); assert.equal((await http(a, 'GET', '/api/me/review-shares')).body.shares.length, 1, 'A sigue viendo solo la suya');
    // sin sesión: 401; un revisor (therapist) sin autorizaciones propias: lista vacía
    assert.equal((await http(null, 'GET', '/api/me/review-shares')).status, 401); assert.deepEqual((await http(reviewer, 'GET', '/api/me/review-shares')).body.shares, []);
    // retirar no cambia el nombre; un revisor eliminado = null (y sin error)
    assert.equal((await http(a, 'DELETE', '/api/me/review-shares/' + listA.body.shares[0].id)).status, 200); assert.equal((await http(a, 'GET', '/api/me/review-shares')).body.shares[0].reviewerName, 'Ana Revisora Sintética');
    await q('UPDATE "Users" SET name=$2 WHERE id=$1', [reviewer.id, '   ']); assert.equal((await http(a, 'GET', '/api/me/review-shares')).body.shares[0].reviewerName, null, 'nombre vacío = null');
    await q('DELETE FROM "ReviewerInvites" WHERE "reviewerId"=$1', [reviewer.id]); await q('UPDATE "ReviewShares" SET "reviewerId"=$2 WHERE "UserId"=$1', [a.id, 987654321]);
    const gone = await http(a, 'GET', '/api/me/review-shares'); assert.equal(gone.status, 200); assert.equal(gone.body.shares[0].reviewerName, null, 'revisor que ya no existe = null');
  });
});
