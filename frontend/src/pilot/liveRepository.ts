// ES-173 (HU-P22, entrega c): repositorio REAL de «Tu opinión». Habla con /api/me/pilot-feedback (propietario = el token; nunca un id en la ruta ni en el cuerpo)
// y con /api/consents/pilot_feedback. Mismo contrato que el repositorio de fixtures (read/save/withdraw) para que la pantalla no distinga el origen.
// Solo se crea con VITE_ENABLE_PILOT_FEEDBACK_LIVE=true (apagada por defecto). Ventana fija: día 7. Sin caché, sin almacenamiento local de respuestas.
import { FixtureError } from './fixtures.ts'
import { validAnswers } from './model.ts'
import type { Feedback, Intent } from './model.ts'

const WINDOW = 'day7'
const TIMEOUT_MS = 15000
type Options = { baseUrl: string; token: string; fetcher?: typeof fetch }
type Reply = { status: number; data: unknown }

export function liveEnabled(value: unknown) { return value === 'true' }

export function createLiveRepository({ baseUrl, token, fetcher = fetch }: Options) {
  const root = baseUrl.replace(/\/$/, '')
  const call = async (path: string, method: string, body?: unknown): Promise<Reply> => {
    const response = await fetcher(root + path, {
      method, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    })
    return { status: response.status, data: await response.json().catch(() => null) }
  }
  const parse = (data: unknown): Feedback => {
    const row = data && typeof data === 'object' && 'feedback' in data ? (data as { feedback: Record<string, unknown> }).feedback : null
    const permission = row && typeof row.permission === 'object' && row.permission ? (row.permission as { granted?: unknown }).granted : undefined
    if (!row || !Number.isSafeInteger(row.version) || (row.version as number) < 0 || typeof permission !== 'boolean' || row.window !== WINDOW
      || !(row.lastRequestId === null || typeof row.lastRequestId === 'string') || !(row.answers === null || validAnswers(row.answers))) throw new FixtureError('load')
    return { synthetic: false, version: row.version as number, questionnaireVersion: 1, window: WINDOW, permission: permission ? 'granted' : 'missing', answers: row.answers as Feedback['answers'], lastRequestId: row.lastRequestId as string | null }
  }
  const codeOf = (reply: Reply) => (reply.data && typeof reply.data === 'object' && 'code' in reply.data ? String((reply.data as { code: unknown }).code) : '')
  // Un corte de red o un 5xx en una ESCRITURA puede haberse aplicado: 'unknown' obliga a consultar antes de reintentar (requestId idempotente).
  const writeFailure = (reply: Reply): FixtureError => {
    if (reply.status === 403 && codeOf(reply) === 'consent_required') return new FixtureError('unconfigured')
    if (reply.status === 409) return new FixtureError('conflict')
    return new FixtureError(reply.status >= 500 ? 'unknown' : 'save')
  }
  return {
    async read(): Promise<Feedback> {
      let reply: Reply
      try { reply = await call(`/api/me/pilot-feedback?window=${WINDOW}`, 'GET') } catch { throw new FixtureError('load') }
      if (reply.status !== 200) throw new FixtureError('load')
      return parse(reply.data)
    },
    async save(intent: Intent): Promise<Feedback> {
      let reply: Reply
      try { reply = await call('/api/me/pilot-feedback', 'PUT', { requestId: intent.requestId, baseVersion: intent.baseVersion, questionnaireVersion: intent.questionnaireVersion, window: WINDOW, answers: intent.answers }) } catch { throw new FixtureError('unknown') }
      if (reply.status !== 200 && reply.status !== 201) throw writeFailure(reply)
      return parse(reply.data)
    },
    async withdraw(version: number): Promise<Feedback> {
      let reply: Reply
      try { reply = await call(`/api/me/pilot-feedback?window=${WINDOW}&baseVersion=${version}`, 'DELETE') } catch { throw new FixtureError('unknown') }
      if (reply.status !== 200) throw writeFailure(reply)
      return parse(reply.data)
    },
    /** Da o retira el permiso `pilot_feedback`. Retirarlo NO borra lo respondido: solo impide guardar más (borrar = withdraw). */
    async setPermission(granted: boolean): Promise<void> {
      let reply: Reply
      try { reply = await call('/api/consents/pilot_feedback', 'PUT', { status: granted ? 'granted' : 'revoked' }) } catch { throw new FixtureError('unknown') }
      if (reply.status < 200 || reply.status >= 300) throw writeFailure(reply)
    },
  }
}
export type LiveRepository = ReturnType<typeof createLiveRepository>
