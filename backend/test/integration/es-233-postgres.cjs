// ES-233 (QA-229-01) · El Puente profesional exige el permiso de análisis (insights_*) de la fuente que se cita como origen, al previsualizar y, DENTRO de la misma transacción, al confirmar.
// HTTP REAL contra el server.js real, PostgreSQL REAL, dos pestañas simuladas.
//   ES233_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-233-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-233 PostgreSQL + HTTP: el permiso de la fuente se exige al previsualizar y al confirmar', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES233_TEST_DATABASE_URL', prefix: 'es233' });
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

  await t.test('carrera: confirmar y retirar el permiso a la vez, 12 veces — nunca queda una versión ACTIVA con el permiso retirado sin la marca «para revisión»', async () => {
    const { getApprovedContext } = require('../../utils/careerContext');
    const outcomes = { created: 0, refused: 0 };
    for (let i = 0; i < 12; i += 1) {
      const person = await mkUser('user'); const id = await ORIGINS.diary_entry.make(person);
      const fields = [{ key: 'motivations', text: TEXT, origin: { type: 'diary_entry', id } }];
      await grant(person, 'professional_bridge'); await grant(person, 'insights_diary');
      const p = await preview(person, fields);
      const [c, r] = await Promise.all([confirm(person, fields, p.body.token), grant(person, 'insights_diary', 'revoked')]);
      assert.equal(r.status, 200); assert.ok([201, 403].includes(c.status), 'confirmación: ' + c.status);
      assert.equal((await q('SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose=$2', [person.id, 'insights_diary']))[0].status, 'revoked');
      if (c.status === 201) {
        outcomes.created += 1;
        const row = (await q('SELECT status, origins FROM "CareerContextVersions" WHERE "UserId"=$1', [person.id]))[0];
        assert.equal(row.status, 'active');
        assert.ok(row.origins.every((o) => o.type !== 'diary_entry' || o.sourceRevokedAt), 'la versión nacida antes de la retirada queda marcada para revisión');
      } else { outcomes.refused += 1; assert.equal(await versions(person), 0); }
      const delivered = await getApprovedContext(person.id, 'test').catch((error) => error);
      assert.ok(!JSON.stringify(delivered).includes('coordinar'), 'el motor profesional nunca entrega el texto de la fuente retirada');
    }
    console.log('# carrera ES-233:', JSON.stringify(outcomes));
  });
});
