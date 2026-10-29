import { array, kinds, object, string, validKey, type Data, type Kind } from './schema'
export type Descriptor = { id: number; version: number; status: 'draft' | 'published' | 'archived'; publishedAt: string | null; itemCount: number }
export type Item = Data & { itemKey: string }
export type Detail = Descriptor & { items: Record<Kind, Item[]>; missing: Record<string, string[]> }
export type Published = { version: number; publishedAt: string; contexts: Data[]; sources: Data[]; roles: Data[]; offers: Data[]; resources: Data[] }
export class CatalogError extends Error {
  readonly status: number; readonly code: string; readonly missing: Record<string, string[]>; readonly draftId?: number
  constructor(status: number, value: unknown) { super('Catalog request failed'); const body = object(value); this.status = status; this.code = string(body.code); this.missing = missing(body.missing); this.draftId = Number.isSafeInteger(body.draftId) ? Number(body.draftId) : undefined }
}
function missing(v: unknown): Record<string, string[]> { return Object.fromEntries(Object.entries(object(v)).map(([key, values]) => [key, array(values).filter((x): x is string => typeof x === 'string')])) }
function descriptor(value: unknown): Descriptor {
  const v = object(value)
  if (!Number.isSafeInteger(v.id) || Number(v.id) < 1 || !Number.isSafeInteger(v.version) || Number(v.version) < 1 || !['draft', 'published', 'archived'].includes(string(v.status)) || !Number.isSafeInteger(v.itemCount) || Number(v.itemCount) < 0 || (v.publishedAt !== null && !Number.isFinite(Date.parse(string(v.publishedAt))))) throw new Error('Invalid catalog descriptor')
  return v as Descriptor
}
export function detail(value: unknown): Detail {
  const v = object(value); const d = descriptor(v); const items = {} as Detail['items']
  for (const kind of kinds) {
    const rows = object(v.items)[kind]; if (!Array.isArray(rows)) throw new Error('Invalid catalog items')
    items[kind] = rows.map(row => { const r = object(row); if (!validKey(string(r.itemKey))) throw new Error('Invalid item key'); return r as Item })
  }
  return { ...d, items, missing: missing(v.missing) }
}
export function published(value: unknown): Published {
  const v = object(value)
  if (!Number.isSafeInteger(v.version) || Number(v.version) < 1 || !Number.isFinite(Date.parse(string(v.publishedAt)))) throw new Error('Invalid published catalog')
  for (const kind of kinds) {
    if (!Array.isArray(v[kind])) throw new Error('Invalid published collection')
    for (const row of array(v[kind])) {
      const item = object(row); const key = kind === 'contexts' ? 'contextKey' : kind === 'sources' ? 'sourceKey' : kind === 'roles' ? 'roleKey' : kind === 'offers' ? 'offerKey' : 'resourceKey'
      if (!validKey(string(item[key]))) throw new Error('Invalid published key')
      if (kind === 'sources' && typeof item.stale !== 'boolean') throw new Error('Invalid source freshness')
      if (kind === 'roles' && typeof item.verificationTask !== 'boolean') throw new Error('Invalid role freshness')
      if (kind === 'offers' && !['current', 'expired', 'unverified'].includes(string(item.status))) throw new Error('Invalid vacancy freshness')
      if (item.synthetic !== undefined && typeof item.synthetic !== 'boolean') throw new Error('Invalid test content flag')
      if (kind === 'sources' && ('consultedBy' in item || !string(item.title) || !Number.isFinite(Date.parse(string(item.consultedAt))))) throw new Error('Invalid public source')
      if (kind === 'roles' && ('review' in item || typeof object(item.domainReview).present !== 'boolean' || !string(object(item.labels).es) || !string(object(item.labels).en) || !Array.isArray(item.tasks))) throw new Error('Invalid public role')
      if (kind === 'offers' && ('verification' in item || typeof object(item.salary).published !== 'boolean' || (object(item.salary).published === true && !string(object(item.salary).text)))) throw new Error('Invalid public salary')
      if (kind === 'resources') {
        const price = object(item.price); const duration = object(item.duration)
        if (typeof price.published !== 'boolean' || (price.published === true && (typeof price.amount !== 'number' || !Number.isFinite(price.amount) || price.amount < 0 || !/^[A-Z]{3}$/.test(string(price.currency)))) || !(typeof duration.minutes === 'number' && duration.minutes > 0) && !string(duration.text)) throw new Error('Invalid resource price or duration')
      }
    }
  }
  return v as Published
}
export function catalogApi(base: string, token: string) {
  async function request(path: string, method = 'GET', body?: Data): Promise<unknown> {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/${path}`, { method, cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) throw new CatalogError(res.status, data)
    return data
  }
  const root = 'admin/route-catalog'
  return {
    published: async () => published(await request('route-catalog')),
    list: async () => { const data = object(await request(root)); if (!Array.isArray(data.catalogs)) throw new Error('Invalid catalog list'); return data.catalogs.map(descriptor) },
    get: async (id: number) => detail(await request(`${root}/${id}`)),
    create: async () => descriptor(await request(root, 'POST', {})),
    save: async (id: number, kind: Kind, key: string, body: Data) => { if (!validKey(key)) throw new Error('Invalid key'); return object(await request(`${root}/${id}/${kind}/${encodeURIComponent(key)}`, 'PUT', body)) },
    remove: async (id: number, kind: Kind, key: string) => { const v = object(await request(`${root}/${id}/${kind}/${encodeURIComponent(key)}`, 'DELETE')); if (v.removed !== true) throw new Error('Invalid removal acknowledgment') },
    publish: async (id: number) => descriptor(await request(`${root}/${id}/publish`, 'POST', {})),
  }
}
