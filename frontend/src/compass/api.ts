import { parseContext, parsePreview, parseVersion, type DirectField } from './model'
export class CompassError extends Error {
  readonly status: number; readonly code: string; readonly fieldIndex?: number
  constructor(status: number, code = '', fieldIndex?: number) { super('Career context request failed'); this.status = status; this.code = code; this.fieldIndex = fieldIndex }
}
export type Confirmation = { fields: DirectField[]; token: string; requestId: string }
export function compassApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  async function request(path = '', body?: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!token) throw new CompassError(401)
    const res = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/career-context${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const value: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const code = value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' && ['field_not_shareable', 'consent_required', 'preview_mismatch', 'preview_expired', 'conflict', 'origin_not_found'].includes(value.code) ? value.code : ''
      const index = value && typeof value === 'object' && 'fieldIndex' in value && typeof value.fieldIndex === 'number' && Number.isSafeInteger(value.fieldIndex) && value.fieldIndex >= 0 ? value.fieldIndex : undefined
      throw new CompassError(res.status, code, index)
    }
    return value
  }
  return {
    read: async (signal?: AbortSignal) => parseContext(await request('', undefined, signal)),
    preview: async (fields: DirectField[], locale: 'es' | 'en') => {
      const preview = parsePreview(await request('/preview', { fields, locale }))
      if (preview.representation.length !== fields.length || preview.representation.some((field, i) => field.key !== fields[i].key)) throw new Error('Preview does not match selection')
      return preview
    },
    confirm: async (body: Confirmation) => parseVersion(await request('/confirm', body)),
    revoke: async () => {
      const response = await request('/revoke', {})
      if (!response || typeof response !== 'object' || !('revoked' in response) || typeof response.revoked !== 'boolean') throw new Error('Invalid withdrawal response')
      return response.revoked
    },
  }
}
