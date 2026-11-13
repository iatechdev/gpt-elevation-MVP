// [QA-Claude] ES-295 (PR #256) · ¿la cola por propietario serializa a personas DISTINTAS? Mide 12 veces el tiempo de 30 personas a la vez frente a una sola. Compararlo entre el PR y main (mismo guion).
//   QA_SUT=<repo> QA256_DB=postgres://... node qa/integration/es256-paralelo.cjs
const path = require('path'); const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
(async () => {
  const { mkUser, http, q } = await startRealApi(t, { envVar: 'QA256_DB', prefix: 'qa256p' });
  const catalog = require(SUT + '/utils/skillCatalog'); const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `n${n}`, en: `l${n}` }]));
  const draft = await catalog.createDraft(); await catalog.upsertSkill(draft.id, 'comunicacion', { type: 'transversal', labels: { es: 'c', en: 'c' }, rubric: { levels, source: 's', verifiedBy: 'r', verifiedAt: '2026-10-01' } });
  try { await catalog.publish(draft.id, 1); } catch { await catalog.publish(draft.id, 2); }
  const rid = () => crypto.randomBytes(10).toString('hex');
  const SLEEP = Number(process.env.QA_SLEEP_MS || 0); if (SLEEP) { await q(`CREATE OR REPLACE FUNCTION qa256_lat() RETURNS trigger AS $$ BEGIN PERFORM pg_sleep(${SLEEP / 1000}); RETURN NEW; END $$ LANGUAGE plpgsql`); await q('CREATE TRIGGER qa256_lat BEFORE INSERT ON "SkillAssessments" FOR EACH ROW EXECUTE FUNCTION qa256_lat()'); } // latencia de base simulada (como la de una base remota): el tiempo es de ESPERA, no de CPU
  const people = []; for (let i = 0; i < 30; i += 1) { const p = await mkUser('user'); const e = await http(p, 'POST', '/api/evidence', { payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status: 'confirmed', requestId: rid() }); people.push({ ...p, refs: [{ evidenceId: e.body.id, version: 1 }] }); }
  const assess = (p, level) => http(p, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level, evidenceRefs: p.refs, requestId: rid() });
  for (let i = 0; i < 6; i += 1) await assess(people[0], 2); // calentamiento
  const single = []; const all = [];
  for (let rep = 0; rep < 12; rep += 1) {
    let s = performance.now(); await assess(people[rep % 30], 3); single.push(performance.now() - s);
    s = performance.now(); await Promise.all(people.map((p) => assess(p, (rep % 4) + 1))); all.push(performance.now() - s);
  }
  console.log(JSON.stringify({ una_sola_ms_mediana: +median(single).toFixed(1), treinta_a_la_vez_ms_mediana: +median(all).toFixed(0), razon_mediana: +(median(all) / median(single)).toFixed(1), razones: all.map((x, i) => +(x / single[i]).toFixed(1)) }));
  for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
