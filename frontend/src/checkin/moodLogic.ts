// ES-159 (Hoy): escala de ánimo de cinco palabras y su guardado. El servidor (routes/mood.js, validateBody.score) acepta enteros 1–5:
// la pantalla anterior enviaba 0–4, así que elegir la primera opción devolvía 400 y la pantalla lo ignoraba. Aquí la escala es 1–5 y
// cualquier respuesta que no sea 2xx es un error visible (la respuesta de la persona se conserva).
export const MOOD_VALUES = [1, 2, 3, 4, 5] as const
export type MoodValue = (typeof MOOD_VALUES)[number]
export type SaveResult = 'ok' | 'expired' | 'error'

export const isMood = (value: unknown): value is MoodValue => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
/** Las dos primeras palabras («Cargado», «Bajo») muestran el aviso de apoyo: no clínico, sin diagnóstico. */
export const needsSupport = (value: MoodValue | null): boolean => value === 1 || value === 2

// `import.meta.env` no existe fuera de Vite (pruebas en Node): se lee con tolerancia.
const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {}
export const backendUrl = (env.VITE_BACKEND_URL as string | undefined) ?? (env.DEV ? 'http://localhost:8080' : '')

/** Guarda el registro del día. El servidor hace upsert por (persona, día): reintentar no duplica. 401/403 = sesión vencida. */
export async function saveMood(value: MoodValue, token: string, request: typeof fetch = fetch): Promise<SaveResult> {
  try {
    const res = await request(`${backendUrl}/api/mood/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mood: value }),
    })
    if (res.ok) return 'ok'
    return res.status === 401 || res.status === 403 ? 'expired' : 'error'
  } catch {
    return 'error'
  }
}
