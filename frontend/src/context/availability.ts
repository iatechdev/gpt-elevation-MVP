// ES-122: la disponibilidad semanal se pide y se muestra en HORAS; lo guardado sigue siendo MINUTOS (availabilityMinutesPerWeek):
// el plan de carrera (ES-33) consume ese campo en minutos, así que la unidad guardada no cambia y no hay migración.
export const MAX_HOURS_PER_WEEK = 168 // 7 × 24: 10 080 minutos, el mismo tope del servidor

export type HoursParse = { valid: boolean; minutes: number | null }

// Texto de horas → minutos enteros. Acepta coma o punto decimal y hasta 2 decimales. Vacío = «por confirmar» (null).
export function parseHours(text: string): HoursParse {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return { valid: true, minutes: null }
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(clean)) return { valid: false, minutes: null }
  const hours = Number(clean)
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_HOURS_PER_WEEK) return { valid: false, minutes: null }
  return { valid: true, minutes: Math.round(hours * 60) }
}

// Minutos guardados → texto de horas (hasta 2 decimales, sin ceros de sobra). null o fuera de rango = vacío.
export function minutesToHours(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > MAX_HOURS_PER_WEEK * 60) return ''
  return String(Math.round((minutes / 60) * 100) / 100)
}
