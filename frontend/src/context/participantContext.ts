export type ParticipantContext = {
  preferredLanguage: 'es' | 'en' | null
  residenceCountry: string | null
  targetMarket: string | null
  timeZone: string | null
  profession: string | null
  interests: string | null
  availabilityMinutesPerWeek: number | null
  careerGoal: string | null
  careerConstraints: string | null
}
export type ContextSnapshot = {
  schemaVersion: 1; version: number; context: ParticipantContext | null
  savedAt: string | null; completedAt: string | null
}
export const emptyContext: ParticipantContext = {
  preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null,
  profession: null, interests: null, availabilityMinutesPerWeek: null,
  careerGoal: null, careerConstraints: null,
}
export class ContextError extends Error {
  status: number
  fields: string[]
  constructor(status: number, fields: string[] = []) {
    super('Context request failed')
    this.status = status
    this.fields = fields
  }
}
const backend = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
export async function contextRequest(body?: {
  schemaVersion: 1; expectedVersion: number; action: 'save_draft' | 'continue'; context: ParticipantContext
}, token = localStorage.getItem('elevation_token') ?? '', signal?: AbortSignal): Promise<ContextSnapshot> {
  const res = await fetch(`${backend}/api/user/context`, {
    method: body ? 'PUT' : 'GET', signal, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const error: unknown = await res.json().catch(() => null)
    const fields = error && typeof error === 'object' && 'fields' in error && Array.isArray(error.fields)
      ? error.fields.filter((field): field is string => typeof field === 'string') : []
    throw new ContextError(res.status, fields)
  }
  const data = await res.json() as ContextSnapshot
  if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.version) || data.version < 0
    || (data.version === 0 ? data.context !== null : !data.context || !data.savedAt)
    || (data.context && Object.keys(emptyContext).some(key => !Object.hasOwn(data.context!, key)))) {
    throw new ContextError(503)
  }
  return data
}
