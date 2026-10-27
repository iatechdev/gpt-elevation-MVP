// ES-25: puente profesional. Modelos en memoria (ver es-25-store.cjs); la concurrencia real está en test-db/.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./support.cjs');
const { install } = require('./es-25-store.cjs');
const bridge = require('../utils/careerContext');
const { encriptarV2 } = require('../utils/crypto');

const A = { role: 'user', id: 101 };
const B = { role: 'user', id: 202 };
const DIARY_CANARY = 'CANARY-DIARIO-PRIVADO';
const CHAT_CANARY = 'CANARY-CHAT-PRIVADO';
const CRISIS_CANARY = 'CANARY-CRISIS';

function setup() {
  const { state, add } = install();
  const diary = add('DiaryEntry', { UserId: 101, entryDate: '2026-10-01', content: encriptarV2(DIARY_CANARY), deletedAt: null });
  const diaryB = add('DiaryEntry', { UserId: 202, entryDate: '2026-10-01', content: encriptarV2('B diario'), deletedAt: null });
  const turn = add('ChatTurn', { UserId: 101, requestId: 'turn-1', status: 'completed', userContent: encriptarV2(CHAT_CANARY), replyContent: encriptarV2('r') });
  return { state, add, diary, diaryB, turn };
}
const post = (request, route, actor, body) => request('POST', `/api/career-context/${route}`, { ...actor, body });
const grant = (request, actor, status = 'granted') => request('PUT', '/api/consents/professional_bridge', { ...actor, body: { status } });
const direct = (text = 'Quiero trabajar con autonomía') => [{ key: 'motivations', text }];
async function approve(request, actor, fields, requestId = 'req-' + Math.random().toString(16).slice(2, 12)) {
  const p = await post(request, 'preview', actor, { fields });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return post(request, 'confirm', actor, { fields, token: p.body.token, requestId });
}

test('ES-25 camino directo: vista previa exacta, confirmación sin consentimiento y lectura del motor solo con clave y texto', async (t) => {
  const { state } = setup();
  const request = await startApp(t);
  const fields = [{ key: 'motivations', text: '  Quiero autonomía  ' }, { key: 'constraints', text: 'Solo remoto', origin: { type: 'direct' } }];
  const p = await post(request, 'preview', A, { fields, locale: 'es' });
  assert.equal(p.status, 200);
  assert.deepEqual(p.body.representation, [{ key: 'motivations', text: 'Quiero autonomía' }, { key: 'constraints', text: 'Solo remoto' }]);
  assert.equal(state.tables.CareerContextVersion.length, 0); // la vista previa no guarda nada
  const c = await post(request, 'confirm', A, { fields, token: p.body.token, requestId: 'req-direct-1' });
  assert.equal(c.status, 201);
  assert.equal(c.body.version, 1);

  // El «motor» simulado captura exactamente lo que recibe.
  const received = await bridge.getApprovedContext(101, 'test-engine');
  assert.deepEqual(Object.keys(received).sort(), ['approvedAt', 'fields', 'version']);
  assert.deepEqual(received.fields, p.body.representation); // lo entregado = lo que la persona vio
  const audit = state.tables.BridgeTransfer;
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0].keys, ['motivations', 'constraints']);
  assert.match(audit[0].hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(audit), /autonomía|remoto/); // la auditoría no guarda texto
  // El cifrado v2 de `payload` se verifica con la criptografía real en test-db/ (aquí crypto es una réplica sin cifrar).
  const { payload, ...outsidePayload } = state.tables.CareerContextVersion[0];
  assert.doesNotMatch(JSON.stringify(outsidePayload), /autonomía|remoto/); // el texto solo está en `payload`
});

