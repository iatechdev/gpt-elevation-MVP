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
  pr_skip: 'Saltar al contenido', pr_find_pro: 'Encontrar profesional', pr_new: 'Nueva', pr_go_checkin: 'Ir al registro',
  pr_rec_title: 'Recomendaciones', pr_rec_cat_mindfulness: 'Atención plena', pr_rec_cat_habit: 'Hábito', pr_rec_cat_reflection: 'Reflexión', pr_rec_cat_resource: 'Recurso', pr_rec_cat_other: 'Recomendación',
  pr_m_title_q: 'Encuentra tu profesional', pr_m_title_r: 'Opciones para ti', pr_m_title_ok: 'Solicitud enviada', pr_m_area: '¿En qué área quieres trabajar?', pr_m_style: '¿Qué estilo prefieres?', pr_m_lang: 'Idioma preferido para las sesiones', pr_m_select: 'Selecciona…',
  pr_a_anxiety: 'Estrés y carga', pr_a_depression: 'Depresión', pr_a_relationships: 'Relaciones', pr_a_growth: 'Crecimiento personal', pr_a_stress: 'Manejo del estrés', pr_a_other: 'Otro',
  pr_s_reflective: 'Reflexivo y exploratorio', pr_s_structured: 'Estructurado con objetivos', pr_s_empathetic: 'Empático y de escucha', pr_s_any: 'Cualquier estilo',
  pr_l_es: 'Español', pr_l_en: 'Inglés', pr_l_none: 'Sin preferencia',
  pr_m_search: 'Encontrar mi profesional', pr_m_searching: 'Buscando…', pr_m_intro: 'Según tus respuestas, estas son las opciones:', pr_m_choose: 'Elegir a este profesional', pr_m_back: 'Volver al cuestionario', pr_m_close: 'Cerrar',
  pr_m_done: 'Solicitud enviada. Un administrador confirmará tu profesional pronto.', pr_m_conn: 'Error de conexión. Inténtalo de nuevo.', pr_m_error: 'No se pudo completar la solicitud. Inténtalo de nuevo.',
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
  pr_skip: 'Skip to content', pr_find_pro: 'Find a professional', pr_new: 'New', pr_go_checkin: 'Go to check-in',
  pr_rec_title: 'Recommendations', pr_rec_cat_mindfulness: 'Mindfulness', pr_rec_cat_habit: 'Habit', pr_rec_cat_reflection: 'Reflection', pr_rec_cat_resource: 'Resource', pr_rec_cat_other: 'Recommendation',
  pr_m_title_q: 'Find your professional', pr_m_title_r: 'Options for you', pr_m_title_ok: 'Request sent', pr_m_area: 'What area do you want to work on?', pr_m_style: 'What style do you prefer?', pr_m_lang: 'Preferred session language', pr_m_select: 'Select…',
  pr_a_anxiety: 'Stress and workload', pr_a_depression: 'Depression', pr_a_relationships: 'Relationships', pr_a_growth: 'Personal growth', pr_a_stress: 'Stress management', pr_a_other: 'Other',
  pr_s_reflective: 'Reflective and exploratory', pr_s_structured: 'Structured with goals', pr_s_empathetic: 'Empathetic and listening', pr_s_any: 'Any style',
  pr_l_es: 'Spanish', pr_l_en: 'English', pr_l_none: 'No preference',
  pr_m_search: 'Find my professional', pr_m_searching: 'Searching…', pr_m_intro: 'Based on your answers, here are the options:', pr_m_choose: 'Choose this professional', pr_m_back: 'Back to the questionnaire', pr_m_close: 'Close',
  pr_m_done: 'Request sent. An admin will confirm your professional shortly.', pr_m_conn: 'Connection error. Please try again.', pr_m_error: 'The request could not be completed. Please try again.',
}
registerCopy(progressEs, progressEn)
