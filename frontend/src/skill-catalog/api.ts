export type CatalogStatus = 'draft' | 'published' | 'archived'
export type Pair = { es?: string; en?: string }
export type Descriptor = { id: number; version: number; status: CatalogStatus; publishedAt: string | null; skillCount: number }
export type SkillRow = {
  skillKey: string; type: 'transversal' | 'domain'; labels: Pair
  rubric: { levels: Record<string, Pair>; source?: string; verifiedBy?: string; verifiedAt?: string }
  territories: string[]; missing: string[]
}
export type Detail = Descriptor & { skills: SkillRow[] }
/** Cuerpo del PUT de una habilidad (el servidor valida y rechaza lo desconocido). */
export type SkillBody = { type: 'transversal' | 'domain'; labels: Pair; rubric: { levels: Record<string, Pair>; source?: string; verifiedBy?: string; verifiedAt?: string }; territories: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' ? v : '')
export class SkillCatalogError extends Error {
  readonly status: number; readonly code: string; readonly missing: Record<string, string[]>; readonly draftId?: number
  constructor(status: number, value: unknown) {
    super('Skill catalog request failed')
    const body = isObject(value) ? value : {}
    this.status = status; this.code = text(body.code)
    this.missing = isObject(body.missing) ? Object.fromEntries(Object.entries(body.missing).map(([k, v]) => [k, Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []])) : {}
    this.draftId = Number.isSafeInteger(body.draftId) ? Number(body.draftId) : undefined
  }
}
function descriptor(value: unknown): Descriptor {
  if (!isObject(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1 || !Number.isSafeInteger(value.version) || Number(value.version) < 1
    || !['draft', 'published', 'archived'].includes(text(value.status)) || !Number.isSafeInteger(value.skillCount) || Number(value.skillCount) < 0
    || (value.publishedAt !== null && value.publishedAt !== undefined && !Number.isFinite(Date.parse(text(value.publishedAt))))) throw new Error('Invalid catalog version')
  return { id: Number(value.id), version: Number(value.version), status: value.status as CatalogStatus, publishedAt: value.publishedAt ? text(value.publishedAt) : null, skillCount: Number(value.skillCount) }
}
const pair = (v: unknown): Pair => (isObject(v) ? { ...(typeof v.es === 'string' ? { es: v.es } : {}), ...(typeof v.en === 'string' ? { en: v.en } : {}) } : {})
export function skillRow(value: unknown): SkillRow {
  if (!isObject(value) || !/^[a-z][a-z0-9_]{2,47}$/.test(text(value.skillKey)) || !['transversal', 'domain'].includes(text(value.type))) throw new Error('Invalid skill')
  const rubric = isObject(value.rubric) ? value.rubric : {}
  const levels = isObject(rubric.levels) ? rubric.levels : {}
  return {
    skillKey: text(value.skillKey), type: value.type as SkillRow['type'], labels: pair(value.labels),
    rubric: { levels: Object.fromEntries(['1', '2', '3', '4'].map(n => [n, pair(levels[n])])), ...(typeof rubric.source === 'string' ? { source: rubric.source } : {}), ...(typeof rubric.verifiedBy === 'string' ? { verifiedBy: rubric.verifiedBy } : {}), ...(typeof rubric.verifiedAt === 'string' ? { verifiedAt: rubric.verifiedAt } : {}) },
    territories: Array.isArray(value.territories) ? value.territories.filter((x): x is string => typeof x === 'string') : [],
    missing: Array.isArray(value.missing) ? value.missing.filter((x): x is string => typeof x === 'string') : [],
  }
}
export function detail(value: unknown): Detail {
  const d = descriptor(value)
  if (!isObject(value) || !Array.isArray(value.skills)) throw new Error('Invalid catalog detail')
  return { ...d, skills: value.skills.map(skillRow) }
}
/** Cliente del backoffice (/api/admin/skill-catalog). Solo el token propio; nunca se manda un id de persona. */
export function skillCatalogApi(base: string, token: string, fetcher: typeof fetch = fetch) {
  const root = `${base.replace(/\/$/, '')}/api/admin/skill-catalog`
  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    if (!token) throw new SkillCatalogError(401, null)
    const res = await fetcher(`${root}${path}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) throw new SkillCatalogError(res.status, data)
    return data
  }
  const key = (skillKey: string) => { if (!/^[a-z][a-z0-9_]{2,47}$/.test(skillKey)) throw new Error('Invalid key'); return encodeURIComponent(skillKey) }
  return {
    list: async () => { const data = await request(''); if (!isObject(data) || !Array.isArray(data.catalogs)) throw new Error('Invalid catalog list'); return data.catalogs.map(descriptor) },
    get: async (id: number) => detail(await request(`/${id}`)),
    create: async () => descriptor(await request('', 'POST', {})),
    save: async (id: number, skillKey: string, body: SkillBody) => skillRow(await request(`/${id}/skills/${key(skillKey)}`, 'PUT', body)),
    remove: async (id: number, skillKey: string) => { const v = await request(`/${id}/skills/${key(skillKey)}`, 'DELETE'); if (!isObject(v) || v.removed !== true) throw new Error('Invalid removal acknowledgment') },
    publish: async (id: number) => descriptor(await request(`/${id}/publish`, 'POST', {})),
  }
}
