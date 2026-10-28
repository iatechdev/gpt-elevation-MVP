import { parseSkillMap, type SkillMap } from './model'

export type MapFailure = 'expired' | 'forbidden' | 'catalog_unavailable' | 'unavailable' | 'load_error'
export class SkillMapError extends Error {
  readonly reason: MapFailure
  constructor(reason: MapFailure) { super(reason); this.reason = reason }
}
export async function readSkillMap({ baseUrl, token, signal, fetcher = fetch }: {
  baseUrl: string; token: string; signal?: AbortSignal; fetcher?: typeof fetch
}): Promise<SkillMap> {
  if (!token) throw new SkillMapError('expired')
  const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/skill-map`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store', signal,
  })
  if (response.status === 401) throw new SkillMapError('expired')
  if (response.status === 403) throw new SkillMapError('forbidden')
  if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) throw new SkillMapError('unavailable')
  const data: unknown = await response.json().catch(() => null)
  if (response.status === 503 && data && typeof data === 'object' && 'code' in data && data.code === 'catalog_unavailable') throw new SkillMapError('catalog_unavailable')
  if (!response.ok) throw new SkillMapError('load_error')
  try { return parseSkillMap(data) } catch { throw new SkillMapError('load_error') }
}
