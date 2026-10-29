// ES-109: lo que una hoja de vida puede respaldar. Todo es opcional: null o lista vacía = «no lo sé / el documento no lo dice»; nunca se completa por deducción.
export type Experience = { role: string; organization: string | null; startYear: number | null; endYear: number | null; isCurrent: boolean }
export type Education = { kind: 'education' | 'certification'; title: string; institution: string | null; year: number | null }
export type DeclaredSkill = { name: string; support: string | null; resumeVersion: number | null }
export type Language = { name: string; level: string | null }
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
  sector: string | null
  totalYearsExperience: number | null
  experience: Experience[]
  education: Education[]
  declaredSkills: DeclaredSkill[]
  languages: Language[]
}
export type ContextSnapshot = {
  schemaVersion: 2; version: number; context: ParticipantContext | null
  savedAt: string | null; completedAt: string | null
}
export const emptyContext: ParticipantContext = {
  preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null,
  profession: null, interests: null, availabilityMinutesPerWeek: null,
  careerGoal: null, careerConstraints: null,
  sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [],
}
export class ContextError extends Error {
  status: number
  fields: string[]
  code: string
  constructor(status: number, fields: string[] = [], code = '') {
    super('Context request failed')
    this.status = status
    this.fields = fields
    this.code = code
  }
}
// `import.meta.env` no existe fuera de Vite (pruebas en Node): se lee con tolerancia.
const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {}
const backend = (env.VITE_BACKEND_URL as string | undefined) ?? (env.DEV ? 'http://localhost:8080' : '')
export async function contextRequest(body?: {
  schemaVersion: 2; expectedVersion: number; action: 'save_draft' | 'continue'; context: ParticipantContext
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
    const code = error && typeof error === 'object' && 'error' in error && typeof error.error === 'string' ? error.error : ''
    throw new ContextError(res.status, fields, code)
  }
  const data = await res.json() as ContextSnapshot
  if (data.schemaVersion !== 2 || !Number.isSafeInteger(data.version) || data.version < 0
    || (data.version === 0 ? data.context !== null : !data.context || !data.savedAt)
    || (data.context && Object.keys(emptyContext).some(key => !Object.hasOwn(data.context!, key)))) {
    throw new ContextError(503)
  }
  return data
}
