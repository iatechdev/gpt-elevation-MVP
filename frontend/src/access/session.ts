export type SessionInfo = { role: 'user' | 'admin' | 'superadmin' | 'therapist' | 'board'; onboardingCompleted: boolean }
export type SessionResult = { status: 'verified'; session: SessionInfo; preferredLanguage?: 'es' | 'en' } | { status: 'invalid' | 'unavailable' }
const roles = ['user', 'admin', 'superadmin', 'therapist', 'board']

export function participantEntry(session: SessionInfo, context: {
  completedAt: string | null; context: { preferredLanguage: 'es' | 'en' | null } | null
}): SessionResult {
  const language = context.context?.preferredLanguage
  if ((context.completedAt !== null && (typeof context.completedAt !== 'string' || !Number.isFinite(Date.parse(context.completedAt)) || !language))
    || (language != null && language !== 'es' && language !== 'en')) throw new Error('Invalid context entry')
  return { status: 'verified', session: { ...session, onboardingCompleted: context.completedAt !== null }, preferredLanguage: language ?? undefined }
}

export function isSessionInfo(value: unknown): value is SessionInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return typeof data.role === 'string' && roles.includes(data.role) && typeof data.onboardingCompleted === 'boolean'
}

export function sessionDestination(session: SessionInfo): string {
  switch (session.role) {
    case 'admin': case 'superadmin': return '/admin/dashboard'
    case 'therapist': return '/therapist/dashboard'
    case 'board': return '/board/manifest'
    case 'user': return session.onboardingCompleted ? '/app/dashboard' : '/app/onboarding'
    default: throw new Error('Unsupported session role')
  }
}

export const registrationRequested = (search: string) => new URLSearchParams(search).get('mode') === 'register'
export const readStoredToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }

export function invalidateStoredSession(expected: string) {
  // A delayed 401 must never erase a newer login performed in this or another tab.
  if (readStoredToken() !== expected) return
  try { for (const key of ['elevation_token', 'elevation_role', 'elevation_name']) localStorage.removeItem(key) } catch { /* unavailable storage */ }
  window.dispatchEvent(new Event('elevation-session-change'))
}

export async function readVerifiedSession({ baseUrl = '', token, signal, timeoutMs = 8000 }: {
  baseUrl?: string; token: string; signal?: AbortSignal; timeoutMs?: number
}): Promise<SessionResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(`${baseUrl}/api/session`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
    })
    if ([401, 403].includes(response.status)) return { status: 'invalid' }
    if (response.status !== 200) return { status: 'unavailable' }
    const value: unknown = await response.json()
    if (!isSessionInfo(value) || Object.keys(value).length !== 2) return { status: 'unavailable' }
    return { status: 'verified', session: value }
  } catch { return { status: 'unavailable' } }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}

export function authFailureKey(status: number, data: { error?: string; locked?: boolean; deactivated?: boolean; code?: string }, registering: boolean): string {
  if (data.locked === true || status === 423) return 'landing.access.locked'
  if (status === 429) return 'landing.access.rate_limit'
  if (data.code === 'deletion_pending') return 'landing.access.deletion_pending'
  if (data.deactivated || data.error?.startsWith('Cuenta inactiva.')) return 'landing.access.inactive'
  if (registering && status === 400 && data.error === 'El correo ya está registrado.') return 'landing.access.duplicate'
  if (status === 401) return 'landing.access.credentials'
  if (status === 400) return 'landing.access.invalid'
  return 'landing.access.failed'
}
