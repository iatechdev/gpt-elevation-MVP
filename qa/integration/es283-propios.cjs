// [QA-Claude] ES-283 (PR #249) · mi propio fallo a mitad de la purga: triggers REALES en pasos y tablas distintos de los de es-283-postgres.cjs, con la huella md5 de TODA la base (no solo de la persona).
//   QA_SUT=<repo> QA_OUT=<carpeta> QA249_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es283-propios.cjs
// Verifica: rollback total (ninguna tabla cambia salvo la solicitud), `failed` con código genérico sin SQL, el reintento completa, y que lo de otra persona no se toca. Solo loopback, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
const { makeSeeder } = require(SUT + '/test/support/seedRow.cjs');
process.chdir(SUT);
process.env.DATA_RIGHTS_ENABLED = 'true';
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 900) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 900) }) + '\n'); };

(async () => {
  const { q, mkUser } = await startRealApi(t, { envVar: 'QA249_DB', prefix: 'qa249' });
  const seed = makeSeeder(q);
  const { requestDeletion } = require(SUT + '/utils/dataRights');
  const { processDeletion } = require(SUT + '/utils/deletionProcessor');
  const tables = (await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")).map((r) => r.table_name).filter((n) => n !== 'SequelizeMeta');
  const fingerprint = async (skip = []) => { const out = {}; for (const tb of tables) { if (skip.includes(tb)) continue; out[tb] = (await q(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) h, count(*)::int n FROM "${tb}" x`))[0]; } return out; };
  const diff = (a, b) => Object.keys(a).filter((k) => a[k].h !== b[k].h);
  const therapist = await mkUser('therapist'); const bystander = await mkUser('user', { therapistId: therapist.id });
  await seed('MoodLogs', { UserId: bystander.id, date: '2026-10-01', checkin_mood: 4 }); await seed('DiaryEntries', { UserId: bystander.id });
  const richPerson = async () => {
    const p = await mkUser('user', { therapistId: therapist.id });
    await seed('MoodLogs', { UserId: p.id, date: '2026-10-02', checkin_mood: 2 }); await seed('DiaryEntries', { UserId: p.id }); await seed('Evidence', { UserId: p.id });
    await seed('MatchingRequests', { UserId: p.id, chosenTherapistId: therapist.id }); await seed('ClinicalNotes', { UserId: p.id, therapistId: therapist.id });
    await seed('TherapySessions', { therapistId: therapist.id, patientId: p.id, patientMoodAfter: 3, meetingUrl: 'https://example.test/s' });
    return p;
  };
  const cases = [
    ['Evidence (otra tabla de lo de la persona)', 'BEFORE DELETE ON "Evidence" FOR EACH ROW'],
    ['DiaryEntries (borrado del diario)', 'BEFORE DELETE ON "DiaryEntries" FOR EACH ROW'],
    ['ExportRequests (paso posterior a las sesiones)', 'BEFORE DELETE ON "ExportRequests" FOR EACH ROW'],
    ['solicitud → awaiting_verification (el ÚLTIMO paso)', 'BEFORE UPDATE ON "DeletionRequests" FOR EACH ROW WHEN (NEW.status = \'awaiting_verification\')'],
  ];
  for (const [label, when] of cases) {
    const person = await richPerson(); await requestDeletion(person.id);
    await seed('ExportRequests', { UserId: person.id, id: require('crypto').randomUUID() }); // requestDeletion cancela las exportaciones: se siembra DESPUÉS para que el paso de ExportRequests tenga una fila que borrar
    const id = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id; const run = () => processDeletion(id, { quiescent: true });
    const before = await fingerprint(['DeletionRequests']);
    await q(`CREATE OR REPLACE FUNCTION qa249_falla() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'SELECT secreto FROM tabla_interna'; END $$ LANGUAGE plpgsql`);
    const table = when.match(/ON ("[A-Za-z]+")/)[1];
    await q(`CREATE TRIGGER qa249_falla ${when} EXECUTE FUNCTION qa249_falla()`);
    let thrown = null; try { await run(); } catch (e) { thrown = e; } finally { await q(`DROP TRIGGER qa249_falla ON ${table}`); }
    const after = await fingerprint(['DeletionRequests']); const changed = diff(before, after);
    const row = (await q('SELECT status,"failureCode","activePurgedAt" FROM "DeletionRequests" WHERE id=$1', [id]))[0];
    const generic = thrown && !/secreto|SELECT|tabla_interna/.test(thrown.message + JSON.stringify(row));
    const retry = await run(); const left = Number((await q('SELECT count(*) n FROM "DiaryEntries" WHERE "UserId"=$1', [person.id]))[0].n);
    const byAfter = await fingerprint(['DeletionRequests']);
    check(`${label}: rollback total de TODA la base, failed con código genérico, el reintento completa [${table}]`, !!thrown && changed.length === 0 && row.status === 'failed' && row.failureCode === 'active_purge_failed' && row.activePurgedAt === null && generic && retry.status === 'awaiting_verification' && left === 0,
      `lanzó ${!!thrown}; tablas cambiadas: ${changed.join(',') || 'ninguna'}; solicitud ${row.status}/${row.failureCode}; mensaje genérico ${generic}; reintento ${retry.status}; diario restante ${left}`);
    const bystanderRows = Number((await q('SELECT count(*) n FROM "MoodLogs" WHERE "UserId"=$1', [bystander.id]))[0].n) + Number((await q('SELECT count(*) n FROM "DiaryEntries" WHERE "UserId"=$1', [bystander.id]))[0].n);
    if (bystanderRows !== 2) check(`lo de otra persona no se toca (${label})`, false, `filas de la otra persona: ${bystanderRows}`);
  }
  check('lo de otra persona (2 filas) sigue intacto tras 4 fallos y 4 purgas', Number((await q('SELECT count(*) n FROM "MoodLogs" WHERE "UserId"=$1', [bystander.id]))[0].n) + Number((await q('SELECT count(*) n FROM "DiaryEntries" WHERE "UserId"=$1', [bystander.id]))[0].n) === 2, 'MoodLogs + DiaryEntries de la otra persona');
  // Caracterización de ProfessionalApplications con MIS columnas: qué queda tras la purga
  const person = await mkUser('user'); const app = await seed('ProfessionalApplications', { name: 'Solicitante Sintético QA', email: 'qa-solicitante@example.test', country: 'Colombia', profession: 'Psicología', licenseNumber: 'LIC-QA-1', message: 'Texto libre QA', status: 'approved', consentAt: new Date(), userId: person.id });
  await seed('ProfessionalApplicationFiles', { ApplicationId: app.id }); await requestDeletion(person.id);
  const pid = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id; const out = await processDeletion(pid, { quiescent: true });
  const left = (await q('SELECT * FROM "ProfessionalApplications" WHERE id=$1', [app.id]))[0]; const files = Number((await q('SELECT count(*) n FROM "ProfessionalApplicationFiles" WHERE "ApplicationId"=$1', [app.id]))[0].n);
  const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ProfessionalApplications' ORDER BY ordinal_position`)).map((r) => r.column_name);
  const personal = ['name', 'email', 'country', 'profession', 'licenseNumber', 'profileUrl', 'message', 'reviewNote'].filter((c) => left && left[c] !== null && left[c] !== undefined && left[c] !== '');
  info('C6 ProfessionalApplications tras la purga de la persona vinculada', `purga ${out.status}; la solicitud SIGUE (${!!left}); columnas con dato: ${personal.join(',')}; userId apunta a ${left && left.userId === person.id ? 'la lápida (mismo id)' : String(left && left.userId)}; archivos de la solicitud: ${files} (hoja de vida); columnas de la tabla: ${cols.join(',')}`);
  const tomb = (await q('SELECT name,email FROM "Users" WHERE id=$1', [person.id]))[0];
  check('C6b la cuenta sí queda anonimizada mientras la solicitud conserva nombre y correo reales (la contradicción que la pregunta de ES-283 plantea)', !!left && /deleted\.invalid/.test(tomb.email) && left.email === 'qa-solicitante@example.test', `usuario: ${tomb.name} / ${tomb.email}; solicitud: ${left && left.name} / ${left && left.email}`);
  // el recibo declara qué conserva
  info('C6c lo que declara el recibo', JSON.stringify(out.retained || out.retainedCategories || Object.keys(out)).slice(0, 300));
  fs.writeFileSync(path.join(OUT, `ES-283-propios-${process.env.TAG || 'pr'}.json`), JSON.stringify(results, null, 1));
  process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