test('ES-25 camino privado: exige consentimiento, no copia el contenido del origen y el motor nunca ve diario, chat ni IDs de origen', async (t) => {
  const { state, diary, turn } = setup();
  const request = await startApp(t);
  const fields = [
    { key: 'values', text: 'Valoro aprender cada día', origin: { type: 'diary_entry', id: diary.id } },
    { key: 'interests', text: 'Datos y educación', origin: { type: 'chat_turn', id: turn.id } },
  ];
  assert.equal((await post(request, 'preview', A, { fields })).status, 403); // sin consentimiento
  assert.equal((await post(request, 'preview', A, { fields })).body.code, 'consent_required');
  assert.equal((await grant(request, A)).status, 200);
  const c = await approve(request, A, fields, 'req-private-1');
  assert.equal(c.status, 201);

  const received = await bridge.getApprovedContext(101, 'test-engine');
  const everything = JSON.stringify([received, state.tables.BridgeTransfer]);
  assert.doesNotMatch(everything, new RegExp(`${DIARY_CANARY}|${CHAT_CANARY}|diary|origin`));
  assert.doesNotMatch(JSON.stringify(received), /"id"/);
  assert.deepEqual(received.fields, [{ key: 'values', text: 'Valoro aprender cada día' }, { key: 'interests', text: 'Datos y educación' }]);
  const stored = state.tables.CareerContextVersion[0];
  assert.equal(stored.consentVersion, 1);
  const { payload, ...outsidePayload } = stored;
  assert.doesNotMatch(JSON.stringify(outsidePayload), new RegExp(`${DIARY_CANARY}|${CHAT_CANARY}|Valoro|Datos y educación`)); // sin texto ni contenido de origen
  assert.doesNotMatch(payload, new RegExp(`${DIARY_CANARY}|${CHAT_CANARY}`));
  assert.deepEqual(Object.keys(stored.origins[0]).sort(), ['index', 'key', 'stamp', 'type', 'id'].sort());
});

test('ES-25 token: campos alterados, vencidos o de otra persona no se pueden confirmar; requestId es idempotente', async (t) => {
  setup();
  const request = await startApp(t);
  const fields = direct();
  const p = await post(request, 'preview', A, { fields });
  const tampered = await post(request, 'confirm', A, { fields: direct('Otro texto'), token: p.body.token, requestId: 'req-token-1' });
  assert.deepEqual([tampered.status, tampered.body.code], [409, 'preview_mismatch']);
  const stolen = await post(request, 'confirm', B, { fields, token: p.body.token, requestId: 'req-token-2' });
  assert.deepEqual([stolen.status, stolen.body.code], [409, 'preview_mismatch']);
  assert.equal((await post(request, 'confirm', A, { fields, token: 'basura', requestId: 'req-token-3' })).status, 400);

  const first = await post(request, 'confirm', A, { fields, token: p.body.token, requestId: 'req-token-4' });
  const again = await post(request, 'confirm', A, { fields, token: p.body.token, requestId: 'req-token-4' });
  assert.deepEqual([first.status, again.status, again.body.version], [201, 200, 1]);

  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 11 * 60 * 1000;
    const expired = await post(request, 'confirm', A, { fields, token: p.body.token, requestId: 'req-token-5' });
    assert.deepEqual([expired.status, expired.body.code], [410, 'preview_expired']);
  } finally { Date.now = realNow; }
});

