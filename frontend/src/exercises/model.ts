// ES-170: forma del ejercicio que sirve GET /api/exercises (ES-194) y validación del cliente. Una respuesta con otra forma se trata como error (nunca se pinta a medias).
export type ExerciseText = { title: string; purpose: string; question: string; help: string }
export type Exercise = { key: string; minutes: [number, number] | null; es: ExerciseText; en: ExerciseText; reviewStatus: string; version: number }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is ExerciseText => object(value) && ['title', 'purpose', 'question', 'help'].every(field => typeof value[field] === 'string' && (value[field] as string).trim() !== '')

export function parseExercise(value: unknown): Exercise | null {
  if (!object(value) || typeof value.key !== 'string' || !/^[a-z][a-z0-9_]{2,47}$/.test(value.key) || !text(value.es) || !text(value.en) || typeof value.reviewStatus !== 'string') return null
  const minutes = Array.isArray(value.minutes) && value.minutes.length === 2 && value.minutes.every(item => Number.isInteger(item) && (item as number) > 0) ? [value.minutes[0], value.minutes[1]] as [number, number] : null
  return { key: value.key, minutes, es: value.es, en: value.en, reviewStatus: value.reviewStatus, version: Number.isInteger(value.version) ? value.version as number : 0 }
}
export function parseExercises(value: unknown): Exercise[] | null {
  if (!Array.isArray(value)) return null
  const rows = value.map(parseExercise)
  return rows.every(Boolean) ? rows as Exercise[] : null
}
