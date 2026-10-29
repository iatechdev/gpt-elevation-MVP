import type { Pair, SkillBody, SkillRow } from './api'

export const KEY_RE = /^[a-z][a-z0-9_]{2,47}$/
/** QA H-88-02: `new` está reservada: la ruta /skills/new es el alta. */
export const RESERVED_KEYS: readonly string[] = ['new']
export const isValidKey = (key: string) => KEY_RE.test(key) && !RESERVED_KEYS.includes(key)
export const LEVELS = ['1', '2', '3', '4'] as const
export type Level = typeof LEVELS[number]
export type Form = {
  type: 'transversal' | 'domain'; labelEs: string; labelEn: string
  levels: Record<Level, { es: string; en: string }>
  source: string; verifiedBy: string; verifiedAt: string; territories: string[]
}
export const emptyForm = (): Form => ({
  type: 'transversal', labelEs: '', labelEn: '', levels: { 1: { es: '', en: '' }, 2: { es: '', en: '' }, 3: { es: '', en: '' }, 4: { es: '', en: '' } },
  source: '', verifiedBy: '', verifiedAt: '', territories: [],
})
export function fromSkill(row: SkillRow): Form {
  const level = (n: Level) => ({ es: row.rubric.levels[n]?.es ?? '', en: row.rubric.levels[n]?.en ?? '' })
  return {
    type: row.type, labelEs: row.labels.es ?? '', labelEn: row.labels.en ?? '', levels: { 1: level('1'), 2: level('2'), 3: level('3'), 4: level('4') },
    source: row.rubric.source ?? '', verifiedBy: row.rubric.verifiedBy ?? '', verifiedAt: row.rubric.verifiedAt ?? '', territories: [...row.territories],
  }
}
/** El servidor exige texto no vacío: lo vacío se omite (un borrador admite contenido incompleto; publicar exige completarlo). */
export function toBody(form: Form): SkillBody {
  const pick = (value: string) => value.trim()
  const pair = (es: string, en: string): Pair => ({ ...(pick(es) ? { es: pick(es) } : {}), ...(pick(en) ? { en: pick(en) } : {}) })
  const levels: Record<string, Pair> = {}
  for (const n of LEVELS) { const p = pair(form.levels[n].es, form.levels[n].en); if (p.es || p.en) levels[n] = p }
  return {
    type: form.type, labels: pair(form.labelEs, form.labelEn),
    rubric: { levels, ...(pick(form.source) ? { source: pick(form.source) } : {}), ...(pick(form.verifiedBy) ? { verifiedBy: pick(form.verifiedBy) } : {}), ...(form.verifiedAt ? { verifiedAt: form.verifiedAt } : {}) },
    territories: [...new Set(form.territories)],
  }
}
export const canonical = (form: Form) => JSON.stringify(toBody({ ...form, territories: [...form.territories].sort() }))
export const isDirty = (a: Form, b: Form) => canonical(a) !== canonical(b)

export type FieldError = 'key' | 'label_es' | 'label_en' | 'level' | 'source' | 'verified_by' | 'verified_at'
const today = () => new Date().toISOString().slice(0, 10)
/** Las mismas reglas de tamaño y fecha que el servidor, para avisar en línea antes de enviar. */
export function validate(form: Form, key: string, creating: boolean, now = today()): Partial<Record<FieldError, true>> {
  const e: Partial<Record<FieldError, true>> = {}
  if (creating && !isValidKey(key)) e.key = true
  if (form.labelEs.trim().length > 80) e.label_es = true
  if (form.labelEn.trim().length > 80) e.label_en = true
  if (LEVELS.some(n => form.levels[n].es.trim().length > 300 || form.levels[n].en.trim().length > 300)) e.level = true
  if (form.source.trim().length > 200) e.source = true
  if (form.verifiedBy.trim().length > 200) e.verified_by = true
  if (form.verifiedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(form.verifiedAt) || Number.isNaN(Date.parse(form.verifiedAt)) || form.verifiedAt > now)) e.verified_at = true
  return e
}
/** Traduce una ruta de «falta» del servidor ('labels.es', 'rubric.levels.2.en', 'rubric.source'…) a una clave de texto y sus parámetros. */
export function missingLabel(path: string): { key: string; level?: string; lang?: string } {
  const m = /^rubric\.levels\.([1-4])\.(es|en)$/.exec(path); if (m) return { key: 'missing_level', level: m[1], lang: m[2].toUpperCase() }
  const l = /^labels\.(es|en)$/.exec(path); if (l) return { key: 'missing_label', lang: l[1].toUpperCase() }
  if (path === 'rubric.source') return { key: 'missing_source' }
  if (path === 'rubric.verifiedBy') return { key: 'missing_verified_by' }
  if (path === 'rubric.verifiedAt') return { key: 'missing_verified_at' }
  return { key: 'missing_other' }
}