test('ES-25 entradas inválidas y textos no compartibles: 400/422 controlados, sin guardar y sin revelar el motivo', async (t) => {
  const { state } = setup();
  const request = await startApp(t);
  const cases = [
    {}, { fields: [] }, { fields: 'x' }, { fields: [{ key: 'password', text: 'x' }] }, { fields: [{ key: 'values' }] },
    { fields: [{ key: 'values', text: 'x'.repeat(501) }] }, { fields: [{ key: 'values', text: '   ' }] },
    { fields: [{ key: 'values', text: 'ok', extra: 1 }] }, { fields: [{ key: 'values', text: 'ok', origin: { type: 'email', id: 1 } }] },
    { fields: [{ key: 'values', text: 'ok', origin: { type: 'diary_entry', id: '1' } }] },
    { fields: [{ key: 'values', text: 'ok', origin: { type: 'direct', id: 1 } }] },
    { fields: Array.from({ length: 13 }, () => ({ key: 'values', text: 'ok' })) },
    { fields: Array.from({ length: 4 }, () => ({ key: 'values', text: 'ok' })) },
    { fields: direct(), locale: 'fr' }, { fields: direct(), UserId: 202 },
  ];
  for (const body of cases) {
    const response = await post(request, 'preview', A, body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
    assert.equal(response.body.code, 'invalid_input');
  }
  const risky = await post(request, 'preview', A, { fields: [{ key: 'constraints', text: `Quiero ${'suicidarme'} ${CRISIS_CANARY}` }] });
  assert.equal(risky.status, 422);
  assert.equal(risky.body.code, 'field_not_shareable');
  assert.doesNotMatch(JSON.stringify(risky.body), /riesgo|risk|crisis|suicid/i); // sin motivo
  const masked = await post(request, 'preview', A, { fields: direct('Mi clave sk-abcdefghijklmnopqrstuvwxyz es privada') });
  assert.doesNotMatch(JSON.stringify(masked.body), /sk-abcdef/);
  assert.equal(state.tables.CareerContextVersion.length, 0);
  assert.equal(state.tables.BridgeTransfer.length, 0);
});

test('ES-25 aislamiento: orígenes ajenos, otros roles y consulta solo del dueño', async (t) => {
  const { diary, diaryB } = setup();
  const request = await startApp(t);
  await grant(request, A);
  await grant(request, B);
  const foreign = await post(request, 'preview', A, { fields: [{ key: 'values', text: 'x', origin: { type: 'diary_entry', id: diaryB.id } }] });
  assert.deepEqual([foreign.status, foreign.body.code], [404, 'origin_not_found']);
  assert.equal((await approve(request, A, [{ key: 'values', text: 'Mío', origin: { type: 'diary_entry', id: diary.id } }])).status, 201);
  assert.equal((await request('GET', '/api/career-context', B)).body.versions.length, 0); // B no ve nada de A
  for (const role of ['admin', 'superadmin', 'therapist', 'facilitator']) {
    assert.equal((await request('GET', '/api/career-context', { role, id: 303 })).body.versions.length, 0);
  }
  assert.equal((await request('GET', '/api/career-context', { role: 'user', id: 101 })).body.versions.length, 1);
  assert.equal((await request('GET', '/api/career-context')).status, 403); // sin sesión
  await assert.rejects(bridge.getApprovedContext(202, 'test-engine'), (e) => e.code === 'no_context'); // B no tiene contexto
});

test('ES-25 revocar el consentimiento invalida la versión privada, emite el evento y conserva la versión directa', async (t) => {
  const { state, diary } = setup();
  const request = await startApp(t);
  await grant(request, A);
  const privateFields = [{ key: 'values', text: 'Privado', origin: { type: 'diary_entry', id: diary.id } }];
  await approve(request, A, privateFields, 'req-revoke-1');
  assert.equal((await bridge.getApprovedContext(101, 'e')).fields.length, 1);
  assert.equal((await grant(request, A, 'revoked')).status, 200);
  const [version] = state.tables.CareerContextVersion;
  assert.equal(version.status, 'revoked');
  assert.ok(version.revokedAt);
  assert.deepEqual(state.tables.DerivedInvalidation.map((r) => [r.sourceType, r.reason, r.UserId]), [['career_context_version', 'revoked', 101]]);
  await assert.rejects(bridge.getApprovedContext(101, 'e'), (e) => e.code === 'no_context');
  await grant(request, A); // volver a autorizar no resucita la versión
  await assert.rejects(bridge.getApprovedContext(101, 'e'), (e) => e.code === 'no_context');
  assert.equal((await request('GET', '/api/career-context', A)).body.active, null); // exige confirmar de nuevo

  // La versión escrita directamente no depende del consentimiento y sobrevive a su revocación.
  await approve(request, A, direct('Directo'), 'req-revoke-2');
  await grant(request, A, 'revoked');
  assert.equal((await bridge.getApprovedContext(101, 'e')).fields[0].text, 'Directo');
});

test('ES-25 revocación entre la vista previa y la confirmación, y entre la confirmación y la lectura', async (t) => {
  const { diary } = setup();
  const request = await startApp(t);
  await grant(request, A);
  const fields = [{ key: 'values', text: 'Privado', origin: { type: 'diary_entry', id: diary.id } }];
  const p = await post(request, 'preview', A, { fields });
  await grant(request, A, 'revoked');
  const late = await post(request, 'confirm', A, { fields, token: p.body.token, requestId: 'req-late-1' });
  assert.deepEqual([late.status, late.body.code], [403, 'consent_required']);
  await grant(request, A);
  assert.equal((await approve(request, A, fields, 'req-late-2')).status, 201);
  await request('POST', '/api/career-context/revoke', A);
  await assert.rejects(bridge.getApprovedContext(101, 'e'), (e) => e.code === 'no_context');
});

test('ES-25 versiones: confirmar de nuevo reemplaza la activa, invalida lo derivado y quitar un campo es una versión nueva', async (t) => {
  const { state } = setup();
  const request = await startApp(t);
  await approve(request, A, [...direct('Uno'), { key: 'interests', text: 'Dos' }], 'req-ver-0001');
  const second = await approve(request, A, direct('Uno'), 'req-ver-0002'); // quita «interests»
  assert.equal(second.body.version, 2);
  assert.deepEqual(state.tables.CareerContextVersion.map((r) => [r.version, r.status]), [[1, 'superseded'], [2, 'active']]);
  assert.deepEqual(state.tables.DerivedInvalidation.map((r) => [r.sourceId === state.tables.CareerContextVersion[0].id, r.reason]), [[true, 'superseded']]);
  assert.deepEqual((await bridge.getApprovedContext(101, 'e')).fields, [{ key: 'motivations', text: 'Uno' }]);
  const history = await request('GET', '/api/career-context', A);
  assert.deepEqual(history.body.versions.map((v) => [v.version, v.status]), [[2, 'active'], [1, 'superseded']]);
});

test('ES-25 un cambio o borrado del origen privado marca para revisión pero NO actualiza el contexto', async (t) => {
  const { state, diary } = setup();
  const request = await startApp(t);
  await grant(request, A);
  await approve(request, A, [{ key: 'values', text: 'Congelado', origin: { type: 'diary_entry', id: diary.id } }], 'req-origin-1');
  assert.equal((await request('GET', '/api/career-context', A)).body.active.needsReview, false);
  state.tables.DiaryEntry[0].updatedAt = new Date(); // edición posterior del diario
  assert.equal((await request('GET', '/api/career-context', A)).body.active.needsReview, true);
  assert.deepEqual((await bridge.getApprovedContext(101, 'e')).fields, [{ key: 'values', text: 'Congelado' }]); // sin cambio ni bloqueo
  state.tables.DiaryEntry[0].deletedAt = new Date(); // borrado
  assert.equal((await request('GET', '/api/career-context', A)).body.active.needsReview, true);
  assert.equal((await bridge.getApprovedContext(101, 'e')).fields[0].text, 'Congelado');
});

test('ES-25 frontera en el código: el puente solo pide id y marca de tiempo de los orígenes y la única lectura del motor es getApprovedContext', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'utils', 'careerContext.js'), 'utf8');
  assert.equal((source.match(/attributes: \['id', 'updatedAt'\]/g) || []).length, 4); // resolveOrigins y needsReviewFor, para cada modelo
  assert.doesNotMatch(source, /\.content\b|userContent|replyContent/);
  assert.deepEqual(Object.keys(bridge).sort(), ['BridgeError', 'FIELD_KEYS', 'confirm', 'getApprovedContext', 'list', 'normalizeFields', 'preview', 'revoke', 'revokeForConsent']);
  const routes = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'careerContext.js'), 'utf8');
  assert.doesNotMatch(routes.split(String.fromCharCode(10)).filter((line) => !line.startsWith(String.fromCharCode(47, 47))).join(String.fromCharCode(10)), /getApprovedContext|DiaryEntry|ChatTurn/); // ninguna ruta HTTP entrega el contexto al motor
});
