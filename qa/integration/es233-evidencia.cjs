// [QA-Claude] ES-233 (PR #253, E253-3) · la evidencia (ES-27) con origen del chat y su propuesta con IA (ES-28) exigen insights_chat: guion PROPIO por HTTP real + PostgreSQL desechable.
// Incluye la carrera confirmar‖retirar con una evidencia previa (orden de bloqueos) y la brecha conocida ES-296 (retirar insights_chat no marca evidencias YA confirmadas).
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA253_DB=postgres://... node qa/integration/es233-evidencia.cjs
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253', 'backend'); const OUT = process.env.QA_OUT || '.'; const TAG = process.env.TAG || 'pr'; const ROUNDS = Number(process.env.QA_ROUNDS || 40);
const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) }; const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1200) }) + '\n'); };
const info = (id, detail) => { results.push({ id, info: detail }); process.stdout.write(JSON.stringify({ id, info: String(detail).slice(0, 1200) }) + '\n'); };
(async () => {
  const { q, mkUser, http, provider } = await startRealApi(t, { envVar: 'QA253_DB', prefix: 'qa253e' });
  const evidence = require(SUT + '/utils/evidence'); const ChatTurn = require(SUT + '/ChatTurn'); const { encriptarV2 } = require(SUT + '/utils/crypto');
  const grant = (who, purpose, status = 'granted') => http(who, 'PUT', `/api/consents/${purpose}`, { status });
  const rid = () => crypto.randomBytes(10).toString('hex');
  const body = (extra = {}, status = 'confirmed') => ({ payload: { title: 'Logro QA', situation: 'Situación', responsibility: { text: 'Responsabilidad' }, actions: [{ text: 'Acción' }], delivered: { text: 'Entrega' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status, requestId: rid(), ...extra });
  const turnOf = async (u, text = 'Coordiné el proyecto sintético con mi equipo durante seis meses.') => (await ChatTurn.create({ UserId: u.id, requestId: `qa-${rid()}`, status: 'completed', userContent: encriptarV2(text), replyContent: encriptarV2('r') })).id;
  const withChat = (id) => ({ origins: [{ type: 'chat_turn', id }] });

  // E1 matriz de permisos al CREAR confirmada
  { const out = []; const mk = async (grants) => { const u = await mkUser('user'); for (const g of grants) await grant(u, g); return u; };
    const a = await mk(['professional_bridge']); const ta = await turnOf(a); const r1 = await http(a, 'POST', '/api/evidence', body(withChat(ta)));
    const b = await mk(['professional_bridge', 'insights_chat']); const tb = await turnOf(b); const r2 = await http(b, 'POST', '/api/evidence', body(withChat(tb)));
    const c = await mk(['insights_chat']); const tc = await turnOf(c); const r3 = await http(c, 'POST', '/api/evidence', body(withChat(tc)));
    const d = await mk(['professional_bridge']); const td = await turnOf(d); const r4 = await http(d, 'POST', '/api/evidence', body(withChat(td), 'draft'));
    const e = await mk(['professional_bridge', 'insights_diary', 'insights_resume']); const te = await turnOf(e); const r5 = await http(e, 'POST', '/api/evidence', body(withChat(te)));
    const f = await mk([]); const r6 = await http(f, 'POST', '/api/evidence', body());
    check(`E1 evidencia confirmada con origen del chat: solo puente → 403 source_consent_required; puente + insights_chat → 201; solo insights_chat → 403 consent_required; el permiso de diario/hoja de vida no sirve; borrador no exige; sin origen no exige nada [${TAG}]`,
      r1.status === 403 && r1.body.code === 'source_consent_required' && r2.status === 201 && r3.status === 403 && r3.body.code === 'consent_required' && r4.status === 201 && r5.status === 403 && r6.status === 201,
      `puente solo ${r1.status} ${r1.body.code}; ambos ${r2.status}; solo chat ${r3.status} ${r3.body.code}; borrador ${r4.status}; diario+hoja ${r5.status}; directa ${r6.status}`); }

  // E2 actualizar (PUT) a confirmada exige el permiso; y retirar entre medias
  { const u = await mkUser('user'); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat'); const id = await turnOf(u);
    const draft = await http(u, 'POST', '/api/evidence', body(withChat(id), 'draft')); await grant(u, 'insights_chat', 'revoked');
    const up = await http(u, 'PUT', `/api/evidence/${draft.body.id || draft.body.evidenceId}`, { ...body(withChat(id)), baseVersion: 1 });
    check(`E2 pasar un borrador con origen del chat a confirmada tras retirar insights_chat → 403 [${TAG}]`, draft.status === 201 && up.status === 403, `borrador ${draft.status}; confirmar ${up.status} ${up.body && up.body.code}`); }

  // E3 carrera confirmar evidencia ‖ retirar insights_chat, con una evidencia previa (orden de bloqueos)
  for (const prior of [true, false]) { const stat = { confirm: {}, revoke: {} }; const problems = [];
    for (let i = 0; i < ROUNDS; i += 1) { const u = await mkUser('user'); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat'); const tid = await turnOf(u); if (prior) await http(u, 'POST', '/api/evidence', body());
      const [c, r] = await Promise.all([http(u, 'POST', '/api/evidence', body(withChat(tid))), grant(u, 'insights_chat', 'revoked')]);
      stat.confirm[c.status] = (stat.confirm[c.status] || 0) + 1; stat.revoke[r.status] = (stat.revoke[r.status] || 0) + 1;
      if (![201, 403].includes(c.status)) problems.push(`ronda ${i}: confirmar ${c.status} ${JSON.stringify(c.body).slice(0, 60)}`); if (r.status !== 200) problems.push(`ronda ${i}: RETIRAR ${r.status}`); }
    check(`E3 ${ROUNDS} rondas confirmar evidencia con origen del chat ‖ retirar insights_chat${prior ? ' (con evidencia previa)' : ' (sin evidencia previa)'}: confirmar 201/403, retirar siempre 200, ningún 5xx ni interbloqueo [${TAG}]`, problems.length === 0, `confirmar ${JSON.stringify(stat.confirm)}; retirar ${JSON.stringify(stat.revoke)}; ${problems.slice(0, 3).join(' | ') || 'sin problemas'}`); }
  // E3b carrera confirmar evidencia ‖ retirar el PUENTE con evidencia previa
  { const stat = { confirm: {}, revoke: {} }; const problems = [];
    for (let i = 0; i < ROUNDS; i += 1) { const u = await mkUser('user'); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat'); const tid = await turnOf(u); await http(u, 'POST', '/api/evidence', body(withChat(tid)));
      const t2 = await turnOf(u); const [c, r] = await Promise.all([http(u, 'POST', '/api/evidence', body(withChat(t2))), grant(u, 'professional_bridge', 'revoked')]);
      stat.confirm[c.status] = (stat.confirm[c.status] || 0) + 1; stat.revoke[r.status] = (stat.revoke[r.status] || 0) + 1; if (![201, 403].includes(c.status)) problems.push(`ronda ${i}: confirmar ${c.status}`); if (r.status !== 200) problems.push(`ronda ${i}: RETIRAR ${r.status}`); }
    check(`E3b ${ROUNDS} rondas confirmar evidencia ‖ retirar el PUENTE (con evidencia confirmada previa): sin 5xx ni interbloqueo [${TAG}]`, problems.length === 0, `confirmar ${JSON.stringify(stat.confirm)}; retirar ${JSON.stringify(stat.revoke)}; ${problems.slice(0, 3).join(' | ') || 'sin problemas'}`); }

  // E4 propuesta con IA
  { const u = await mkUser('user'); await grant(u, 'professional_bridge'); const id = await turnOf(u); const before = provider.calls; const noIns = await http(u, 'POST', '/api/evidence/proposals', { turnIds: [id], locale: 'es' }); const mid = provider.calls;
    await grant(u, 'insights_chat'); const withIns = await http(u, 'POST', '/api/evidence/proposals', { turnIds: [id], locale: 'es' }); const after = provider.calls;
    check(`E4 propuesta con IA: sin insights_chat → 403 source_consent_required y SIN llamar a la IA; con él sí llama [${TAG}]`, noIns.status === 403 && noIns.body.code === 'source_consent_required' && mid === before && after > mid && withIns.status !== 403, `sin permiso ${noIns.status} ${noIns.body.code}; llamadas ${before}→${mid}; con permiso ${withIns.status} (llamadas →${after})`); }

  // E5 BRECHA CONOCIDA (ES-296): retirar insights_chat NO marca evidencias ya confirmadas con origen del chat
  { const u = await mkUser('user'); await grant(u, 'professional_bridge'); await grant(u, 'insights_chat'); const id = await turnOf(u); const ev = await http(u, 'POST', '/api/evidence', body(withChat(id))); const before = (await evidence.getConfirmedEvidence(u.id, 'qa')).length;
    await grant(u, 'insights_chat', 'revoked'); const afterIns = (await evidence.getConfirmedEvidence(u.id, 'qa')).length; await grant(u, 'professional_bridge', 'revoked'); const afterBridge = (await evidence.getConfirmedEvidence(u.id, 'qa')).length;
    info(`E5 BRECHA CONOCIDA (ES-296) [${TAG}]`, `evidencia confirmada con origen del chat: ${ev.status}; entregada al motor antes ${before}; DESPUÉS de retirar insights_chat ${afterIns} (si es ${before}, el texto derivado del chat sigue saliendo); después de retirar también el puente ${afterBridge}`); }

  fs.writeFileSync(path.join(OUT, `ES-233-evidencia-${TAG}.json`), JSON.stringify(results, null, 1)); process.stdout.write('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length + '\n');
  for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
