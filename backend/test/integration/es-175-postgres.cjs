// ES-175 (HU-P24) · Revisiones profesionales recibidas y objeción. HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA.
// Contrato 11612 + decisiones 11886: permiso `professional_review` por revisor, UNA objeción por revisión, UNA respuesta por objeción, alias «Persona n» para el revisor,
// el revisor es un usuario con rol `therapist`, propietario y permiso verificados en CADA acceso.
//   ES175_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-175-postgres.cjs
// @pg-env ES175_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-175 PostgreSQL + HTTP: revisiones profesionales, objeción y autorización por revisor', { timeout: 600000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES175_TEST_DATABASE_URL', prefix: 'es175' });
  const rid = () => crypto.randomUUID();
  const evidencePayload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' });
  const evidence = async (person, title = 'Muestra de prueba') => {
    const out = await http(person, 'POST', '/api/evidence', { payload: evidencePayload(title), status: 'confirmed', requestId: rid() });
    assert.equal(out.status, 201, JSON.stringify(out.body)); return out.body.id;
  };
  const share = async (person, reviewer, ids, requestId = rid()) => http(person, 'POST', '/api/me/review-shares', { reviewerId: reviewer.id, evidenceIds: ids, requestId });
  const review = (reviewer, shareId, ids, extra = {}) => http(reviewer, 'POST', '/api/reviewer/reviews', { shareId, evidenceIds: ids, observation: 'Observación de prueba', limits: 'Límites de prueba', locale: 'es', requestId: rid(), ...extra });
  const object = (person, reviewId, reason = 'No coincide con lo que hice', requestId = rid(), locale = 'es') => http(person, 'POST', `/api/me/professional-reviews/${reviewId}/objection`, { reason, requestId, locale });
  // Escenario base: persona, revisor (therapist), una evidencia compartida y una revisión.
  const scene = async () => {
    const person = await mkUser('user'); const reviewer = await mkUser('therapist'); const ev = await evidence(person);
    const sh = await share(person, reviewer, [ev]); assert.equal(sh.status, 201, JSON.stringify(sh.body));
    const rv = await review(reviewer, sh.body.share.id, [ev]); assert.equal(rv.status, 201, JSON.stringify(rv.body));
    return { person, reviewer, ev, shareId: sh.body.share.id, reviewId: rv.body.review.id };
  };

  await t.test('flujo completo: autorizar → el revisor ve el material con alias → revisa → la persona objeta → el revisor responde → la persona ve «Respondida»', async () => {
    const person = await mkUser('user'); const reviewer = await mkUser('therapist'); const ev = await evidence(person, 'Mi explicación de tres pasos');
    const sh = await share(person, reviewer, [ev]); assert.equal(sh.status, 201); assert.equal(sh.body.share.status, 'granted'); assert.equal(sh.body.share.materialVersion, 1);
    const seen = await http(reviewer, 'GET', '/api/reviewer/shares'); assert.equal(seen.status, 200); assert.equal(seen.body.shares.length, 1);
    assert.match(seen.body.shares[0].person, /^Persona [1-9][0-9]*$/); assert.equal(seen.body.shares[0].material[0].title, 'Mi explicación de tres pasos');
    const text = JSON.stringify(seen.body); const row = (await q('SELECT name, email FROM "Users" WHERE id=$1', [person.id]))[0];
    assert.ok(!text.includes(row.email) && !text.includes(row.name) && !new RegExp(`"(UserId|userId|email|name)"`).test(text), 'el revisor no ve nombre, correo ni id de la persona');
    const rv = await review(reviewer, sh.body.share.id, [ev], { observation: '<img src=x onerror=alert(1)> y <b>negrita</b>' }); assert.equal(rv.status, 201);
    const mine = await http(person, 'GET', '/api/me/professional-reviews'); assert.equal(mine.status, 200); assert.equal(mine.body.reviews.length, 1);
    const r = mine.body.reviews[0]; assert.equal(r.observation, '<img src=x onerror=alert(1)> y <b>negrita</b>', 'el HTML se guarda y se entrega LITERAL (la pantalla lo muestra como texto)');
    assert.equal(r.status, 'none'); assert.equal(r.materialChanged, false); assert.equal(r.evidence[0].title, 'Mi explicación de tres pasos'); assert.ok(r.author.displayName);
    const ob = await object(person, r.id, 'Esto no refleja mi trabajo'); assert.equal(ob.status, 201, JSON.stringify(ob.body));
    assert.equal((await http(person, 'GET', '/api/me/professional-reviews')).body.reviews[0].status, 'pending');
    const pend = await http(reviewer, 'GET', '/api/reviewer/objections'); assert.equal(pend.body.objections.length, 1); assert.equal(pend.body.objections[0].reason, 'Esto no refleja mi trabajo'); assert.equal(pend.body.objections[0].status, 'pending');
    assert.ok(!/"(UserId|userId|email|name)"/.test(JSON.stringify(pend.body)), 'tampoco en las objeciones');
    const re = await http(reviewer, 'POST', `/api/reviewer/objections/${pend.body.objections[0].objectionId}/response`, { text: 'Gracias, lo reviso', requestId: rid(), locale: 'es' }); assert.equal(re.status, 201, JSON.stringify(re.body));
    const done = (await http(person, 'GET', '/api/me/professional-reviews')).body.reviews[0]; assert.equal(done.status, 'answered'); assert.equal(done.response.text, 'Gracias, lo reviso'); assert.ok(done.response.author.displayName);
    // en la base, el texto sobre la persona va cifrado
    const raw = (await q('SELECT observation, limits FROM "ProfessionalReviews" WHERE id=$1', [r.id]))[0]; assert.ok(!raw.observation.includes('negrita') && !raw.limits.includes('Límites'), 'cifrado v2 en la base');
    assert.ok(!(await q('SELECT reason FROM "ReviewObjections"'))[0].reason.includes('trabajo'));
  });

  await t.test('propietario: cada persona ve solo lo suyo; una revisión ajena responde el MISMO 404 que una inexistente; el revisor solo opera sobre lo que se le autorizó', async () => {
    const a = await scene(); const b = await mkUser('user');
    assert.deepEqual((await http(b, 'GET', '/api/me/professional-reviews')).body.reviews, []);
    const foreign = await object(b, a.reviewId); const missing = await object(b, 987654);
    assert.equal(foreign.status, 404); assert.deepEqual(foreign.body, missing.body, 'ajena = inexistente');
    assert.equal((await q('SELECT count(*) n FROM "ReviewObjections"'))[0].n >= 0, true);
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewObjections" WHERE "reviewId"=$1', [a.reviewId]))[0].n), 0, 'B no pudo objetar la revisión de A');
    assert.equal((await http(b, 'DELETE', `/api/me/review-shares/${a.shareId}`)).status, 404, 'B no retira la autorización de A');
    const other = await mkUser('therapist');
    assert.equal((await review(other, a.shareId, [a.ev])).status, 404, 'otro revisor no usa la autorización de A');
    assert.deepEqual((await http(other, 'GET', '/api/reviewer/shares')).body.shares, []);
    const oresp = await http(other, 'POST', '/api/reviewer/objections/1/response', { text: 'x', requestId: rid(), locale: 'es' }); assert.equal(oresp.status, 404);
    for (const route of ['/api/reviewer/shares', '/api/reviewer/objections']) assert.equal((await http(a.person, 'GET', route)).status, 403, 'una persona no entra al lado del revisor');
    assert.ok([401, 403].includes((await http(null, 'GET', '/api/me/professional-reviews')).status), 'sin sesión no entra');
    // revisor inexistente o que no es therapist: mismo 404 reviewer_not_found
    const ev = await evidence(b); const notTherapist = await mkUser('user');
    const x = await share(b, notTherapist, [ev]); const y = await http(b, 'POST', '/api/me/review-shares', { reviewerId: 99999999, evidenceIds: [ev], requestId: rid() });
    assert.equal(x.status, 404); assert.equal(x.body.code, 'reviewer_not_found'); assert.deepEqual(x.body, y.body);
    // evidencia ajena o inexistente
    assert.equal((await share(b, other, [a.ev])).status, 400); assert.equal((await share(b, other, [a.ev])).body.code, 'invalid_evidence'); assert.equal((await share(b, other, [123456789])).body.code, 'invalid_evidence');
    // el permiso nunca se concede desde /api/consents (el alcance y las evidencias no vienen de ahí)
    assert.equal((await http(b, 'PUT', '/api/consents/professional_review', { status: 'granted' })).body.code, 'use_review_shares');
  });

  await t.test('UNA objeción por revisión: segunda con otro requestId = 409 already_objected; el mismo requestId es repetición idempotente; 12 simultáneas = 1 fila', async () => {
    const s = await scene(); const requestId = rid();
    const first = await object(s.person, s.reviewId, 'Primera', requestId); assert.equal(first.status, 201);
    const second = await object(s.person, s.reviewId, 'Segunda'); assert.equal(second.status, 409); assert.equal(second.body.code, 'already_objected');
    const replay = await object(s.person, s.reviewId, 'Primera', requestId); assert.equal(replay.status, 200); assert.equal(replay.body.objection.id, first.body.objection.id);
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewObjections" WHERE "reviewId"=$1', [s.reviewId]))[0].n, 1);
    for (let round = 0; round < 3; round++) {
      const r = await scene(); const outs = await Promise.all(Array.from({ length: 12 }, (_, i) => object(r.person, r.reviewId, `Objeción ${i}`)));
      assert.equal(outs.filter((o) => o.status === 201).length, 1, `ronda ${round}: exactamente una gana`); assert.ok(outs.every((o) => [201, 409].includes(o.status)), JSON.stringify(outs.map((o) => o.status)));
      assert.equal((await q('SELECT count(*)::int n FROM "ReviewObjections" WHERE "reviewId"=$1', [r.reviewId]))[0].n, 1);
    }
    const same = await scene(); const rq = rid(); const outs = await Promise.all(Array.from({ length: 10 }, () => object(same.person, same.reviewId, 'Misma', rq)));
    assert.ok(outs.every((o) => [200, 201].includes(o.status)), JSON.stringify(outs.map((o) => o.status))); assert.equal(new Set(outs.map((o) => o.body.objection.id)).size, 1);
    const second2 = await review(same.reviewer, same.shareId, [same.ev]); assert.equal(second2.status, 201);
    assert.equal((await object(same.person, second2.body.review.id, 'Otra', rq)).status, 409, 'el mismo requestId con otra revisión es un conflicto, no una repetición');
    // UNA respuesta por objeción
    const r2 = await scene(); const ob = await object(r2.person, r2.reviewId); assert.equal(ob.status, 201);
    const resp = (text, requestId = rid()) => http(r2.reviewer, 'POST', `/api/reviewer/objections/${ob.body.objection.id}/response`, { text, requestId, locale: 'es' });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => resp(`Respuesta ${i}`))); assert.equal(results.filter((x) => x.status === 201).length, 1); assert.ok(results.every((x) => [201, 409].includes(x.status)));
    assert.equal((await resp('Otra más')).body.code, 'already_responded');
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewResponses" WHERE "objectionId"=$1', [ob.body.objection.id]))[0].n, 1);
  });

  await t.test('acceso retirado: el revisor deja de ver el material y de poder revisar o responder; la persona deja de poder objetar y NO pierde lo que ya tiene', async () => {
    const s = await scene(); const ob = await object(s.person, s.reviewId, 'Antes de retirar'); assert.equal(ob.status, 201);
    const s2 = await scene(); // otra persona con otra revisión sin objeción: se retira A MITAD
    const gone = await http(s2.person, 'DELETE', `/api/me/review-shares/${s2.shareId}`); assert.equal(gone.status, 200); assert.equal(gone.body.share.status, 'revoked');
    assert.equal((await http(s2.person, 'DELETE', `/api/me/review-shares/${s2.shareId}`)).status, 200, 'retirar dos veces es idempotente');
    const late = await object(s2.person, s2.reviewId, 'Texto escrito tras retirar'); assert.equal(late.status, 403); assert.equal(late.body.code, 'consent_revoked');
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewObjections" WHERE "reviewId"=$1', [s2.reviewId]))[0].n, 0, 'nada se guardó');
    assert.deepEqual((await http(s2.reviewer, 'GET', '/api/reviewer/shares')).body.shares, [], 'el revisor ya no ve el material');
    const blocked = await review(s2.reviewer, s2.shareId, [s2.ev]); assert.equal(blocked.status, 403); assert.equal(blocked.body.code, 'consent_required');
    const kept = (await http(s2.person, 'GET', '/api/me/professional-reviews')).body.reviews[0]; assert.equal(kept.materialChanged, true, 'la revisión se conserva y se marca «el material cambió»');
    // retirar DESPUÉS de objetar: el revisor ya no ve la objeción ni puede responder; lo que la persona escribió sigue siendo suyo
    await http(s.person, 'DELETE', `/api/me/review-shares/${s.shareId}`);
    assert.deepEqual((await http(s.reviewer, 'GET', '/api/reviewer/objections')).body.objections, []);
    const noresp = await http(s.reviewer, 'POST', `/api/reviewer/objections/${ob.body.objection.id}/response`, { text: 'Tarde', requestId: rid(), locale: 'es' }); assert.equal(noresp.status, 403);
    const still = (await http(s.person, 'GET', '/api/me/professional-reviews')).body.reviews[0]; assert.equal(still.objection.reason, 'Antes de retirar'); assert.equal(still.status, 'pending');
    // volver a autorizar crea un material NUEVO (versión 2); la revisión original se conserva intacta
    const again = await share(s.person, s.reviewer, [s.ev]); assert.equal(again.status, 201); assert.equal(again.body.share.materialVersion, 2);
    assert.equal((await q('SELECT count(*)::int n FROM "ProfessionalReviews" WHERE id=$1', [s.reviewId]))[0].n, 1);
    // revisión sobre una autorización sustituida: 409; carrera retirar ‖ revisar: nunca 5xx y nada se crea tras el retiro
    const old = await review(s.reviewer, s.shareId, [s.ev]); assert.ok([403, 409].includes(old.status), String(old.status));
    for (let round = 0; round < 3; round++) {
      const r = await scene(); const outs = await Promise.all([http(r.person, 'DELETE', `/api/me/review-shares/${r.shareId}`), ...Array.from({ length: 10 }, () => review(r.reviewer, r.shareId, [r.ev]))]);
      assert.ok(outs.every((o) => o.status < 500), JSON.stringify(outs.map((o) => o.status)));
      const created = await q('SELECT r."createdAt" at FROM "ProfessionalReviews" r WHERE r."shareId"=$1 AND r.id <> $2', [r.shareId, r.reviewId]);
      const revokedAt = (await q('SELECT "decidedAt" d FROM "Consents" WHERE "UserId"=$1 AND purpose=$2 AND status=$3', [r.person.id, 'professional_review', 'revoked']))[0].d;
      assert.ok(created.every((row) => row.at <= revokedAt), 'ninguna revisión nueva después del retiro');
      assert.equal(await review(r.reviewer, r.shareId, [r.ev]).then((o) => o.status), 403, 'y después del retiro, siempre 403');
    }
  });

  await t.test('entradas: texto plano ≤2000 sin caracteres de control, claves desconocidas, ids y requestId inválidos → 400 estable, nunca 500; la revisión es inmutable', async () => {
    const s = await scene();
    const cases = [
      [{ reason: '', requestId: rid(), locale: 'es' }, 'required'], [{ reason: '   ', requestId: rid(), locale: 'es' }, 'required'], [{ reason: 'a'.repeat(2001), requestId: rid(), locale: 'es' }, 'too_long'],
      [{ reason: 'ok\u0000mal', requestId: rid(), locale: 'es' }, 'control_chars'], [{ reason: 'ok', requestId: 'corto', locale: 'es' }, 'invalid_input'], [{ reason: 'ok', requestId: rid(), locale: 'fr' }, 'invalid_input'],
      [{ reason: 'ok', requestId: rid(), locale: 'es', extra: 1 }, 'invalid_input'], [{ reason: { $ne: 1 }, requestId: rid(), locale: 'es' }, 'invalid_input'], [null, 'invalid_input'],
    ];
    for (const [body, code] of cases) { const out = await http(s.person, 'POST', `/api/me/professional-reviews/${s.reviewId}/objection`, body); assert.equal(out.status, 400, JSON.stringify([body, out.body])); assert.equal(out.body.code, code, JSON.stringify(out.body)); }
    assert.equal((await object(s.person, s.reviewId, 'a'.repeat(2000))).status, 201, '2000 exactos sí');
    for (const bad of ['abc', '0', '-1', '1.5', '99999999999']) assert.equal((await http(s.person, 'POST', `/api/me/professional-reviews/${bad}/objection`, { reason: 'x', requestId: rid(), locale: 'es' })).status, 404);
    for (const body of [{ shareId: s.shareId, evidenceIds: [s.ev], observation: 'x'.repeat(2001), limits: 'l', locale: 'es', requestId: rid() }, { shareId: s.shareId, evidenceIds: [s.ev, 999], observation: 'x', limits: 'l', locale: 'es', requestId: rid() }, { shareId: s.shareId, evidenceIds: [s.ev], observation: 'x', limits: '', locale: 'es', requestId: rid() }]) {
      const out = await http(s.reviewer, 'POST', '/api/reviewer/reviews', body); assert.ok([400].includes(out.status), JSON.stringify(out.body));
    }
    // inmutable: no existe ninguna ruta de edición ni de borrado de una revisión
    for (const [method, route] of [['PUT', `/api/reviewer/reviews/${s.reviewId}`], ['PATCH', `/api/reviewer/reviews/${s.reviewId}`], ['DELETE', `/api/reviewer/reviews/${s.reviewId}`]]) assert.equal((await http(s.reviewer, method, route, { observation: 'otra' })).status, 404);
    assert.equal((await q('SELECT count(*)::int n FROM "ProfessionalReviews" WHERE id=$1', [s.reviewId]))[0].n, 1);
    // corrección = revisión NUEVA que apunta a la anterior; la original se conserva
    const fix = await review(s.reviewer, s.shareId, [s.ev], { observation: 'Corrección', supersedesId: s.reviewId }); assert.equal(fix.status, 201);
    const list = (await http(s.person, 'GET', '/api/me/professional-reviews')).body.reviews; assert.equal(list.length, 2); assert.ok(list.some((r) => r.supersedesId === s.reviewId) && list.some((r) => r.observation === 'Observación de prueba'));
    // repetir la misma revisión con el mismo requestId no duplica
    const rq = rid(); const a1 = await review(s.reviewer, s.shareId, [s.ev], { requestId: rq }); const a2 = await review(s.reviewer, s.shareId, [s.ev], { requestId: rq });
    assert.equal(a1.status, 201); assert.equal(a2.status, 200); assert.equal(a1.body.review.id, a2.body.review.id);
  });

  await t.test('evidencias compartibles: solo confirmadas, vigentes y sin origen en el chat; ninguna cita ni campo privado llega al revisor; repetir el requestId de la autorización no duplica', async () => {
    const person = await mkUser('user'); const reviewer = await mkUser('therapist');
    const draft = await http(person, 'POST', '/api/evidence', { payload: { title: 'Borrador', situation: 'x' }, status: 'draft', requestId: rid() }); assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal((await share(person, reviewer, [draft.body.id])).body.code, 'invalid_evidence', 'un borrador no se comparte');
    const ev = await evidence(person, 'Una'); const del = await evidence(person, 'Borrada'); assert.ok((await http(person, 'DELETE', `/api/evidence/${del}`)).status < 300);
    assert.equal((await share(person, reviewer, [del])).body.code, 'invalid_evidence', 'una borrada no se comparte');
    for (const bad of [[], [ev, ev], Array.from({ length: 21 }, (_, i) => i + 1), ['1'], [0]]) assert.equal((await http(person, 'POST', '/api/me/review-shares', { reviewerId: reviewer.id, evidenceIds: bad, requestId: rid() })).status, 400);
    assert.equal((await http(person, 'POST', '/api/me/review-shares', { reviewerId: person.id, evidenceIds: [ev], requestId: rid() })).status, 404, 'no puedes ser tu propio revisor');
    const rq = rid(); const s1 = await share(person, reviewer, [ev], rq); const s2 = await share(person, reviewer, [ev], rq);
    assert.equal(s1.status, 201); assert.equal(s2.status, 201); assert.equal(s1.body.share.id, s2.body.share.id); assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]))[0].n, 1);
    const ev2 = await evidence(person, 'Dos'); assert.equal((await share(person, reviewer, [ev2], rq)).status, 409, 'mismo requestId con otros datos');
    const out = await http(reviewer, 'GET', '/api/reviewer/shares'); const text = JSON.stringify(out.body);
    assert.ok(!/chat|diary|diario|crisis|mood|email|origins|quote|requestId|UserId/i.test(text), 'ningún campo privado: ' + text.slice(0, 300));
    // una revisión solo puede citar evidencias de SU autorización
    const s = (await share(person, reviewer, [ev])).body.share; assert.equal((await review(reviewer, s.id, [ev2])).body.code, 'invalid_evidence');
  });

  await t.test('evidencia con origen en el chat: NO se puede compartir con un revisor (ni con el permiso del chat); la directa sí', async () => {
    const person = await mkUser('user'); const reviewer = await mkUser('therapist');
    for (const purpose of ['professional_bridge', 'insights_chat']) assert.equal((await http(person, 'PUT', `/api/consents/${purpose}`, { status: 'granted' })).status, 200);
    const turnRid = rid(); assert.equal((await http(person, 'POST', '/api/chat', { message: 'Coordiné a cuatro personas en un proyecto pequeño', requestId: turnRid })).status, 200);
    const turn = (await q('SELECT id FROM "ChatTurns" WHERE "UserId"=$1 AND "requestId"=$2', [person.id, turnRid]))[0].id;
    const fromChat = await http(person, 'POST', '/api/evidence', { payload: evidencePayload('Desde el chat'), status: 'confirmed', requestId: rid(), origins: [{ type: 'chat_turn', id: turn, quote: 'Coordiné a cuatro personas' }] });
    assert.equal(fromChat.status, 201, JSON.stringify(fromChat.body));
    const out = await share(person, reviewer, [fromChat.body.id]); assert.equal(out.status, 400); assert.equal(out.body.code, 'invalid_evidence');
    assert.equal(Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]))[0].n), 0);
    assert.equal((await share(person, reviewer, [await evidence(person)])).status, 201);
  });

  await t.test('el permiso se comprueba en CADA acceso, no solo al autorizar: con el permiso retirado por otra vía (la autorización sigue «granted»), el revisor no ve, no revisa y no responde; la persona no objeta', async () => {
    const s = await scene(); const ob = await object(s.person, s.reviewId); assert.equal(ob.status, 201);
    const s2 = await scene();
    await q('UPDATE "Consents" SET status=$2 WHERE purpose=$1', ['professional_review', 'revoked']); // simula una retirada por otra vía; las ReviewShares siguen en granted
    assert.equal(Number((await q("SELECT count(*) n FROM \"ReviewShares\" WHERE status='granted'"))[0].n) >= 2, true);
    for (const x of [s, s2]) {
      assert.deepEqual((await http(x.reviewer, 'GET', '/api/reviewer/shares')).body.shares, [], 'no ve el material');
      assert.equal((await review(x.reviewer, x.shareId, [x.ev])).status, 403); assert.deepEqual((await http(x.reviewer, 'GET', '/api/reviewer/objections')).body.objections, []);
    }
    assert.equal((await http(s.reviewer, 'POST', `/api/reviewer/objections/${ob.body.objection.id}/response`, { text: 'x', requestId: rid(), locale: 'es' })).status, 403);
    assert.equal((await object(s2.person, s2.reviewId)).status, 403);
  });

  await t.test('ES-23: las 4 tablas entran a personalData.CORE (se exporta descifrado, sin requestId) y la autorización queda en el historial de consentimientos', async () => {
    const s = await scene(); await object(s.person, s.reviewId, 'Para la exportación');
    const { personalData, CORE } = require('../../utils/personalData'); const User = require('../../User');
    for (const name of ['ReviewShare', 'ProfessionalReview', 'ReviewObjection', 'ReviewResponse']) assert.ok(CORE.some((row) => row[1] === name), `${name} en CORE`);
    const data = await personalData(await User.findByPk(s.person.id), 'es');
    assert.equal(data.professionalReviews[0].observation, 'Observación de prueba'); assert.equal(data.reviewObjections[0].reason, 'Para la exportación'); assert.equal(data.reviewShares.length, 1);
    assert.ok(!JSON.stringify(data).includes('requestId'), 'sin referencias técnicas');
    const history = (await http(s.person, 'GET', '/api/consents/history')).body.history; assert.ok(history.some((h) => h.purpose === 'professional_review' && h.scope === `reviewer-${s.reviewer.id}` && h.status === 'granted'));
    const purposes = (await http(s.person, 'GET', '/api/consents')).body.consents; assert.ok(!purposes.some((c) => c.purpose === 'professional_review'), 'no es un interruptor global: se gestiona por revisor en /api/me/review-shares');
  });
});
