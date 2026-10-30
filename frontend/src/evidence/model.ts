export type Claim = { text: string; source: 'self_report' | 'artifact_examined' | 'exercise_observed' }
export type Artifact = { kind: 'url'; url: string; note?: string } | { kind: 'text'; excerpt: string }
export type Payload = {
  title: string; situation?: string; responsibility?: Claim; actions?: Claim[]; alternatives?: string[]
  goal?: string; delivered?: Claim; observedEffect?: { known: false } | { known: true; claim: Claim }
  learning?: string; autonomy?: 'conceptual' | 'assisted' | 'autonomous' | 'leads' | null; artifactRefs?: Artifact[]
}
export type Status = 'draft' | 'confirmed' | 'revoked'
// ES-110: si la evidencia salió de una hoja de vida se informa de dónde (versión y fecha) y si esa versión ya no existe («para revisión»).
// `fromChat` solo dice que viene del chat (sin ids ni citas): esas no se editan desde aquí porque la edición perdería su origen.
export type Origin = { kind: 'resume'; version: number; date: string; needsReview: boolean }
export type Evidence = { id: number; version: number; status: Status; authoring: 'person' | 'ai_proposed'; createdAt: string; payload: Payload; origin?: Origin; fromChat?: boolean }
export type Detail = { id: number; currentVersion: number; versions: Evidence[] }
export type Draft = {
  title: string; situation: string; responsibility: string; actions: string[]; alternatives: string[]
  goal: string; delivered: string; effect: 'unset' | 'known' | 'unknown'; effectText: string; learning: string
  autonomy: '' | 'conceptual' | 'assisted' | 'autonomous' | 'leads'
  artifacts: { kind: 'url' | 'text'; value: string; note: string }[]
}
export const blankDraft = (): Draft => ({ title: '', situation: '', responsibility: '', actions: [''], alternatives: [],
  goal: '', delivered: '', effect: 'unset', effectText: '', learning: '', autonomy: '', artifacts: [] })
