// ES-233 (QA-229-01) · El Puente profesional exige el permiso de análisis (insights_*) de la fuente que se cita como origen, al previsualizar y, DENTRO de la misma transacción, al confirmar.
// HTTP REAL contra el server.js real, PostgreSQL REAL, dos pestañas simuladas.
//   ES233_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-233-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-233 PostgreSQL + HTTP: el permiso de la fuente se exige al previsualizar y al confirmar', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http, provider } = await startRealApi(t, { envVar: 'ES233_TEST_DATABASE_URL', prefix: 'es233' });
  const seed = makeSeeder(q);
  const TEXT = 'Me motiva coordinar equipos pequeños.';
  const grant = (who, purpose, status = 'granted') => http(who, 'PUT', `/api/consents/${purpose}`, { status });
  const preview = (who, fields) => http(who, 'POST', '/api/career-context/preview', { fields });
  const confirm = (who, fields, token) => http(who, 'POST', '/api/career-context/confirm', { fields, token, requestId: crypto.randomBytes(12).toString('hex') });
  const versions = async (who) => Number((await q('SELECT count(*) n FROM "CareerContextVersions" WHERE "UserId"=$1', [who.id]))[0].n);
  const ORIGINS = {
    diary_entry: { purpose: 'insights_diary', make: async (u) => (await http(u, 'POST', '/api/diary', { date: '2026-10-01', content: 'Una entrada del diario' })).body.id },
    chat_turn: { purpose: 'insights_chat', make: async (u) => (await seed('ChatTurns', { UserId: u.id, requestId: crypto.randomUUID() })).id },
    resume_version: { purpose: 'insights_resume', make: async (u) => (await seed('ParticipantResumes', { UserId: u.id })).id },
  };

  for (const [type, { purpose, make }] of Object.entries(ORIGINS)) {
    await t.test(`${type}: sin ${purpose} no hay vista previa; con él sí; si se retira entre la vista previa y la confirmación, confirmar da 403 y NO crea versión`, async () => {
      const person = await mkUser('user'); const id = await make(person);
      const fields = [{ key: 'motivations', text: TEXT, origin: { type, id } }];
      assert.equal((await grant(person, 'professional_bridge')).status, 200);
      const refused = await preview(person, fields);
      assert.equal(refused.status, 403); assert.equal(refused.body.code, 'source_consent_required'); assert.ok(refused.body.error.includes(' / '));
      assert.equal((await grant(person, purpose)).status, 200);
      const ok = await preview(person, fields); assert.equal(ok.status, 200); assert.ok(ok.body.token);
      assert.equal((await grant(person, purpose, 'revoked')).status, 200); // otra pestaña retira el permiso
      const stale = await confirm(person, fields, ok.body.token);
      assert.equal(stale.status, 403); assert.equal(stale.body.code, 'source_consent_revoked');
      assert.equal(await versions(person), 0, 'no se creó ninguna versión');
      assert.equal((await preview(person, fields)).status, 403, 'tampoco una vista previa nueva');
      assert.equal((await grant(person, purpose)).status, 200); // vuelve a autorizar: el mismo token (aún vigente) ya sirve
      const again = await confirm(person, fields, ok.body.token);
      assert.equal(again.status, 201, JSON.stringify(again.body));
      assert.equal(await versions(person), 1);
    });
  }

  await t.test('control: un texto escrito directamente no depende de ningún permiso de análisis; el origen de OTRA persona sigue siendo 404', async () => {
    const person = await mkUser('user'); const other = await mkUser('user');
    const direct = [{ key: 'values', text: TEXT, origin: { type: 'direct' } }];
    const p = await preview(person, direct); assert.equal(p.status, 200);
    assert.equal((await confirm(person, direct, p.body.token)).status, 201);
    await grant(person, 'professional_bridge'); await grant(person, 'insights_diary');
    const foreign = await ORIGINS.diary_entry.make(other);
    const out = await preview(person, [{ key: 'values', text: TEXT, origin: { type: 'diary_entry', id: foreign } }]);
    assert.equal(out.status, 404); assert.equal(out.body.code, 'origin_not_found');
  });

  // E253-1 (ALTO, QA): con una versión activa previa, confirmar‖retirar se cruzaba en los bloqueos (confirmar: versiones → consentimiento; retirar: consentimiento → versiones) y daba 500 por
  // interbloqueo (40P01) en ~19 de 20 rondas. Orden único: consentimiento primero, versiones después. La carrera ahora PARTE de una versión activa y exige 0 errores 5xx.
  for (const [type, { purpose, make }] of Object.entries(ORIGINS)) {
    await t.test(`carrera con versión activa previa (${type}): 40 rondas de confirmar‖retirar ${purpose} → 0 errores 5xx, la retirada siempre responde 200 y nunca queda texto sin marca`, async () => {
      const { getApprovedContext } = require('../../utils/careerContext');
      const outcomes = { created: 0, refused: 0 };
      for (let i = 0; i < 40; i += 1) {
        const person = await mkUser('user'); const id = await make(person);
        await grant(person, 'professional_bridge'); await grant(person, purpose);
        const first = [{ key: 'motivations', text: TEXT, origin: { type, id } }];
        const p1 = await preview(person, first); assert.equal(p1.status, 200);
        assert.equal((await confirm(person, first, p1.body.token)).status, 201, 'versión activa previa');
        const second = [{ key: 'values', text: 'Valoro aprender de otras personas.', origin: { type, id } }];
        const p2 = await preview(person, second); assert.equal(p2.status, 200);
        const [c, r] = await Promise.all([confirm(person, second, p2.body.token), grant(person, purpose, 'revoked')]);
        assert.equal(r.status, 200, 'ronda ' + i + ': la RETIRADA no puede fallar (' + JSON.stringify(r.body) + ')');
        assert.ok([201, 403].includes(c.status), 'ronda ' + i + ': confirmación ' + c.status + ' ' + JSON.stringify(c.body).slice(0, 80));
        assert.equal((await q('SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose=$2', [person.id, purpose]))[0].status, 'revoked');
        const active = await q('SELECT origins FROM "CareerContextVersions" WHERE "UserId"=$1 AND status=$2', [person.id, 'active']);
        assert.ok(active.length <= 1);
        for (const row of active) assert.ok(row.origins.every((o) => o.type !== type || o.sourceRevokedAt), 'ronda ' + i + ': toda versión activa con la fuente retirada queda marcada para revisión');
        const delivered = await getApprovedContext(person.id, 'test').catch((error) => error);
        assert.ok(!JSON.stringify(delivered).includes('coordinar') && !JSON.stringify(delivered).includes('aprender'), 'el motor nunca entrega texto de la fuente retirada');
        if (c.status === 201) outcomes.created += 1; else outcomes.refused += 1;
      }
      console.log('# carrera ES-233 ' + type + ':', JSON.stringify(outcomes));
    });
  }

  // E253-2 (Bajo, QA): «comprobar solo el primer permiso» pasaba la prueba. Un texto puede citar VARIAS fuentes: cada una exige su propio permiso, en la vista previa y al confirmar.
  await t.test('varias fuentes en una misma versión: cada una exige su permiso (no basta el primero) en la vista previa y al confirmar', async () => {
    const person = await mkUser('user');
    const diary = await ORIGINS.diary_entry.make(person); const chat = await ORIGINS.chat_turn.make(person);
    const fields = [{ key: 'motivations', text: TEXT, origin: { type: 'diary_entry', id: diary } }, { key: 'values', text: 'Valoro aprender de otras personas.', origin: { type: 'chat_turn', id: chat } }];
    await grant(person, 'professional_bridge');
    await grant(person, 'insights_diary'); // solo la PRIMERA fuente (en el orden de los campos)
    assert.equal((await preview(person, fields)).body.code, 'source_consent_required');
    const reversed = [...fields].reverse(); // y solo la ÚLTIMA
    await grant(person, 'insights_diary', 'revoked'); await grant(person, 'insights_chat');
    assert.equal((await preview(person, reversed)).body.code, 'source_consent_required');
    await grant(person, 'insights_diary'); // ambas
    const ok = await preview(person, fields); assert.equal(ok.status, 200);
    await grant(person, 'insights_chat', 'revoked'); // se retira SOLO la segunda entre la vista previa y la confirmación
    const stale = await confirm(person, fields, ok.body.token);
    assert.equal(stale.status, 403); assert.equal(stale.body.code, 'source_consent_revoked'); assert.equal(await versions(person), 0);
    await grant(person, 'insights_chat'); await grant(person, 'insights_diary', 'revoked'); // ahora solo la primera
    assert.equal((await confirm(person, fields, ok.body.token)).body.code, 'source_consent_revoked');
    assert.equal(await versions(person), 0);
  });

  // E253-3 (decisión de Infra, misma regla de privacidad): la evidencia (ES-27) con origen del chat exige insights_chat además de professional_bridge; también la propuesta con IA (ES-28).
  await t.test('evidencia con origen del chat: exige insights_chat además del puente (conceder / negar / retirar); el borrador no lo necesita; la propuesta con IA tampoco se llama sin él', async () => {
    const person = await mkUser('user');
    const rid = crypto.randomUUID(); // un turno REAL del chat: la cita se comprueba contra su texto
    assert.equal((await http(person, 'POST', '/api/chat', { message: 'Coordiné a cuatro personas en un proyecto pequeño', requestId: rid })).status, 200);
    const turn = (await q('SELECT id FROM "ChatTurns" WHERE "UserId"=$1 AND "requestId"=$2', [person.id, rid]))[0].id;
    const body = (origins, status = 'confirmed') => ({ payload: { title: 'Coordiné un equipo', situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status, requestId: crypto.randomUUID(), origins });
    const evidence = (b) => http(person, 'POST', '/api/evidence', b);
    const withTurn = [{ type: 'chat_turn', id: turn, quote: 'Coordiné a cuatro personas' }];
    await grant(person, 'professional_bridge'); // solo el puente
    const denied = await evidence(body(withTurn));
    assert.equal(denied.status, 403); assert.equal(denied.body.code, 'source_consent_required');
    assert.equal(Number((await q('SELECT count(*) n FROM "Evidence" WHERE "UserId"=$1', [person.id]))[0].n), 0, 'nada se guardó');
    assert.notEqual((await evidence(body([], 'draft'))).status, 403, 'un borrador sin origen no exige ningún permiso');
    const proposal = await http(person, 'POST', '/api/evidence/proposals', { turnIds: [turn] });
    assert.equal(proposal.status, 403); assert.equal(proposal.body.code, 'source_consent_required');
    const calls = provider.calls;
    await grant(person, 'insights_chat'); // ambos
    const ok = await evidence(body(withTurn)); assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.notEqual((await http(person, 'POST', '/api/evidence/proposals', { turnIds: [turn] })).body.code, 'source_consent_required');
    assert.ok(provider.calls >= calls, 'con ambos permisos la propuesta sí llega a la IA');
    await grant(person, 'insights_chat', 'revoked'); // retirar el análisis del chat
    const afterRevoke = await evidence(body(withTurn)); assert.equal(afterRevoke.status, 403); assert.equal(afterRevoke.body.code, 'source_consent_required');
    assert.equal((await http(person, 'POST', '/api/evidence/proposals', { turnIds: [turn] })).status, 403);
  });
});
