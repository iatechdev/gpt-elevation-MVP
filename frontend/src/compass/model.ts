export const fieldKeys = ['motivations', 'values', 'interests', 'energy_gives', 'energy_drains', 'desired_conditions', 'constraints'] as const
export type FieldKey = typeof fieldKeys[number]
// ES-121: un texto puede venir de un insight con origen privado (solo `id`, nunca el contenido) y de una habilidad; el titular los recibe de vuelta en GET y se reenvían tal cual.
export type Origin = { type: 'direct' } | { type: 'chat_turn' | 'diary_entry' | 'resume_version'; id: number }
export type Field = { key: FieldKey; text: string; origin?: Origin; skillKey?: string }
export type DirectField = Field & { origin: Origin }
export type DraftField = { id: string; key: FieldKey | ''; text: string; selected: boolean }
export type ContextVersion = { version: number; status: 'active' | 'superseded' | 'revoked'; approvedAt: string; revokedAt: string | null; fields: Field[]; needsReview?: boolean }
export type CareerContext = { active: ContextVersion | null; versions: ContextVersion[] }
export type Preview = { token: string; expiresAt: string; representation: Field[] }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))
const originTypes = ['chat_turn', 'diary_entry', 'resume_version']
function parseOrigin(value: unknown): Origin | undefined {
  // Lo que no es un origen reconocible se ignora (como cualquier dato extra del servidor): el texto sigue siendo válido.
  if (!object(value)) return undefined
  if (value.type === 'direct' && Object.keys(value).length === 1) return { type: 'direct' }
  if (typeof value.type === 'string' && originTypes.includes(value.type) && Number.isSafeInteger(value.id) && Number(value.id) > 0 && Object.keys(value).length === 2) return { type: value.type as 'chat_turn', id: Number(value.id) }
  return undefined
}
export function parseFields(value: unknown): Field[] {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error('Invalid fields')
  const counts = new Map<string, number>()
  return value.map(item => {
    if (!object(item) || typeof item.key !== 'string' || !fieldKeys.includes(item.key as FieldKey) || !nonempty(item.text) || item.text.length > 500) throw new Error('Invalid field')
    counts.set(item.key, (counts.get(item.key) ?? 0) + 1)
    if (counts.get(item.key)! > 3) throw new Error('Invalid field count')
    const origin = parseOrigin(item.origin)
    const skillKey = typeof item.skillKey === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(item.skillKey) ? item.skillKey : undefined
    return { key: item.key as FieldKey, text: item.text, ...(origin ? { origin } : {}), ...(skillKey ? { skillKey } : {}) }
  })
}
export function parseVersion(value: unknown): ContextVersion {
  if (!object(value) || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || typeof value.status !== 'string'
    || !['active', 'superseded', 'revoked'].includes(value.status) || !date(value.approvedAt)
    || (value.revokedAt !== null && !date(value.revokedAt)) || (value.needsReview !== undefined && typeof value.needsReview !== 'boolean')) throw new Error('Invalid version')
  return { version: Number(value.version), status: value.status as ContextVersion['status'], approvedAt: value.approvedAt,
    revokedAt: value.revokedAt as string | null, fields: parseFields(value.fields), ...(value.needsReview !== undefined ? { needsReview: value.needsReview as boolean } : {}) }
}
export function parseContext(value: unknown): CareerContext {
  if (!object(value) || !Array.isArray(value.versions) || (value.active !== null && !object(value.active))) throw new Error('Invalid context')
  const versions = value.versions.map(parseVersion).sort((a, b) => b.version - a.version)
  if (new Set(versions.map(row => row.version)).size !== versions.length) throw new Error('Invalid history')
  const active = value.active === null ? null : parseVersion(value.active)
  const current = versions.filter(row => row.status === 'active')
  if (active ? active.status !== 'active' || typeof active.needsReview !== 'boolean' || current.length !== 1 || JSON.stringify(active) !== JSON.stringify(current[0]) : current.length !== 0) throw new Error('Invalid active context')
  return { active, versions }
}
export function parsePreview(value: unknown): Preview {
  if (!object(value) || !nonempty(value.token) || !date(value.expiresAt)) throw new Error('Invalid preview')
  return { token: value.token, expiresAt: value.expiresAt, representation: parseFields(value.representation) }
}
export function selectedFields(rows: DraftField[]): { fields: DirectField[]; errors: string[] } {
  const fields: DirectField[] = []; const errors: string[] = []; const counts = new Map<string, number>()
  for (const row of rows.filter(row => row.selected)) {
    if (!fieldKeys.includes(row.key as FieldKey) || !row.text.trim() || row.text.length > 500) { errors.push(row.id); continue }
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1)
    if (counts.get(row.key)! > 3) errors.push(row.id)
    fields.push({ key: row.key as FieldKey, text: row.text, origin: { type: 'direct' } })
  }
  if (!fields.length || fields.length > 12) errors.push('selection')
  return { fields, errors: [...new Set(errors)] }
}
