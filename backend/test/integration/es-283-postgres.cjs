// ES-283 (E235-1) · Endurece las pruebas de la purga de ES-274 contra PostgreSQL REAL: (1) cada referencia del lado del profesional bloquea la purga POR SÍ SOLA (mata la mutación
// «blocksPurge sin chosenTherapistId» y cualquier otra de una referencia); (2) un fallo REAL de la base (trigger) en cada paso de la purga revierte TODO (mata «el UPDATE de sesiones
// fuera de la transacción»); (3) caracteriza lo que hoy pasa con ProfessionalApplications, para que cambiar esa decisión sea deliberado. No cambia comportamiento de producción.
//   ES283_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-283-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

test('ES-283 PostgreSQL: pruebas de la purga (referencias, fallo real por paso, ProfessionalApplications)', { timeout: 300000 }, async (t) => {
  const { q, mkUser } = await startRealApi(t, { envVar: 'ES283_TEST_DATABASE_URL', prefix: 'es283' });
  const seed = makeSeeder(q);
  const { requestDeletion } = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const purge = async (person) => {
    await requestDeletion(person.id);
    const id = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id;
    return { id, run: () => processDeletion(id, { quiescent: true }) };
  };
  const mood = (person) => seed('MoodLogs', { UserId: person.id, date: '2026-10-02', checkin_mood: 3 });
  const other = await mkUser('user'); const therapist = await mkUser('therapist');

  // ── 1. Cada referencia del lado del profesional/administración bloquea POR SÍ SOLA ──────────────────────────────────────────────────────────
  const REFERENCES = {
    'ClinicalNote.therapistId': (u) => seed('ClinicalNotes', { UserId: other.id, therapistId: u.id }),
    'TherapySession.therapistId': (u) => seed('TherapySessions', { therapistId: u.id, patientId: other.id }),
    'SessionNote.therapistId': async (u) => { const s = await seed('TherapySessions', { therapistId: therapist.id, patientId: other.id }); return seed('SessionNotes', { sessionId: s.id, therapistId: u.id }); },
    'TherapistProfile.UserId': (u) => seed('TherapistProfiles', { UserId: u.id }),
    'TherapistValidation.therapistId': (u) => seed('TherapistValidations', { therapistId: u.id }),
    'MatchingRequest.chosenTherapistId': (u) => seed('MatchingRequests', { UserId: other.id, chosenTherapistId: u.id }),
    'EthicManifest.uploadedBy': (u) => seed('EthicManifests', { uploadedBy: u.id }),
    'PlanRequest.resolvedBy': async (u) => { const plan = await seed('PricingPlans', { slug: 'es283' }); return seed('PlanRequests', { userId: other.id, planId: plan.id, resolvedBy: u.id }); },
    'User.therapistId': async (u) => { await q('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [u.id, other.id]); },
  };
  await t.test('control positivo: una persona sin ninguna referencia del lado profesional SÍ se purga', async () => {
    const free = await mkUser('user'); await mood(free);
    const out = await (await purge(free)).run();
    assert.equal(out.status, 'awaiting_verification');
    assert.equal((await q('SELECT count(*)::int n FROM "MoodLogs" WHERE "UserId"=$1', [free.id]))[0].n, 0);
  });
  for (const [name, make] of Object.entries(REFERENCES)) {
    await t.test(`una sola referencia «${name}» basta para dejar la solicitud en revisión y NO borrar nada`, async () => {
      const subject = await mkUser('user'); await mood(subject);
      await make(subject);
      const out = await (await purge(subject)).run();
      assert.equal(out.status, 'awaiting_review', name);
      assert.equal((await q('SELECT count(*)::int n FROM "MoodLogs" WHERE "UserId"=$1', [subject.id]))[0].n, 1, 'nada se borró');
      assert.equal((await q('SELECT active FROM "Users" WHERE id=$1', [subject.id]))[0].active, false, 'el acceso sí queda cortado');
      assert.ok(!/deleted\.invalid/.test((await q('SELECT email FROM "Users" WHERE id=$1', [subject.id]))[0].email), 'sin lápida: el usuario no se anonimizó');
    });
  }

  // ── 2. Fallo REAL de la base en cada paso: la purga se revierte entera y el reintento la completa ─────────────────────────────────────────────
  async function richPerson() {
    const person = await mkUser('user', { therapistId: therapist.id });
    await mood(person);
    await seed('MatchingRequests', { UserId: person.id, chosenTherapistId: therapist.id });
    await seed('ClinicalNotes', { UserId: person.id, therapistId: therapist.id });
    await seed('TherapySessions', { therapistId: therapist.id, patientId: person.id, patientMoodAfter: 4, cancelReason: 'motivo', meetingUrl: 'https://example.test/s', recordingUrl: 'https://example.test/g', googleEventId: 'ev' });
    return person;
  }
  const snapshot = async (p) => JSON.stringify([
    await q('SELECT * FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY id', [p.id]), await q('SELECT * FROM "MatchingRequests" WHERE "UserId"=$1 ORDER BY id', [p.id]),
    await q('SELECT * FROM "ClinicalNotes" WHERE "UserId"=$1 ORDER BY id', [p.id]), await q('SELECT * FROM "TherapySessions" WHERE "patientId"=$1 ORDER BY id', [p.id]),
    await q('SELECT id,name,email,password,active,"therapistId" FROM "Users" WHERE id=$1', [p.id]),
  ]);
  const STEPS = [
    ['borrado de lo de la persona (CORE)', 'BEFORE DELETE ON "MoodLogs"'],
    ['borrado del emparejamiento', 'BEFORE DELETE ON "MatchingRequests"'],
    ['campos de persona en las sesiones', 'BEFORE UPDATE ON "TherapySessions"'],
    ['lápida del usuario', 'BEFORE UPDATE ON "Users"'],
  ];
  for (const [label, when] of STEPS) {
    await t.test(`fallo real en «${label}»: todo se revierte, la solicitud queda failed con código genérico y, sin el fallo, el reintento completa la purga`, async () => {
      const person = await richPerson();
      const job = await purge(person); // requestDeletion ya cortó el acceso; el fallo se instala DESPUÉS, para que solo afecte a la purga
      const before = await snapshot(person);
      await q(`CREATE OR REPLACE FUNCTION es283_falla() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'SELECT secreto FROM tabla_interna'; END $$ LANGUAGE plpgsql`);
      const table = when.split(' ON ')[1];
      await q(`CREATE TRIGGER es283_falla ${when} FOR EACH ROW EXECUTE FUNCTION es283_falla()`);
      try {
        await assert.rejects(job.run(), (error) => { assert.doesNotMatch(error.message, /secreto|SELECT|tabla_interna/); return true; });
      } finally { await q(`DROP TRIGGER es283_falla ON ${table}`); }
      assert.equal(await snapshot(person), before, 'ninguna fila cambió: ni lo borrado antes del fallo ni la lápida');
      const request = (await q('SELECT status,"failureCode","activePurgedAt" FROM "DeletionRequests" WHERE id=$1', [job.id]))[0];
      assert.equal(request.status, 'failed'); assert.equal(request.failureCode, 'active_purge_failed'); assert.equal(request.activePurgedAt, null);
      assert.doesNotMatch(JSON.stringify(request), /secreto|SELECT|tabla_interna/);
      const retry = await job.run();
      assert.equal(retry.status, 'awaiting_verification');
      assert.equal((await q('SELECT count(*)::int n FROM "MoodLogs" WHERE "UserId"=$1', [person.id]))[0].n, 0);
      assert.equal((await q('SELECT count(*)::int n FROM "MatchingRequests" WHERE "UserId"=$1', [person.id]))[0].n, 0);
      assert.equal((await q('SELECT count(*)::int n FROM "ClinicalNotes" WHERE "UserId"=$1', [person.id]))[0].n, 1, 'lo del profesional se conserva');
      assert.equal((await q('SELECT "patientMoodAfter","meetingUrl" FROM "TherapySessions" WHERE "patientId"=$1', [person.id]))[0].patientMoodAfter, null);
    });
  }

  // ── 3. ProfessionalApplications (pregunta abierta para Mauricio/Alejo): se CARACTERIZA lo que pasa hoy ───────────────────────────────────────────
  await t.test('ProfessionalApplications: tras la purga de la persona su solicitud (nombre, correo, licencia, mensaje) SIGUE en la base con userId hacia la lápida — decisión pendiente', async () => {
    const person = await mkUser('user'); await mood(person);
    const app = await seed('ProfessionalApplications', { name: 'Nombre Solicitante Sintético', email: 'solicitante-sintetico@example.test', country: 'Colombia', profession: 'Psicología',
      licenseNumber: 'LIC-SINTETICA-1', message: 'Mensaje libre de la solicitud', status: 'approved', consentAt: new Date(), userId: person.id });
    await seed('ProfessionalApplicationFiles', { ApplicationId: app.id });
    const out = await (await purge(person)).run();
    assert.equal(out.status, 'awaiting_verification', 'la purga de la persona procede: la solicitud no la bloquea');
    const left = (await q('SELECT name,email,"licenseNumber",message,"userId" FROM "ProfessionalApplications" WHERE id=$1', [app.id]))[0];
    // Si el equipo decide purgar (o minimizar) esta fila con la cuenta, ESTA aserción debe cambiar a propósito, junto con la excepción de es-88 y los textos de pantalla.
    assert.deepEqual(left, { name: 'Nombre Solicitante Sintético', email: 'solicitante-sintetico@example.test', licenseNumber: 'LIC-SINTETICA-1', message: 'Mensaje libre de la solicitud', userId: person.id });
    assert.equal((await q('SELECT count(*)::int n FROM "ProfessionalApplicationFiles" WHERE "ApplicationId"=$1', [app.id]))[0].n, 1, 'la hoja de vida de la solicitud también sigue');
  });
});
