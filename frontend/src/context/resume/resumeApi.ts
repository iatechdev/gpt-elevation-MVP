// ES-109: llamadas del navegador a la hoja de vida. Nada se guarda en el navegador (ni almacenamiento local, ni cookies, ni la URL).
import type { Suggestions } from './resumeLogic'

// `import.meta.env` no existe fuera de Vite (pruebas en Node): se lee con tolerancia.
const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {}
const backend = (env.VITE_BACKEND_URL as string | undefined) ?? (env.DEV ? 'http://localhost:8080' : '')
const token = () => localStorage.getItem('elevation_token') ?? ''
const auth = () => ({ Authorization: `Bearer ${token()}` })

export const MAX_RESUME_BYTES = 5 * 1024 * 1024
export const MAX_VERSIONS = 5
export type ResumeMeta = { id: number; version: number; size: number; createdAt: string }
export type FileProblem = 'empty' | 'too_large' | 'not_pdf'
export type ErrorCode = FileProblem | 'encrypted' | 'corrupt' | 'too_many_pages' | 'no_text' | 'timeout' | 'sanitize_failed' | 'provider_unavailable'
  | 'ai_budget_exhausted' | 'ai_budget_not_configured' | 'consent_required' | 'resume_limit' | 'rate_limited' | 'analysis_in_progress' | 'request_already_processed' | 'network' | 'cancelled' | 'internal_error'
export type AnalyzeResult =
  | { status: 'ok'; resume: ResumeMeta; reused: boolean; suggestions: Suggestions; discarded: number }
  | { status: 'error'; code: ErrorCode; http: number; retryable: boolean; resume?: ResumeMeta }

const KNOWN: ErrorCode[] = ['empty', 'too_large', 'not_pdf', 'encrypted', 'corrupt', 'too_many_pages', 'no_text', 'timeout', 'sanitize_failed', 'provider_unavailable', 'ai_budget_exhausted',
  'ai_budget_not_configured', 'consent_required', 'resume_limit', 'rate_limited', 'analysis_in_progress', 'request_already_processed', 'internal_error']

// Comprobación previa en el navegador (el servidor repite todas): el aviso sale ANTES de enviar nada.
export function checkFile(file: Pick<File, 'name' | 'size' | 'type'>): FileProblem | null {
  if (file.size === 0) return 'empty'
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'not_pdf'
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream') return 'not_pdf'
  if (file.size > MAX_RESUME_BYTES) return 'too_large'
  return null
}

async function json(response: Response): Promise<Record<string, unknown> | null> { return response.json().catch(() => null) as Promise<Record<string, unknown> | null> }
const asMeta = (value: unknown): ResumeMeta | undefined => {
  const v = value as Partial<ResumeMeta> | null
  return v && Number.isSafeInteger(v.id) && Number.isSafeInteger(v.version) && Number.isFinite(v.size) && typeof v.createdAt === 'string' ? v as ResumeMeta : undefined
}

export async function analyzeResume(file: File, requestId: string, signal?: AbortSignal): Promise<AnalyzeResult> {
  const data = new FormData()
  data.append('requestId', requestId)
  data.append('cv', file, 'cv.pdf') // el nombre original no viaja
  try {
    const response = await fetch(`${backend}/api/user/resumes/analyze`, { method: 'POST', headers: auth(), body: data, signal, cache: 'no-store' })
    const body = await json(response)
    if (response.ok && body && body.suggestions && asMeta(body.resume)) {
      return { status: 'ok', resume: asMeta(body.resume)!, reused: body.reused === true, suggestions: body.suggestions as Suggestions, discarded: Number(body.discarded) || 0 }
    }
    const code = KNOWN.includes(body?.code as ErrorCode) ? body!.code as ErrorCode : 'internal_error'
    return { status: 'error', code, http: response.status, retryable: body?.retryable === true, resume: asMeta(body?.resume) }
  } catch (error) {
    if (signal?.aborted || (error as { name?: string })?.name === 'AbortError') return { status: 'error', code: 'cancelled', http: 0, retryable: false }
    return { status: 'error', code: 'network', http: 0, retryable: true }
  }
}

export async function readResumeConsent(): Promise<boolean> {
  try {
    const response = await fetch(`${backend}/api/consents`, { headers: auth(), cache: 'no-store' })
    const body = await json(response)
    const list = (body?.consents ?? []) as { purpose?: string; status?: string }[]
    return list.some(item => item.purpose === 'resume_ai_reading' && item.status === 'granted')
  } catch { return false }
}
// ES-248: el resultado de cambiar el permiso puede ser INCIERTO. 'ok' = el servidor respondió que sí; 'rejected' = respuesta definitiva de rechazo (4xx);
// 'uncertain' = sin respuesta (corte o 15 s) o 5xx: el servidor pudo haberlo aplicado (el PUT es idempotente) y hay que releer antes de decir nada.
export type ConsentChange = 'ok' | 'rejected' | 'uncertain'
export async function setResumeConsent(granted: boolean): Promise<ConsentChange> {
  try {
    const response = await fetch(`${backend}/api/consents/resume_ai_reading`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: granted ? 'granted' : 'revoked' }), signal: AbortSignal.timeout(15000) })
    return response.ok ? 'ok' : response.status >= 500 ? 'uncertain' : 'rejected'
  } catch { return 'uncertain' }
}
// Lee el permiso real. 'unknown' = no se pudo leer (a diferencia de readResumeConsent, que cuenta un error como «no autorizado»).
export async function checkResumeConsent(): Promise<'granted' | 'not_granted' | 'unknown'> {
  try {
    const response = await fetch(`${backend}/api/consents`, { headers: auth(), cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) return 'unknown'
    const body = await json(response)
    const list = (body?.consents ?? []) as { purpose?: string; status?: string }[]
    return list.some(item => item.purpose === 'resume_ai_reading' && item.status === 'granted') ? 'granted' : 'not_granted'
  } catch { return 'unknown' }
}

export async function listResumes(signal?: AbortSignal): Promise<{ resumes: ResumeMeta[]; maxVersions: number } | null> {
  try {
    const response = await fetch(`${backend}/api/user/resumes`, { headers: auth(), cache: 'no-store', signal })
    const body = await json(response)
    if (!response.ok || !body || !Array.isArray(body.resumes)) return null
    return { resumes: (body.resumes as unknown[]).map(asMeta).filter((item): item is ResumeMeta => Boolean(item)), maxVersions: Number(body.maxVersions) || MAX_VERSIONS }
  } catch { return null }
}
export async function deleteResume(id: number): Promise<boolean> {
  try { return (await fetch(`${backend}/api/user/resumes/${id}`, { method: 'DELETE', headers: auth() })).ok } catch { return false }
}
// La descarga lleva la sesión: no hay una URL pública de la hoja de vida.
export async function fetchResumeBlob(id: number): Promise<Blob | null> {
  try {
    const response = await fetch(`${backend}/api/user/resumes/${id}/file`, { headers: auth(), cache: 'no-store' })
    return response.ok ? await response.blob() : null
  } catch { return null }
}
