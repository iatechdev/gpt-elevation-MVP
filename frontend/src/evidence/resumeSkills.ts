// ES-110: habilidades declaradas en la hoja de vida → «Mis evidencias». Solo la persona elige cuáles pasan; por defecto ninguna.
// Una habilidad declarada es lo que dice el documento, NO evidencia verificada: nunca trae nivel.
export type Declared = {
  name: string; support: string | null
  classified: { skillKey: string; labels: { es: string | null; en: string | null } } | null
  resume: { id: number; version: number; createdAt: string }
  added: boolean
}
export type PromoteResult = { created: { id: number; name: string; skillKey: string; replayed: boolean }[]; skipped: { name: string; reason: string }[] }
export class SkillsError extends Error {
  readonly status: number
  constructor(status: number) { super('Resume skills request failed'); this.status = status }
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const label = (v: unknown) => v === null || typeof v === 'string'

export function parseDeclared(value: unknown): Declared[] {
  if (!object(value) || !Array.isArray(value.skills)) throw new Error('Invalid skills list')
  return value.skills.map(item => {
    if (!object(item) || typeof item.name !== 'string' || !item.name.trim() || !(item.support === null || typeof item.support === 'string') || typeof item.added !== 'boolean'
      || !object(item.resume) || !positive(item.resume.id) || !positive(item.resume.version) || typeof item.resume.createdAt !== 'string' || !Number.isFinite(Date.parse(item.resume.createdAt))) throw new Error('Invalid skill')
    const c = item.classified
    if (c !== null && !(object(c) && typeof c.skillKey === 'string' && c.skillKey && object(c.labels) && label(c.labels.es) && label(c.labels.en))) throw new Error('Invalid classification')
    return item as unknown as Declared
  })
}
export function parsePromote(value: unknown): PromoteResult {
  if (!object(value) || !Array.isArray(value.created) || !Array.isArray(value.skipped)) throw new Error('Invalid result')
  for (const item of value.created) if (!object(item) || !positive(item.id) || typeof item.name !== 'string') throw new Error('Invalid created')
  return value as unknown as PromoteResult
}

// Se puede añadir si está en el catálogo vigente, tiene el texto que la respalda y aún no está en «Mis evidencias».
export const selectable = (skill: Declared) => skill.classified !== null && skill.support !== null && !skill.added
export type Why = 'unclassified' | 'no_support' | 'added' | null
export const whyNot = (skill: Declared): Why => skill.added ? 'added' : skill.classified === null ? 'unclassified' : skill.support === null ? 'no_support' : null

export function resumeSkillsApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  const call = async (path: string, init: RequestInit = {}) => {
    if (!token) throw new SkillsError(401)
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/user/resume-skills${path}`, { cache: 'no-store', ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
    const value: unknown = await response.json().catch(() => null)
    if (!response.ok) throw new SkillsError(response.status)
    return value
  }
  return {
    list: async (signal?: AbortSignal) => parseDeclared(await call('', { signal })),
    promote: async (names: string[], requestId: string) => parsePromote(await call('/promote', { method: 'POST', body: JSON.stringify({ requestId, names }) })),
  }
}

export const formatDate = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', year: 'numeric' })
