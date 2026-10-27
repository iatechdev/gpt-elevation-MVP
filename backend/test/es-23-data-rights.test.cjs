const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { models, startApp } = require('./support.cjs');
const { install } = require('./es-23-store.cjs');
const { processDeletion } = require('../utils/deletionProcessor');
const { hasConsent, withConsent } = require('../utils/consent');
const { sessionProblem } = require('../utils/sessions');

const A = { id: 101, role: 'user' };
const B = { id: 202, role: 'user' };
const admin = { id: 303, role: 'superadmin' };
const setup = () => {
  process.env.DATA_RIGHTS_ENABLED = 'true';
  process.env.DATA_RIGHTS_PREVIEWS_PER_MINUTE = '1000'; // el límite de frecuencia (QA-23-03) se prueba aparte, con un valor bajo
  process.env.DATA_RIGHTS_DOWNLOADS_PER_MINUTE = '1000';
  return install();
};
const preview = (request, actor = A, locale = 'es') => request('POST', '/api/exports/preview', { ...actor, body: { type: 'personal', locale } });
const remove = (request, actor = A) => request('POST', '/api/account/deletion-requests', { ...actor, body: { confirm: true } });
const download = (request, id, actor = A) => request('POST', `/api/exports/${id}/download`, actor);

test('ES-23: preview and download deliver exactly the owner’s allowed data, in ES/EN, without credentials or deleted entries', async t => {
  const { state } = setup();
  const request = await startApp(t);
  for (const locale of ['es', 'en']) {
    const p = await preview(request, A, locale);
    assert.equal(p.status, 201);
    assert.equal(p.body.data.locale, locale);
    assert.equal(p.body.data.diary.length, 1);
    assert.equal(p.body.data.messages[0].content, 'A private message');
    const d = await download(request, p.body.id);
    assert.equal(d.status, 200);
    assert.equal(d.headers.get('cache-control'), 'no-store');
    assert.match(d.headers.get('content-disposition'), /attachment/);
    assert.deepEqual(d.body, p.body.data);
    assert.doesNotMatch(JSON.stringify(d.body), /B PRIVATE CANARY|DELETED CANARY|NEVER_EXPORT/);
    const metadata = state.tables.ExportRequest.find(row => row.id === p.body.id);
    assert.doesNotMatch(JSON.stringify(metadata), /private message|A diary|example.invalid/);
    assert.match(metadata.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('ES-23: guessed IDs and elevated roles cannot download another owner’s preview', async t => {
  setup();
  const request = await startApp(t);
  assert.equal((await preview(request, {})).status, 403);
  const p = await preview(request);
  assert.equal((await download(request, p.body.id, B)).status, 404);
  // An elevated role is not an export permission (it must pass its own legacy-policy review).
  assert.equal((await download(request, p.body.id, admin)).status, 409);
  assert.equal((await request('GET', `/api/exports/${p.body.id}/download`, A)).status, 404);
  assert.equal((await download(request, 'not-a-uuid')).status, 404);
});

test('ES-23: source edits and expired previews prevent delivery; professional dependency stays closed', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const p = await preview(request);
  state.tables.message[0].content = 'edited';
  assert.equal((await download(request, p.body.id)).body.code, 'export_outdated');
  const next = await preview(request);
  state.tables.ExportRequest.find(row => row.id === next.body.id).expiresAt = new Date(0);
  assert.equal((await download(request, next.body.id)).status, 410);
  const professional = await request('POST', '/api/exports/preview', { ...A, body: { type: 'professional', locale: 'en' } });
  assert.equal(professional.status, 503);
  assert.equal(professional.body.code, 'professional_contract_pending');
  assert.doesNotMatch(JSON.stringify(professional.body), /A diary|private message/);
});

test('ES-23: invalid selections/owner injection never write; feature is off by default', async t => {
  const { state } = setup();
  const request = await startApp(t);
  for (const body of [null, {}, [], { type: 'personal', locale: 'fr' }, { type: 'personal', locale: 'es', UserId: 202 }]) {
    assert.equal((await request('POST', '/api/exports/preview', { ...A, body })).status, 400);
  }
  for (const body of [{ confirm: false }, { confirm: true, UserId: 202 }, {}]) {
    assert.equal((await request('POST', '/api/account/deletion-requests', { ...A, body })).status, 400);
  }
  assert.equal(state.tables.DeletionRequest.length, 0);
  assert.equal(state.tables.ExportRequest.length, 0);
  delete process.env.DATA_RIGHTS_ENABLED;
  assert.equal((await preview(request)).status, 503);
});

test('ES-23: accepted deletion is atomic, blocks sessions, new login and sharing; authenticated retry returns same receipt', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const p = await preview(request);
  const result = await remove(request);
  assert.equal(result.status, 202);
  assert.equal(result.body.status, 'accepted');
  assert.equal(result.body.deadlinesVerified, false);
  assert.equal((await request('GET', '/api/diary', A)).status, 401);
  assert.equal((await download(request, p.body.id)).status, 401);
  assert.equal(state.tables.ExportRequest.length, 0);
  assert.ok(state.tables.Consent.every(c => c.status === 'revoked'));
  assert.equal(await hasConsent(101, 'professional_bridge'), false);
  await assert.rejects(withConsent(101, 'professional_bridge', () => assert.fail('must not publish')));
  const repeated = await remove(request);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.id, result.body.id);
  assert.equal(state.tables.DeletionRequest.length, 1);
  assert.equal((await request('PUT', '/api/admin/usuarios/101/unlock', admin)).status, 409);
  assert.equal((await request('PUT', '/api/admin/usuarios/101', { ...admin, body: { active: true } })).status, 409);
  assert.equal((await request('DELETE', '/api/admin/usuarios/101', admin)).status, 409);
  const account = state.tables.User.find(u => u.id === 101);
  account.active = true; // Even an out-of-band reactivation does not lift the tombstone.
  account.password = await bcrypt.hash('synthetic-password', 4);
  assert.equal((await request('POST', '/api/login', { body: { email: account.email, password: 'synthetic-password' } })).status, 403);
  assert.equal(await sessionProblem({ id: 101, jti: 'synthetic-new-session', iat: Date.now() / 1000 }), 'deletion_pending');
  assert.equal((await request('GET', '/api/diary', B)).status, 200);
});

test('ES-23: failed acceptance rolls back deactivation, consent changes and receipt; retry succeeds', async t => {
  const { state } = setup();
  const request = await startApp(t);
  state.fail = 'ExportRequest.destroy';
  assert.equal((await remove(request)).status, 503);
  assert.equal(state.tables.User.find(u => u.id === 101).active, true);
  assert.equal(state.tables.DeletionRequest.length, 0);
  assert.equal(state.tables.ConsentEvent.length, 0);
  assert.ok(state.tables.Consent.every(c => c.status === 'granted'));
  assert.equal((await remove(request)).status, 202);
});

test('ES-23: legacy human records fail closed; no misleading partial export or deletion', async t => {
  const { state, add } = setup();
  add('TherapySession', { id: 1, patientId: 101, therapistId: 202, therapistNote: 'THIRD PARTY PRIVATE' });
  const request = await startApp(t);
  assert.equal((await preview(request)).body.code, 'data_review_required');
  const result = await remove(request);
  assert.equal((await processDeletion(result.body.id, { quiescent: true })).status, 'awaiting_review');
  assert.equal(state.tables.message[0].content, 'A private message');
  assert.equal(state.tables.TherapySession.length, 1);
});

test('ES-23: purge rollback, retry and repeat preserve B and never claim providers/backups are deleted', async t => {
  const { state, add } = setup();
  add('DerivedInvalidation', { id: 1, UserId: 101, sourceType: 'diary_entry', sourceId: 1, reason: 'deleted', handledAt: null });
  const request = await startApp(t);
  const result = await remove(request);
  await assert.rejects(processDeletion(result.body.id), /drain confirmation/);
  state.fail = 'DiaryEntry.destroy';
  await assert.rejects(processDeletion(result.body.id, { quiescent: true }), /can be retried/);
  assert.equal(state.tables.message.length, 2); // earlier deletes rolled back
  assert.equal(state.tables.DeletionRequest[0].status, 'failed');
  assert.equal(state.tables.DeletionRequest[0].attempts, 1);
  const purged = await processDeletion(result.body.id, { quiescent: true });
  assert.equal(purged.status, 'awaiting_verification');
  assert.equal(purged.deadlinesVerified, false);
  assert.deepEqual(state.tables.message.map(m => m.UserId), [202]);
  assert.equal(state.tables.DerivedInvalidation[0].handledAt, null);
  const account = state.tables.User.find(u => u.id === 101);
  assert.equal(account.active, false);
  assert.match(account.email, /@deleted.invalid$/);
  assert.equal(state.tables.User.find(u => u.id === 202).email, '202@example.invalid');
  assert.deepEqual(await processDeletion(result.body.id, { quiescent: true }), purged);
  assert.equal(state.tables.DeletionRequest[0].attempts, 2);
  // A restored backup can reintroduce records even after a successful prior purge.
  add('message', { id: 3, UserId: 101, role: 'user', content: 'RESTORED PRIVATE' });
  await processDeletion(result.body.id, { quiescent: true, replay: true });
  assert.deepEqual(state.tables.message.map(m => m.UserId), [202]);
});

test('ES-23: ledger read failures deny session and download rather than leak data', async t => {
  setup();
  const request = await startApp(t);
  const p = await preview(request);
  models.DeletionRequest.findOne = async () => { throw new Error('synthetic private database diagnostic'); };
  const result = await download(request, p.body.id);
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /private database diagnostic|private message/);
});

