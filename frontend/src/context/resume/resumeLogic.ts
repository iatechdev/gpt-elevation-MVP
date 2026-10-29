// ES-109: lógica pura (sin red ni DOM) de la hoja de vida en el contexto. Reglas de la maqueta aprobada:
//  - Lo sugerido NUNCA pisa lo que la persona ya escribió: si el campo tiene valor, la sugerencia queda aparte («Usar» / «Ignorar»).
//  - Cada valor sugerido se marca; si la persona lo edita deja de verse como sugerido; se puede quitar de un gesto.
//  - Lo que el documento no dice queda vacío; nunca se completa por deducción.
import type { Education, DeclaredSkill, Experience, Language, ParticipantContext } from '../participantContext'

export const MAX_EXPERIENCE = 15
export const MAX_EDUCATION = 15
export const MAX_SKILLS = 40
export const MAX_LANGUAGES = 10
export const MIN_YEAR = 1950

export type ScalarKey = 'profession' | 'interests' | 'sector' | 'totalYearsExperience'
export type ListKey = 'experience' | 'education' | 'declaredSkills' | 'languages'
export type Suggestions = Pick<ParticipantContext, ScalarKey | ListKey>
export type Flags = Record<ScalarKey, boolean> & Record<ListKey, boolean[]>
export type Pending = Partial<Record<ScalarKey, string | number>>

const SCALARS: ScalarKey[] = ['profession', 'interests', 'sector', 'totalYearsExperience']
const LISTS: ListKey[] = ['experience', 'education', 'declaredSkills', 'languages']
const FIELD_COUNT = SCALARS.length + LISTS.length

export const emptyFlags = (draft: Pick<ParticipantContext, ListKey>): Flags => ({
  profession: false, interests: false, sector: false, totalYearsExperience: false,
  experience: draft.experience.map(() => false), education: draft.education.map(() => false),
  declaredSkills: draft.declaredSkills.map(() => false), languages: draft.languages.map(() => false),
})
const blank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && !value.trim())
const same = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

const itemKey: { [K in ListKey]: (item: ParticipantContext[K][number]) => string } = {
  experience: (e: Experience) => `${e.role}|${e.startYear ?? ''}|${e.endYear ?? ''}`.toLowerCase().trim(),
  education: (e: Education) => `${e.kind}|${e.title}`.toLowerCase().trim(),
  declaredSkills: (s: DeclaredSkill) => s.name.toLowerCase().trim(),
  languages: (l: Language) => l.name.toLowerCase().trim(),
}
const LIMITS: Record<ListKey, number> = { experience: MAX_EXPERIENCE, education: MAX_EDUCATION, declaredSkills: MAX_SKILLS, languages: MAX_LANGUAGES }

// -> { draft, flags, pending } con las sugerencias fusionadas SIN sobrescribir nada de lo que la persona ya tiene.
export function applySuggestions(draft: ParticipantContext, flags: Flags, suggestions: Suggestions): { draft: ParticipantContext; flags: Flags; pending: Pending } {
  const next: ParticipantContext = { ...draft }
  const nextFlags: Flags = { ...flags, experience: [...flags.experience], education: [...flags.education], declaredSkills: [...flags.declaredSkills], languages: [...flags.languages] }
  const pending: Pending = {}
  for (const key of SCALARS) {
    const value = suggestions[key]
    if (blank(value)) continue
    if (blank(next[key])) { (next as Record<ScalarKey, unknown>)[key] = value; nextFlags[key] = true } else if (!same(next[key], value)) pending[key] = value as string | number
  }
  for (const key of LISTS) {
    const incoming = suggestions[key] as unknown[]
    const current = [...(next[key] as unknown[])]
    const known = new Set(current.map(item => (itemKey[key] as (i: unknown) => string)(item)))
    for (const item of incoming) {
      if (current.length >= LIMITS[key]) break
      const id = (itemKey[key] as (i: unknown) => string)(item)
      if (known.has(id)) continue
      known.add(id); current.push(item); nextFlags[key].push(true)
    }
    ;(next as Record<ListKey, unknown>)[key] = current
  }
  return { draft: next, flags: nextFlags, pending }
}

// «9 de 8 campos»: cuántos de los 8 campos tienen algo sugerido y cuántos no (la lista cuenta como un campo).
export function summarize(suggestions: Suggestions): { found: number; empty: number; total: number } {
  const found = SCALARS.filter(key => !blank(suggestions[key])).length + LISTS.filter(key => (suggestions[key] as unknown[]).length > 0).length
  return { found, empty: FIELD_COUNT - found, total: FIELD_COUNT }
}

// «Quitar todas las sugerencias»: vacía lo marcado como sugerido y deja intacto lo que la persona escribió o editó.
export function removeAllSuggested(draft: ParticipantContext, flags: Flags): { draft: ParticipantContext; flags: Flags } {
  const next: ParticipantContext = { ...draft }
  for (const key of SCALARS) if (flags[key]) (next as Record<ScalarKey, unknown>)[key] = null
  for (const key of LISTS) (next as Record<ListKey, unknown>)[key] = (draft[key] as unknown[]).filter((_, i) => !flags[key][i])
  return { draft: next, flags: emptyFlags(next) }
}
export const countSuggested = (flags: Flags) => SCALARS.filter(key => flags[key]).length + LISTS.reduce((total, key) => total + flags[key].filter(Boolean).length, 0)

