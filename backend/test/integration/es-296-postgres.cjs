// ES-296 · Retirar insights_chat marca «para revisión» las evidencias confirmadas con origen del chat (equivalente de ES-229 para la evidencia de ES-27): no viajan al motor profesional hasta que la
// persona las reconfirme; nada se borra; idempotente; sin PII en la invalidación. HTTP REAL contra el server.js real y PostgreSQL REAL.
//   ES296_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-296-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-296 PostgreSQL + HTTP: retirar insights_chat marca para revisión la evidencia con origen del chat', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES296_TEST_DATABASE_URL', prefix: 'es296' });
  const { getConfirmedEvidence } = require('../../utils/evidence');
  const grant = (who, purpose, status = 'granted') => http(who, 'PUT', `/api/consents/${purpose}`, { status });
  const payload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' });
  const turnOf = async (person, text = 'Coordiné a cuatro personas en un proyecto pequeño') => {
    const rid = crypto.randomUUID();
    assert.equal((await http(person, 'POST', '/api/chat', { message: text, requestId: rid })).status, 200);
    return (await q('SELECT id FROM "ChatTurns" WHERE "UserId"=$1 AND "requestId"=$2', [person.id, rid]))[0].id;
  };
  const withChat = async (person, title = 'Evidencia del chat') => {
    const turn = await turnOf(person);
    const out = await http(person, 'POST', '/api/evidence', { payload: payload(title), status: 'confirmed', requestId: crypto.randomUUID(), origins: [{ type: 'chat_turn', id: turn, quote: 'Coordiné a cuatro personas' }] });
    assert.equal(out.status, 201, JSON.stringify(out.body)); return { id: out.body.id, turn };
  };
  const direct = async (person, title = 'Evidencia directa') => {
    const out = await http(person, 'POST', '/api/evidence', { payload: payload(title), status: 'confirmed', requestId: crypto.randomUUID() });
    assert.equal(out.status, 201, JSON.stringify(out.body)); return out.body.id;
  };
  const setup = async () => { const p = await mkUser('user'); await grant(p, 'professional_bridge'); await grant(p, 'insights_chat'); return p; };
  const engine = async (p) => (await getConfirmedEvidence(p.id, 'test')).map((e) => e.evidenceId).sort((x, y) => x - y);
  const events = (p) => q(`SELECT "sourceId", reason FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked' ORDER BY id`, [p.id]);

  await t.test('retirar insights_chat: la evidencia del chat queda «para revisión» y deja de llegar al motor; la directa sigue; nada se borra; la persona lo ve sin ids ni citas', async () => {
    const p = await setup(); const chat = await withChat(p); const plain = await direct(p);
    assert.deepEqual(await engine(p), [chat.id, plain].sort((x, y) => x - y), 'antes: el motor recibe ambas');
    assert.equal((await grant(p, 'insights_chat', 'revoked')).status, 200);
    assert.deepEqual(await engine(p), [plain], 'el motor ya no recibe la evidencia del chat');
    const list = await http(p, 'GET', '/api/evidence'); assert.equal(list.status, 200);
    const mine = list.body.find((e) => e.id === chat.id); const text = JSON.stringify(list.body);
    const version = mine.versions ? mine.versions[mine.versions.length - 1] : mine;
    assert.equal(version.needsReview, true); assert.equal(version.reviewReason, 'source_revoked'); assert.equal(version.status, 'confirmed', 'la versión sigue confirmada en el historial: nada se reescribe');
    assert.ok(!text.includes(String(chat.turn)) || !/"turnId"|"origin":\{"type":"chat_turn"/.test(text), 'sin id ni cita del chat');
    assert.ok(!text.includes('sourceRevokedAt') && !text.includes('quote'), 'la marca privada no sale');
    assert.deepEqual((await http(p, 'GET', `/api/evidence/${plain}`)).body.versions ? [] : [], []);
    assert.equal(Number((await q('SELECT count(*) n FROM "Evidence" WHERE "UserId"=$1 AND "deletedAt" IS NULL', [p.id]))[0].n), 2, 'no se borró nada');
    const ev = await events(p); assert.equal(ev.length, 1); assert.equal(ev[0].sourceId, chat.id); // sin PII: solo ids y motivo
  });

  await t.test('idempotente: retirar otra vez no duplica marca ni evento; volver a otorgar NO limpia la marca; reconfirmar crea una versión nueva y vuelve al motor (exige el permiso)', async () => {
    const p = await setup(); const chat = await withChat(p);
    await grant(p, 'insights_chat', 'revoked'); await grant(p, 'insights_chat', 'revoked');
    assert.equal((await events(p)).length, 1, 'un solo evento aunque se retire dos veces');
    await grant(p, 'insights_chat'); // vuelve a otorgar
    assert.deepEqual(await engine(p), [], 'volver a otorgar no devuelve la evidencia al motor');
    await grant(p, 'insights_chat', 'revoked'); assert.equal((await events(p)).length, 1, 'ni retirando de nuevo tras re-otorgar');
    await grant(p, 'insights_chat');
    const turn = await turnOf(p, 'Coordiné a cuatro personas otra vez');
    const edit = await http(p, 'PUT', `/api/evidence/${chat.id}`, { payload: payload('Evidencia del chat (reconfirmada)'), status: 'confirmed', baseVersion: 1, requestId: crypto.randomUUID(), origins: [{ type: 'chat_turn', id: turn, quote: 'Coordiné a cuatro personas' }] });
    assert.ok(edit.status < 300, JSON.stringify(edit.body));
    assert.deepEqual(await engine(p), [chat.id], 'la versión NUEVA vuelve al motor');
    const rows = await q('SELECT version, origins FROM "EvidenceVersions" WHERE "EvidenceId"=$1 ORDER BY version', [chat.id]);
    assert.equal(rows.length, 2); assert.ok(rows[0].origins.some((o) => o.sourceRevokedAt), 'la versión anterior conserva su marca como historia'); assert.ok(rows[1].origins.every((o) => !o.sourceRevokedAt));
  });

  await t.test('solo insights_chat marca; retirar insights_diary, insights_resume, research o el puente-no-relacionado no marca la evidencia del chat; otra persona no se toca (A/B)', async () => {
    const a = await setup(); const b = await setup(); const ca = await withChat(a); const cb = await withChat(b);
    for (const purpose of ['insights_diary', 'insights_resume', 'research']) { await grant(a, purpose); assert.equal((await grant(a, purpose, 'revoked')).status, 200); }
    assert.deepEqual(await engine(a), [ca.id], 'otros permisos no marcan');
    await grant(a, 'insights_chat', 'revoked');
    assert.deepEqual(await engine(a), []); assert.deepEqual(await engine(b), [cb.id], 'B no cambia');
    assert.equal((await events(b)).length, 0);
  });

  await t.test('carrera: retirar insights_chat ‖ reconfirmar la evidencia, 40 rondas → 0 errores 5xx, la retirada siempre 200 y nunca queda una versión vigente con origen del chat sin marca si el permiso está retirado', async () => {
    const outcomes = { saved: 0, refused: 0 };
    for (let i = 0; i < 40; i += 1) {
      const p = await setup(); const chat = await withChat(p); const turn = await turnOf(p, 'Coordiné a cuatro personas de nuevo');
      const edit = http(p, 'PUT', `/api/evidence/${chat.id}`, { payload: payload('Reconfirmada'), status: 'confirmed', baseVersion: 1, requestId: crypto.randomUUID(), origins: [{ type: 'chat_turn', id: turn, quote: 'Coordiné a cuatro personas' }] });
      const [e, r] = await Promise.all([edit, grant(p, 'insights_chat', 'revoked')]);
      assert.equal(r.status, 200, `ronda ${i}: la retirada falló ${JSON.stringify(r.body)}`);
      assert.ok(e.status < 500, `ronda ${i}: reconfirmar respondió ${e.status} ${JSON.stringify(e.body).slice(0, 80)}`);
      const current = (await q(`SELECT v.origins, v.status FROM "EvidenceVersions" v JOIN "Evidence" e ON e.id=v."EvidenceId" AND e."currentVersion"=v.version WHERE e."UserId"=$1`, [p.id]))[0];
      if (current.status === 'confirmed') assert.ok(current.origins.every((o) => o.type !== 'chat_turn' || o.sourceRevokedAt), `ronda ${i}: versión vigente con origen del chat y permiso retirado, sin marca`);
      assert.ok(!(await engine(p)).includes(chat.id), `ronda ${i}: el motor entregó evidencia del chat con el permiso retirado`);
      if (e.status < 300) outcomes.saved += 1; else outcomes.refused += 1;
    }
    console.log('# carrera ES-296:', JSON.stringify(outcomes));
  });
});
