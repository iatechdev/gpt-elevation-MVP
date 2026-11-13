// [QA-Claude] ES-295 (PR #256) · autoevaluaciones simultáneas de la misma persona: guion PROPIO por HTTP real contra el server.js real y PostgreSQL desechable.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA256_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es256-propios.cjs
// Cubre: carrera de la misma persona (8/30/100), personas distintas en paralelo, cola que no se envenena ni se llena, dos procesos contra la misma base (límite declarado), semántica y latencia.
// Solo loopback, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const TAG = process.env.TAG || 'pr';
const ROUNDS = Number(process.env.QA_ROUNDS || 5);
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1300) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1300) }) + '\n'); };
const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.ceil(l.length * 0.95) - 1)];
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
// Rastrea los Map que se crean (para ver si la cola por propietario se vacía): se parchea ANTES de cargar el servidor.
const trackedRefs = []; const seenMaps = new WeakSet(); const realSet = Map.prototype.set;
Map.prototype.set = function trackedSet(k, v) { if (!seenMaps.has(this)) { seenMaps.add(this); trackedRefs.push(new WeakRef(this)); } return realSet.call(this, k, v); };
const liveMaps = () => trackedRefs.map((r) => r.deref()).filter(Boolean);
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
const { makeSeeder } = require(SUT + '/test/support/seedRow.cjs');
process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };

(async () => {
  const { q, mkUser, http, base, dbName, issueToken } = await startRealApi(t, { envVar: 'QA256_DB', prefix: 'qa256' });
  const seed = makeSeeder(q);
  const catalog = require(SUT + '/utils/skillCatalog');
  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
  const draft = await catalog.createDraft(); await catalog.upsertSkill(draft.id, 'comunicacion', def('comunicacion')); await catalog.upsertSkill(draft.id, 'planificacion', def('planificacion'));
  try { await catalog.publish(draft.id, 1); } catch { await catalog.publish(draft.id, 2); }
  const rid = () => crypto.randomBytes(10).toString('hex');
  const evBody = () => ({ payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status: 'confirmed', requestId: rid() });
  const mkPerson = async () => { const p = await mkUser('user'); const e = await http(p, 'POST', '/api/evidence', evBody()); return { ...p, refs: [{ evidenceId: e.body.id || (e.body.evidence && e.body.evidence.id), version: 1 }] }; };
  const assess = (p, level, skillKey = 'comunicacion', extra = {}) => http(p, 'POST', '/api/skill-map/self', { skillKey, level, evidenceRefs: p.refs, requestId: rid(), rationale: 'nota QA', ...extra });
  const rows = async (p, skillKey = 'comunicacion') => ({ cur: Number((await q(`SELECT count(*) n FROM "SkillAssessments" WHERE "UserId"=$1 AND "skillKey"=$2 AND track='self' AND status='current'`, [p.id, skillKey]))[0].n), all: Number((await q(`SELECT count(*) n FROM "SkillAssessments" WHERE "UserId"=$1 AND "skillKey"=$2`, [p.id, skillKey]))[0].n) });
  const probe = await mkPerson(); const one = await assess(probe, 2); info(`C0 sondeo del contrato [${TAG}]`, `evidencia ${JSON.stringify(probe.refs)}; autoevaluación → ${one.status} ${JSON.stringify(one.body).slice(0, 160)}`);

  // ── C2 · misma persona y habilidad con 8, 30 y 100 simultáneas × rondas ──
  for (const N of [8, 30, 100]) {
    const p = await mkPerson(); const problems = []; const lat = []; const all = {};
    for (let r = 0; r < ROUNDS; r += 1) {
      const t0 = performance.now();
      const out = await Promise.all(Array.from({ length: N }, async (_, i) => { const s = performance.now(); const x = await assess(p, (i % 4) + 1); lat.push(performance.now() - s); return x; }));
      for (const x of out) all[x.status] = (all[x.status] || 0) + 1;
      const bad = out.filter((x) => ![200, 201].includes(x.status)); if (bad.length) problems.push(`ronda ${r}: ${bad.length} rechazadas (${[...new Set(bad.map((x) => x.status + ' ' + (x.body && x.body.code)))].join(',')})`);
      const c = await rows(p); if (c.cur !== 1) problems.push(`ronda ${r}: vigentes ${c.cur}`);
    }
    const c = await rows(p); if (c.all !== N * ROUNDS + 0) problems.push(`guardadas ${c.all} de ${N * ROUNDS}`);
    check(`C2 ${N} autoevaluaciones simultáneas de la MISMA persona y habilidad × ${ROUNDS} rondas: 0 rechazos (ningún 409), 1 vigente, todas guardadas [${TAG}]`, problems.length === 0,
      `estados ${JSON.stringify(all)}; guardadas ${c.all}/${N * ROUNDS}; latencia: mediana ${median(lat).toFixed(0)} ms, p95 ${p95(lat).toFixed(0)} ms, máxima ${Math.max(...lat).toFixed(0)} ms; ${problems.slice(0, 3).join(' | ') || 'sin problemas'}`);
  }

  // ── C3 · personas distintas siguen en paralelo ──
  { const people = []; for (let i = 0; i < 30; i += 1) people.push(await mkPerson());
    const t1 = []; for (let i = 0; i < 5; i += 1) { const s = performance.now(); await assess(people[i], 2); t1.push(performance.now() - s); }
    const s = performance.now(); const out = await Promise.all(people.map((p) => assess(p, 3, 'planificacion'))); const total = performance.now() - s;
    const ratio = total / median(t1); info(`C3 30 personas distintas a la vez frente a una sola: ~${ratio.toFixed(1)}× (referencia: serializar a todos daría ~30×; el proceso es de CPU y main da ~20×; la comparación fiable PR/main está en es256-paralelo.cjs) [${TAG}]`, `una sola: ${median(t1).toFixed(1)} ms; 30 a la vez: ${total.toFixed(0)} ms; estados ${JSON.stringify(out.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {}))}`); }

  // ── C4 · la cola no se envenena: peticiones inválidas, fallo real de la base y repetidas en medio de una cola ──
  { const p = await mkPerson(); const noRefs = { ...p, refs: [] };
    await q(`CREATE OR REPLACE FUNCTION qa256_falla() RETURNS trigger AS $$ BEGIN IF NEW."UserId" = ${p.id} AND NEW.level = 4 THEN RAISE EXCEPTION 'SELECT secreto FROM tabla_interna'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER qa256_falla BEFORE INSERT ON "SkillAssessments" FOR EACH ROW EXECUTE FUNCTION qa256_falla()`);
    const sameRid = rid(); const jobs = [];
    for (let i = 0; i < 40; i += 1) {
      const kind = i % 8;
      if (kind === 0) jobs.push(['nivel fuera de rango', http(p, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level: 9, evidenceRefs: p.refs, requestId: rid() }), [400, 422]]);
      else if (kind === 1) jobs.push(['habilidad inexistente', http(p, 'POST', '/api/skill-map/self', { skillKey: 'no-existe', level: 2, evidenceRefs: p.refs, requestId: rid() }), [400]]);
      else if (kind === 2) jobs.push(['sin evidencias', assess(noRefs, 2), [422]]);
      else if (kind === 3) jobs.push(['falla real de la base (trigger)', assess(p, 4), [500, 502, 503]]);
      else if (kind === 4) jobs.push(['requestId repetido', http(p, 'POST', '/api/skill-map/self', { skillKey: 'planificacion', level: 2, evidenceRefs: p.refs, requestId: sameRid }), [200, 201]]);
      else jobs.push(['válida', assess(p, (i % 3) + 1), [200, 201]]);
    }
    const out = await Promise.all(jobs.map(async ([label, pr, ok]) => ({ label, ...(await pr), ok }))); const bad = out.filter((x) => !x.ok.includes(x.status));
    await q('DROP TRIGGER qa256_falla ON "SkillAssessments"');
    const after = await assess(p, 2); const c = await rows(p);
    const leakText = out.filter((x) => x.label.startsWith('falla') && /secreto|tabla_interna|SELECT/.test(JSON.stringify(x.body)));
    check(`C4 en una cola de 40 con peticiones inválidas, un fallo REAL de la base y repetidas: todas responden como se espera, la cola sigue (una nueva se acepta), 1 vigente y sin texto de PostgreSQL [${TAG}]`, bad.length === 0 && [200, 201].includes(after.status) && c.cur === 1 && leakText.length === 0,
      `respuestas fuera de lo esperado: ${bad.map((x) => x.label + ' → ' + x.status).slice(0, 4).join(' | ') || 'ninguna'}; la petición posterior: ${after.status}; vigentes ${c.cur}; fuga de SQL ${leakText.length}`); }

  // ── C4b · el mapa interno de la cola se vacía en reposo ──
  { const people = []; for (let i = 0; i < 400; i += 1) people.push(await mkPerson());
    const before = new Map(liveMaps().map((m, i) => [m, m.size])); for (let k = 0; k < people.length; k += 50) await Promise.all(people.slice(k, k + 50).map((p) => assess(p, 2))); await new Promise((r) => setTimeout(r, 300)); if (global.gc) global.gc();
    const grown = liveMaps().map((m) => ({ grew: m.size - (before.has(m) ? before.get(m) : 0), size: m.size })).filter((x) => x.grew >= 200);
    const queueMaps = liveMaps().filter((m) => m.size > 0 && [...m.values()].slice(0, 3).every((v) => v instanceof Promise));
    info(`C4b otros Map que crecen con las personas (cachés de otros módulos, también en main) [${TAG}]`, JSON.stringify(grown));
    check(`C4b tras 400 personas distintas, en reposo, NINGÚN Map de promesas (la cola por propietario) retiene entradas [${TAG}]`, queueMaps.length === 0, queueMaps.length ? `Map(s) de promesas con entradas: ${queueMaps.map((m) => m.size).join(',')}` : `${liveMaps().length} Map rastreados; ninguno de promesas con entradas`); }

  // ── C5 · cola larga: 100 simultáneas de una persona mientras otras 20 personas piden; la API responde ──
  { const heavy = await mkPerson(); const others = []; for (let i = 0; i < 20; i += 1) others.push(await mkPerson());
    const lat = []; const s0 = performance.now();
    const hv = Promise.all(Array.from({ length: 100 }, () => assess(heavy, 2)));
    await new Promise((r) => setTimeout(r, 20));
    const ot = await Promise.all(others.map(async (p) => { const s = performance.now(); const x = await assess(p, 3); lat.push(performance.now() - s); return x; })); const health = await fetch(base + '/api/health');
    const hres = await hv; const total = performance.now() - s0;
    check(`C5 mientras una persona tiene 100 en cola, otras 20 personas son atendidas (p95 ${p95(lat).toFixed(0)} ms) y la API responde; ninguna de las 100 se rechaza [${TAG}]`, ot.every((x) => [200, 201].includes(x.status)) && health.status === 200 && hres.every((x) => [200, 201].includes(x.status)) && p95(lat) < 5000,
      `otras personas: p95 ${p95(lat).toFixed(0)} ms, máxima ${Math.max(...lat).toFixed(0)} ms; salud ${health.status}; cola de 100 terminó en ${total.toFixed(0)} ms con estados ${JSON.stringify(hres.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {}))}`); }

  // ── C7 · semántica ──
  { const p = await mkPerson(); const seq = []; for (const level of [1, 2, 3, 4, 2]) seq.push(await assess(p, level)); const cur = (await q(`SELECT level FROM "SkillAssessments" WHERE "UserId"=$1 AND "skillKey"='comunicacion' AND track='self' AND status='current'`, [p.id]))[0];
    const R = rid(); const rep = await Promise.all(Array.from({ length: 8 }, () => http(p, 'POST', '/api/skill-map/self', { skillKey: 'planificacion', level: 2, evidenceRefs: p.refs, requestId: R }))); const repRows = (await rows(p, 'planificacion')).all;
    const val = []; for (const [label, body] of [['nivel 0', { level: 0 }], ['nivel 5', { level: 5 }], ['nivel texto', { level: 'a' }], ['nivel decimal', { level: 2.5 }], ['sin habilidad', { skillKey: undefined, level: 2 }], ['habilidad vacía', { skillKey: '', level: 2 }]]) { const r = await http(p, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level: 2, evidenceRefs: p.refs, requestId: rid(), ...body }); val.push(`${label}=${r.status}`); }
    const clear = await http(p, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level: null, requestId: rid() });
    info(`C7 validaciones y retirar nivel [${TAG}]`, `${val.join(' ')}; retirar (level null) → ${clear.status} ${JSON.stringify(clear.body).slice(0, 60)}`);
    check(`C7 en secuencia el último nivel (2) queda vigente; el mismo requestId × 8 deja 1 fila; ninguna validación da 5xx [${TAG}]`, seq.every((x) => [200, 201].includes(x.status)) && cur.level === 2 && repRows === 1 && !val.some((v) => /=5\d\d/.test(v)), `vigente ${cur.level}; filas del requestId repetido ${repRows}; ${val.join(' ')}`); }

  // ── C9 · latencia aislada ──
  { const p = await mkPerson(); const lat = []; for (let i = 0; i < 60; i += 1) { const s = performance.now(); await assess(p, (i % 4) + 1); lat.push(performance.now() - s); }
    info(`C9 autoevaluación aislada, 60 en serie [${TAG}]`, `mediana ${median(lat).toFixed(1)} ms, p95 ${p95(lat).toFixed(1)} ms`);
    check(`C9 p95 < 300 ms (propuesta) [${TAG}]`, p95(lat) < 300, `${p95(lat).toFixed(1)} ms`); }

  // ── C6 · DOS procesos (réplicas) contra la misma base: el respaldo sigue funcionando ──
  if (process.env.QA_TWO !== '0') {
    const env = { ...process.env, PORT: '0', DATABASE_URL: process.env.QA256_DB.replace(/\/[^/]*$/, '/' + dbName), DB_SSL: 'false', NODE_ENV: 'test', DB_SYNC_DISABLED: 'true', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', AI_BUDGET_TOKENS_PER_USER: '1000', AI_MAX_RETRIES: '0' };
    const start = (port) => new Promise((resolve, reject) => { const child = spawn(process.execPath, ['server.js'], { cwd: SUT, env: { ...env, PORT: String(port) }, stdio: 'ignore' }); const t0 = Date.now(); const tick = async () => { try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) return resolve(child); } catch { /* aún no */ } if (Date.now() - t0 > 30000) { child.kill(); return reject(new Error('el servidor no arrancó')); } setTimeout(tick, 400); }; tick(); });
    let a; let b; try { a = await start(9561); b = await start(9562);
      const p = await mkPerson(); const call = (port) => fetch(`http://127.0.0.1:${port}/api/skill-map/self`, { method: 'POST', headers: { Authorization: 'Bearer ' + p.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ skillKey: 'comunicacion', level: 2, evidenceRefs: p.refs, requestId: rid() }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
      const stat = {}; let n5xx = 0; for (let round = 0; round < 3; round += 1) { const out = await Promise.all([...Array.from({ length: 16 }, () => call(9561)), ...Array.from({ length: 16 }, () => call(9562))]); for (const x of out) { const k = x.status + (x.body && x.body.code ? ' ' + x.body.code : ''); stat[k] = (stat[k] || 0) + 1; if (x.status >= 500) n5xx += 1; } }
      const c = await rows(p);
      check(`C6 DOS procesos del servidor contra la misma base (16 + 16 simultáneas × 3 rondas de la misma persona): 0 5xx y 1 vigente [${TAG}]`, n5xx === 0 && c.cur === 1, `estados ${JSON.stringify(stat)}; guardadas ${c.all}; vigentes ${c.cur}; los 409 \`conflict\` (reintentables) son el límite declarado entre réplicas`);
    } catch (e) { check(`C6 dos procesos [${TAG}]`, false, 'excepción: ' + e.message); } finally { for (const c of [a, b]) if (c) c.kill(); }
  }

  fs.writeFileSync(path.join(OUT, `ES-295-propios-${TAG}.json`), JSON.stringify(results, null, 1));
  process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