export function removeAt<K extends ListKey>(draft: ParticipantContext, flags: Flags, key: K, index: number): { draft: ParticipantContext; flags: Flags } {
  const list = (draft[key] as unknown[]).filter((_, i) => i !== index)
  return { draft: { ...draft, [key]: list } as ParticipantContext, flags: { ...flags, [key]: flags[key].filter((_, i) => i !== index) } }
}
export function insertAt<K extends ListKey>(draft: ParticipantContext, flags: Flags, key: K, index: number, item: unknown, suggested: boolean): { draft: ParticipantContext; flags: Flags } {
  const list = [...(draft[key] as unknown[])]; list.splice(index, 0, item)
  const marks = [...flags[key]]; marks.splice(index, 0, suggested)
  return { draft: { ...draft, [key]: list } as ParticipantContext, flags: { ...flags, [key]: marks } }
}

// ── «Años»: «2021–2026», «2021-actual», «2021» ⇄ startYear/endYear/isCurrent ─────────────────────────────────────────────────────────
const CURRENT = /^(?:actual|actualidad|presente|hoy|current|present|now|ongoing)$/i
export const currentYear = () => new Date().getFullYear()
const yearOf = (text: string): number | null => (/^\d{4}$/.test(text) && Number(text) >= MIN_YEAR && Number(text) <= currentYear() ? Number(text) : null)
export type Period = Pick<Experience, 'startYear' | 'endYear' | 'isCurrent'>
export function parsePeriod(raw: string): Period | null {
  const text = raw.trim()
  if (!text) return { startYear: null, endYear: null, isCurrent: false }
  const parts = text.split(/\s*(?:[-‐-―]|\ba\b|\bto\b|\bhasta\b)\s*/i).map(part => part.trim()).filter(Boolean)
  if (parts.length < 1 || parts.length > 2) return null
  const start = yearOf(parts[0]); if (start === null) return null
  if (parts.length === 1) return { startYear: start, endYear: null, isCurrent: false }
  if (CURRENT.test(parts[1])) return { startYear: start, endYear: null, isCurrent: true }
  const end = yearOf(parts[1]); if (end === null || end < start) return null
  return { startYear: start, endYear: end, isCurrent: false }
}
export function formatPeriod(period: Period, currentWord = 'actual'): string {
  if (period.startYear === null && period.endYear === null) return period.isCurrent ? currentWord : ''
  if (period.isCurrent) return `${period.startYear ?? ''}–${currentWord}`
  if (period.endYear === null) return String(period.startYear ?? '')
  return `${period.startYear ?? ''}–${period.endYear}`
}

// ── Limpieza antes de guardar: quita filas totalmente vacías y señala las incompletas (mismo contrato que el servidor) ──────────────
export type ExtrasKey = ListKey | 'sector' | 'totalYearsExperience'
const text = (value: string | null | undefined) => (value ?? '').trim()
const orNull = (value: string | null | undefined) => text(value) || null
export function cleanExtras(draft: ParticipantContext): { draft: ParticipantContext; flagsKeep: Record<ListKey, number[]>; errors: ExtrasKey[] } {
  const errors = new Set<ExtrasKey>()
  const keep: Record<ListKey, number[]> = { experience: [], education: [], declaredSkills: [], languages: [] }
  const out: ParticipantContext = { ...draft }
  out.experience = []
  draft.experience.forEach((row, i) => {
    const role = text(row.role)
    if (!role && !text(row.organization) && row.startYear === null && row.endYear === null && !row.isCurrent) return
    if (!role || role.length > 120 || text(row.organization).length > 120) errors.add('experience')
    keep.experience.push(i); out.experience.push({ ...row, role, organization: orNull(row.organization) })
  })
  out.education = []
  draft.education.forEach((row, i) => {
    const title = text(row.title)
    if (!title && !text(row.institution) && row.year === null) return
    if (!title || title.length > 160 || text(row.institution).length > 120 || (row.year !== null && (!Number.isInteger(row.year) || row.year < MIN_YEAR || row.year > currentYear()))) errors.add('education')
    keep.education.push(i); out.education.push({ ...row, title, institution: orNull(row.institution) })
  })
  out.declaredSkills = []
  const seen = new Set<string>()
  draft.declaredSkills.forEach((row, i) => {
    const name = text(row.name)
    if (!name) return
    if (name.length > 60 || seen.has(name.toLowerCase())) errors.add('declaredSkills')
    seen.add(name.toLowerCase()); keep.declaredSkills.push(i); out.declaredSkills.push({ ...row, name, support: orNull(row.support) })
  })
  out.languages = []
  draft.languages.forEach((row, i) => {
    const name = text(row.name)
    if (!name && !text(row.level)) return
    if (!name || name.length > 40 || text(row.level).length > 40) errors.add('languages')
    keep.languages.push(i); out.languages.push({ name, level: orNull(row.level) })
  })
  if (out.experience.length > MAX_EXPERIENCE) errors.add('experience')
  if (out.education.length > MAX_EDUCATION) errors.add('education')
  if (out.declaredSkills.length > MAX_SKILLS) errors.add('declaredSkills')
  if (out.languages.length > MAX_LANGUAGES) errors.add('languages')
  out.sector = orNull(draft.sector)
  if (out.sector && out.sector.length > 80) errors.add('sector')
  const years = draft.totalYearsExperience
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) errors.add('totalYearsExperience')
  return { draft: out, flagsKeep: keep, errors: [...errors] }
}