test('ES-23: oversized archives are rejected in full without creating a preview', async t => {
  const { state } = setup();
  state.tables.message[0].content = 'x'.repeat(10 * 1024 * 1024);
  const request = await startApp(t);
  const result = await preview(request);
  assert.equal(result.status, 413);
  assert.equal(result.body.code, 'export_too_large');
  assert.equal(state.tables.ExportRequest.length, 0);
  assert.ok(JSON.stringify(result.body).length < 500);
});

test('ES-23 (QA-23-03): 40 vistas previas simultáneas del mismo dueño dejan una sola fila y reutilizan la vigente; una nueva reemplaza a la anterior', async t => {
  const { state } = setup();
  const rights = require('../utils/dataRights');
  const results = await Promise.all(Array.from({ length: 40 }, () => rights.preview(101, { type: 'personal', locale: 'es' })));
  assert.equal(new Set(results.map(r => r.id)).size, 1);
  assert.equal(results.filter(r => !r.reused).length, 1);
  assert.equal(state.tables.ExportRequest.filter(r => r.UserId === 101).length, 1);
  const first = results[0];
  // otro idioma o un cambio de datos generan una vista previa nueva que reemplaza a la anterior (nunca queda más de una vigente)
  const en = await rights.preview(101, { type: 'personal', locale: 'en' });
  assert.notEqual(en.id, first.id);
  assert.deepEqual(state.tables.ExportRequest.filter(r => r.UserId === 101).map(r => r.id), [en.id]);
  state.tables.message.push({ id: 99, UserId: 101, role: 'user', content: 'mensaje nuevo', createdAt: new Date(), updatedAt: new Date() });
  const changed = await rights.preview(101, { type: 'personal', locale: 'en' });
  assert.notEqual(changed.id, en.id);
  assert.equal(state.tables.ExportRequest.filter(r => r.UserId === 101).length, 1);
  const request = await startApp(t);
  assert.equal((await download(request, en.id)).status, 404); // la anterior ya no existe
  assert.equal((await download(request, changed.id)).status, 200);
});

