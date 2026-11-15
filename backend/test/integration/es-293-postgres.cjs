// ES-293 (E249-1) · Decisión de Mauricio (12-nov-2026), opción C — MINIMIZAR: al purgar a una persona, su solicitud de profesional conserva SOLO estado y fechas; se borran nombre, correo, país,
// profesión, licencia, perfil, mensaje, revisor, nota y hoja de vida. PostgreSQL REAL (migraciones reales), purga real (processDeletion), datos sintéticos.
//   ES293_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-293-postgres.cjs
// @pg-env ES293_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-293 PostgreSQL: la purga de la persona minimiza su solicitud de profesional (solo estado y fechas)', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES293_TEST_DATABASE_URL', prefix: 'es293' });
  const seed = makeSeeder(q);
  const { requestDeletion } = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const purge = async (person) => {
    await requestDeletion(person.id);
    const id = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id;
    return { id, run: (options = {}) => processDeletion(id, { quiescent: true, ...options }) };
  };
  const mood = (person) => seed('MoodLogs', { UserId: person.id, date: '2026-10-02', checkin_mood: 3 });
  const CANARY = { name: 'Nombre Canario Solicitante', license: 'LIC-CANARIO-777', message: 'Mensaje canario de la solicitud', profile: 'https://canario.example.test/perfil', reviewer: 'Revisor Canario', note: 'Nota canaria de revisión', country: 'Canarilandia', profession: 'Profesión canaria' };
  const application = (extra = {}) => seed('ProfessionalApplications', { name: CANARY.name, email: 'solicitante-canario@example.test', country: CANARY.country, profession: CANARY.profession, licenseNumber: CANARY.license,
    profileUrl: CANARY.profile, message: CANARY.message, status: 'approved', reviewedBy: CANARY.reviewer, reviewNote: CANARY.note, reviewedAt: new Date('2026-10-10T10:00:00Z'), consentAt: new Date('2026-10-01T09:00:00Z'), ...extra });
  const withFile = async (app, size = 4096) => seed('ProfessionalApplicationFiles', { ApplicationId: app.id, size, sha256: 'a'.repeat(64) });
  const row = async (id) => (await q('SELECT * FROM "ProfessionalApplications" WHERE id=$1', [id]))[0];
  const files = async (id) => (await q('SELECT count(*)::int n FROM "ProfessionalApplicationFiles" WHERE "ApplicationId"=$1', [id]))[0].n;
  const bytes = async () => Number((await q('SELECT COALESCE(sum(size),0)::bigint n FROM "ProfessionalApplicationFiles"'))[0].n);
  const noCanary = (data) => { const text = JSON.stringify(data); for (const value of Object.values(CANARY)) assert.ok(!text.includes(value), 'la fila no debe conservar «' + value + '»'); assert.ok(!/solicitante-canario|canario-correo/i.test(text), 'ni el correo'); };

  await t.test('solicitud ligada a la cuenta: se conservan SOLO estado y fechas; nombre, correo, licencia, perfil, mensaje, revisor, nota y hoja de vida desaparecen; el recibo lo declara', async () => {
    const person = await mkUser('user'); await mood(person);
    const app = await application({ userId: person.id }); await withFile(app); const before = await row(app.id);
    const out = await (await purge(person)).run();
    assert.equal(out.status, 'awaiting_verification'); assert.ok(out.retained.includes('professionalApplication'), 'el recibo declara la categoría (sin contenido): ' + JSON.stringify(out));
    const after = await row(app.id); noCanary(after);
    assert.equal(after.status, 'approved', 'el estado se conserva'); assert.equal(after.createdAt.getTime(), before.createdAt.getTime()); assert.equal(after.consentAt.getTime(), before.consentAt.getTime()); assert.equal(after.reviewedAt.getTime(), before.reviewedAt.getTime());
    assert.equal(after.userId, person.id, 'enlace a la lápida (sin datos)'); assert.ok(after.minimizedAt, 'queda marcada como minimizada');
    for (const column of ['licenseNumber', 'profileUrl', 'message', 'reviewedBy', 'reviewNote']) assert.equal(after[column], null, column);
    assert.equal(after.email, `app-${app.id}@deleted.invalid`); assert.equal(await files(app.id), 0, 'la hoja de vida se borra');
    assert.equal((await q('SELECT count(*)::int n FROM "ProfessionalApplications" WHERE id=$1', [app.id]))[0].n, 1, 'la fila NO se borra');
  });

  await t.test('una solicitud hecha con el correo ORIGINAL de la persona (aún sin cuenta ligada, en otro uso de mayúsculas) también se minimiza; una pendiente queda cerrada y libera cupo; la de OTRA persona no se toca (A/B)', async () => {
    const person = await mkUser('user'); await mood(person); const email = (await q('SELECT email FROM "Users" WHERE id=$1', [person.id]))[0].email;
    const mine = await application({ email: email.toUpperCase(), status: 'pending', reviewedAt: null }); await withFile(mine, 5000);
    const stranger = await application({ email: 'otra-persona-canaria@example.test', status: 'pending', reviewedAt: null }); await withFile(stranger, 7000);
    const bytesBefore = await bytes();
    await (await purge(person)).run();
    const gone = await row(mine.id); noCanary(gone); assert.equal(gone.status, 'rejected', 'la pendiente sin datos se cierra'); assert.ok(gone.reviewedAt); assert.equal(await files(mine.id), 0); assert.equal(gone.userId, person.id);
    const intact = await row(stranger.id); assert.equal(intact.name, CANARY.name); assert.equal(intact.email, 'otra-persona-canaria@example.test'); assert.equal(intact.status, 'pending'); assert.equal(intact.minimizedAt, null); assert.equal(await files(stranger.id), 1);
    assert.equal(await bytes(), bytesBefore - 5000, 'el cupo de bytes se libera solo por la hoja de vida minimizada');
  });

  await t.test('sin solicitud no hay categoría ni cambios; repetir la purga o reintentar el recibo es idempotente (no toca de nuevo ni cambia fechas)', async () => {
    const none = await mkUser('user'); await mood(none); const out = await (await purge(none)).run();
    assert.ok(!(out.retained ?? []).includes('professionalApplication'));
    const person = await mkUser('user'); await mood(person); const app = await application({ userId: person.id, email: 'idem-canaria@example.test' }); await withFile(app);
    const run = await purge(person); const first = await run.run(); const stamp = (await row(app.id)).minimizedAt.getTime();
    const second = await run.run(); const replay = await run.run({ replay: true });
    for (const receipt of [first, second, replay]) assert.ok(receipt.retained.includes('professionalApplication'));
    assert.equal((await row(app.id)).minimizedAt.getTime(), stamp, 'la marca no cambia'); noCanary(await row(app.id));
  });

  await t.test('fallo real a mitad: todo se revierte (la solicitud sigue íntegra y su hoja de vida también) y, sin el fallo, el reintento completa la minimización', async () => {
    const person = await mkUser('user'); await mood(person); const app = await application({ userId: person.id, email: 'rollback-canaria@example.test' }); await withFile(app);
    await q("CREATE OR REPLACE FUNCTION es293_fail() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'es293 fallo simulado'; END $f$ LANGUAGE plpgsql");
    await q('CREATE TRIGGER es293_fail_trg BEFORE UPDATE ON "ProfessionalApplications" FOR EACH ROW EXECUTE FUNCTION es293_fail()');
    const run = await purge(person);
    try { await assert.rejects(run.run(), /Active purge failed/); } finally { await q('DROP TRIGGER es293_fail_trg ON "ProfessionalApplications"'); }
    const intact = await row(app.id); assert.equal(intact.name, CANARY.name); assert.equal(intact.minimizedAt, null); assert.equal(await files(app.id), 1, 'la hoja de vida NO se borró (misma transacción)');
    assert.equal((await q('SELECT status FROM "DeletionRequests" WHERE id=$1', [run.id]))[0].status, 'failed');
    const out = await run.run({ replay: true }); assert.equal(out.status, 'awaiting_verification'); noCanary(await row(app.id)); assert.equal(await files(app.id), 0);
  });

  await t.test('la lista de administración (HTTP real) ya no muestra datos de la persona ni su hoja de vida tras la purga, y el contrato de la API no cambia; la hoja de vida ya no se descarga', async () => {
    const person = await mkUser('user'); await mood(person); const app = await application({ userId: person.id, email: 'lista-canaria@example.test' }); await withFile(app);
    const admin = await mkUser('admin'); const before = await http(admin, 'GET', '/api/admin/professional-applications'); const shape = Object.keys(before.body.find((x) => x.id === app.id)).sort();
    await (await purge(person)).run();
    const listed = await http(admin, 'GET', '/api/admin/professional-applications'); assert.equal(listed.status, 200);
    const mine = listed.body.find((x) => x.id === app.id); noCanary(mine); assert.equal(mine.name, 'Solicitud eliminada / Deleted application'); assert.deepEqual(Object.keys(mine).sort(), shape, 'mismas claves');
    assert.notEqual((await http(admin, 'GET', `/api/admin/professional-applications/${app.id}/cv`)).status, 200, 'la hoja de vida ya no existe');
  });
});
