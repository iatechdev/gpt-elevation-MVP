export const MAX_REFS = 8
export const MAX_NOTE = 500
export type SelfFailure = 'expired' | 'invalid' | 'conflict' | 'uncertain' | 'error'
export class SelfAssessError extends Error {
  readonly reason: SelfFailure
  constructor(reason: SelfFailure) { super(reason); this.reason = reason }
}
export type EvidenceRef = { evidenceId: number; version: number }
export type SelfBody = { requestId: string; skillKey: string; level: number | null; evidenceRefs?: EvidenceRef[]; rationale?: string }

/** Identificador de la solicitud: se conserva en los reintentos del MISMO envío (idempotencia) y se renueva si la persona cambia algo. */
export function newRequestId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16); c.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Mismas reglas que el servidor: un nivel (1–4) exige de 1 a 8 evidencias distintas; la nota es opcional (1–500). `level: null` retira el nivel. */
export function buildSelfBody(input: { requestId: string; skillKey: string; level: number | null; refs: readonly EvidenceRef[]; note: string }): SelfBody {
  const { requestId, skillKey, level, refs } = input
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 4)) throw new SelfAssessError('invalid')
  if (level === null) return { requestId, skillKey, level: null }
  const unique = new Map(refs.map(ref => [ref.evidenceId, ref.version]))
  if (unique.size < 1 || unique.size > MAX_REFS || unique.size !== refs.length) throw new SelfAssessError('invalid')
  const note = input.note.trim()
  if (note.length > MAX_NOTE) throw new SelfAssessError('invalid')
  return { requestId, skillKey, level, evidenceRefs: [...unique].map(([evidenceId, version]) => ({ evidenceId, version })), ...(note ? { rationale: note } : {}) }
}

/** `POST /api/skill-map/self` con el token propio. Nunca se manda un id de persona; el servidor verifica propietario, evidencia y versión. */
export async function saveSelfAssessment({ baseUrl, token, body, signal, fetcher = fetch }: {
  baseUrl: string; token: string; body: SelfBody; signal?: AbortSignal; fetcher?: typeof fetch
}): Promise<void> {
  if (!token) throw new SelfAssessError('expired')
  let response: Response
  try {
    response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/skill-map/self`, {
      method: 'POST', cache: 'no-store', signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch { throw new SelfAssessError('uncertain') } // sin respuesta: no se sabe si se guardó; reintentar con el mismo requestId es seguro
  if (response.status === 401) throw new SelfAssessError('expired')
  if (response.status === 400) throw new SelfAssessError('invalid')
  if (response.status === 409) throw new SelfAssessError('conflict')
  if (response.status >= 500) throw new SelfAssessError('uncertain')
  if (!response.ok) throw new SelfAssessError('error')
}
