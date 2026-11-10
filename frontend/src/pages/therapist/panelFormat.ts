// ES-177 (B1): cifras del panel profesional en palabras. Sin emojis ni estrellas; «sin datos» es null, nunca 0 ni «—».
import type { PersonRef } from './panelText'

export type PanelPerson = PersonRef & {
  id: number
  active: boolean
  sharing?: boolean
  avgRating: number | null
  trend: 'improving' | 'stable' | 'declining' | null
  sessionsThisWeek: number
  totalSessions: number
  lastMood: { checkin_mood: number | null; checkout_mood: number | null; date: string } | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null)

/** Solo cuentan quienes comparten: el servidor ya manda null para el resto, aquí además se excluye por `sharing === false`. */
export const sharedOnly = (people: PanelPerson[]) => people.filter(p => p.sharing !== false)
export const activeThisWeek = (people: PanelPerson[]) => sharedOnly(people).filter(p => p.sessionsThisWeek > 0).length
export const averageMood = (people: PanelPerson[]) =>
  mean(sharedOnly(people).map(p => p.lastMood?.checkin_mood).filter((m): m is number => m != null))
export const averageRating = (people: PanelPerson[]) =>
  mean(sharedOnly(people).map(p => p.avgRating).filter((r): r is number => r != null))

/** Días desde el último registro (0 = hoy); null si no hay. */
export const daysSince = (iso: string | undefined | null, now = Date.now()) => {
  if (!iso) return null
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / 86400000))
}

/** «Ahora»: desde 15 min antes del inicio hasta el final de la sesión. */
export const sessionIsNow = (scheduledAt: string, durationMinutes: number, now = Date.now()) => {
  const diff = new Date(scheduledAt).getTime() - now
  return diff <= 15 * 60 * 1000 && diff >= -durationMinutes * 60 * 1000
}
