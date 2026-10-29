export type Answer = 'yes' | 'no' | 'unsure' | null
export type Category = 'ideas' | 'experience' | 'next_step' | 'other'
export type Answers = { initialValue: Answer; valueArea: 'personal' | 'career' | 'both' | null; listened: Answer; respected: Answer; professionalClarity: Answer | 'not_explored'; helpedBy: Category[] }
export type Feedback = { synthetic: true; version: number; questionnaireVersion: 1; window: 'day7' | 'day30'; permission: 'fixture_only' | 'not_configured'; answers: Answers | null; lastRequestId: string | null }
export type Intent = Readonly<{ requestId: string; baseVersion: number; questionnaireVersion: 1; answers: Answers }>
export type Metric = { key: 'activation' | 'experiment' | 'listening' | 'utility'; status: 'not_configured' | 'not_available' | 'in_progress' | 'suppressed' | 'ready'; counts?: { eligible: number; responded: number; missing: number; positive: number } }
export type Metrics = { synthetic: true; metrics: Metric[] }
export function previewEnabled(value: unknown) { return value === 'true' }
export function emptyAnswers(): Answers { return { initialValue: null, valueArea: null, listened: null, respected: null, professionalClarity: null, helpedBy: [] } }
const categories = ['ideas', 'experience', 'next_step', 'other']
export function validAnswers(v: unknown): v is Answers {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const a = v as Record<string, unknown>
  if (Object.keys(a).sort().join() !== Object.keys(emptyAnswers()).sort().join()) return false
  return ['initialValue', 'listened', 'respected'].every(k => [null, 'yes', 'no', 'unsure'].includes(a[k] as string | null)) && [null, 'yes', 'no', 'unsure', 'not_explored'].includes(a.professionalClarity as string | null) && [null, 'personal', 'career', 'both'].includes(a.valueArea as string | null) && (a.initialValue === 'yes' || a.valueArea === null) && Array.isArray(a.helpedBy) && a.helpedBy.every(v => categories.includes(v)) && new Set(a.helpedBy).size === a.helpedBy.length && a.helpedBy.length <= 4
}
export function hasAnswers(a: Answers) { return a.initialValue !== null || a.listened !== null || a.respected !== null || a.professionalClarity !== null || a.helpedBy.length > 0 }
export function makeIntent(a: Answers, version: number, requestId = crypto.randomUUID()): Intent {
  if (!validAnswers(a) || !hasAnswers(a) || !Number.isSafeInteger(version) || version < 0 || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw new Error('invalid')
  const copy = structuredClone(a); Object.freeze(copy.helpedBy); Object.freeze(copy)
  return Object.freeze({ requestId, baseVersion: version, questionnaireVersion: 1, answers: copy })
}
export function parseMetrics(value: unknown): Metrics {
  if (!value || typeof value !== 'object') throw new Error('invalid_metrics')
  const dto = value as Metrics
  const keys = ['activation', 'experiment', 'listening', 'utility']
  if (dto.synthetic !== true || Object.keys(dto).sort().join() !== 'metrics,synthetic' || !Array.isArray(dto.metrics) || dto.metrics.length !== 4 || new Set(dto.metrics.map(m => m.key)).size !== 4) throw new Error('invalid_metrics')
  for (const m of dto.metrics) {
    if (!keys.includes(m.key) || !['not_configured', 'not_available', 'in_progress', 'suppressed', 'ready'].includes(m.status) || Object.keys(m).some(k => !['key', 'status', 'counts'].includes(k))) throw new Error('invalid_metrics')
    if (m.status !== 'ready') { if (Object.hasOwn(m, 'counts')) throw new Error('hidden_counts'); continue }
    const c = m.counts
    if (!c || Object.keys(c).sort().join() !== 'eligible,missing,positive,responded' || Object.values(c).some(n => !Number.isSafeInteger(n) || n < 0) || c.eligible < 5 || c.responded + c.missing !== c.eligible || c.positive > c.responded) throw new Error('invalid_counts')
  }
  return structuredClone(dto)
}
