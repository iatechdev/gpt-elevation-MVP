// [QA-Claude] ES-45 · PR #48: mutaciones sobre copias en memoria del manifiesto. No toca archivos del paquete ni ejecuta el producto.
// Uso: QA_SUT=<clon con el head de #48> node qa/acceptance/es45-mutations.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const sut = process.env.QA_SUT; if (!sut) throw new Error('Defina QA_SUT.');
const dir = path.join(sut, 'acceptance', 'es45');
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
const { validatePackage } = await imp('lib/validate.mjs');
const { consolidate, recordKey } = await imp('lib/consolidate.mjs');
const { POLICY, LAYER_COMMANDS, BLOCKER_IDS } = await imp('lib/policy.mjs');
const load = (n) => JSON.parse(readFileSync(path.join(dir, n + '.json'), 'utf8'));
const base = () => structuredClone({ cases: load('cases'), journeys: load('journeys'), readiness: load('readiness'), results: load('results') });
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const SHA = 'a'.repeat(40), ORIGIN = 'https://staging.example.test';
const now = Date.parse('2026-12-01T12:00:00.000Z');
const hex = 'b'.repeat(64);
const rec = (p, v, layer, over = {}) => {
  const human = layer === 'human_review' || layer === 'followup';
  return { caseId: p.id, variantId: v.id, runId: 'run-001', layer, environmentKind: layer === 'followup' ? 'followup' : (['staging_api', 'staging_browser', 'human_review'].includes(layer) ? 'staging' : (['unit_doubles', 'http_doubles', 'browser_fixtures'].includes(layer) ? 'ci' : 'ci')),
    origin: ['staging_api', 'staging_browser', 'human_review', 'followup'].includes(layer) ? ORIGIN : null, commit: SHA, status: 'passed', simulation: false, simulatedBoundaries: [],
    startedAt: '2026-11-30T10:00:00.000Z', finishedAt: '2026-11-30T10:05:00.000Z', reasonCode: 'check_passed', commandId: LAYER_COMMANDS[layer][0],
    evidence: [{ path: 'ev/' + p.id + '-' + v.id + '-' + layer + '.json', sha256: hex, mediaType: 'application/json' }], reviewerRole: human ? 'QA' : null, reviewRef: human ? 'QA-REV1' : null, ...over };
};
const targetOk = { environmentKind: 'staging', origin: ORIGIN, commit: SHA, deploymentRef: 'PR-48', isolationRef: 'CI-1', accessRef: 'ES-45' };
const codes = (b) => validatePackage(b, now).map(e => e.code || e);
const has = (b, c) => codes(b).some(x => String(x).includes(c));

// 0. Paquete tal cual
check('M00 el paquete tal cual valida sin errores', codes(base()).length === 0, codes(base()).join(','));
const c0 = consolidate(base(), { now });
check('M01 el consolidado inicial: preparación lista, aceptación bloqueada, invitación pendiente, pilotReady false, 236 no verificados', c0.preparationReady && c0.integratedAcceptance === 'blocked' && c0.invitationDecision === 'pending_human_decision' && c0.pilotReady === false && c0.coverage.integratedNotVerified === 236, JSON.stringify({ a: c0.integratedAcceptance, n: c0.coverage.integratedNotVerified }));

// 1. Adversarial: todo passed + todos los bloqueos satisfechos + evidencia «verificada» => solo awaiting_human_review
const adv = base(); adv.readiness.target = { ...targetOk }; adv.readiness.blockers.forEach(b => { b.status = 'satisfied'; b.reference = 'ES-45'; });
for (const p of POLICY) for (const v of p.variants) for (const layer of p.layers) adv.results.records.push(rec(p, v, layer, layer === 'followup' ? { startedAt: '2026-11-30T10:00:00.000Z' } : {}));
const advErr = codes(adv);
const verified = new Set(adv.results.records.map(recordKey));
const ca = consolidate(adv, { now, verified });
check('M02 el manifiesto adversarial (todo passed, bloqueos satisfechos, hashes «verificados») se acepta como estructura', advErr.length === 0 || advErr.every(e => /followup_not_due/.test(String(e))), advErr.slice(0, 3).join(','));
check('M03 aun así solo llega a awaiting_human_review o blocked: nunca pilotReady ni invitación automática', ['awaiting_human_review', 'blocked'].includes(ca.integratedAcceptance) && ca.pilotReady === false && ca.invitationDecision === 'pending_human_decision', `${ca.integratedAcceptance} pilotReady=${ca.pilotReady}`);

