// ES-303 (PR B) · Cliente de la invitación de revisor con código de un solo uso, contra el servidor real (PR A, #396). Lógica pura donde se puede: forma de las respuestas, mapeo de errores y el código del fragmento.
// El servidor verifica propietario, código, topes y permiso en cada acceso; aquí NUNCA se confía en el cliente y NUNCA se envía un reviewerId (el servidor responde 410 use_invite).
// El código de invitación no se escribe en errores, en logs, en el almacenamiento del navegador ni en la URL (el fragmento se limpia al leerlo).
// Sin importaciones: la lógica pura se prueba con node:test directamente sobre este archivo.
const object = (value: unknown): Record<string, unknown> => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {})
const string = (value: unknown) => (typeof value === 'string' ? value : '')

export type InviteStatus = 'active' | 'used' | 'revoked' | 'expired'
export type InviteView = { id: number; status: InviteStatus; createdAt: string; expiresAt: string; usedAt: string | null; revokedAt: string | null }
export type ShareView = { id: number; reviewerId: number; materialVersion: number; evidenceCount: number; status: 'granted' | 'revoked' | 'superseded'; createdAt: string; revokedAt: string | null }
export type Lookup = { reviewerName: string; expiresAt: string }

export class AuthError extends Error {
  readonly status: number; readonly code: string
  constructor(status: number, value: unknown) { super('Review authorization request failed'); const body = object(value); this.status = status; this.code = string(body.code) }
}

const INVITE_STATUSES: readonly string[] = ['active', 'used', 'revoked', 'expired']
const SHARE_STATUSES: readonly string[] = ['granted', 'revoked', 'superseded']
const date = (value: unknown) => { const text = string(value); if (!Number.isFinite(Date.parse(text))) throw new Error('Invalid date'); return text }
const optionalDate = (value: unknown) => (value === null || value === undefined ? null : date(value))
const id = (value: unknown) => { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('Invalid id'); return Number(value) }

export function parseInvite(value: unknown): InviteView {
  const row = object(value)
  if (!INVITE_STATUSES.includes(string(row.status))) throw new Error('Invalid invite status')
  return { id: id(row.id), status: string(row.status) as InviteStatus, createdAt: date(row.createdAt), expiresAt: date(row.expiresAt), usedAt: optionalDate(row.usedAt), revokedAt: optionalDate(row.revokedAt) }
}
export function parseInvites(body: unknown): InviteView[] {
  const list = object(body).invites
  if (!Array.isArray(list)) throw new Error('Invalid invites')
  return list.map(parseInvite)
}
export function parseShares(body: unknown): ShareView[] {
  const list = object(body).shares
  if (!Array.isArray(list)) throw new Error('Invalid shares')
  return list.map((value: unknown) => {
    const row = object(value)
    if (!SHARE_STATUSES.includes(string(row.status))) throw new Error('Invalid share status')
    return { id: id(row.id), reviewerId: id(row.reviewerId), materialVersion: Number(row.materialVersion) || 0, evidenceCount: Number(row.evidenceCount) || 0, status: string(row.status) as ShareView['status'], createdAt: date(row.createdAt), revokedAt: optionalDate(row.revokedAt) }
  })
}
export function parseLookup(body: unknown): Lookup {
  const root = object(body); const reviewer = object(root.reviewer)
  if (typeof reviewer.name !== 'string' || !reviewer.name.trim()) throw new Error('Invalid reviewer')
  return { reviewerName: reviewer.name, expiresAt: date(root.expiresAt) }
}
/** Una fila por persona revisora: la autorización MÁS RECIENTE de cada una (las anteriores están sustituidas). Activa si esa última sigue concedida. */
export function latestShares(shares: ShareView[]): ShareView[] {
  const best = new Map<number, ShareView>()
  for (const share of shares) { const current = best.get(share.reviewerId); if (!current || share.id > current.id) best.set(share.reviewerId, share) }
  return [...best.values()].sort((a, b) => b.id - a.id)
}

/** Cuántas invitaciones activas cuenta el servidor para el tope (10): activa = sin usar, sin anular y sin vencer. */
export const MAX_ACTIVE_INVITES = 10
export const activeInvites = (invites: InviteView[], now = Date.now()) => invites.filter(invite => invite.status === 'active' && Date.parse(invite.expiresAt) > now).length

