import { POLICY, LAYERS } from './policy.mjs'
import { validatePackage } from './validate.mjs'
export const recordKey = r => [r.caseId, r.variantId, r.layer, r.runId].join('|')
export function consolidate(bundle, { now = Date.now(), verified = new Set() } = {}) {
  const errors = validatePackage(bundle, now)
  if (errors.length) return { schemaVersion: 1, ticket: 'ES-45', preparationReady: false, integratedAcceptance: 'blocked', invitationDecision: 'pending_human_decision', pilotReady: false, errors }
  const { cases, readiness, results } = bundle
  const eligible = r => r.status === 'passed' && !r.simulation && r.commit === readiness.target?.commit &&
    r.evidence.length > 0 && verified.has(recordKey(r))
  const requirements = POLICY.flatMap(p => p.variants.flatMap(v => p.layers.map(layer => ({
    caseId: p.id, variantId: v.id, layer,
    state: results.records.some(r => r.caseId === p.id && r.variantId === v.id && r.layer === layer && eligible(r)) ? 'evidence_for_review' : 'not_verified',
  }))))
  const integrated = requirements.filter(r => r.caseId !== 'E45-28')
  const followup = requirements.filter(r => r.caseId === 'E45-28')
  const failures = results.records.filter(r => r.status === 'failed' && !r.simulation &&
    (r.commit === readiness.target?.commit || ['E45-18', 'E45-19', 'E45-22', 'E45-23'].includes(r.caseId)))
    .map(r => ({ caseId: r.caseId, variantId: r.variantId, layer: r.layer, runId: r.runId }))
  const blockers = readiness.blockers.filter(b => b.status !== 'satisfied').map(b => b.id)
  const available = integrated.filter(r => r.state === 'evidence_for_review').length
  return {
    schemaVersion: 1, ticket: 'ES-45', preparationReady: true, pilotReady: false,
    integratedAcceptance: readiness.target && !blockers.length && !failures.length && available === integrated.length ? 'awaiting_human_review' : 'blocked',
    invitationDecision: 'pending_human_decision',
    coverage: { families: cases.families.length, variants: cases.families.reduce((n, f) => n + f.variants.length, 0),
      integratedRequired: integrated.length, integratedEvidenceForReview: available, integratedNotVerified: integrated.length - available,
      layers: LAYERS.map(layer => ({ layer, recorded: results.records.filter(r => r.layer === layer).length,
        simulated: results.records.filter(r => r.layer === layer && r.simulation).length,
        eligibleForReview: results.records.filter(r => r.layer === layer && eligible(r)).length })) },
    followup: { state: readiness.pilotStartedAt === null ? 'not_started' : followup.every(r => r.state === 'evidence_for_review') ? 'awaiting_human_review' : 'pending',
      required: followup.length, evidenceForReview: followup.filter(r => r.state === 'evidence_for_review').length },
    blockers, failures, requirements, errors: [],
    warning: 'Structural consistency and matching artifact hashes do not prove truthful execution or authenticate human approval.',
  }
}
export function markdown(report) {
  const lines = ['# ES-45 — Consolidado / Consolidation', '', '[Dev-Codex]', '',
    'Preparación / Preparation: ' + (report.preparationReady ? 'lista / ready' : 'inválida / invalid'),
    'Aceptación integral / Integrated acceptance: ' + report.integratedAcceptance,
    'Invitación / Invitation: pending_human_decision', 'Piloto aprobado / Pilot approved: false', '']
  if (!report.preparationReady) return lines.concat('Errores de estructura / Structure errors: ' + report.errors.length, '').join('\n')
  lines.push('Familias / Families: ' + report.coverage.families, 'Variantes / Variants: ' + report.coverage.variants,
    'Requisitos con evidencia para revisión / Requirements with evidence for review: ' + report.coverage.integratedEvidenceForReview + '/' + report.coverage.integratedRequired,
    'No verificados / Not verified: ' + report.coverage.integratedNotVerified,
    'Dependencias pendientes / Pending dependencies: ' + report.blockers.length,
    'Fallos sin resolver / Unresolved failures: ' + report.failures.length,
    'Seguimiento / Follow-up: ' + report.followup.state, '', '| Capa / Layer | Registros / Records | Simulados / Simulated | Para revisión / For review |', '| --- | ---: | ---: | ---: |')
  for (const row of report.coverage.layers) lines.push('| ' + row.layer + ' | ' + row.recorded + ' | ' + row.simulated + ' | ' + row.eligibleForReview + ' |')
  lines.push('', 'El paquete no ejecuta el producto ni autoriza invitaciones. / The package does not run the product or authorize invitations.',
    'Hashes y esquema no prueban ejecución veraz ni aprobación humana. / Hashes and schema do not prove truthful execution or human approval.', '')
  return lines.join('\n')
}
