// [QA-Claude] ES-233 (PR #253) · permiso de la fuente en el Puente profesional: guion PROPIO, por HTTP real contra el server.js real y PostgreSQL desechable, por CADA tipo de fuente.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA253_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es233-propios.cjs
// Cubre: cruce de permisos entre tipos, retiro entre vista previa y confirmación, campos mixtos, orden de errores, requestId repetido, y carreras confirmar‖retirar
// CON una versión activa previa (la que obliga a bloqueos cruzados) además de sin ella. Solo loopback, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const TAG = process.env.TAG || 'pr';
const ROUNDS = Number(process.env.QA_ROUNDS || 40);
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
const { makeSeeder } = require(SUT + '/test/support/seedRow.cjs');
process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1400) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1400) }) + '\n'); };
const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.ceil(l.length * 0.95) - 1)];
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];

(async () => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'QA253_DB', prefix: 'qa253' });
  const seed = makeSeeder(q);
  const careerContext = require(SUT + '/utils/careerContext');
  const grant = (who, purpose, status = 'granted') => http(who, 'PUT', `/api/consents/${purpose}`, { status });
  const preview = (who, fields) => http(who, 'POST', '/api/career-context/preview', { fields });
  const rid = () => crypto.randomBytes(12).toString('hex');
  const confirm = (who, fields, token, requestId = rid()) => http(who, 'POST', '/api/career-context/confirm', { fields, token, requestId });
  const versions = async (who) => Number((await q('SELECT count(*) n FROM "CareerContextVersions" WHERE "UserId"=$1', [who.id]))[0].n);
  const TEXT = (n) => `Texto QA marcador ${n} sobre coordinar equipos pequeños.`;
  const TYPES = {
    diary_entry: { purpose: 'insights_diary', make: async (u) => (await http(u, 'POST', '/api/diary', { date: '2026-10-01', content: 'Entrada de diario QA' })).body.id },
    chat_turn: { purpose: 'insights_chat', make: async (u) => (await seed('ChatTurns', { UserId: u.id, requestId: crypto.randomUUID() })).id },
    resume_version: { purpose: 'insights_resume', make: async (u) => (await seed('ParticipantResumes', { UserId: u.id })).id },
  };
  const ALL = Object.values(TYPES).map((x) => x.purpose);
  const field = (type, id, n = 1) => ({ key: 'motivations', text: TEXT(n), origin: { type, id } });

  // ── C2 · cruce de permisos: solo sirve el permiso del MISMO tipo ──
  { const bad = []; let n = 0;
    for (const [type, { make }] of Object.entries(TYPES)) for (const given of ALL) {
      const p = await mkUser('user'); const id = await make(p); await grant(p, 'professional_bridge'); await grant(p, given);
      const out = await preview(p, [field(type, id)]); n += 1; const should = given === TYPES[type].purpose;
      if (should && out.status !== 200) bad.push(`${type} con ${given}: ${out.status} ${out.body && out.body.code}`);
      if (!should && !(out.status === 403 && out.body.code === 'source_consent_required')) bad.push(`${type} con ${given} (otro tipo): ${out.status} ${out.body && out.body.code}`);
    }
    check('C2 cruce de permisos (3 tipos × 3 permisos): solo el permiso del mismo tipo permite la vista previa; los otros → 403 source_consent_required', bad.length === 0, bad.join(' | ') || `${n} combinaciones`);
    const p = await mkUser('user'); const idd = await TYPES.diary_entry.make(p); await grant(p, 'insights_diary');
    const noBridge = await preview(p, [field('diary_entry', idd)]);
    check('C2b con el permiso de la fuente pero SIN el puente → 403 consent_required (el del puente sigue mandando)', noBridge.status === 403 && noBridge.body.code === 'consent_required', `${noBridge.status} ${noBridge.body && noBridge.body.code}`);
  }

  // ── C3 · retiro entre vista previa y confirmación, por tipo; campos mixtos ──
  for (const [type, { purpose, make }] of Object.entries(TYPES)) {
    const p = await mkUser('user'); const id = await make(p); await grant(p, 'professional_bridge'); await grant(p, purpose);
    const fields = [field(type, id)]; const pv = await preview(p, fields); await grant(p, purpose, 'revoked');
    const stale = await confirm(p, fields, pv.body.token); const n0 = await versions(p); const fresh = await preview(p, fields);
    await grant(p, purpose); const again = await confirm(p, fields, pv.body.token);
    check(`C3 ${type}: retirar ${purpose} entre vista previa y confirmación → 403 source_consent_revoked, 0 versiones; vista previa nueva 403; al reautorizar el mismo token sirve (201)`, stale.status === 403 && stale.body.code === 'source_consent_revoked' && n0 === 0 && fresh.status === 403 && again.status === 201, `confirmar ${stale.status} ${stale.body && stale.body.code}; versiones ${n0}; vista nueva ${fresh.status}; reautorizado ${again.status}`);
  }
  { const p = await mkUser('user'); const d = await TYPES.diary_entry.make(p); const c = await TYPES.chat_turn.make(p); for (const x of ['professional_bridge', 'insights_diary', 'insights_chat']) await grant(p, x);
    const fields = [{ key: 'values', text: TEXT('directo'), origin: { type: 'direct' } }, { key: 'motivations', text: TEXT('diario'), origin: { type: 'diary_entry', id: d } }, { key: 'interests', text: TEXT('chat'), origin: { type: 'chat_turn', id: c } }];
    const pv = await preview(p, fields); await grant(p, 'insights_chat', 'revoked'); const stale = await confirm(p, fields, pv.body.token);
    check('C3b campos mixtos (directo + diario + chat) con SOLO el permiso del chat retirado → 403 source_consent_revoked y 0 versiones', pv.status === 200 && stale.status === 403 && (await versions(p)) === 0, `vista ${pv.status}; confirmar ${stale.status} ${stale.body && stale.body.code}`);
    const direct = [{ key: 'values', text: TEXT('solo directo'), origin: { type: 'direct' } }]; const q2 = await mkUser('user'); const dp = await preview(q2, direct); const dc = await confirm(q2, direct, dp.body.token);
    check('C3c el texto escrito directamente no depende de ningún permiso de análisis ni del puente → 201', dp.status === 200 && dc.status === 201, `${dp.status}/${dc.status}`); }

  // ── C6 · orden de errores y fugas ──
  { const p = await mkUser('user'); const other = await mkUser('user'); await grant(p, 'professional_bridge'); await grant(p, 'insights_diary');
    const foreign = await TYPES.diary_entry.make(other); const f1 = await preview(p, [field('diary_entry', foreign)]); const f2 = await preview(p, [field('diary_entry', 2147483000)]); const f3 = await preview(p, [field('chat_turn', 2147483000)]);
    const own = await TYPES.diary_entry.make(p); await grant(p, 'insights_diary', 'revoked'); const f4 = await preview(p, [field('diary_entry', foreign)]);
    check('C6a origen ajeno o inexistente → 404 origin_not_found, también con el permiso de la fuente retirado (sin oráculo de existencia por el 403)', [f1, f2, f3, f4].every((r) => r.status === 404 && r.body.code === 'origin_not_found') && own > 0, [f1, f2, f3, f4].map((r) => r.status + '/' + (r.body && r.body.code)).join(' '));
    const bad = []; for (const body of [{ fields: [{ key: 'motivations', text: TEXT('x'), origin: { type: 'otro', id: 1 } }] }, { fields: [{ key: 'motivations', text: TEXT('x'), origin: { type: 'diary_entry' } }] }, { fields: [{ key: 'motivations', text: TEXT('x'), origin: { type: 'diary_entry', id: 'abc' } }] }, { fields: [{ key: 'motivations', text: TEXT('x'), origin: { type: 'chat_turn', id: -1 } }] }, { fields: [] }, { fields: 'x' }, {}]) { const r = await http(p, 'POST', '/api/career-context/preview', body); if (r.status >= 500) bad.push(`${JSON.stringify(body).slice(0, 50)} → ${r.status}`); }
    check('C6b orígenes y cuerpos malformados → 4xx, nunca 5xx', bad.length === 0, bad.join(' | ') || '7 casos'); }
  { const p = await mkUser('user'); const id = await TYPES.diary_entry.make(p); await grant(p, 'professional_bridge'); await grant(p, 'insights_diary');
    const fields = [field('diary_entry', id)]; const pv = await preview(p, fields);
    const { requestDeletion } = require(SUT + '/utils/dataRights'); await requestDeletion(p.id); const after = await confirm(p, fields, pv.body.token);
    check('C6c persona con eliminación pendiente: la confirmación no crea versión', after.status !== 201 && (await versions(p)) === 0, `estado ${after.status} ${after.body && after.body.code}`); }

  // ── C7 · requestId repetido tras retirar ──
  for (const [type, { purpose, make }] of Object.entries(TYPES)) {
    const p = await mkUser('user'); const id = await make(p); await grant(p, 'professional_bridge'); await grant(p, purpose); const fields = [field(type, id, 7)]; const pv = await preview(p, fields); const R = rid();
    const first = await confirm(p, fields, pv.body.token, R); await grant(p, purpose, 'revoked'); const replay = await confirm(p, fields, pv.body.token, R); const delivered = await careerContext.getApprovedContext(p.id, 'qa').catch((e) => e);
    check(`C7 ${type}: repetir la confirmación (mismo requestId) tras retirar el permiso → no duplica versión y el motor NO entrega el texto`, first.status === 201 && (await versions(p)) === 1 && !JSON.stringify(delivered).includes('marcador 7'), `primera ${first.status}; repetición ${replay.status} ${replay.body && replay.body.code}; versiones ${await versions(p)}; motor: ${String(delivered && (delivered.code || delivered.message || 'entregó')).slice(0, 40)}`); }

  // ── C4 · carreras: confirmar ‖ retirar, CON una versión activa previa (bloqueos cruzados) y sin ella ──
  for (const [type, { purpose, make }] of Object.entries(TYPES)) for (const withPrior of [true, false]) {
    const outcomes = { confirm: {}, revoke: {} }; const problems = []; const lat = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      const p = await mkUser('user'); const id = await make(p); await grant(p, 'professional_bridge'); await grant(p, purpose);
      if (withPrior) { const d = [{ key: 'values', text: TEXT('previa'), origin: { type: 'direct' } }]; const dv = await preview(p, d); await confirm(p, d, dv.body.token); }
      const fields = [field(type, id, i)]; const pv = await preview(p, fields); const t0 = performance.now();
      const [c, r] = await Promise.all([confirm(p, fields, pv.body.token), grant(p, purpose, 'revoked')]); lat.push(performance.now() - t0);
      outcomes.confirm[c.status] = (outcomes.confirm[c.status] || 0) + 1; outcomes.revoke[r.status] = (outcomes.revoke[r.status] || 0) + 1;
      if (![201, 403].includes(c.status)) problems.push(`ronda ${i}: confirmar ${c.status} ${JSON.stringify(c.body).slice(0, 70)}`); if (r.status !== 200) problems.push(`ronda ${i}: RETIRAR ${r.status} ${JSON.stringify(r.body).slice(0, 70)}`);
      const consentRow = (await q('SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose=$2', [p.id, purpose]))[0]; if (r.status === 200 && consentRow.status !== 'revoked') problems.push(`ronda ${i}: retiro 200 pero el permiso sigue ${consentRow.status}`);
      const delivered = await careerContext.getApprovedContext(p.id, 'qa').catch((e) => e); if (JSON.stringify(delivered).includes(`marcador ${i} `)) problems.push(`ronda ${i}: el motor ENTREGÓ el texto de la fuente retirada`);
      if (c.status === 201) { const row = (await q(`SELECT origins FROM "CareerContextVersions" WHERE "UserId"=$1 AND status='active' ORDER BY version DESC LIMIT 1`, [p.id]))[0]; if (!row || !row.origins.every((o) => o.type !== type || o.sourceRevokedAt)) problems.push(`ronda ${i}: versión nacida sin la marca «para revisión»`); }
      else if ((await versions(p)) !== (withPrior ? 1 : 0)) problems.push(`ronda ${i}: 403 pero hay versiones de más`);
    }
    check(`C4 ${type}${withPrior ? ' (con versión activa previa)' : ' (sin versión previa)'}: ${ROUNDS} rondas confirmar‖retirar → confirmar 201/403, retirar siempre 200, ningún 5xx, nunca texto entregado, versión nacida siempre marcada [${TAG}]`, problems.length === 0,
      `confirmar ${JSON.stringify(outcomes.confirm)}; retirar ${JSON.stringify(outcomes.revoke)}; latencia de la ronda: mediana ${median(lat).toFixed(0)} ms, p95 ${p95(lat).toFixed(0)} ms; ${problems.slice(0, 4).join(' | ') || 'sin problemas'}`);
  }

  // ── C12 · latencia de vista previa y confirmación ──
  { const p = await mkUser('user'); const id = await TYPES.diary_entry.make(p); await grant(p, 'professional_bridge'); await grant(p, 'insights_diary'); const tp = []; const tc = [];
    for (let i = 0; i < 40; i += 1) { const fields = [field('diary_entry', id, 900 + i)]; let t0 = performance.now(); const pv = await preview(p, fields); tp.push(performance.now() - t0); t0 = performance.now(); await confirm(p, fields, pv.body.token); tc.push(performance.now() - t0); }
    info(`C12 latencia (${TAG})`, `vista previa: mediana ${median(tp).toFixed(1)} ms, p95 ${p95(tp).toFixed(1)} ms | confirmar: mediana ${median(tc).toFixed(1)} ms, p95 ${p95(tc).toFixed(1)} ms`);
    check(`C12 p95 de vista previa y confirmar < 300 ms (propuesta) [${TAG}]`, p95(tp) < 300 && p95(tc) < 300, `vista ${p95(tp).toFixed(1)} ms; confirmar ${p95(tc).toFixed(1)} ms`); }

  fs.writeFileSync(path.join(OUT, `ES-233-propios-${TAG}.json`), JSON.stringify(results, null, 1));
  process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
