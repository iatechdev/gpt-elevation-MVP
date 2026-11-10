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

// E210-1: los días se cuentan entre fechas de CALENDARIO (día local), no en bloques de 24 h. Un registro DATEONLY («2026-11-10») es un día, no un instante en UTC:
// a las 20:00 en Bogotá un registro de hoy dice «hoy», y en Auckland uno de ayer dice «hace 1 d». `timeZone` solo lo usan las pruebas (por defecto, la del navegador).
const calendarDay = (instant: number, timeZone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
const dayNumber = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
/** Días desde el último registro (0 = hoy); null si no hay o no es una fecha. */
export const daysSince = (value: string | undefined | null, now = Date.now(), timeZone?: string) => {
  if (!value) return null
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isNaN(Date.parse(value)) ? null : calendarDay(Date.parse(value), timeZone)
  if (day === null || Number.isNaN(dayNumber(day))) return null
  return Math.max(0, dayNumber(calendarDay(now, timeZone)) - dayNumber(day))
}

/** «Ahora»: desde 15 min antes del inicio hasta el final de la sesión. */
export const sessionIsNow = (scheduledAt: string, durationMinutes: number, now = Date.now()) => {
  const diff = new Date(scheduledAt).getTime() - now
  return diff <= 15 * 60 * 1000 && diff >= -durationMinutes * 60 * 1000
}