const claim = (text: string): Claim => ({ text: text.trim(), source: 'self_report' })
export function draftPayload(draft: Draft, status: 'draft' | 'confirmed'): { payload: Payload; errors: string[] } {
  const errors: string[] = []
  const payload: Payload = { title: draft.title.trim() }
  if (!payload.title || payload.title.length > 120) errors.push('title')
  for (const [key, max] of [['situation', 1000], ['goal', 500], ['learning', 1000]] as const) {
    const value = draft[key].trim()
    if (value.length > max) errors.push(key)
    if (value) payload[key] = value
  }
  for (const key of ['responsibility', 'delivered'] as const) {
    if (draft[key].trim().length > 1000) errors.push(key)
    if (draft[key].trim()) payload[key] = claim(draft[key])
  }
  if (draft.actions.length > 8 || draft.actions.some(value => value.trim().length > 1000)) errors.push('actions')
  if (draft.actions.some(value => value.trim())) payload.actions = draft.actions.filter(value => value.trim()).map(claim)
  if (draft.alternatives.length > 5 || draft.alternatives.some(value => value.trim().length > 500)) errors.push('alternatives')
  if (draft.alternatives.some(value => value.trim())) payload.alternatives = draft.alternatives.filter(value => value.trim()).map(value => value.trim())
  if (draft.effect === 'unknown') payload.observedEffect = { known: false }
  if (draft.effect === 'known') {
    if (!draft.effectText.trim() || draft.effectText.trim().length > 1000) errors.push('observedEffect')
    else payload.observedEffect = { known: true, claim: claim(draft.effectText) }
  }
  if (draft.autonomy) payload.autonomy = draft.autonomy
  if (draft.artifacts.length > 5) errors.push('artifactRefs')
  const refs: Artifact[] = []
  for (const ref of draft.artifacts) {
    const value = ref.value.trim(); const note = ref.note.trim()
    if (!value && !note) continue
    if (ref.kind === 'text') {
      if (!value || value.length > 1000) errors.push('artifactRefs')
      else refs.push({ kind: 'text', excerpt: value })
    } else {
      try {
        const url = new URL(value)
        if (!value || value.length > 500 || note.length > 300 || url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw new Error('invalid')
        refs.push({ kind: 'url', url: value, ...(note ? { note } : {}) })
      } catch { errors.push('artifactRefs') }
    }
  }
  if (refs.length) payload.artifactRefs = refs
  if (status === 'draft' && Object.keys(payload).length < 2) errors.push('draft_minimum')
  if (status === 'confirmed') for (const key of ['situation', 'responsibility', 'actions', 'delivered', 'observedEffect'] as const) if (payload[key] === undefined) errors.push(key)
  return { payload, errors: [...new Set(errors)] }
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const isClaim = (v: unknown): v is Claim => object(v) && text(v.text, 1000) && typeof v.source === 'string' && ['self_report', 'artifact_examined', 'exercise_observed'].includes(v.source)
function isPayload(v: unknown): v is Payload {
  if (!object(v) || !text(v.title, 120)) return false
  for (const [key, max] of [['situation', 1000], ['goal', 500], ['learning', 1000]] as const) if (v[key] !== undefined && !text(v[key], max)) return false
  for (const key of ['responsibility', 'delivered']) if (v[key] !== undefined && !isClaim(v[key])) return false
  if (v.actions !== undefined && (!Array.isArray(v.actions) || v.actions.length < 1 || v.actions.length > 8 || !v.actions.every(isClaim))) return false
  if (v.alternatives !== undefined && (!Array.isArray(v.alternatives) || v.alternatives.length > 5 || !v.alternatives.every(item => text(item, 500)))) return false
  if (v.observedEffect !== undefined && (!object(v.observedEffect) || typeof v.observedEffect.known !== 'boolean' || (v.observedEffect.known && !isClaim(v.observedEffect.claim)))) return false
  if (v.autonomy !== undefined && v.autonomy !== null && (typeof v.autonomy !== 'string' || !['conceptual', 'assisted', 'autonomous', 'leads'].includes(v.autonomy))) return false
  if (v.artifactRefs !== undefined && (!Array.isArray(v.artifactRefs) || v.artifactRefs.length > 5 || !v.artifactRefs.every(ref => object(ref) && (
    ref.kind === 'text' ? text(ref.excerpt, 1000) : ref.kind === 'url' && text(ref.url, 500) && (ref.note === undefined || text(ref.note, 300))
  )))) return false
  return true
}
const isOrigin = (v: unknown): v is Origin => object(v) && v.kind === 'resume' && positive(v.version) && typeof v.date === 'string' && Number.isFinite(Date.parse(v.date)) && typeof v.needsReview === 'boolean'
export function parseEvidence(value: unknown): Evidence {
  if (!object(value) || !positive(value.id) || !positive(value.version)
    || !['draft', 'confirmed', 'revoked'].includes(String(value.status)) || typeof value.status !== 'string'
    || !['person', 'ai_proposed'].includes(String(value.authoring)) || typeof value.authoring !== 'string'
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !isPayload(value.payload)
    || (value.origin !== undefined && !isOrigin(value.origin)) || (value.fromChat !== undefined && value.fromChat !== true)) throw new Error('Invalid evidence')
  return value as Evidence
}
export function parseList(value: unknown): Evidence[] {
  if (!object(value) || !Array.isArray(value.evidence)) throw new Error('Invalid evidence list')
  const rows = value.evidence.map(parseEvidence)
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid evidence list')
  return rows
}
export function parseDetail(value: unknown): Detail {
  if (!object(value) || !positive(value.id) || !positive(value.currentVersion) || !Array.isArray(value.versions) || !value.versions.length) throw new Error('Invalid detail')
  const rows = value.versions.map(parseEvidence)
  if (rows.some(row => row.id !== value.id || row.version > Number(value.currentVersion)) || !rows.some(row => row.version === value.currentVersion)
    || new Set(rows.map(row => row.version)).size !== rows.length) throw new Error('Invalid detail')
  return { id: value.id, currentVersion: value.currentVersion, versions: rows.sort((a, b) => b.version - a.version) }
}
export function parseAck(value: unknown): { id: number; version: number } {
  if (!object(value) || !positive(value.id) || !positive(value.version)) throw new Error('Invalid save result')
  return { id: value.id, version: value.version }
}

// ES-110: lleva una versión guardada de vuelta al formulario para editarla (cada edición crea una versión nueva).
export function draftFromPayload(payload: Payload): Draft {
  return {
    title: payload.title, situation: payload.situation ?? '', responsibility: payload.responsibility?.text ?? '', actions: payload.actions?.length ? payload.actions.map(item => item.text) : [''],
    alternatives: payload.alternatives ?? [], goal: payload.goal ?? '', delivered: payload.delivered?.text ?? '',
    effect: payload.observedEffect ? (payload.observedEffect.known ? 'known' : 'unknown') : 'unset', effectText: payload.observedEffect?.known ? payload.observedEffect.claim.text : '',
    learning: payload.learning ?? '', autonomy: payload.autonomy ?? '',
    artifacts: (payload.artifactRefs ?? []).map(ref => ref.kind === 'url' ? { kind: 'url' as const, value: ref.url, note: ref.note ?? '' } : { kind: 'text' as const, value: ref.excerpt, note: '' }),
  }
}
