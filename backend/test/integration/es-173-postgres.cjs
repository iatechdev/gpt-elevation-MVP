// ES-173 (HU-P22) · «Mi opinión» del piloto. HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA.
// Contrato 11613 + decisiones 11887: permiso `pilot_feedback` (separado de `research`), UNA respuesta por ventana (day7|day30), catálogo cerrado, 403 sin permiso, 409 por versión,
// borrado REAL al retirar, agregados SOLO con ≥ 5 personas (probado con 4 y 5), nadie ve respuestas individuales, purga ES-23 sin huérfanos.
//   ES173_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-173-postgres.cjs
// @pg-env ES173_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-173 PostgreSQL + HTTP: «Mi opinión» (permiso, versión, retiro, agregados y purga)', { timeout: 900000 }, async (t) => {
  const { q, mkUser, http, app } = await startRealApi(t, { envVar: 'ES173_TEST_DATABASE_URL', prefix: 'es173' });
  const rid = () => crypto.randomUUID();
  const answers = (patch = {}) => ({ initialValue: 'yes', valueArea: 'career', listened: 'yes', respected: 'yes', professionalClarity: 'yes', helpedBy: ['ideas'], ...patch });
  const put = (who, patch = {}, body = {}) => http(who, 'PUT', '/api/me/pilot-feedback', { requestId: rid(), baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: answers(patch), ...body });
  const get = (who, window = 'day7') => http(who, 'GET', `/api/me/pilot-feedback?window=${window}`);
  const del = (who, window = 'day7', extra = '') => http(who, 'DELETE', `/api/me/pilot-feedback?window=${window}${extra}`);
  const grant = async (who) => { const out = await http(who, 'PUT', '/api/consents/pilot_feedback', { status: 'granted' }); assert.equal(out.status, 200, JSON.stringify(out.body)); };
  const revoke = async (who) => { const out = await http(who, 'PUT', '/api/consents/pilot_feedback', { status: 'revoked' }); assert.equal(out.status, 200, JSON.stringify(out.body)); };
  const person = async () => { const who = await mkUser('user'); await grant(who); return who; };
  const rows = (who) => q('SELECT * FROM "PilotFeedbacks" WHERE "UserId"=$1 ORDER BY id', [who.id]);

  await t.test('flujo: vacío → 403 sin permiso (nada guardado) → permiso → crear → leer → reemplazar → repetición idempotente', async () => {
    const a = await mkUser('user');
    const empty = await get(a); assert.equal(empty.status, 200); assert.deepEqual({ v: empty.body.feedback.version, s: empty.body.feedback.status, a: empty.body.feedback.answers, g: empty.body.feedback.permission.granted }, { v: 0, s: 'none', a: null, g: false });
    const denied = await put(a); assert.equal(denied.status, 403); assert.equal(denied.body.code, 'consent_required'); assert.equal((await rows(a)).length, 0, 'sin permiso no se guarda nada');
    await grant(a);
    const body = { requestId: rid(), baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: answers() };
    const first = await http(a, 'PUT', '/api/me/pilot-feedback', body); assert.equal(first.status, 201, JSON.stringify(first.body)); assert.equal(first.body.feedback.version, 1); assert.equal(first.body.replay, false);
    const read = await get(a); assert.deepEqual(read.body.feedback.answers, answers()); assert.equal(read.body.feedback.lastRequestId, body.requestId); assert.equal(read.body.feedback.permission.granted, true);
    const again = await http(a, 'PUT', '/api/me/pilot-feedback', body); assert.equal(again.status, 200); assert.equal(again.body.replay, true); assert.equal(again.body.feedback.version, 1); assert.equal((await rows(a)).length, 1, 'la repetición no duplica');
    const clash = await http(a, 'PUT', '/api/me/pilot-feedback', { ...body, answers: answers({ listened: 'no' }) }); assert.equal(clash.status, 409); assert.equal(clash.body.code, 'request_conflict');
    const next = await put(a, { listened: 'no' }, { baseVersion: 1 }); assert.equal(next.status, 201); assert.equal(next.body.feedback.version, 2); assert.equal((await get(a)).body.feedback.answers.listened, 'no');
    assert.equal(Number((await q('SELECT count(*) n FROM "PilotFeedbacks" WHERE "UserId"=$1', [a.id]))[0].n), 1, 'una sola fila por persona y ventana');
  });

  await t.test('versión: una base desactualizada da 409 version_conflict con la respuesta guardada y no cambia nada', async () => {
    const a = await person(); await put(a); await put(a, { listened: 'no' }, { baseVersion: 1 });
    const stale = await put(a, { listened: 'unsure' }, { baseVersion: 1 }); assert.equal(stale.status, 409); assert.equal(stale.body.code, 'version_conflict');
    assert.equal(stale.body.current.version, 2); assert.equal(stale.body.current.answers.listened, 'no');
    const future = await put(a, {}, { baseVersion: 9 }); assert.equal(future.status, 409);
    const create = await put(a, {}, { baseVersion: 0 }); assert.equal(create.status, 409, 'crear con base 0 cuando ya existe también es conflicto');
    assert.equal((await rows(a))[0].version, 2); assert.equal((await rows(a))[0].answers.listened, 'no');
  });

  await t.test('catálogo cerrado: claves o valores fuera del catálogo, texto libre, tipos hostiles y formas raras → 400 y NADA guardado (nunca 500)', async () => {
    const a = await person();
    const bad = [
      ['clave extra', { notes: 'texto libre' }], ['valor fuera', { listened: 'maybe' }], ['valor numérico', { listened: 1 }], ['valueArea fuera', { valueArea: 'both ', initialValue: 'yes' }],
      ['valueArea sin initialValue yes', { initialValue: 'no', valueArea: 'career' }], ['helpedBy duplicado', { helpedBy: ['ideas', 'ideas'] }], ['helpedBy fuera', { helpedBy: ['otra'] }],
      ['helpedBy texto', { helpedBy: 'ideas' }], ['helpedBy 5', { helpedBy: ['ideas', 'experience', 'next_step', 'other', 'ideas'] }], ['clarity fuera', { professionalClarity: 'maybe' }],
      ['todo vacío', { initialValue: null, valueArea: null, listened: null, respected: null, professionalClarity: null, helpedBy: [] }], ['proto', JSON.parse('{"__proto__": {"x": 1}}')],
    ];
    for (const [name, patch] of bad) { const out = await put(a, patch); assert.equal(out.status, 400, `${name}: ${JSON.stringify(out.body)}`); assert.ok(['invalid_answers', 'empty_answers'].includes(out.body.code), name); }
    const raw = answers(); delete raw.respected; assert.equal((await put(a, {}, { answers: raw })).status, 400, 'faltan claves');
    for (const value of [null, [], 'texto', 5]) assert.equal((await put(a, {}, { answers: value })).status, 400);
    for (const [name, body] of [['window inválida', { window: 'day1' }], ['window ausente', { window: undefined }], ['window lista', { window: ['day7'] }], ['requestId corto', { requestId: 'x' }], ['requestId con símbolos', { requestId: 'a b c d e f g h' }],
      ['baseVersion negativa', { baseVersion: -1 }], ['baseVersion decimal', { baseVersion: 1.5 }], ['baseVersion texto', { baseVersion: '0' }], ['questionnaireVersion 2', { questionnaireVersion: 2 }], ['UserId en el cuerpo', { UserId: 999 }], ['status en el cuerpo', { status: 'active' }]]) {
      const out = await put(a, {}, body); assert.equal(out.status, 400, `${name}: ${JSON.stringify(out.body)}`);
    }
    assert.equal((await http(a, 'PUT', '/api/me/pilot-feedback', [])).status, 400); assert.equal((await http(a, 'PUT', '/api/me/pilot-feedback', null)).status, 400);
    for (const window of ['', 'day1', 'DAY7', '%00', 'day7&window=day30']) assert.equal((await http(a, 'GET', `/api/me/pilot-feedback?window=${window}`)).status, 400, window);
    assert.equal((await http(a, 'GET', '/api/me/pilot-feedback?window=day7&window=day30')).status, 400); assert.equal((await http(a, 'GET', '/api/me/pilot-feedback')).status, 400);
    assert.equal((await http(a, 'DELETE', '/api/me/pilot-feedback?window=day7&baseVersion=abc')).status, 400);
    assert.equal((await rows(a)).length, 0, 'nada guardado con entradas inválidas');
    const ok = await put(a, { helpedBy: [], listened: 'yes', respected: null, initialValue: null, valueArea: null, professionalClarity: null }); assert.equal(ok.status, 201, 'una sola respuesta basta (todas son opcionales)');
  });

  await t.test('una respuesta por ventana: day7 y day30 son independientes', async () => {
    const a = await person();
    assert.equal((await put(a, { listened: 'yes' })).status, 201); assert.equal((await put(a, { listened: 'no' }, { window: 'day30' })).status, 201);
    assert.equal((await get(a, 'day7')).body.feedback.answers.listened, 'yes'); assert.equal((await get(a, 'day30')).body.feedback.answers.listened, 'no');
    assert.equal((await rows(a)).length, 2); assert.deepEqual((await rows(a)).map((r) => r.windowKey).sort(), ['day30', 'day7']);
    await assert.rejects(() => q('INSERT INTO "PilotFeedbacks" ("UserId","windowKey","questionnaireVersion","answers","version","status","createdAt","updatedAt") VALUES ($1,\'day7\',1,\'{}\',1,\'active\',now(),now())', [a.id]), /duplicate|unique|único/i, 'el índice único lo impide también en la base');
  });

  await t.test('retirar BORRA de verdad: la fila queda withdrawn sin contenido ni requestId; idempotente; reenviar crea una versión nueva; permitido aun sin permiso', async () => {
    const a = await person(); await put(a, { listened: 'yes', helpedBy: ['experience'] });
    const stale = await del(a, 'day7', '&baseVersion=5'); assert.equal(stale.status, 409); assert.equal(stale.body.code, 'version_conflict'); assert.equal((await get(a)).body.feedback.status, 'active', 'una base vieja no borra');
    const out = await del(a, 'day7', '&baseVersion=1'); assert.equal(out.status, 200); assert.equal(out.body.feedback.status, 'withdrawn'); assert.equal(out.body.feedback.answers, null); assert.equal(out.body.feedback.version, 2);
    const row = (await rows(a))[0]; assert.deepEqual(row.answers, {}, 'el contenido se sobrescribe, no se oculta'); assert.equal(row.lastRequestId, null); assert.equal(row.status, 'withdrawn');
    assert.ok(!JSON.stringify(row).includes('experience') && !JSON.stringify(row).includes('yes'), 'ninguna respuesta queda en la fila');
    const again = await del(a); assert.equal(again.status, 200); assert.equal(again.body.feedback.version, 2, 'idempotente: no sube la versión');
    assert.equal((await get(a)).body.feedback.answers, null);
    const resend = await put(a, { listened: 'no' }, { baseVersion: 2 }); assert.equal(resend.status, 201); assert.equal(resend.body.feedback.version, 3); assert.equal(resend.body.feedback.answers.listened, 'no');
    await revoke(a); const noConsent = await del(a); assert.equal(noConsent.status, 200, 'retirar no exige el permiso'); assert.equal((await rows(a))[0].status, 'withdrawn');
    const none = await mkUser('user'); const nothing = await del(none); assert.equal(nothing.status, 200); assert.equal(nothing.body.feedback.status, 'none'); assert.equal((await rows(none)).length, 0, 'retirar sin respuesta no crea filas');
  });

  await t.test('revocar el permiso no borra lo escrito pero impide enviar; volver a concederlo reanuda; el propósito es independiente de research', async () => {
    const a = await person(); await put(a, { listened: 'yes' });
    await revoke(a); const read = await get(a); assert.equal(read.body.feedback.answers.listened, 'yes', 'lo escrito sigue ahí'); assert.equal(read.body.feedback.permission.granted, false);
    const blocked = await put(a, { listened: 'no' }, { baseVersion: 1 }); assert.equal(blocked.status, 403); assert.equal((await rows(a))[0].version, 1, 'no se escribió');
    await grant(a); assert.equal((await put(a, { listened: 'no' }, { baseVersion: 1 })).status, 201);
    const b = await mkUser('user'); assert.equal((await http(b, 'PUT', '/api/consents/research', { status: 'granted' })).status, 200);
    assert.equal((await put(b)).status, 403, 'autorizar investigación NO autoriza la opinión');
    const list = (await http(a, 'GET', '/api/consents')).body.consents; assert.ok(list.some((c) => c.purpose === 'pilot_feedback' && c.status === 'granted' && c.requiredVersion === 1), 'aparece en la lista de propósitos');
    const history = (await http(a, 'GET', '/api/consents/history')).body.history; assert.ok(history.filter((h) => h.purpose === 'pilot_feedback').map((h) => h.status).includes('revoked'));
    await q('UPDATE "Consents" SET version=0 WHERE "UserId"=$1 AND purpose=\'pilot_feedback\'', [a.id]);
    assert.equal((await put(a, { listened: 'yes' }, { baseVersion: 2 })).status, 403, 'una versión anterior del permiso deja de valer');
  });

  await t.test('propietario: la respuesta de A nunca es visible para B, para un profesional ni para administración; no hay ruta ni parámetro para leer la de otra persona', async () => {
    const a = await person(); const b = await person(); const pro = await mkUser('therapist'); const admin = await mkUser('admin'); const boss = await mkUser('superadmin'); const board = await mkUser('board');
    await put(a, { listened: 'yes', helpedBy: ['next_step'] });
    for (const who of [b, pro, admin, boss, board]) { const out = await get(who); assert.equal(out.status, 200); assert.equal(out.body.feedback.answers, null, 'cada quien ve solo lo suyo'); assert.ok(!JSON.stringify(out.body).includes('next_step')); }
    assert.equal((await http(b, 'GET', `/api/me/pilot-feedback?window=day7&UserId=${a.id}&userId=${a.id}&id=1`)).body.feedback.answers, null, 'un id en la consulta no cambia de titular');
    assert.equal((await put(b, {}, { UserId: a.id })).status, 400, 'un titular en el cuerpo se rechaza'); assert.equal((await rows(a))[0].version, 1);
    assert.equal((await del(b)).body.feedback.status, 'none'); assert.equal((await rows(a))[0].status, 'active', 'B no puede retirar la de A');
    for (const path of [`/api/me/pilot-feedback/${a.id}`, `/api/admin/pilot-feedback`, `/api/admin/pilot-feedback/${a.id}`, `/api/admin/pilot-metrics/${a.id}`]) for (const who of [b, pro, admin, boss]) { const out = await http(who, 'GET', path); assert.ok([403, 404].includes(out.status) && !JSON.stringify(out.body).includes('next_step'), `${path}: no existe una ruta individual (${out.status})`); if (['admin', 'superadmin'].includes(who.role) || path.startsWith('/api/me')) assert.equal(out.status, 404, path); }
    const metrics = await http(admin, 'GET', '/api/admin/pilot-metrics'); assert.equal(metrics.status, 200); assert.ok(!JSON.stringify(metrics.body).includes('next_step') && !JSON.stringify(metrics.body).includes(String(a.id)), 'los agregados no traen respuestas ni ids');
    assert.ok([401, 403].includes((await http(null, 'GET', '/api/me/pilot-feedback?window=day7')).status)); assert.ok([401, 403].includes((await http(null, 'PUT', '/api/me/pilot-feedback', {})).status)); assert.ok([401, 403].includes((await http(null, 'DELETE', '/api/me/pilot-feedback?window=day7')).status));
  });

  await t.test('agregados: con 4 personas NO se publica nada (sin conteos); con 5 sí; 5 elegibles con 4 respuestas tampoco; revocar o retirar saca a la persona', async () => {
    const admin = await mkUser('admin');
    // Base limpia: ninguna otra persona con permiso ni respuestas activas en esta prueba.
    await q('DELETE FROM "PilotFeedbacks"'); await q('UPDATE "Consents" SET status=\'revoked\' WHERE purpose=\'pilot_feedback\'');
    const metricsOf = async () => { const out = await http(admin, 'GET', '/api/admin/pilot-metrics'); assert.equal(out.status, 200, JSON.stringify(out.body)); return Object.fromEntries(out.body.metrics.map((m) => [m.key, m])); };
    const people = []; for (let i = 0; i < 4; i++) { const p = await person(); people.push(p); assert.equal((await put(p, { listened: 'yes', respected: 'yes', professionalClarity: i < 3 ? 'yes' : 'no' })).status, 201); assert.equal((await put(p, { professionalClarity: i < 3 ? 'yes' : 'no' }, { window: 'day30' })).status, 201); }
    let m = await metricsOf();
    assert.deepEqual(m.listening, { key: 'listening', status: 'suppressed', window: 'day7' }, '4 personas: suprimida y SIN conteos'); assert.ok(!('counts' in m.listening)); assert.equal(m.utility.status, 'suppressed');
    assert.deepEqual([m.activation.status, m.experiment.status], ['not_available', 'not_available']);
    const fifth = await person(); assert.equal((await put(fifth, { listened: 'yes', respected: 'no', professionalClarity: 'yes' })).status, 201); await put(fifth, { professionalClarity: 'yes' }, { window: 'day30' });
    m = await metricsOf();
    assert.deepEqual(m.listening, { key: 'listening', status: 'ready', window: 'day7', counts: { eligible: 5, responded: 5, missing: 0, positive: 4 } }, '5 personas: se publica');
    assert.deepEqual(m.utility.counts, { eligible: 5, responded: 5, missing: 0, positive: 4 });
    // 5 elegibles pero solo 4 respondieron la pregunta → suprimida (no se puede reidentificar a quien respondió)
    const sixth = await person(); m = await metricsOf(); assert.equal(m.listening.counts.eligible, 6); assert.equal(m.listening.counts.missing, 1);
    await put(sixth, { listened: null, respected: null, professionalClarity: 'not_explored', initialValue: 'yes' }); m = await metricsOf(); assert.equal(m.listening.counts.responded, 5, 'una pregunta sin responder no cuenta'); assert.equal(m.utility.counts.responded, 5, '«no he explorado» no cuenta como respuesta');
    await revoke(fifth); m = await metricsOf(); assert.equal(m.listening.status, 'suppressed', 'quien revoca sale del agregado al instante (quedan 4 que respondieron)'); assert.ok(!('counts' in m.listening));
    await grant(fifth); m = await metricsOf(); assert.equal(m.listening.status, 'ready');
    assert.equal((await del(people[0])).status, 200); m = await metricsOf(); assert.equal(m.listening.status, 'suppressed', 'quien retira su respuesta sale del agregado');
    for (const role of ['user', 'therapist', 'board']) { const who = await mkUser(role); assert.equal((await http(who, 'GET', '/api/admin/pilot-metrics')).status, 403, role); }
    assert.ok([401, 403].includes((await http(null, 'GET', '/api/admin/pilot-metrics')).status));
    const text = JSON.stringify((await http(admin, 'GET', '/api/admin/pilot-metrics')).body); assert.ok(!/"(UserId|userId|answers|email|name|id)"/.test(text), 'ni identidad ni respuestas');
    await q('UPDATE "Users" SET role=\'admin\' WHERE id=$1', [people[1].id]); m = await metricsOf(); assert.ok(m.listening.status === 'suppressed' || m.listening.counts.eligible <= 5, 'solo cuentan personas (rol user)');
    await q('UPDATE "Users" SET role=\'user\' WHERE id=$1', [people[1].id]);
  });

  await t.test('carreras ×40: respuestas simultáneas nunca dan 5xx, no duplican y dejan una sola versión ganadora', async () => {
    const a = await person();
    const same = rid(); const body = { requestId: same, baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: answers() };
    const burst = await Promise.all(Array.from({ length: 40 }, () => http(a, 'PUT', '/api/me/pilot-feedback', body)));
    assert.ok(burst.every((r) => r.status < 500), JSON.stringify(burst.filter((r) => r.status >= 500).map((r) => r.body)));
    assert.equal(burst.filter((r) => r.status === 201).length, 1, 'una sola creación'); assert.ok(burst.every((r) => [200, 201].includes(r.status)), 'el resto son repeticiones idempotentes');
    assert.equal((await rows(a)).length, 1); assert.equal((await rows(a))[0].version, 1);
    const b = await person(); const different = await Promise.all(Array.from({ length: 40 }, (_, i) => put(b, { listened: i % 2 ? 'yes' : 'no' })));
    assert.ok(different.every((r) => r.status < 500), JSON.stringify(different.filter((r) => r.status >= 500).map((r) => r.body)));
    assert.equal(different.filter((r) => r.status === 201).length, 1, 'con la misma base solo una gana'); assert.ok(different.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.body.code === 'version_conflict'));
    assert.equal((await rows(b)).length, 1); assert.equal((await rows(b))[0].version, 1);
    const c = await person(); await put(c);
    const mixed = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? del(c) : i % 4 === 1 ? revoke(c).then(() => ({ status: 200 })) : put(c, { listened: 'no' }, { baseVersion: 1 }))));
    assert.ok(mixed.every((r) => r.status < 500), 'retirar, revocar y escribir a la vez: sin 5xx'); assert.ok((await rows(c)).length === 1);
    await revoke(c); assert.equal((await put(c, {}, { baseVersion: (await rows(c))[0].version })).status, 403, 'tras revocar, nada entra');
  });

  await t.test('ES-23: entra a personalData.CORE (se exporta lo propio, sin requestId) y la purga no deja huérfanos ni toca a otras personas', async () => {
    const { personalData, CORE } = require('../../utils/personalData'); const User = require('../../User'); const { requestDeletion } = require('../../utils/dataRights'); const { processDeletion } = require('../../utils/deletionProcessor');
    assert.ok(CORE.some((row) => row[1] === 'PilotFeedback' && row[2] === 'UserId'), 'PilotFeedback en CORE');
    const a = await person(); const b = await person(); await put(a, { listened: 'yes', helpedBy: ['ideas'] }); await put(a, { listened: 'no' }, { window: 'day30' }); await put(b, { listened: 'unsure' });
    const data = await personalData(await User.findByPk(a.id), 'es'); assert.equal(data.pilotFeedbacks.length, 2); assert.deepEqual(data.pilotFeedbacks.map((f) => f.windowKey).sort(), ['day30', 'day7']);
    assert.equal(data.pilotFeedbacks.find((f) => f.windowKey === 'day7').answers.helpedBy[0], 'ideas'); assert.ok(!JSON.stringify(data.pilotFeedbacks).includes('requestId') && !JSON.stringify(data.pilotFeedbacks).includes('lastRequestId'), 'sin referencias técnicas');
    assert.ok(!JSON.stringify(data).includes('unsure'), 'la respuesta de B no está en la exportación de A');
    const bBefore = JSON.stringify(await rows(b));
    await requestDeletion(a.id); const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [a.id]))[0].id; await processDeletion(request, { quiescent: true });
    assert.equal((await rows(a)).length, 0, 'purgado sin huérfanos'); assert.equal(JSON.stringify(await rows(b)), bBefore, 'la de B intacta');
    assert.equal(Number((await q('SELECT count(*) n FROM "PilotFeedbacks" WHERE "UserId" NOT IN (SELECT id FROM "Users")'))[0].n), 0, 'sin filas sin dueño');
  });

  await t.test('migración: RLS activa, índice único, idempotente (up dos veces) y up→down→up sin pérdida de estructura', async () => {
    const mig = require('../../migrations/20261113020000-es173-pilot-feedback.cjs');
    const rls = async () => (await q('SELECT relrowsecurity FROM pg_class WHERE relname=\'PilotFeedbacks\''))[0].relrowsecurity;
    assert.equal(await rls(), true, 'RLS desde la migración');
    await mig.up(app); await mig.up(app); assert.equal(await rls(), true, 'up es idempotente');
    assert.equal((await q('SELECT count(*) n FROM pg_indexes WHERE tablename=\'PilotFeedbacks\' AND indexname=\'pilot_feedbacks__user_window\''))[0].n, '1');
    await assert.rejects(() => mig.down(app.getQueryInterface()), /ALLOW_DESTRUCTIVE_MIGRATION/, 'el down exige permiso explícito');
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    try { await mig.down(app.getQueryInterface()); } finally { delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; }
    assert.equal((await q('SELECT to_regclass(\'"PilotFeedbacks"\') t'))[0].t, null, 'down borra la tabla');
    await mig.up(app); assert.equal(await rls(), true); assert.equal((await q('SELECT count(*) n FROM "PilotFeedbacks"'))[0].n, '0');
    const cols = (await q('SELECT column_name FROM information_schema.columns WHERE table_name=\'PilotFeedbacks\'')).map((r) => r.column_name).sort();
    assert.deepEqual(cols, ['UserId', 'answers', 'createdAt', 'id', 'lastRequestId', 'questionnaireVersion', 'status', 'updatedAt', 'version', 'windowKey']);
  });
});
