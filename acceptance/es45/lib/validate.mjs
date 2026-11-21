import { POLICY, LAYERS, LAYER_COMMANDS, BLOCKER_IDS, COMMANDS, ENVIRONMENTS, STATUSES, BOUNDARIES, MEDIA, REASONS } from './policy.mjs'
export const dateMs = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? Date.parse(value) : NaN
export const safeReference = value => typeof value === 'string' && /^(ES-\d+(?::\d+)?|PR-\d+|CI-\d+|QA-[A-Z0-9-]+)$/.test(value)
export const safeArtifactPath = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value) && value.split('/').every(p => p && p !== '.' && p !== '..') && /\.(json|txt|md|png)$/.test(value)
export const safeOrigin = value => {
  if (typeof value !== 'string') return false
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' && u.origin === value && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) } catch { return false }
}
const SHA = /^[a-f0-9]{40}$/, HASH = /^[a-f0-9]{64}$/, ID = /^[A-Za-z0-9_-]{1,80}$/
export function validatePackage({ cases, journeys, readiness, results }, now = Date.now()) {
  const errors = []
  const error = (code, location) => errors.push({ code, location })
  const shape = (obj, keys, p) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { error('object_required', p); return false }
    if (Object.keys(obj).sort().join('|') !== [...keys].sort().join('|')) { error('closed_fields', p); return false }
    return true
  }
  const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 5000
  const bilingual = (obj, p) => { if (shape(obj, ['es', 'en'], p) && (!text(obj.es) || !text(obj.en))) error('bilingual_text', p) }
  const array = (value, max, p) => { if (!Array.isArray(value) || value.length > max) { error('bounded_array', p); return false } return true }
  const unique = (values, p) => { if (new Set(values).size !== values.length) error('duplicate_id', p) }
  const envelope = (value, key, p) => {
    if (!shape(value, ['schemaVersion', 'ticket', key], p)) return false
    if (value.schemaVersion !== 1 || value.ticket !== 'ES-45') error('version_or_ticket', p)
    return true
  }
  const known = new Map(POLICY.map(p => [p.id, p]))
  if (envelope(cases, 'families', 'cases') && array(cases.families, 28, 'families')) {
    unique(cases.families.map(f => f?.id), 'families')
    if (cases.families.length !== 28) error('family_coverage', 'families')
    cases.families.forEach((family, i) => {
      const p = 'families.' + i
      if (!shape(family, ['id', 'title', 'hu', 'requiredLayers', 'destructive', 'variants'], p)) return
      const policy = known.get(family.id)
      if (!policy) { error('unknown_family', p); return }
      bilingual(family.title, p + '.title')
      if (!Array.isArray(family.hu) || !family.hu.length || family.hu.some(h => typeof h !== 'string' || !/^ES-\d+$/.test(h))) error('hu_reference', p)
      if (JSON.stringify(family.requiredLayers) !== JSON.stringify(policy.layers)) error('required_layers_changed', p)
      if (family.destructive !== policy.destructive) error('destructive_marker', p)
      if (!array(family.variants, 30, p)) return
      unique(family.variants.map(v => v?.id), p)
      if (family.variants.length !== policy.variants.length) error('variant_coverage', p)
      family.variants.forEach((v, j) => {
        const q = p + '.variants.' + j
        if (!shape(v, ['id', 'locale', 'edge', 'steps', 'expected', 'followupDays'], q)) return
        if (!policy.variants.some(pv => pv.id === v.id && pv.locale === v.locale && pv.edge === v.edge)) error('unknown_variant', q)
        if (v.followupDays !== (family.id === 'E45-28' ? v.edge === 'day-7' ? 7 : 30 : null)) error('followup_window', q)
        bilingual(v.expected, q + '.expected')
        if (shape(v.steps, ['es', 'en'], q + '.steps')) for (const locale of ['es', 'en']) {
          if (!Array.isArray(v.steps[locale]) || v.steps[locale].length < 3 || v.steps[locale].length > 20 || v.steps[locale].some(x => !text(x))) error('bilingual_steps', q)
        }
      })
    })
    for (const policy of POLICY) if (!cases.families.some(f => f?.id === policy.id)) error('missing_family', 'families')
  }
  if (shape(journeys, ['schemaVersion', 'ticket', 'synthetic', 'journeys'], 'journeys')) {
    if (journeys.schemaVersion !== 1 || journeys.ticket !== 'ES-45' || journeys.synthetic !== true) error('synthetic_only', 'journeys')
    if (array(journeys.journeys, 6, 'journeys.items')) {
      if (journeys.journeys.length !== 6 || journeys.journeys.filter(j => j?.locale === 'es').length !== 5 || journeys.journeys.filter(j => j?.locale === 'en').length !== 1) error('six_bilingual_journeys', 'journeys')
      unique(journeys.journeys.map(j => j?.id), 'journeys')
      journeys.journeys.forEach((j, i) => {
        const p = 'journeys.' + i
        if (!shape(j, ['id', 'locale', 'entry', 'context', 'steps', 'notes'], p)) return
        if (!/^SYN-0[1-6]$/.test(j.id) || !['es', 'en'].includes(j.locale) || !['exploration', 'direct'].includes(j.entry)) error('journey_identity', p)
        bilingual(j.context, p + '.context'); bilingual(j.notes, p + '.notes')
        if (!array(j.steps, 28, p) || !j.steps.length) { error('journey_steps', p); return }
        j.steps.forEach((s, n) => {
          if (!shape(s, ['caseId', 'variantId'], p + '.steps.' + n)) return
          if (!known.get(s.caseId)?.variants.some(v => v.id === s.variantId && v.locale === j.locale)) error('journey_reference', p + '.steps.' + n)
        })
        const ids = j.steps.map(s => s?.caseId)
        if (ids[0] !== 'E45-02' || ids[1] !== 'E45-03' || !ids.includes(j.entry === 'direct' ? 'E45-07' : 'E45-05')) error('entry_flow', p)
        if (j.id === 'SYN-05' && ids.some(id => ['E45-06', 'E45-07', 'E45-15'].includes(id))) error('optional_career', p)
        if (['SYN-01', 'SYN-02', 'SYN-06'].includes(j.id) && !['E45-08', 'E45-09', 'E45-10', 'E45-12', 'E45-13', 'E45-15', 'E45-17'].every(id => ids.includes(id))) error('full_journey', p)
      })
      if (!['exploration', 'direct'].every(entry => journeys.journeys.some(j => j?.entry === entry))) error('both_entries', 'journeys')
    }
  }
  if (shape(readiness, ['schemaVersion', 'ticket', 'target', 'pilotStartedAt', 'blockers'], 'readiness')) {
    if (readiness.schemaVersion !== 1 || readiness.ticket !== 'ES-45') error('version_or_ticket', 'readiness')
    if (readiness.target !== null && shape(readiness.target, ['environmentKind', 'origin', 'commit', 'deploymentRef', 'isolationRef', 'accessRef'], 'target')) {
      const t = readiness.target
      if (t.environmentKind !== 'staging' || !safeOrigin(t.origin) || !SHA.test(t.commit) || ![t.deploymentRef, t.isolationRef, t.accessRef].every(safeReference)) error('unverified_target_shape', 'target')
    }
    if (readiness.pilotStartedAt !== null && (!Number.isFinite(dateMs(readiness.pilotStartedAt)) || dateMs(readiness.pilotStartedAt) > now)) error('pilot_date', 'readiness')
    if (array(readiness.blockers, BLOCKER_IDS.length, 'blockers')) {
      unique(readiness.blockers.map(b => b?.id), 'blockers')
      if (readiness.blockers.length !== BLOCKER_IDS.length) error('missing_blocker', 'blockers')
      readiness.blockers.forEach((b, i) => {
        const p = 'blockers.' + i
        if (!shape(b, ['id', 'status', 'reference'], p)) return
        if (!BLOCKER_IDS.includes(b.id) || !['pending', 'satisfied'].includes(b.status) || (b.status === 'satisfied' ? !safeReference(b.reference) : b.reference !== null)) error('blocker_reference', p)
      })
    }
  }
  if (envelope(results, 'records', 'results') && array(results.records, 5000, 'records')) {
    const seen = new Set()
    results.records.forEach((r, i) => {
      const p = 'records.' + i
      if (!shape(r, ['caseId', 'variantId', 'runId', 'layer', 'environmentKind', 'origin', 'commit', 'status', 'simulation', 'simulatedBoundaries', 'startedAt', 'finishedAt', 'reasonCode', 'commandId', 'evidence', 'reviewerRole', 'reviewRef'], p)) return
      const policy = known.get(r.caseId)
      const variant = policy?.variants.find(v => v.id === r.variantId)
      if (!variant || typeof r.runId !== 'string' || !ID.test(r.runId)) error('result_identity', p)
      const key = [r.caseId, r.variantId, r.layer, r.runId].join('|'); if (seen.has(key)) error('duplicate_result', p); seen.add(key)
      if (!LAYERS.includes(r.layer) || !ENVIRONMENTS.includes(r.environmentKind) || !STATUSES.includes(r.status) || typeof r.simulation !== 'boolean' || !REASONS.includes(r.reasonCode) || !COMMANDS.includes(r.commandId)) error('result_enum', p)
      if (!LAYER_COMMANDS[r.layer]?.includes(r.commandId)) error('command_layer', p)
      if (!Array.isArray(r.simulatedBoundaries) || r.simulatedBoundaries.some(x => !BOUNDARIES.includes(x)) || new Set(r.simulatedBoundaries).size !== r.simulatedBoundaries.length) error('boundary_enum', p)
      else {
        if (['unit_doubles', 'http_doubles', 'browser_fixtures'].includes(r.layer) && !r.simulatedBoundaries.length) error('hidden_doubles', p)
        if (['staging_api', 'staging_browser', 'human_review', 'followup'].includes(r.layer) && r.simulatedBoundaries.length) error('promoted_doubles', p)
        if (r.layer === 'db_real' && r.simulatedBoundaries.some(x => !['provider', 'clock'].includes(x))) error('not_real_db', p)
      }
      const stageLayer = ['staging_api', 'staging_browser', 'human_review'].includes(r.layer)
      if (r.layer === 'db_real' && !['local', 'ci', 'staging'].includes(r.environmentKind)) error('layer_environment', p)
      if (stageLayer && r.environmentKind !== 'staging' || r.layer === 'followup' && r.environmentKind !== 'followup' ||
        ['unit_doubles', 'http_doubles', 'browser_fixtures'].includes(r.layer) && !['local', 'ci'].includes(r.environmentKind)) error('layer_environment', p)
      const remote = ['staging', 'followup'].includes(r.environmentKind)
      if (remote ? !safeOrigin(r.origin) || r.origin !== readiness?.target?.origin : r.origin !== null) error('result_origin', p)
      if (r.commit !== null && (typeof r.commit !== 'string' || !SHA.test(r.commit))) error('full_sha_required', p)
      if (['passed', 'failed'].includes(r.status)) {
        if (r.commit === null || !Number.isFinite(dateMs(r.startedAt)) || !Number.isFinite(dateMs(r.finishedAt)) || dateMs(r.finishedAt) < dateMs(r.startedAt) || dateMs(r.finishedAt) > now) error('execution_provenance', p)
      } else if ((r.startedAt === null) !== (r.finishedAt === null) || r.startedAt !== null && (!Number.isFinite(dateMs(r.startedAt)) || !Number.isFinite(dateMs(r.finishedAt)) || dateMs(r.finishedAt) < dateMs(r.startedAt) || dateMs(r.finishedAt) > now)) error('execution_provenance', p)
      if (r.status === 'passed' && r.reasonCode !== 'check_passed' || r.status === 'failed' && r.reasonCode !== 'assertion_failed' ||
        ['not_run', 'blocked'].includes(r.status) && ['check_passed', 'assertion_failed'].includes(r.reasonCode)) error('status_reason', p)
      if (r.layer === 'human_review' || r.layer === 'followup') {
        if (!['QA', 'PO', 'tech_lead', 'specialist', 'facilitator'].includes(r.reviewerRole) || !safeReference(r.reviewRef)) error('human_reference', p)
      } else if (r.reviewerRole !== null || r.reviewRef !== null) error('unexpected_human_claim', p)
      if (r.layer === 'followup' && r.status === 'passed') {
        const days = variant?.edge === 'day-7' ? 7 : variant?.edge === 'day-30' ? 30 : NaN
        if (r.caseId !== 'E45-28' || !Number.isFinite(dateMs(readiness?.pilotStartedAt)) || dateMs(r.startedAt) < dateMs(readiness.pilotStartedAt) + days * 86400000) error('followup_not_due', p)
      }
      if (array(r.evidence, 8, p + '.evidence')) {
        if (r.status === 'passed' && !r.evidence.length) error('missing_evidence', p)
        r.evidence.forEach((e, n) => {
          const q = p + '.evidence.' + n
          if (shape(e, ['path', 'sha256', 'mediaType'], q) && (!safeArtifactPath(e.path) || typeof e.sha256 !== 'string' || !HASH.test(e.sha256) || !MEDIA.includes(e.mediaType))) error('evidence_reference', q)
        })
        unique(r.evidence.map(e => e?.path), p + '.evidence')
      }
    })
  }
  return errors
}
