// ES-95: envío del formulario público. Nada se guarda en el navegador: ni almacenamiento local, ni cookies, ni la URL.
import type { FieldKey, Values } from './validation'

const backend = import.meta.env.VITE_BACKEND_URL ?? ''

export type SubmitResult =
  | { status: 'ok' }
  | { status: 'invalid'; fields: FieldKey[] }
  | { status: 'rate_limited' }
  | { status: 'network' }
  | { status: 'server' }

const KNOWN: FieldKey[] = ['name', 'email', 'country', 'profession', 'licenseNumber', 'profileUrl', 'message', 'cv', 'consent']

export function buildForm(values: Values, file: File, lang: 'es' | 'en', honeypot = ''): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) if (value.trim()) data.append(key, value.trim())
  data.append('locale', lang); data.append('consent', 'true'); data.append('website', honeypot)
  data.append('cv', file, 'cv.pdf') // el nombre original no viaja
  return data
}

export async function submitApplication(data: FormData): Promise<SubmitResult> {
  try {
    const response = await fetch(`${backend}/api/professional-applications`, { method: 'POST', body: data, cache: 'no-store' })
    if (response.status === 201) return { status: 'ok' }
    if (response.status === 429) return { status: 'rate_limited' }
    if (response.status === 400) {
      const body = await response.json().catch(() => null) as { fields?: unknown } | null
      const fields = Array.isArray(body?.fields) ? body.fields.filter((f): f is FieldKey => KNOWN.includes(f as FieldKey)) : []
      return { status: 'invalid', fields }
    }
    return { status: 'server' }
  } catch { return { status: 'network' } }
}
