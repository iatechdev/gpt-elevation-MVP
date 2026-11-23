// QA-Claude-5 · PR #390 (ES-110 PR1). Harness propio (derivado del patrón de es-110-postgres.cjs, sin modificar el código de la app).
//   QA_BACKEND=<ruta a backend/ del PR o de main> QA_PG=postgres://...@127.0.0.1:54361/postgres QA_OUT=<archivo json> node qa/qa5-390.cjs
// Imprime resultados por caso (OK/FALLA) y escribe un resumen determinista (sin ids ni fechas) para comparar PR vs main.
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const BE = path.resolve(process.env.QA_BACKEND);
const req = (p) => require(path.join(BE, p));
const { Client } = req('node_modules/pg');
const { Sequelize } = req('node_modules/sequelize');
const { makeTextPdf } = req('test/support/pdfFixtures.cjs');
const results = []; const summary = {};
const check = (id, cond, detail = '') => { results.push([id, !!cond]); console.log(`${cond ? 'OK   ' : 'FALLA'} ${id} ${cond ? '' : detail}`); };

const CV = ['MARÍA GÓMEZ', 'maria.gomez@example.test · +57 300 123 4567', 'Líder de diseño · Estudio Norte · 2021–2026', 'Habilidades: Power BI, SQL, Excel avanzado, Gestión de proyectos, Storytelling con datos',
  'Consultas SQL para reportes semanales', 'Idiomas: Español nativo'];
const OUTPUT = { profession: 'Líder de diseño', interests: null, sector: null, totalYearsExperience: null, experience: [], education: [],
  declaredSkills: [{ name: 'Power BI', support: null }, { name: 'SQL', support: 'Consultas SQL para reportes semanales' }, { name: 'Gestión de proyectos', support: null }, { name: 'Storytelling con datos', support: null }], languages: [] };

