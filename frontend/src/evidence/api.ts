import { parseList, parseDetail, parseAck, type Payload } from './model'
export class EvidenceError extends Error {
  readonly status: number
  readonly fields: string[]
  constructor(status: number, fields: string[] = []) { super('Evidence request failed'); this.status = status; this.fields = fields }
}
export type CreateBody = { payload: Payload; status: 'draft' | 'confirmed'; requestId: string }
export function evidenceApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, body?: CreateBody, signal?: AbortSignal): Promise<unknown> {
    if (!token) throw new EvidenceError(401)
    const res = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/evidence${path}`, {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      cache: 'no-store', signal, ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const value: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const fields = value && typeof value === 'object' && 'missing' in value && Array.isArray(value.missing)
        ? value.missing.filter((v): v is string => typeof v === 'string' && ['title', 'situation', 'responsibility', 'actions', 'delivered', 'observedEffect'].includes(v)) : []
      throw new EvidenceError(res.status, fields)
    }
    return value
  }
  return {
    list: async (signal?: AbortSignal) => parseList(await request('', undefined, signal)),
    detail: async (id: number, signal?: AbortSignal) => {
      if (!Number.isSafeInteger(id) || id < 1 || id > 999999999) throw new EvidenceError(404)
      const detail = parseDetail(await request(`/${id}`, undefined, signal))
      if (detail.id !== id) throw new Error('Invalid evidence owner resource')
      return detail
    },
    create: async (body: CreateBody) => parseAck(await request('', body)),
  }
}
