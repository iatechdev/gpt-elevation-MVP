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
const setup = () => { process.env.DATA_RIGHTS_ENABLED = 'true'; return install(); };
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
