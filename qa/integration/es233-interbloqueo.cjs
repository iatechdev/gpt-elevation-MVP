// [QA-Claude] ES-233 (PR #253) · ¿el 500 de confirmar‖retirar es un interbloqueo de PostgreSQL? Llama a las funciones reales y muestra el código del error de la base (40P01 = deadlock_detected).
//   QA_SUT=<repo> QA253_DB=postgres://... node qa/integration/es233-interbloqueo.cjs
const path = require('path'); const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); const { makeSeeder } = require(SUT + '/test/support/seedRow.cjs');
process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
(async () => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'QA253_DB', prefix: 'qa253d' });
  const seed = makeSeeder(q); const cc = require(SUT + '/utils/careerContext'); const consent = require(SUT + '/utils/consent');
  const N = Number(process.env.QA_ROUNDS || 20); const tally = { confirm: {}, revoke: {} }; const codes = {};
  const note = (bucket, key) => { bucket[key] = (bucket[key] || 0) + 1; };
  for (let i = 0; i < N; i += 1) {
    const p = await mkUser('user'); const diary = (await http(p, 'POST', '/api/diary', { date: '2026-10-01', content: 'Entrada QA' })).body.id;
    await consent.setConsent(p.id, 'professional_bridge', 'granted'); await consent.setConsent(p.id, 'insights_diary', 'granted');
    const direct = [{ key: 'values', text: 'Texto previo directo', origin: { type: 'direct' } }]; const dv = await cc.preview(p.id, { fields: direct }); await cc.confirm(p.id, { fields: direct, token: dv.token, requestId: crypto.randomBytes(12).toString('hex') });
    const fields = [{ key: 'motivations', text: 'Texto con fuente ' + i, origin: { type: 'diary_entry', id: diary } }]; const pv = await cc.preview(p.id, { fields });
    const [c, r] = await Promise.allSettled([cc.confirm(p.id, { fields, token: pv.token, requestId: crypto.randomBytes(12).toString('hex') }), consent.setConsent(p.id, 'insights_diary', 'revoked')]);
    note(tally.confirm, c.status === 'fulfilled' ? 'ok' : 'error'); note(tally.revoke, r.status === 'fulfilled' ? 'ok' : 'error');
    for (const x of [c, r]) if (x.status === 'rejected') { const e = x.reason; note(codes, `${e.name || 'Error'} · pg ${(e.parent && e.parent.code) || (e.original && e.original.code) || '-'} · ${String((e.parent && e.parent.message) || e.message).slice(0, 70)}`); }
  }
  console.log(JSON.stringify({ rondas: N, confirmar: tally.confirm, retirar: tally.revoke, errores: codes }, null, 1));
  for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
