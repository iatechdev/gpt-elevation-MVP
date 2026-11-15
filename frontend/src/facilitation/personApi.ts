// ES-175 (HU-P24) · cliente de «Mis revisiones» contra el servidor real (#262). Lógica pura donde se puede: validación de la forma de la respuesta y mapeo de errores.
// El servidor verifica propietario y permiso en cada acceso; aquí NUNCA se confía en el cliente: solo se muestra lo que responde, como TEXTO.
import { array, object, string, type Data } from '../routeCatalog/schema'

export type ReviewStatus = 'none' | 'pending' | 'answered'
export type Authored = { text: string; locale: string; createdAt: string; author?: string | null }
export type ReviewView = {
  id: number; author: string | null; createdAt: string; locale: string; materialVersion: number; materialChanged: boolean
  evidence: { title: string | null; version: number }[]; observation: string; limits: string; status: ReviewStatus
  objection: { reason: string; locale: string; createdAt: string } | null
  response: { text: string; locale: string; createdAt: string; author: string | null } | null
}

export class ReviewsError extends Error {
  readonly status: number; readonly code: string
  constructor(status: number, value: unknown) { super('Reviews request failed'); const body = object(value); this.status = status; this.code = string(body.code) }
}

const isLocale = (value: unknown) => value === 'es' || value === 'en'
const date = (value: unknown) => { const text = string(value); if (!Number.isFinite(Date.parse(text))) throw new Error('Invalid review date'); return text }

/** Valida la forma completa: cualquier cosa inesperada lanza (la pantalla dice «No pudimos cargar»), nunca se muestra a medias. */
export function parseReviews(body: unknown): ReviewView[] {
  const list = object(body).reviews
  if (!Array.isArray(list)) throw new Error('Invalid reviews')
  return list.map((row: unknown) => {
    const r = object(row)
    if (!Number.isSafeInteger(r.id) || Number(r.id) < 1 || !isLocale(r.locale) || typeof r.observation !== 'string' || typeof r.limits !== 'string' || typeof r.materialChanged !== 'boolean') throw new Error('Invalid review')
    if (!['none', 'pending', 'answered'].includes(string(r.status))) throw new Error('Invalid review status')
    const objection = r.objection === null ? null : (() => { const o = object(r.objection); if (typeof o.reason !== 'string' || !isLocale(o.locale)) throw new Error('Invalid objection'); return { reason: o.reason, locale: string(o.locale), createdAt: date(o.createdAt) } })()
    const response = r.response === null ? null : (() => { const o = object(r.response); if (typeof o.text !== 'string' || !isLocale(o.locale)) throw new Error('Invalid response'); return { text: o.text, locale: string(o.locale), createdAt: date(o.createdAt), author: typeof object(o.author).displayName === 'string' ? string(object(o.author).displayName) : null } })()
    return {
      id: Number(r.id), author: typeof object(r.author).displayName === 'string' ? string(object(r.author).displayName) : null, createdAt: date(r.createdAt), locale: string(r.locale),
      materialVersion: Number(r.materialVersion) || 0, materialChanged: r.materialChanged,
      evidence: array(r.evidence).map((e: unknown) => { const x = object(e) as Data; return { title: typeof x.title === 'string' && x.title ? x.title : null, version: Number(x.version) || 0 } }),
      observation: r.observation, limits: r.limits, status: string(r.status) as ReviewStatus, objection, response,
    }
  })
}

export type Failure = { kind: 'session' | 'consent' | 'gone' | 'already' | 'conflict' | 'invalid' | 'uncertain'; field?: 'required' | 'tooLong' | 'controlChars' }
/** Qué le pasó a la objeción. Red caída, respuesta perdida o 5xx = «uncertain»: el servidor PUDO guardar, así que se reintenta con el MISMO requestId (idempotente). */
export function failureOf(error: unknown): Failure {
  if (!(error instanceof ReviewsError) || error.status >= 500) return { kind: 'uncertain' }
  if (error.status === 401) return { kind: 'session' }
  if (error.status === 403) return { kind: error.code === 'consent_revoked' ? 'consent' : 'session' }
  if (error.status === 404) return { kind: 'gone' }
  if (error.status === 409) return { kind: error.code === 'already_objected' ? 'already' : 'conflict' }
  if (error.status === 400) return error.code === 'required' ? { kind: 'invalid', field: 'required' } : error.code === 'too_long' ? { kind: 'invalid', field: 'tooLong' } : error.code === 'control_chars' ? { kind: 'invalid', field: 'controlChars' } : { kind: 'conflict' }
  return { kind: 'uncertain' }
}

export function reviewsApi(base: string, token: string) {
  const call = async (path: string, init: RequestInit & { signal?: AbortSignal }) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' })
    let body: unknown = null; try { body = await response.json() } catch { /* sin cuerpo */ }
    if (!response.ok) throw new ReviewsError(response.status, body)
    return body
  }
  return {
    list: async (signal?: AbortSignal) => parseReviews(await call('/api/me/professional-reviews', { method: 'GET', signal })),
    object: async (reviewId: number, input: { reason: string; requestId: string; locale: 'es' | 'en' }) => { await call(`/api/me/professional-reviews/${reviewId}/objection`, { method: 'POST', body: JSON.stringify(input) }) },
  }
}
