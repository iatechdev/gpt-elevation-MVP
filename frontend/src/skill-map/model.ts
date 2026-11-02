export type LocalizedText = { es?: string; en?: string }
export type AssessmentState = 'initial' | 'reviewed' | 'contradictory' | 'stale'
export type Assessment = {
  level: number | null
  state: AssessmentState
  stale: boolean
  catalogOutdated: boolean
  confidence: 'low' | 'medium' | 'high'
  confidenceReason: LocalizedText
  evidenceCount: number
  authoring: 'person' | 'ai_proposed'
  rationale: string | null
  needsReview: boolean
}
export type Skill = {
  skillKey: string
  type: 'transversal' | 'domain'
  labels: LocalizedText
  rubric: { levels: Record<string, LocalizedText>; source: string; verifiedAt: string }
  self: Assessment | null
  review: Assessment | null
  state: AssessmentState | 'no_evidence'
  /** Ids de territorio (ES-116). Opcional: un servidor anterior no lo envía; sin ninguno válido, la habilidad queda «sin territorio». */
  territories?: string[]
}
export type SkillMap = { catalogVersion: number; skills: Skill[] }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const states = ['initial', 'reviewed', 'contradictory', 'stale']
function localized(value: unknown): value is LocalizedText {
  return object(value) && ['es', 'en'].some(lang => text(value[lang]))
    && ['es', 'en'].every(lang => value[lang] === undefined || text(value[lang]))
}
function assessment(value: unknown): value is Assessment | null {
  return value === null || (object(value)
    && (value.level === null || (typeof value.level === 'number' && Number.isInteger(value.level) && value.level >= 1 && value.level <= 4))
    && typeof value.state === 'string' && states.includes(value.state)
    && typeof value.stale === 'boolean' && typeof value.catalogOutdated === 'boolean'
    && typeof value.confidence === 'string' && ['low', 'medium', 'high'].includes(value.confidence) && localized(value.confidenceReason)
    && typeof value.evidenceCount === 'number' && Number.isSafeInteger(value.evidenceCount) && value.evidenceCount >= 0
    && (value.level === null || value.stale === true || value.state === 'stale' || value.evidenceCount > 0)
    && typeof value.authoring === 'string' && ['person', 'ai_proposed'].includes(value.authoring)
    && (value.rationale === null || typeof value.rationale === 'string') && typeof value.needsReview === 'boolean')
}
function rubric(value: unknown): value is Skill['rubric'] {
  if (!object(value) || !object(value.levels)) return false
  const levels = value.levels
  return ['1', '2', '3', '4'].every(level => localized(levels[level]))
    && text(value.source) && text(value.verifiedAt) && Number.isFinite(Date.parse(value.verifiedAt))
}
/** Validate the actual ES-29 GET DTO. A failed schema is never an empty map. */
export function parseSkillMap(value: unknown): SkillMap {
  if (!object(value) || !Number.isSafeInteger(value.catalogVersion) || Number(value.catalogVersion) < 1 || !Array.isArray(value.skills)) throw new Error('Invalid skill map')
  const keys = new Set<string>()
  for (const skill of value.skills) {
    if (!object(skill) || !text(skill.skillKey) || keys.has(skill.skillKey)
      || typeof skill.type !== 'string' || !['transversal', 'domain'].includes(skill.type) || !localized(skill.labels)
      || !rubric(skill.rubric)
      || !assessment(skill.self) || !assessment(skill.review)
      || typeof skill.state !== 'string' || !['no_evidence', ...states].includes(skill.state)
      || (skill.territories !== undefined && (!Array.isArray(skill.territories) || skill.territories.length > 8
        || skill.territories.some(id => typeof id !== 'string' || id.length === 0 || id.length > 16)))) throw new Error('Invalid skill map')
    keys.add(skill.skillKey)
  }
  return value as SkillMap
}
/** Conservative display rules: never resurrect stale numbers or average tracks. */
export function trackView(track: Assessment | null) {
  const stale = track?.stale === true || track?.state === 'stale'
  const level = stale ? null : track?.level ?? null
  const needsReview = !stale && (track?.needsReview === true || track?.state === 'contradictory')
  return {
    level, stale, needsReview,
    state: stale ? 'stale' : needsReview ? 'contradictory' : level === null ? 'no_evidence' : track?.state ?? 'no_evidence',
    confidence: stale || level === null ? null : track?.confidence ?? null,
  }
}