// 2. Mutaciones puntuales sobre un registro válido
const P = POLICY.find(p => p.layers.includes('staging_browser') && p.layers.includes('staging_api')), V = P.variants[0];
const withRec = (over, layer = 'staging_browser', mutateBundle = (b) => b) => { const b = base(); b.readiness.target = { ...targetOk }; b.results.records.push(rec(P, V, layer, over)); return mutateBundle(b); };
check('M10 registro válido de staging_browser: sin errores', codes(withRec({})).length === 0, codes(withRec({})).join(','));
check('M11 comando de la capa API usado como staging_browser → command_layer', has(withRec({ commandId: LAYER_COMMANDS.staging_api[0] }), 'command_layer'));
check('M12 simulación declarada en capa de staging → promoted_doubles', has(withRec({ simulatedBoundaries: ['api'] }), 'promoted_doubles') && has(withRec({ simulatedBoundaries: ['http'] }), 'boundary_enum'));
check('M13 SHA incompleto (7 caracteres) → full_sha_required', has(withRec({ commit: 'abc1234' }), 'full_sha_required'));
check('M14 origen distinto del objetivo → result_origin', has(withRec({ origin: 'https://otro.example.test' }), 'result_origin'));
check('M15 origen con localhost o http → rechazado', has(withRec({ origin: 'http://localhost:3000' }), 'result_origin') && has(withRec({ origin: 'https://127.0.0.1' }), 'result_origin'));
check('M16 término antes del inicio → execution_provenance', has(withRec({ startedAt: '2026-11-30T10:05:00.000Z', finishedAt: '2026-11-30T10:00:00.000Z' }), 'execution_provenance'));
check('M17 término en el futuro → execution_provenance', has(withRec({ finishedAt: '2027-12-01T00:00:00.000Z' }), 'execution_provenance'));
check('M18 passed sin evidencia → missing_evidence', has(withRec({ evidence: [] }), 'missing_evidence'));
check('M19 evidencia con ruta ../ o absoluta → evidence_reference', has(withRec({ evidence: [{ path: '../secreto.json', sha256: hex, mediaType: 'application/json' }] }), 'evidence_reference') && has(withRec({ evidence: [{ path: '/etc/passwd', sha256: hex, mediaType: 'application/json' }] }), 'evidence_reference') && has(withRec({ evidence: [{ path: 'C:\\x.json', sha256: hex, mediaType: 'application/json' }] }), 'evidence_reference'));
check('M20 evidencia con hash corto o tipo no permitido → evidence_reference', has(withRec({ evidence: [{ path: 'a.json', sha256: 'abc', mediaType: 'application/json' }] }), 'evidence_reference') && has(withRec({ evidence: [{ path: 'a.json', sha256: hex, mediaType: 'text/html' }] }), 'evidence_reference'));
check('M21 passed con razón incorrecta → status_reason', has(withRec({ reasonCode: 'not_executed' }), 'status_reason'));
check('M22 identidad inventada (caso o variante inexistente) → result_identity', has(withRec({ variantId: 'no-existe' }), 'result_identity') && has(withRec({ caseId: 'E45-99' }), 'result_identity'));
check('M23 propiedad extra en un registro → forma cerrada', codes(withRec({ extra: 1 })).length > 0);
check('M24 registro duplicado → duplicate_result', has(withRec({}, 'staging_browser', (b) => { b.results.records.push(structuredClone(b.results.records[0])); return b; }), 'duplicate_result'));
check('M25 reclamo humano en una capa que no es humana → unexpected_human_claim', has(withRec({ reviewerRole: 'QA', reviewRef: 'QA-REV1' }), 'unexpected_human_claim'));
check('M26 human_review sin responsable o con rol inventado → human_reference', has(withRec({ reviewerRole: null, reviewRef: null }, 'human_review'), 'human_reference') && has(withRec({ reviewerRole: 'cualquiera', reviewRef: 'R-1' }, 'human_review'), 'human_reference'));
const F = POLICY.find(p => p.id === 'E45-28'), FV = F.variants.find(v => v.edge === 'day-7');
const fup = (over, ready) => { const b = base(); b.readiness.target = { ...targetOk }; if (ready) b.readiness.pilotStartedAt = ready; b.results.records.push(rec(F, FV, 'followup', over)); return b; };
check('M27 seguimiento passed sin piloto iniciado → followup_not_due', has(fup({}), 'followup_not_due'));
check('M28 seguimiento de 7 días antes de cumplirse → followup_not_due', has(fup({ startedAt: '2026-11-30T10:00:00.000Z', finishedAt: '2026-11-30T10:05:00.000Z' }, '2026-11-28T00:00:00.000Z'), 'followup_not_due'));
const tg = (t) => { const b = base(); b.readiness.target = t; return b; };
check('M29 objetivo con origen http, con credenciales, con ruta o con puerto → unverified_target_shape', ['http://staging.example.test', 'https://user:pw@staging.example.test', 'https://staging.example.test/app', 'https://localhost'].every(o => has(tg({ ...targetOk, origin: o }), 'unverified_target_shape')));
check('M30 objetivo con SHA corto o de entorno no staging → rechazado', has(tg({ ...targetOk, commit: 'abc' }), 'unverified_target_shape') && has(tg({ ...targetOk, environmentKind: 'production' }), 'unverified_target_shape'));
const bl = (mut) => { const b = base(); mut(b.readiness); return b; };
check('M31 bloqueo satisfecho sin referencia → blocker_reference; falta un bloqueo → missing_blocker', has(bl(r => { r.blockers[0].status = 'satisfied'; }), 'blocker_reference') && has(bl(r => { r.blockers.pop(); }), 'missing_blocker'));
// 3. No cuenta como integración: simulado, otro commit, sin hash comprobado
const elig = (over, verifiedSet) => { const b = withRec(over, 'staging_api'); const k = recordKey(b.results.records[0]); return consolidate(b, { now, verified: verifiedSet ? new Set([k]) : new Set() }); };
check('M40 un passed de staging_api con hash comprobado cuenta como «evidencia para revisión» (1 de 236)', elig({}, true).coverage.integratedEvidenceForReview === 1 && elig({}, true).coverage.integratedNotVerified === 235, '');
check('M41 el mismo registro sin hash comprobado no cuenta', elig({}, false).coverage.integratedEvidenceForReview === 0);
check('M42 el mismo registro con otro commit no cuenta', elig({ commit: 'c'.repeat(40) }, true).coverage.integratedEvidenceForReview === 0);
check('M43 un fallo (failed) en una familia crítica se informa en failures', (() => { const q = POLICY.find(p => p.id === 'E45-18'); const b = base(); b.readiness.target = { ...targetOk }; b.results.records.push(rec(q, q.variants[0], 'db_real', { status: 'failed', reasonCode: 'assertion_failed', environmentKind: 'ci', origin: null, commit: 'd'.repeat(40), evidence: [] })); const c = consolidate(b, { now }); return c.failures.length === 1; })());
console.log(JSON.stringify({ fin: true, familias: POLICY.length, bloqueos: BLOCKER_IDS.length }));