test('ES-23 (QA-23-03): límite de frecuencia por persona en la vista previa y la descarga; otra persona no se ve afectada', async t => {
  const { add } = setup();
  add('User', { id: 404, name: 'Synthetic 404', email: '404@example.invalid', password: 'x', active: true, role: 'user', therapistId: null });
  const request = await startApp(t);
  process.env.DATA_RIGHTS_PREVIEWS_PER_MINUTE = '3';
  const C = { id: 404, role: 'user' };
  const statuses = [];
  for (let i = 0; i < 8; i++) statuses.push((await preview(request, C)).status);
  assert.deepEqual(statuses.slice(0, 3).map(s => s < 300), [true, true, true]);
  assert.deepEqual(statuses.slice(3), [429, 429, 429, 429, 429]);
  const limited = await preview(request, C);
  assert.equal(limited.body.code, 'rate_limited');
  assert.ok(limited.status === 429 && !limited.body.data);
  process.env.DATA_RIGHTS_PREVIEWS_PER_MINUTE = '1000';
  assert.equal((await preview(request, B)).status < 300, true); // otra persona no comparte el contador
});

test('ES-23 (QA-23-04): un fallo de serialización al descargar se reintenta una vez; si la cuenta ya tiene un borrado aceptado, responde 403 y no un 503 engañoso', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const p = await preview(request);
  const ExportRequest = require('../ExportRequest');
  const original = ExportRequest.findOne;
  const serialization = () => Object.assign(new Error('could not serialize access'), { parent: { code: '40001' } });
  try {
    let calls = 0;
    ExportRequest.findOne = async options => { if (++calls === 1) throw serialization(); return original(options); };
    assert.equal((await download(request, p.body.id)).status, 200); // el reintento interno lo resuelve
    // la aceptación del borrado coincide con la descarga: el primer intento falla, el reintento ve la solicitud
    let second = 0;
    ExportRequest.findOne = async options => {
      if (++second === 1) { state.tables.DeletionRequest.push({ id: 'd1', UserId: 101, status: 'accepted', attempts: 0 }); throw serialization(); }
      return original(options);
    };
    const blocked = await download(request, p.body.id);
    assert.deepEqual([blocked.status, blocked.body.code], [403, 'deletion_pending']);
    // si ni el reintento puede completarse, la respuesta es un 409 claro y reintentable, nunca data_rights_failed
    state.tables.DeletionRequest.length = 0;
    ExportRequest.findOne = async () => { throw serialization(); };
    const conflict = await download(request, p.body.id);
    assert.deepEqual([conflict.status, conflict.body.code], [409, 'concurrent_change']);
    assert.doesNotMatch(JSON.stringify(conflict.body), /data_rights_failed/);
  } finally { ExportRequest.findOne = original; }
});

