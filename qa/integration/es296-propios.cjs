// [QA-Claude] ES-296 (PR #257) · retirar insights_chat marca para revisión la evidencia con origen del chat: guion PROPIO por HTTP real + PostgreSQL desechable.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA296_DB=postgres://... node qa/integration/es296-propios.cjs
// Cubre: todos los caminos de lectura (motor, mapa, propuesta con IA, plan, exportaciones, profesional, administración), no fuga de campos internos, alcance, idempotencia, re-otorgar, historia, aislamiento y carreras.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253', 'backend'); const OUT = process.env.QA_OUT || '.'; const TAG = process.env.TAG || 'pr'; const ROUNDS = Number(process.env.QA_ROUNDS || 40);
const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) }; const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1500) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1500) }) + '\n'); };
const LEAK = /sourceRevokedAt|source_revoked|reviewReason|needsReview|"origins"/;
(async () => {
  const { q, mkUser, http, provider } = await startRealApi(t, { envVar: 'QA296_DB', prefix: 'qa296' });
  const evidence = require(SUT + '/utils/evidence'); const ChatTurn = require(SUT + '/ChatTurn'); const { encriptarV2 } = require(SUT + '/utils/crypto'); const catalog = require(SUT + '/utils/skillCatalog');
  const grant = (who, purpose, status = 'granted') => http(who, 'PUT', `/api/consents/${purpose}`, { status });
  const rid = () => crypto.randomBytes(10).toString('hex');
  const payload = (title = 'Logro QA') => ({ title, situation: 'Situación', responsibility: { text: 'Responsabilidad' }, actions: [{ text: 'Acción' }], delivered: { text: 'Entrega' }, observedEffect: { known: false }, autonomy: 'autonomous' });
  const body = (extra = {}, status = 'confirmed') => ({ payload: payload(), status, requestId: rid(), ...extra });
  const turnOf = async (u, text = 'Coordiné el proyecto sintético con mi equipo durante seis meses.') => (await ChatTurn.create({ UserId: u.id, requestId: `qa-${rid()}`, status: 'completed', userContent: encriptarV2(text), replyContent: encriptarV2('r') })).id;
  const withChat = (id) => ({ origins: [{ type: 'chat_turn', id, quote: 'Coordiné el proyecto' }] });
  const setup = async () => { const u = await mkUser('user'); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat'); return u; };
  const engine = async (u, who = 'qa') => (await evidence.getConfirmedEvidence(u.id, who)).map((e) => e.evidenceId).sort((a, b) => a - b);
  const mkChatEv = async (u, extra = {}) => { const tid = await turnOf(u); const r = await http(u, 'POST', '/api/evidence', body({ ...withChat(tid), ...extra })); return { id: r.body.id, status: r.status, turn: tid }; };
  const mkDirect = async (u) => (await http(u, 'POST', '/api/evidence', body())).body.id;

  // catálogo con una habilidad, para el mapa y la propuesta con IA
  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `n${n}`, en: `l${n}` }]));
  const draft = await catalog.createDraft(); await catalog.upsertSkill(draft.id, 'comunicacion', { type: 'transversal', labels: { es: 'c', en: 'c' }, rubric: { levels, source: 's', verifiedBy: 'r', verifiedAt: '2026-10-01' } });
  try { await catalog.publish(draft.id, 1); } catch { await catalog.publish(draft.id, 2); }

  // F1 + F2: todos los consumidores de getConfirmedEvidence (nombres usados en producción) dejan de recibir lo marcado
  { const u = await setup(); const chat = await mkChatEv(u); const plain = await mkDirect(u);
    const refs = [{ evidenceId: chat.id, version: 1 }]; const self1 = await http(u, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level: 2, evidenceRefs: refs, requestId: rid() });
    const names = ['skill-map', 'skill-proposal', 'career-plan', 'professional', 'qa'];
    const before = {}; for (const n of names) before[n] = await engine(u, n);
    await grant(u, 'insights_chat', 'revoked');
    const after = {}; for (const n of names) after[n] = await engine(u, n);
    const ok = names.every((n) => before[n].length === 2 && after[n].length === 1 && after[n][0] === plain);
    check(`F1 el motor (cualquier consumidor) recibe 2 antes y SOLO la directa después de retirar insights_chat [${TAG}]`, ok, `antes ${JSON.stringify(before)}; después ${JSON.stringify(after)}`);
    const self2 = await http(u, 'POST', '/api/skill-map/self', { skillKey: 'comunicacion', level: 2, evidenceRefs: refs, requestId: rid() });
    check(`F1b autoevaluar citando la evidencia marcada → 422 evidence_not_valid (la evaluación ya hecha antes pasó con ${self1.status}) [${TAG}]`, self1.status === 200 || self1.status === 201 ? self2.status === 422 && self2.body.code === 'evidence_not_valid' : false, `antes ${self1.status}; después ${self2.status} ${self2.body.code}`);
    const map = await http(u, 'GET', '/api/skill-map'); const sk = map.body.skills.find((s) => s.skillKey === 'comunicacion');
    check(`F1c el mapa deja la evaluación previa en «stale» sin nivel y sin citar la evidencia marcada [${TAG}]`, map.status === 200 && sk.self && sk.self.stale === true && sk.self.level === null && !/sourceRevokedAt|source_revoked|reviewReason|"origins"/.test(JSON.stringify(map.body)), `stale ${sk.self && sk.self.stale}; nivel ${sk.self && sk.self.level}`);
    const u3 = await setup(); const mk = await http(u3, 'POST', '/api/evidence', body({ payload: payload('MARCADA-CHAT'), ...withChat(await turnOf(u3)) })); await http(u3, 'POST', '/api/evidence', body({ payload: payload('DIRECTA-OK') })); await grant(u3, 'insights_chat', 'revoked');
    const before2 = provider.requests.length; const prop = await http(u3, 'POST', '/api/skill-map/proposals', { skillKeys: ['comunicacion'], locale: 'es' }); const reqs = provider.requests.slice(before2).join(' ');
    check(`F1d propuesta con IA: el prompt NO contiene la evidencia marcada y SÍ la directa [${TAG}]`, mk.status === 201 && reqs.includes('DIRECTA-OK') && !reqs.includes('MARCADA-CHAT'), `llamadas ${provider.requests.length - before2}; respuesta ${prop.status}; marcada en el prompt ${reqs.includes('MARCADA-CHAT')}; directa ${reqs.includes('DIRECTA-OK')}`);
    const plan = await http(u, 'GET', '/api/career-plan'); info(`F1e plan /api/career-plan [${TAG}]`, `estado ${plan.status}; fuga ${LEAK.test(JSON.stringify(plan.body))}`);
  }

  // F2 alcance
  { const u = await setup(); const chat = await mkChatEv(u); const out = [];
    for (const p of ['insights_diary', 'insights_resume', 'research', 'professional_bridge_unrelated']) { if (p.startsWith('professional')) continue; await grant(u, p); const r = await grant(u, p, 'revoked'); out.push(`${p}:${r.status}`); }
    const still = await engine(u); const marks = Number((await q(`SELECT count(*) n FROM "EvidenceVersions" WHERE "UserId"=$1 AND origins::text LIKE '%sourceRevokedAt%'`, [u.id]))[0].n); const ev = Number((await q(`SELECT count(*) n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [u.id]))[0].n);
    check(`F2 retirar insights_diary / insights_resume / research NO marca ni invalida nada [${TAG}]`, still.length === 1 && marks === 0 && ev === 0, `${out.join(', ')}; motor ${still.length}; marcas ${marks}; eventos ${ev}`); }

  // F3 no fuga: la persona ve solo needsReview/reviewReason; profesional, administración y exportaciones nunca ven campos internos
  { const therapist = await mkUser('therapist'); const admin = await mkUser('admin'); const u = await mkUser('user', { therapistId: therapist.id }); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat');
    const chat = await mkChatEv(u); await mkDirect(u); await grant(u, 'insights_chat', 'revoked');
    const list = await http(u, 'GET', '/api/evidence'); const one = await http(u, 'GET', `/api/evidence/${chat.id}`);
    const mine = list.body.evidence.find((e) => e.id === chat.id); const keys = Object.keys(mine).sort().join(',');
    check(`F3a la persona: lista y detalle exponen needsReview + reviewReason='source_revoked' y NADA de origins/sourceRevokedAt/ids del chat [${TAG}]`, mine.needsReview === true && mine.reviewReason === 'source_revoked' && !/sourceRevokedAt|"origins"|chat_turn|turnId/.test(JSON.stringify(list.body) + JSON.stringify(one.body)), `campos ${keys}; detalle ${one.status}`);
    const hits = {}; const scan = async (name, who, method, url, b) => { const r = await http(who, method, url, b); const txt = JSON.stringify(r.body); hits[name] = `${r.status}${LEAK.test(txt) ? ' FUGA' : ''}${txt.includes('Coordiné') ? ' TEXTO' : ''}`; return r; };
    await scan('prof:pacientes', therapist, 'GET', '/api/therapist/pacientes'); await scan('prof:alerts', therapist, 'GET', '/api/therapist/alerts'); await scan('prof:historial', therapist, 'GET', `/api/therapist/pacientes/${u.id}/historial`);
    await scan('prof:historia', therapist, 'GET', `/api/therapist/pacientes/${u.id}/historia`); await scan('prof:resumen-ia', therapist, 'GET', `/api/therapist/pacientes/${u.id}/resumen-ia`);
    await scan('admin:usuarios', admin, 'GET', '/api/admin/usuarios'); await scan('admin:stats', admin, 'GET', `/api/admin/usuarios/${u.id}/stats`); await scan('admin:alerts', admin, 'GET', '/api/admin/usuarios/alerts');
    await scan('prof:evidence-ajena', therapist, 'GET', `/api/evidence/${chat.id}`); await scan('admin:evidence-ajena', admin, 'GET', `/api/evidence/${chat.id}`);
    await scan('prof:careerctx', therapist, 'GET', '/api/career-context'); await scan('prof:skill-map', therapist, 'GET', '/api/skill-map');
    const bad = Object.entries(hits).filter(([, v]) => /FUGA|TEXTO/.test(v)); const own404 = ['prof:evidence-ajena', 'admin:evidence-ajena'].map((k) => `${k}=${hits[k]}`).join(' ');
    check(`F3b profesional y administración: ningún endpoint revisado devuelve sourceRevokedAt / source_revoked / reviewReason / needsReview / origins ni texto del chat [${TAG}]`, bad.length === 0, `${bad.length ? 'FUGAS ' + JSON.stringify(bad) : 'sin fugas'}; ${own404}; todos: ${JSON.stringify(hits)}`);
    // exportaciones (personal y profesional)
    const ex = {}; for (const type of ['personal', 'professional']) { const alt = await http(u, 'POST', '/api/exports/preview', { type, locale: 'es' }); const txt = JSON.stringify(alt.body); ex[type] = `${alt.status}${alt.body && alt.body.code ? ' ' + alt.body.code : ''}${/sourceRevokedAt|"origins"|reviewReason/.test(txt) ? ' FUGA' : ''}${/source_revoked/.test(txt) ? ' (invalidación propia «source_revoked»: solo id y motivo, es de la persona)' : ''}`; ex[type + '_incluyeEvidenciaMarcada'] = /Logro QA/.test(txt) && (txt.match(/Logro QA/g) || []).length; }
    check(`F3c exportaciones personal/profesional (DATA_RIGHTS_ENABLED=true): se generan y no llevan sourceRevokedAt/origins [${TAG}]`, !/FUGA/.test(JSON.stringify(ex)) && /^20[01]/.test(ex.personal) && /^(20[01]|503 professional_contract_pending)/.test(ex.professional), JSON.stringify(ex)); } // la exportación profesional aún no existe (503 professional_contract_pending): no se puede verificar

  // F4 re-otorgar no limpia + F5 idempotencia + F6 solo la vigente, historia intacta
  { const u = await setup(); const chat = await mkChatEv(u); const t2 = await turnOf(u);
    await http(u, 'PUT', `/api/evidence/${chat.id}`, { payload: payload('v2'), status: 'confirmed', baseVersion: 1, requestId: rid(), ...withChat(t2) }); // 2 versiones; la vigente es la 2
    const direct = await mkDirect(u); const draftOnly = (await http(u, 'POST', '/api/evidence', body(withChat(await turnOf(u)), 'draft'))).body.id;
    await grant(u, 'insights_chat', 'revoked'); await grant(u, 'insights_chat', 'revoked');
    const rows = await q(`SELECT "EvidenceId", version, status, origins::text AS o FROM "EvidenceVersions" WHERE "UserId"=$1 ORDER BY "EvidenceId", version`, [u.id]);
    const marked = rows.filter((r) => r.o.includes('sourceRevokedAt')).map((r) => `${r.EvidenceId}v${r.version}`); const events = Number((await q(`SELECT count(*) n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [u.id]))[0].n);
    check(`F5/F6 solo la VIGENTE confirmada con origen del chat se marca (v2); no la v1, ni la directa, ni el borrador; retirar dos veces → 1 evento; nada se borra [${TAG}]`, JSON.stringify(marked) === JSON.stringify([`${chat.id}v2`]) && events === 1 && rows.length === 4, `marcadas ${JSON.stringify(marked)}; eventos ${events}; versiones ${rows.length}`);
    await grant(u, 'insights_chat'); const reg = await engine(u);
    check(`F4 volver a otorgar NO limpia: el motor sigue sin la evidencia del chat (solo ${direct}) [${TAG}]`, JSON.stringify(reg) === JSON.stringify([direct]), `motor ${JSON.stringify(reg)}`);
    const t3 = await turnOf(u); const ed = await http(u, 'PUT', `/api/evidence/${chat.id}`, { payload: payload('v3'), status: 'confirmed', baseVersion: 2, requestId: rid(), ...withChat(t3) });
    const after = await engine(u); check(`F4b reconfirmar crea una versión NUEVA que vuelve al motor [${TAG}]`, ed.status < 300 && after.includes(chat.id), `PUT ${ed.status}; motor ${JSON.stringify(after)}`);
    // la edición directa (sin chat) de una marcada: queda como lo decide la persona
    const u2 = await setup(); const c2 = await mkChatEv(u2); await grant(u2, 'insights_chat', 'revoked');
    const direct2 = await http(u2, 'PUT', `/api/evidence/${c2.id}`, { payload: payload('sin chat'), status: 'confirmed', baseVersion: 1, requestId: rid() });
    info(`F4c editar la marcada SIN origen del chat (permiso retirado) [${TAG}]`, `PUT ${direct2.status} ${direct2.body && direct2.body.code}; motor ${JSON.stringify(await engine(u2))} (si entra al motor es el texto escrito por la persona al confirmar; no hay origen del chat)`); }

  // F7 carreras
  const race = async (id, mk, label) => { const stat = {}; const problems = [];
    for (let i = 0; i < ROUNDS; i += 1) { const { u, ops, check: fin } = await mk(); const res = await Promise.all(ops.map((f) => f())); res.forEach((r, k) => { stat[`${k}:${r.status}`] = (stat[`${k}:${r.status}`] || 0) + 1; if (r.status >= 500) problems.push(`ronda ${i} op${k} ${r.status}`); });
      const g = res[res.length - 1]; if (g.status !== 200) problems.push(`ronda ${i}: RETIRAR ${g.status}`); const extra = await fin(u); if (extra) problems.push(`ronda ${i}: ${extra}`); }
    check(`${id} ${ROUNDS} rondas ${label}: 0 5xx, retirar siempre 200, invariante [${TAG}]`, problems.length === 0, `${JSON.stringify(stat)}; ${problems.slice(0, 3).join(' | ') || 'sin problemas'}`); };
  const invariant = async (u) => { const cur = (await q(`SELECT v.origins::text o, v.status FROM "EvidenceVersions" v JOIN "Evidence" e ON e.id=v."EvidenceId" AND e."currentVersion"=v.version WHERE e."UserId"=$1 AND e."deletedAt" IS NULL`, [u.id])); const consent = (await q(`SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose='insights_chat' ORDER BY id DESC LIMIT 1`, [u.id]))[0];
    const bad = cur.filter((c) => c.status === 'confirmed' && c.o.includes('chat_turn') && !c.o.includes('sourceRevokedAt')); if (consent && consent.status === 'revoked' && bad.length) return 'vigente con origen del chat, permiso retirado y SIN marca'; if ((await engine(u)).length && consent && consent.status === 'revoked' && bad.length) return 'el motor entregó'; return null; };
  await race('F7a', async () => { const u = await setup(); const c = await mkChatEv(u); const t2 = await turnOf(u); return { u, ops: [() => http(u, 'PUT', `/api/evidence/${c.id}`, { payload: payload('r'), status: 'confirmed', baseVersion: 1, requestId: rid(), ...withChat(t2) }), () => grant(u, 'insights_chat', 'revoked')], check: invariant }; }, 'retirar ‖ reconfirmar (PUT)');
  await race('F7b', async () => { const u = await setup(); await mkChatEv(u); const t2 = await turnOf(u); return { u, ops: [() => http(u, 'POST', '/api/evidence', body(withChat(t2))), () => grant(u, 'insights_chat', 'revoked')], check: invariant }; }, 'retirar ‖ crear confirmada con origen del chat (POST), con evidencia previa');
  await race('F7c', async () => { const u = await setup(); const c = await mkChatEv(u); await http(u, 'POST', '/api/career-context/preview', { fields: [] }); return { u, ops: [() => http(u, 'DELETE', `/api/evidence/${c.id}`), () => grant(u, 'insights_chat', 'revoked')], check: invariant }; }, 'retirar ‖ borrar la evidencia');
  await race('F7d', async () => { const u = await setup(); await mkChatEv(u); await mkChatEv(u); return { u, ops: [() => grant(u, 'professional_bridge', 'revoked'), () => grant(u, 'insights_chat', 'revoked')], check: invariant }; }, 'retirar el puente ‖ retirar insights_chat (dos ganchos)');
  await race('F7e', async () => { const u = await setup(); await mkChatEv(u); return { u, ops: [() => grant(u, 'insights_chat', 'revoked'), () => grant(u, 'insights_chat', 'revoked'), () => grant(u, 'insights_chat', 'revoked')], check: async (x) => { const e = Number((await q(`SELECT count(*) n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [x.id]))[0].n); return e === 1 ? null : `eventos ${e}`; } }; }, '3 retiradas simultáneas (idempotencia: 1 evento)');
  // F8 orden de bloqueos: Puente + evidencia con los dos orígenes a la vez, retirar insights_chat ‖ confirmar el puente
  await race('F8', async () => { const u = await setup(); await grant(u, 'insights_diary'); const c = await mkChatEv(u); const t2 = await turnOf(u);
    return { u, ops: [() => http(u, 'POST', '/api/evidence', body(withChat(t2))), () => http(u, 'PUT', `/api/evidence/${c.id}`, { payload: payload('x'), status: 'confirmed', baseVersion: 1, requestId: rid(), ...withChat(t2) }), () => grant(u, 'insights_chat', 'revoked')], check: invariant }; }, 'retirar ‖ (crear + actualizar) evidencia con origen del chat');

  // F9 aislamiento
  { const a = await setup(); const b = await setup(); const ca = await mkChatEv(a); const cb = await mkChatEv(b); await grant(a, 'insights_chat', 'revoked');
    const foreign = await http(a, 'GET', `/api/evidence/${cb.id}`); const eb = await engine(b); const events = Number((await q(`SELECT count(*) n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND reason='source_revoked'`, [b.id]))[0].n);
    check(`F9 aislamiento: la retirada de A no toca a B; la evidencia de B no se lee con el token de A [${TAG}]`, eb.length === 1 && eb[0] === cb.id && events === 0 && foreign.status === 404, `B motor ${JSON.stringify(eb)}; eventos de B ${events}; A lee la de B ${foreign.status}`); }

  // F10 sin permiso nunca hubo origen del chat: la evidencia directa (sin origen) jamás se marca aunque se retire insights_chat
  { const u = await setup(); const d = await mkDirect(u); await grant(u, 'insights_chat', 'revoked'); const list = await http(u, 'GET', '/api/evidence'); const me = list.body.evidence.find((e) => e.id === d);
    check(`F10 la evidencia directa (sin origen) no se marca ni lleva needsReview [${TAG}]`, me.needsReview === undefined && me.reviewReason === undefined && (await engine(u)).includes(d), JSON.stringify(Object.keys(me))); }

  // F13 rendimiento: retirar con 200 evidencias del chat y lectura del motor
  { const u = await setup(); const tid = await turnOf(u); for (let i = 0; i < 200; i += 1) { await http(u, 'POST', '/api/evidence', body(withChat(tid))); }
    const t0 = performance.now(); const r = await engine(u); const read1 = performance.now() - t0; const s = performance.now(); const rv = await grant(u, 'insights_chat', 'revoked'); const revoke = performance.now() - s; const t1 = performance.now(); const r2 = await engine(u); const read2 = performance.now() - t1;
    check(`F13 retirar insights_chat con 200 evidencias del chat: ${revoke.toFixed(0)} ms (umbral propuesto < 500); lectura del motor ${read1.toFixed(0)} → ${read2.toFixed(0)} ms [${TAG}]`, rv.status === 200 && revoke < 500 && r.length === 200 && r2.length === 0 && read2 < read1 * 1.2 + 20, `retirar ${revoke.toFixed(0)} ms; motor ${r.length}→${r2.length}`); }

  fs.writeFileSync(path.join(OUT, `ES-296-propios-${TAG}.json`), JSON.stringify(results, null, 1)); process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
