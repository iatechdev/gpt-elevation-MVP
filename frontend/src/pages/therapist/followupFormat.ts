// ES-178 (F1): cifras de la ficha en palabras. Una calificación o un ánimo nulos (o fuera de 1-5) no cuentan como 0 ni entran en el divisor; sin valores válidos = null («Sin datos»).
export type MoodRow = { id: number; date: string; checkin_mood: number | null; checkout_mood: number | null }
export type RatingRow = { id: number; date: string; rating: number | null }

const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5
const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null)

/** Promedio de las entradas y salidas válidas (misma regla que el servidor: ES-105/ES-257). */
export const averageMoodOf = (rows: MoodRow[]) => mean(rows.flatMap(row => [row.checkin_mood, row.checkout_mood]).filter(valid))
/** Promedio de las calificaciones válidas (una nula no cuenta como 0). */
export const averageRatingOf = (rows: RatingRow[]) => mean(rows.map(row => row.rating).filter(valid))

/** Cambio entre la entrada y la salida del día, en palabras; null si falta alguno de los dos. */
export const moodChange = (row: MoodRow): 'up' | 'down' | 'same' | null =>
  valid(row.checkin_mood) && valid(row.checkout_mood) ? (row.checkout_mood > row.checkin_mood ? 'up' : row.checkout_mood < row.checkin_mood ? 'down' : 'same') : null

/** E226-1: HOY como fecha de CALENDARIO local (YYYY-MM-DD), no el día UTC: a las 20:00 en Bogotá no es «mañana» ni a la 01:00 en Auckland «ayer». `timeZone` solo lo usan las pruebas. */
export const localToday = (now = Date.now(), timeZone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

export const MAX_HISTORY = 60 // el servidor devuelve como máximo los últimos 60 registros