test('ES-23 (QA-H1): el uso de IA de la persona se exporta sin contenido y se purga; el contador de cohorte y los datos de B no se tocan', async t => {
  const { state, add } = setup();
  add('AiUsage', { id: 1, UserId: 101, kind: 'chat', requestId: 'turn-a', model: 'm', periodKey: '2026-10', status: 'completed', inputTokens: 10, outputTokens: 5, latencyMs: 20 });
  add('AiUsage', { id: 2, UserId: 202, kind: 'chat', requestId: 'B-USAGE-CANARY', model: 'm', periodKey: '2026-10', status: 'completed' });
  add('AiBudgetCounter', { id: 1, UserId: 101, periodKey: '2026-10', used: 15 });
  add('AiBudgetCounter', { id: 2, UserId: 202, periodKey: '2026-10', used: 99 });
  add('AiBudgetCounter', { id: 3, UserId: 0, periodKey: '2026-10', used: 114 });
  const request = await startApp(t);
  const p = await preview(request);
  assert.deepEqual(p.body.data.aiUsage.map(u => [u.id, u.kind, u.inputTokens]), [[1, 'chat', 10]]);
  assert.deepEqual(p.body.data.aiBudget.map(b => [b.periodKey, b.used]), [['2026-10', 15]]);
  assert.doesNotMatch(JSON.stringify(p.body.data), /B-USAGE-CANARY|"used":99|"used":114/);
  const result = await remove(request);
  await processDeletion(result.body.id, { quiescent: true });
  assert.deepEqual(state.tables.AiUsage.map(u => u.UserId), [202]);
  assert.deepEqual(state.tables.AiBudgetCounter.map(c => [c.UserId, c.used]), [[202, 99], [0, 114]]);
});

test('ES-23 (QA-23-04): si el fallo de concurrencia ocurre DESPUÉS de entregar los bytes, no se reintenta (no se envía el archivo dos veces)', async t => {
  setup();
  const request = await startApp(t);
  const p = await preview(request);
  const rights = require('../utils/dataRights');
  const { database } = require('./support.cjs');
  const originalTransaction = database.sequelize.transaction;
  let delivered = 0;
  try {
    database.sequelize.transaction = async (...args) => {
      const tx = await originalTransaction(...args);
      tx.commit = async () => { throw Object.assign(new Error('could not serialize access'), { parent: { code: '40001' } }); };
      return tx;
    };
    await assert.rejects(rights.download(101, p.body.id, () => { delivered++; }), rights.isConcurrency);
  } finally { database.sequelize.transaction = originalTransaction; }
  assert.equal(delivered, 1);
});

test('ES-23 (QA-14-01): el contexto del participante (ES-14) se exporta descifrado al dueño, no se mezcla con B y se purga, también tras una restauración (--replay)', async t => {
  const { state, add } = setup();
  const dto = (profession) => JSON.stringify({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession, interests: null, availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null });
  add('ParticipantContext', { id: 1, UserId: 101, version: 3, content: dto('Docencia sintética A'), completedAt: new Date('2026-10-02') });
  add('ParticipantContext', { id: 2, UserId: 202, version: 1, content: dto('B PROFESSION CANARY'), completedAt: null });
  add('DerivedInvalidation', { id: 7, UserId: 101, sourceType: 'participant_context', sourceId: 1, reason: 'edited', handledAt: null });
  const request = await startApp(t);
  const p = await preview(request);
  const exported = p.body.data.participantContext;
  assert.equal(exported.length, 1);
  assert.deepEqual([exported[0].version, exported[0].content.profession, exported[0].content.targetMarket], [3, 'Docencia sintética A', 'DK']); // descifrado y como objeto
  assert.doesNotMatch(JSON.stringify(p.body.data), /B PROFESSION CANARY/);
  assert.deepEqual(p.body.data.invalidations.map(i => [i.sourceType, i.reason]), [['participant_context', 'edited']]); // los eventos propios también se entregan
  const result = await remove(request);
  await processDeletion(result.body.id, { quiescent: true });
  assert.deepEqual(state.tables.ParticipantContext.map(r => r.UserId), [202]); // purgado el de A, intacto el de B
  assert.equal(state.tables.DerivedInvalidation.length, 1); // las invalidaciones pendientes se conservan (ES-23)
  // una restauración reintroduce el contexto de A: el reaplicado lo vuelve a borrar
  add('ParticipantContext', { id: 3, UserId: 101, version: 3, content: dto('RESTORED PRIVATE'), completedAt: null });
  await processDeletion(result.body.id, { quiescent: true, replay: true });
  assert.deepEqual(state.tables.ParticipantContext.map(r => r.UserId), [202]);
});