(async () => {
  const target = new URL(process.env.QA_PG);
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Solo loopback');
  const dbName = `qa5_${crypto.randomBytes(6).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: BE, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  if (migrated.status !== 0) throw new Error('migraciones: ' + (migrated.stdout + migrated.stderr).slice(-500));
  const app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 20, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test'; process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month'; process.env.RESUME_ANALYZE_RATE_MAX = '100000';
  const stub = (p, exports) => { const m = require.resolve(path.join(BE, p)); require.cache[m] = { id: m, filename: m, loaded: true, exports }; };
  stub('database', { sequelize: app });
  stub('utils/anthropic', { MODEL: 'modelo-sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify(OUTPUT) }], usage: { input_tokens: 400, output_tokens: 200 } }) } });
  req('associations')();
  const { issueToken } = req('utils/sessions'); const { verificarToken } = req('middlewares/auth');
  const express = req('node_modules/express'); const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, req('routes/consents'));
  api.use('/api/user/context', verificarToken, req('routes/participantContext'));
  api.use('/api/user/resumes', verificarToken, req('routes/resumes'));
  api.use('/api/user/resume-skills', verificarToken, req('routes/resumeSkills'));
  api.use('/api/evidence', verificarToken, req('routes/evidence'));
  api.use((err, _req, res, _next) => { console.log('ERROR NO CONTROLADO', err && err.message); res.status(500).json({ error: 'x' }); });
  const server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;
  let n500 = 0;

  const cat = (await q(`INSERT INTO "SkillCatalogs" (version,status,"publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now()) RETURNING id`))[0].id;
  for (const [key, es, en] of [['power_bi', 'Power BI', 'Power BI'], ['sql', 'SQL', 'SQL'], ['gestion_proyectos', 'Gestión de proyectos', 'Project management']])
    await q(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey",type,labels,rubric,"createdAt","updatedAt") VALUES ($1,$2,'domain',$3,$4,now(),now())`, [cat, key, JSON.stringify({ es, en }), JSON.stringify({ levels: { 1: { es: 'a', en: 'a' } } })]);
  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role = 'user') {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `qa5-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const call = async (who, method, route, body, raw) => {
    const headers = who ? { Authorization: `Bearer ${who.token}` } : {}; let payload;
    if (body instanceof FormData) payload = body; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + route, { method, headers, body: payload }); const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ }
    if (res.status >= 500) n500 += 1;
    return { status: res.status, body: json, text };
  };
  const form = (pdf) => { const f = new FormData(); f.append('requestId', crypto.randomUUID()); f.append('cv', new Blob([pdf], { type: 'application/pdf' }), 'cv.pdf'); return f; };
  const grant = (who, status = 'granted') => call(who, 'PUT', '/api/consents/resume_ai_reading', { status });
  const EMPTY = { preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null,
    sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] };
  const upload = async (who, extra = []) => { const r = await call(who, 'POST', '/api/user/resumes/analyze', form(makeTextPdf([...CV, ...extra]))); if (r.status !== 200) throw new Error('analyze ' + r.text); return r.body; };
  const putCtx = async (who, skills, expectedVersion = 0) => { const r = await call(who, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion, action: 'save_draft', context: { ...EMPTY, declaredSkills: skills } }); if (r.status !== 200) throw new Error('ctx ' + r.text); return r.body; };
  const promote = (who, names) => call(who, 'POST', '/api/user/resume-skills/promote', { requestId: crypto.randomUUID(), names });
  const claim = (text) => ({ text, source: 'self_report' });
  const FULL = { title: 'SQL', situation: 'Reportes semanales', responsibility: claim('Yo escribía las consultas'), actions: [claim('Escribí consultas')], delivered: claim('Un reporte'), observedEffect: { known: true, claim: claim('Se leyó cada semana') }, artifactRefs: [{ kind: 'text', excerpt: 'Consultas SQL para reportes semanales' }] };
  const versions = (uid) => q(`SELECT v."EvidenceId", v.version, v.status, v.payload, v.origins FROM "EvidenceVersions" v WHERE v."UserId"=$1 ORDER BY v."EvidenceId", v.version`, [uid]);
  const count = async (sql, p) => Number((await q(sql, p))[0].n);
  const marked = (rows) => rows.filter((r) => Array.isArray(r.origins) && r.origins.some((o) => o && o.sourceRevokedAt));
  const outDir = path.dirname(process.env.QA_OUT);

  // Base: persona D con v1 (Power BI borrador, SQL confirmada, Gestión de proyectos borrador), v2 con otra habilidad, borrador a mano
  const grants = async (u) => (await grant(u)).status;
  const A = await mkUser(); const B = await mkUser();
  await grants(A); await grants(B);
  const a1 = await upload(A); const ctx1 = await putCtx(A, a1.suggestions.declaredSkills);
  const pr1 = await promote(A, ['Power BI', 'SQL', 'Gestión de proyectos']);
  const [dPB, dSQL, dGP] = pr1.body.created.map((c) => c.id);
  const confirm = await call(A, 'PUT', `/api/evidence/${dSQL}`, { payload: FULL, status: 'confirmed', baseVersion: 1, requestId: crypto.randomUUID() });
  check('P1-pre confirmar SQL', confirm.status === 201, confirm.text);
  const hand = await call(A, 'POST', '/api/evidence', { payload: { title: 'A mano', situation: 'Situación escrita a mano' }, status: 'draft', requestId: crypto.randomUUID() });
  check('P1-pre borrador a mano', hand.status === 201, hand.text);
  const a2 = await upload(A, ['Línea de la versión 2']); check('P1-pre v2', a2.resume.version === 2);
  const ctxV = (await call(A, 'GET', '/api/user/context')).body;
  summary.ctxShape = Object.keys(ctxV).sort();
  const ctxVersion = ctxV.version ?? ctxV.context?.version ?? 1;
  // B igual (aislamiento)
  const b1 = await upload(B); await putCtx(B, b1.suggestions.declaredSkills); const pb = await promote(B, ['Power BI', 'SQL']);
  const bSnap0 = JSON.stringify([await versions(B.id), await q('SELECT "sourceType","sourceId",reason,"handledAt" IS NULL AS pend FROM "DerivedInvalidations" WHERE "UserId"=$1 ORDER BY id', [B.id])]);
  const bSkills0 = JSON.stringify((await call(B, 'GET', '/api/user/resume-skills')).body);

  const before = await versions(A.id);
  const invBefore = await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [A.id]);
  const evCountBefore = await count('SELECT count(*)::int AS n FROM "Evidence" WHERE "UserId"=$1', [A.id]);
  const evVerCountBefore = before.length;
  const confirmedBefore = JSON.stringify(before.filter((r) => r.EvidenceId === dSQL)); const handBefore = JSON.stringify(before.filter((r) => r.EvidenceId === hand.body.id));
  const skillsBefore = (await call(A, 'GET', '/api/user/resume-skills')).body; const ctxBeforeDeclared = JSON.stringify((await call(A, 'GET', '/api/user/context')).body);
  fs.writeFileSync(path.join(outDir, 'resume-skills-before.json'), JSON.stringify(skillsBefore));
  check('P5-pre sin orphaned vivo (PR: [] ; main: ausente)', skillsBefore.orphaned === undefined || (Array.isArray(skillsBefore.orphaned) && skillsBefore.orphaned.length === 0));

  // P1 borrar v1 (la que originó los borradores)
  const del = await call(A, 'DELETE', `/api/user/resumes/${a1.resume.id}`); check('P1 DELETE v1 = 200', del.status === 200, del.text);
  const after = await versions(A.id);
  const mk = marked(after).map((r) => r.EvidenceId).sort();
  summary.markedCount = mk.length;
  check('P1 solo borradores de v1 marcados (Power BI y Gestión)', JSON.stringify(mk) === JSON.stringify([dPB, dGP].sort()), `marcados=${mk} esperado=${[dPB, dGP]}`);
  check('P1 confirmada idéntica byte a byte', JSON.stringify(after.filter((r) => r.EvidenceId === dSQL)) === confirmedBefore);
  check('P1 borrador a mano no marcado', JSON.stringify(after.filter((r) => r.EvidenceId === hand.body.id)) === handBefore);
  check('P1 nada se borra (Evidence y EvidenceVersions)', await count('SELECT count(*)::int AS n FROM "Evidence" WHERE "UserId"=$1', [A.id]) === evCountBefore && after.length === evVerCountBefore);
  check('P1 una invalidación por borrador', await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [A.id]) - invBefore === 2);
  const list = (await call(A, 'GET', '/api/evidence')).body.evidence; const by = Object.fromEntries(list.map((e) => [e.id, e]));
  check('P1 GET evidence: needsReview+source_revoked en borradores de v1', by[dPB].needsReview === true && by[dPB].reviewReason === 'source_revoked' && by[dGP].reviewReason === 'source_revoked');
  check('P1 GET evidence: confirmada y a mano sin reviewReason', by[dSQL].reviewReason === undefined && by[hand.body.id].reviewReason === undefined);
  check('P6 declaredSkills/consent intactos', JSON.stringify((await call(A, 'GET', '/api/user/context')).body) === ctxBeforeDeclared && (await call(A, 'GET', '/api/consents')).status === 200);
  summary.listShape = list.map((e) => ({ s: e.status, nr: e.needsReview ?? null, rr: e.reviewReason ?? null, on: e.origin ? e.origin.needsReview : null }));

  // P5 orphaned
  const sk = await call(A, 'GET', '/api/user/resume-skills'); fs.writeFileSync(path.join(outDir, 'resume-skills-after.json'), JSON.stringify(sk.body));
  summary.skillsAfter = { skills: sk.body.skills.map((s) => s.name), orphaned: (sk.body.orphaned || []).map((s) => [s.name, s.origin, s.classified ? s.classified.skillKey : null]) };
  check('P5 skills (v2 viva) intacto en forma', Array.isArray(sk.body.skills));
  check('P5 orphaned = habilidades de v1 solo si resumeVersion apunta a v1', Array.isArray(sk.body.orphaned), JSON.stringify(sk.body));
  check('P5 orphaned vacío para B', JSON.stringify(((await call(B, 'GET', '/api/user/resume-skills')).body.orphaned) || []) === '[]');
  const noResume = await mkUser(); const nr = await call(noResume, 'GET', '/api/user/resume-skills'); check('P5 persona sin hoja: orphaned []', nr.status === 200 && (nr.body.orphaned === undefined || nr.body.orphaned.length === 0));
  check('P6 orphaned sin texto del PDF (solo name/origin/classified/added)', (sk.body.orphaned || []).every((s) => JSON.stringify(Object.keys(s).sort()) === JSON.stringify(['added', 'classified', 'name', 'origin'])));

  // idempotencia
  check('P2 segundo DELETE = 404', (await call(A, 'DELETE', `/api/user/resumes/${a1.resume.id}`)).status === 404);
  check('P2 sin segundo marcado', await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [A.id]) - invBefore === 2);
  // retirar la autorización borra v2; no duplica marcas de v1 y deja sin marcar lo que no era de v2
  const rev = await grant(A, 'revoked'); check('P2 revocar autorización = 200', rev.status === 200);
  check('P2 tras revocar: invalidaciones source_revoked siguen en 2 y confirmada intacta', await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [A.id]) - invBefore === 2 && JSON.stringify((await versions(A.id)).filter((r) => r.EvidenceId === dSQL)) === confirmedBefore);
  // P4 mapa
  const sm = req('utils/skillMap'); const m1 = await sm.getMap(A.id); const pend1 = await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND "sourceType" IN ('resume','evidence') AND "handledAt" IS NULL`, [A.id]);
  const m2 = await sm.getMap(A.id);
  summary.map = JSON.stringify(m1); check('P4 consume invalidaciones resume+evidence', pend1 === 0, `pendientes=${pend1}`);
  check('P4 mapa idempotente', JSON.stringify(m1) === JSON.stringify(m2));
  await q(`INSERT INTO "DerivedInvalidations" ("UserId","sourceType","sourceId",reason,"createdAt") VALUES ($1,'career_context_version',1,'source_revoked',now())`, [A.id]).catch((e) => console.log('nota insert inv', e.message));
  await sm.getMap(A.id);
  check('P4 otro tipo NO se consume', await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND "sourceType"='career_context_version' AND "handledAt" IS NULL`, [A.id]) >= 1);
  // P3 aislamiento
  check('P3 B idéntico tras todo lo de A', JSON.stringify([await versions(B.id), await q('SELECT "sourceType","sourceId",reason,"handledAt" IS NULL AS pend FROM "DerivedInvalidations" WHERE "UserId"=$1 ORDER BY id', [B.id])]) === bSnap0 && JSON.stringify((await call(B, 'GET', '/api/user/resume-skills')).body) === bSkills0);
  await grant(A);
  const a3 = await upload(A, ['otra']);
  const foreign = await call(B, 'DELETE', `/api/user/resumes/${a3.resume.id}`); check('P3 B borra versión de A → 404', foreign.status === 404, String(foreign.status));
  check('P3 la versión de A sigue', await count('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE id=$1', [a3.resume.id]) === 1);
  check('P3 sin token → 401', (await call(null, 'DELETE', `/api/user/resumes/${a3.resume.id}`)).status === 401);
  for (const role of ['admin', 'professional', 'board', 'superadmin']) { const u = await mkUser(role); const s1 = (await call(u, 'DELETE', `/api/user/resumes/${a3.resume.id}`)).status; const s2 = (await call(u, 'GET', '/api/user/resume-skills')).status; check(`P3 rol ${role} DELETE/GET`, [401, 403].includes(s1) && [200, 401, 403].includes(s2), `${s1}/${s2}`); summary[`role_${role}`] = [s1, s2]; }
  let hostile = [];
  for (const id of ['abc', '0', '-1', '1.5', '99999999999', '2147483648', "1;DROP TABLE x", '%00', '1%27', '%5B1%5D', '1e3']) { const r = await call(A, 'DELETE', `/api/user/resumes/${id}`); hostile.push(r.status); if (!(r.status >= 400 && r.status < 500)) console.log('hostil', id, r.status, r.text.slice(0, 120)); }
  check('P3 ids hostiles → 4xx', hostile.every((s) => s >= 400 && s < 500), hostile.join(','));
  summary.hostile = hostile;

  // P2 concurrencia: 8 DELETE simultáneos con borrador marcado una vez
  const C = await mkUser(); await grant(C); const c1 = await upload(C); await putCtx(C, c1.suggestions.declaredSkills); const pc = await promote(C, ['Power BI', 'SQL']);
  const rs = await Promise.all(Array.from({ length: 8 }, () => call(C, 'DELETE', `/api/user/resumes/${c1.resume.id}`)));
  const statuses = rs.map((r) => r.status).sort();
  check('P2 8 DELETE simultáneos → exactamente un 200 y el resto 404', statuses.filter((s) => s === 200).length === 1 && statuses.filter((s) => s === 404).length === 7, statuses.join(','));
  check('P2 una marca e invalidación por borrador', marked(await versions(C.id)).length === 2 && await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [C.id]) === 2);

  // P1b dos versiones vivas: borrar v1 marca SOLO lo de v1; retirar la autorización marca lo de v2 (revokeForConsent)
  {
    const D = await mkUser(); await grant(D); const d1 = await upload(D); const c1v = await putCtx(D, d1.suggestions.declaredSkills);
    const p1 = await promote(D, ['Power BI']); const id1 = p1.body.created[0].id;
    const d2 = await upload(D, ['segunda']); const ctxNow = (await call(D, 'GET', '/api/user/context')).body;
    const sk2 = d2.suggestions.declaredSkills.map((s) => ({ ...s })); await putCtx(D, sk2, ctxNow.version);
    const p2 = await promote(D, ['SQL']); const id2 = p2.body.created[0].id;
    const ver2 = (await versions(D.id)).find((r) => r.EvidenceId === id2);
    check('P1b origen del segundo borrador = v2', ver2 && ver2.origins[0].version === 2, JSON.stringify(ver2 && ver2.origins));
    await call(D, 'DELETE', `/api/user/resumes/${d1.resume.id}`);
    const m1 = marked(await versions(D.id)).map((r) => r.EvidenceId);
    check('P1b borrar v1 marca solo su borrador (no el de v2)', JSON.stringify(m1) === JSON.stringify([id1]), `marcados=${m1}`);
    await grant(D, 'revoked');
    const m2 = marked(await versions(D.id)).map((r) => r.EvidenceId).sort();
    check('P1b retirar autorización marca el borrador de v2', JSON.stringify(m2) === JSON.stringify([id1, id2].sort()), `marcados=${m2}`);
    check('P1b 2 invalidaciones source_revoked', await count(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [D.id]) === 2);
  }

  // P7 cinturón de lectura (cabeza 1fc6aac3): borrador con hoja inexistente SIN marca persistida (datos previos al despliegue) sale «para revisión» al leer; lo confirmado y los de hoja viva, no
  {
    const E = await mkUser(); await grant(E); const e1 = await upload(E); await putCtx(E, e1.suggestions.declaredSkills);
    const pe = await promote(E, ['Power BI', 'SQL']); const [bd, bc] = pe.body.created.map((c) => c.id);
    await call(E, 'PUT', `/api/evidence/${bc}`, { payload: FULL, status: 'confirmed', baseVersion: 1, requestId: crypto.randomUUID() });
    await call(E, 'DELETE', `/api/user/resumes/${e1.resume.id}`);
    await q(`UPDATE "EvidenceVersions" SET origins=(SELECT jsonb_agg(o - 'sourceRevokedAt') FROM jsonb_array_elements(origins::jsonb) o) WHERE "UserId"=$1`, [E.id]).catch(async () => q(`UPDATE "EvidenceVersions" SET origins=(SELECT json_agg((o::jsonb - 'sourceRevokedAt')::json) FROM json_array_elements(origins::json) o) WHERE "UserId"=$1`, [E.id]));
    check('P7 sin marcas persistidas (preparación)', marked(await versions(E.id)).length === 0);
    const lst = Object.fromEntries((await call(E, 'GET', '/api/evidence')).body.evidence.map((e) => [e.id, e]));
    check('P7 borrador de hoja inexistente sale needsReview+source_revoked al leer', lst[bd].needsReview === true && lst[bd].reviewReason === 'source_revoked', JSON.stringify(lst[bd] && [lst[bd].needsReview, lst[bd].reviewReason]));
    check('P7 la confirmada NO se marca', lst[bc].reviewReason === undefined && lst[bc].needsReview === undefined);
    const one = (await call(E, 'GET', `/api/evidence/${bd}`)).body;
    check('P7 GET /api/evidence/:id coherente (0 × 500)', one && Array.isArray(one.versions) && one.versions[0].reviewReason === 'source_revoked');
    const live = await mkUser(); await grant(live); const l1 = await upload(live); await putCtx(live, l1.suggestions.declaredSkills); const pl = await promote(live, ['SQL']);
    const ll = (await call(live, 'GET', '/api/evidence')).body.evidence[0]; check('P7 borrador con hoja viva NO se marca', ll.needsReview === undefined && ll.reviewReason === undefined);
  }

  // P2 carrera DELETE vs EDICIÓN del borrador
  const N = Number(process.env.QA_RACE || 30); let lost = 0; let errors = 0; let orphanEvid = 0; const raceDetail = [];
  for (let i = 0; i < N; i++) {
    const R = await mkUser(); await grant(R); const r1 = await upload(R); await putCtx(R, r1.suggestions.declaredSkills); const pr = await promote(R, ['SQL']); const eid = pr.body.created[0].id;
    const edit = () => call(R, 'PUT', `/api/evidence/${eid}`, { payload: { title: 'SQL', situation: `Editado ${i}` }, status: 'draft', baseVersion: 1, requestId: crypto.randomUUID() });
    const DL = (process.env.QA_DELAYS || '0,1,3').split(',').map(Number); const delay = DL[i % DL.length];
    const [d, e] = await Promise.all([call(R, 'DELETE', `/api/user/resumes/${r1.resume.id}`), new Promise((r) => setTimeout(r, delay)).then(edit)]);
    if (d.status >= 500 || e.status >= 500) errors += 1;
    const ev = (await q('SELECT "currentVersion" FROM "Evidence" WHERE id=$1', [eid]))[0]; const cur = (await q('SELECT origins FROM "EvidenceVersions" WHERE "EvidenceId"=$1 AND version=$2', [eid, ev.currentVersion]))[0];
    if (process.env.QA_DIAG && i < 2) console.log('DIAG', i, JSON.stringify(await q('SELECT version, origins FROM "EvidenceVersions" WHERE "EvidenceId"=$1 ORDER BY version', [eid])));
    if (!cur) orphanEvid += 1; else if (!(cur.origins || []).some((o) => o.sourceRevokedAt)) { lost += 1; raceDetail.push({ delay, d: d.status, e: e.status, cv: ev.currentVersion }); }
  }
  console.log(`CARRERA edición/borrado: ${N} corridas, marcas perdidas=${lost}, 5xx=${errors}, huérfanas=${orphanEvid}`, JSON.stringify(raceDetail.slice(0, 5)));
  check('P2 carrera DELETE vs PUT: 0 marcas perdidas', lost === 0, `perdidas=${lost}/${N}`);
  check('P2 carrera: 0 × 5xx y 0 huérfanas', errors === 0 && orphanEvid === 0);
  summary.raceLost = lost;
  check('0 × 500 global', n500 === 0, String(n500));

  fs.writeFileSync(process.env.QA_OUT, JSON.stringify(summary, null, 1));
  console.log(`RESUMEN: ${results.filter((r) => r[1]).length}/${results.length} OK; fallas: ${results.filter((r) => !r[1]).map((r) => r[0]).join(' | ') || 'ninguna'}`);
  await new Promise((r) => { server.close(r); server.closeAllConnections?.(); }); await db.end(); await app.close();
  await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`); await admin.end();
})().catch((e) => { console.error('ABORTA', e); process.exit(2); });
