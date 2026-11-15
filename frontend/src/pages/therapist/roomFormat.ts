// ES-179: ayudas puras de la sala del profesional (sin emojis; el tiempo se calcula desde el inicio que registró el SERVIDOR).
/** Segundos desde `startedAt` (ISO del servidor) hasta `now`; 0 si falta o es inválido (nunca negativo). */
export const elapsedSeconds = (startedAt: string | null | undefined, now = Date.now()) => {
  if (!startedAt) return 0
  const start = Date.parse(startedAt)
  return Number.isNaN(start) ? 0 : Math.max(0, Math.floor((now - start) / 1000))
}

/** «mm:ss» o «h:mm:ss». */
export const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Hito alcanzado (no un evento puntual: sobrevive a una pestaña dormida). El temporizador NO se anuncia cada segundo: solo al llegar a «quedan 5 minutos» y a la duración prevista, y a demanda. */
export const milestone = (seconds: number, plannedMinutes: number | null): 'five_left' | 'planned' | null => {
  if (!plannedMinutes || plannedMinutes <= 0) return null
  const planned = plannedMinutes * 60
  if (seconds >= planned) return 'planned'
  if (plannedMinutes > 5 && seconds >= planned - 300) return 'five_left'
  return null
}

/** Identificador de reintento idempotente del autoguardado (el servidor acepta 8-64 caracteres [A-Za-z0-9_-]). */
export const newRequestId = () => {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export const MIN_CLOSING = 10
export const MAX_CLOSING = 4000
export const MAX_LIVE = 20000
export const MOODS = [1, 2, 3, 4, 5] as const
