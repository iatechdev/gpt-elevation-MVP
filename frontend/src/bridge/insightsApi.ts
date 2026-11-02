// ES-121: cliente de los permisos por fuente (`/api/consents/insights_*`) y del análisis (`/api/insights/proposals`). El titular sale del token, nunca del cuerpo.
import type { Insight, SourceId } from './logic.ts'
import { failureOf, parseConsents, parseResumes, proposalsToInsights, purposeOf } from './sources.ts'
import type { Failure, ResumeVersion } from './sources.ts'

export class SourcesError extends Error {
  readonly kind: Failure
  constructor(kind: Failure) { super(kind); this.kind = kind }
}
type Opts = { baseUrl: string; token: string; signal?: AbortSignal; fetcher?: typeof fetch }
const join = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, '')}${path}`

async function call({ baseUrl, token, signal, fetcher = fetch }: Opts, path: string, method: 'GET' | 'PUT' | 'POST', body: unknown, timeoutMs: number): Promise<unknown> {
  if (!token) throw new SourcesError('expired')
  const timeout = AbortSignal.timeout(timeoutMs)
  let response: Response
  try {
    response = await fetcher(join(baseUrl, path), {
      method, cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new SourcesError('network')
  }
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new SourcesError(failureOf(response.status, value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' ? value.code : ''))
  return value
}

export async function readPermissions(opts: Opts): Promise<Record<SourceId, boolean>> {
  const parsed = parseConsents(await call(opts, '/api/consents', 'GET', undefined, 15000))
  if (!parsed) throw new SourcesError('unavailable')
  return parsed
}
export async function setPermission(opts: Opts, source: SourceId, granted: boolean): Promise<void> {
  await call(opts, `/api/consents/${purposeOf[source]}`, 'PUT', { status: granted ? 'granted' : 'revoked' }, 15000)
}
/** Versiones de la hoja de vida (solo id, versión y fecha). Si no se pueden leer, la lista queda vacía: el análisis usa la última. */
export async function listResumeVersions(opts: Opts): Promise<ResumeVersion[]> {
  try { return parseResumes(await call(opts, '/api/user/resumes', 'GET', undefined, 15000)) } catch (error) { if (opts.signal?.aborted) throw error; return [] }
}
/** Pide propuestas de UNA fuente. La IA puede tardar: 60 s. Nada se guarda en el servidor. */
export async function analyze(opts: Opts, source: SourceId, { locale, today, resumeId }: { locale: 'es' | 'en'; today: string; resumeId?: number }): Promise<Insight[]> {
  const value = await call(opts, '/api/insights/proposals', 'POST', { sources: [source], locale, ...(source === 'resume' && resumeId ? { resumeId } : {}) }, 60000)
  try { return proposalsToInsights(value, source, today) } catch { throw new SourcesError('invalid') }
}
