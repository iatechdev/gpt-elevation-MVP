export type BridgeStatus = 'granted' | 'revoked' | 'undecided' | 'outdated' | 'unknown'
export type ConsentFailure = 'expired' | 'error'
export class ConsentError extends Error {
  readonly reason: ConsentFailure
  constructor(reason: ConsentFailure) { super(reason); this.reason = reason }
}
type Opts = { baseUrl: string; token: string; signal?: AbortSignal; fetcher?: typeof fetch }
const url = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, '')}/api/consents${path}`
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' })

/** Estado del propósito `professional_bridge` (lo que cruza al recorrido profesional). Solo lectura de lo propio. */
export async function readBridgeStatus({ baseUrl, token, signal, fetcher = fetch }: Opts): Promise<BridgeStatus> {
  if (!token) throw new ConsentError('expired')
  const response = await fetcher(url(baseUrl, ''), { method: 'GET', headers: headers(token), cache: 'no-store', signal })
  if (response.status === 401) throw new ConsentError('expired')
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok || !data || typeof data !== 'object' || !('consents' in data) || !Array.isArray(data.consents)) throw new ConsentError('error')
  const row = data.consents.find((c: unknown) => !!c && typeof c === 'object' && 'purpose' in c && c.purpose === 'professional_bridge')
  const status = row && typeof row === 'object' && 'status' in row ? row.status : null
  return status === 'granted' || status === 'revoked' || status === 'undecided' || status === 'outdated' ? status : 'unknown'
}

/** «Revocar todos»: retira el permiso del propósito `professional_bridge`. Solo el cuerpo {status}; sin IDs ni competencias. */
export async function revokeBridge({ baseUrl, token, signal, fetcher = fetch }: Opts): Promise<void> {
  if (!token) throw new ConsentError('expired')
  const response = await fetcher(url(baseUrl, '/professional_bridge'), {
    method: 'PUT', headers: { ...headers(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'revoked' }), cache: 'no-store', signal,
  })
  if (response.status === 401) throw new ConsentError('expired')
  if (!response.ok) throw new ConsentError('error')
}