// ── Código ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Lo que se muestra en el campo: mayúsculas, solo letras y números, en grupos de 4 separados por guion (el servidor normaliza igual: acepta guiones y espacios). Máximo 16 caracteres. */
export function formatCode(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  return clean.match(/.{1,4}/g)?.join('-') ?? ''
}
export const codeComplete = (value: string) => formatCode(value).replace(/-/g, '').length === 16
/** El código llega en el FRAGMENTO del enlace (`#code=…`): no viaja al servidor, a los registros ni al Referer. Devuelve el código ya formateado o '' si no hay o no es plausible. */
export function codeFromHash(hash: string): string {
  const match = /^#?(?:.*&)?code=([^&]*)/.exec(hash)
  if (!match) return ''
  let raw = ''; try { raw = decodeURIComponent(match[1]) } catch { return '' }
  const formatted = formatCode(raw)
  return codeComplete(formatted) ? formatted : ''
}
export const inviteLink = (origin: string, code: string) => `${origin}/app/professional-reviews#code=${encodeURIComponent(code)}`

// ── Errores ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type Problem = 'session' | 'invalid' | 'limit' | 'invalidEvidence' | 'full' | 'gone' | 'network'
/** Qué le pasó a la persona. 404 es UNIFORME (inexistente, usado, vencido, anulado, propio o revisor inactivo): un solo problema, sin distinguir la causa. */
export function problemOf(error: unknown): Problem {
  if (!(error instanceof AuthError) || error.status >= 500) return 'network'
  if (error.status === 401 || error.status === 403) return 'session'
  if (error.status === 404 || error.status === 410) return 'invalid'
  if (error.status === 429) return 'limit'
  if (error.status === 409) return error.code === 'too_many_active' ? 'full' : 'gone'
  if (error.status === 400) return error.code === 'invalid_evidence' ? 'invalidEvidence' : 'invalid'
  return 'network'
}

export function reviewAuthApi(base: string, token: string, fetcher: typeof fetch = fetch) {
  const call = async (path: string, init: RequestInit & { signal?: AbortSignal } = {}) => {
    const response = await fetcher(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store', referrerPolicy: 'no-referrer' })
    let body: unknown = null; try { body = await response.json() } catch { /* sin cuerpo */ }
    if (!response.ok) throw new AuthError(response.status, body)
    return body
  }
  const post = (path: string, payload: unknown) => call(path, { method: 'POST', body: JSON.stringify(payload) })
  return {
    // Persona (/api/me). OJO: el lookup recibe { code } y la autorización { inviteCode } (contrato del servidor, PR A).
    lookup: async (code: string) => parseLookup(await post('/api/me/review-invites/lookup', { code })),
    authorizeWithCode: async (input: { code: string; evidenceIds: number[]; requestId: string }) => { await post('/api/me/review-shares', { inviteCode: input.code, evidenceIds: input.evidenceIds, requestId: input.requestId }) },
    authorizeAgain: async (input: { shareId: number; evidenceIds: number[]; requestId: string }) => { await post('/api/me/review-shares', { shareId: input.shareId, evidenceIds: input.evidenceIds, requestId: input.requestId }) },
    shares: async (signal?: AbortSignal) => parseShares(await call('/api/me/review-shares', { method: 'GET', signal })),
    withdraw: async (shareId: number) => { await call(`/api/me/review-shares/${shareId}`, { method: 'DELETE' }) },
    // Revisor (/api/reviewer)
    invites: async (signal?: AbortSignal) => parseInvites(await call('/api/reviewer/invites', { method: 'GET', signal })),
    createInvite: async (requestId: string): Promise<{ invite: InviteView; code: string | null }> => {
      const body = object(await post('/api/reviewer/invites', { requestId }))
      return { invite: parseInvite(body.invite), code: typeof body.code === 'string' && body.code ? body.code : null }
    },
    revokeInvite: async (inviteId: number) => { await call(`/api/reviewer/invites/${inviteId}`, { method: 'DELETE' }) },
  }
}
