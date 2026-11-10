// ES-254: textos de «Tu progreso» (/app/progress). Sin emojis ni estrellas: la escala 1–5 se dice «N de 5»; en el historial el ánimo lleva además una palabra.
// La tendencia es una palabra (no color de alarma) y compara solo la entrada y la salida de UNA sesión. No es una medición de salud.
import { registerCopy } from '../i18n/lazyCopy.ts'

export const progressEs: Record<string, string> = {
  pr_back: 'Volver al chat', pr_title: 'Tu progreso', pr_period: 'Últimos 30 días',
  pr_note: 'Estas cifras son un registro tuyo. No son una medición de salud ni un diagnóstico.',
  pr_loading: 'Cargando tu progreso…', pr_error: 'No se pudo cargar tu progreso.', pr_retry: 'Reintentar',
  pr_stat_sessions: 'Sesiones totales', pr_stat_mood: 'Ánimo promedio', pr_stat_rating: 'Calificación promedio', pr_stat_streak: 'Racha actual',
  pr_of5: '{n} de 5', pr_day: 'día', pr_days: 'días',
  pr_mood_title: 'Historial emocional', pr_mood_empty: 'Aún no hay registros.', pr_in: 'Al entrar', pr_out: 'Al salir',
  pr_mood_1: 'muy bajo', pr_mood_2: 'bajo', pr_mood_3: 'medio', pr_mood_4: 'alto', pr_mood_5: 'muy alto',
  pr_up: 'Subió', pr_same: 'Igual', pr_down: 'Bajó',
  pr_ratings_title: 'Calificaciones', pr_ratings_empty: 'Aún no hay calificaciones.',
}
export const progressEn: Record<string, string> = {
  pr_back: 'Back to chat', pr_title: 'Your progress', pr_period: 'Last 30 days',
  pr_note: 'These figures are your own record. They are not a health measurement or a diagnosis.',
  pr_loading: 'Loading your progress…', pr_error: 'Could not load your progress.', pr_retry: 'Retry',
  pr_stat_sessions: 'Total sessions', pr_stat_mood: 'Average mood', pr_stat_rating: 'Average rating', pr_stat_streak: 'Current streak',
  pr_of5: '{n} of 5', pr_day: 'day', pr_days: 'days',
  pr_mood_title: 'Emotional history', pr_mood_empty: 'No records yet.', pr_in: 'On arrival', pr_out: 'On leaving',
  pr_mood_1: 'very low', pr_mood_2: 'low', pr_mood_3: 'medium', pr_mood_4: 'high', pr_mood_5: 'very high',
  pr_up: 'Went up', pr_same: 'Stayed the same', pr_down: 'Went down',
  pr_ratings_title: 'Session ratings', pr_ratings_empty: 'No ratings yet.',
}
registerCopy(progressEs, progressEn)
