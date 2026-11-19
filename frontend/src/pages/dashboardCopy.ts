// ES-329 (Inicio): textos de «Mi panel» (/app/dashboard) que antes se decidían con `lang === 'es' ? … : …` dentro del componente.
// El contenido NO cambia salvo el vocabulario aprobado (12331): «terapeuta» → «profesional». Sin emojis ni estrellas: el ánimo y la calificación se dicen con «N de 5» y una palabra.
import { registerCopy } from '../i18n/lazyCopy.ts'

export const dashboardEs: Record<string, string> = {
  dash_title: 'Mi panel',
  dash_mood_title: 'Estado emocional', dash_arrive: '¿Cómo llegas hoy?', dash_register: 'Registrar mi estado', dash_checked: '✓ Ya registraste tu estado de hoy',
  dash_progress: 'Tu progreso', dash_sessions_week: 'sesiones esta semana', dash_trend: 'Tendencia emocional',
  dash_upcoming: 'Próxima sesión', dash_live: 'Sesión en curso', dash_with: 'Con', dash_join: 'Entrar a la videollamada', dash_soon: 'La sesión está por comenzar',
  dash_link_later: 'El enlace estará disponible cuando el profesional inicie la sesión', dash_no_session: 'Tu profesional aún no ha agendado una sesión.', dash_find_pro: 'Buscar mi profesional',
  dash_chat_select: 'Selecciona cómo llegas hoy para comenzar tu conversación.',
  dash_plan: 'Mi plan', dash_plan_basic: 'Básico', dash_free: 'Gratis', dash_month: 'mes', dash_ai_day: 'Mensajes IA / día', dash_sessions_month: 'Sesiones / mes', dash_see_plans: 'Ver planes →',
  dash_recs: 'Recomendaciones para ti', dash_recs_generate: 'Generar nuevas', dash_recs_empty: 'Aún no tienes recomendaciones. ¡Genera las primeras!', dash_explore: 'Explorar →', dash_close: 'Cerrar',
  // ES-332: aviso de error por tarjeta (la lectura falló; nunca se pinta un «0» como dato). «Reintentar» y «Cargando…» reutilizan pr_retry y loading.
  dash_err_session: 'No se pudo cargar tu próxima sesión.', dash_err_plan: 'No se pudo cargar tu plan.', dash_err_recs: 'No se pudieron cargar tus recomendaciones.',
}
export const dashboardEn: Record<string, string> = {
  dash_title: 'My dashboard',
  dash_mood_title: 'Emotional state', dash_arrive: 'How are you arriving today?', dash_register: 'Log my state', dash_checked: '✓ Check-in done for today',
  dash_progress: 'Your progress', dash_sessions_week: 'sessions this week', dash_trend: 'Emotional trend',
  dash_upcoming: 'Upcoming session', dash_live: 'Session live', dash_with: 'With', dash_join: 'Join videocall', dash_soon: 'Session starting soon',
  dash_link_later: 'Link will be available when your professional starts the session', dash_no_session: 'Your professional has not scheduled a session yet.', dash_find_pro: 'Find my professional',
  dash_chat_select: 'Select how you’re arriving today to start your conversation.',
  dash_plan: 'My plan', dash_plan_basic: 'Basic', dash_free: 'Free', dash_month: 'month', dash_ai_day: 'AI messages / day', dash_sessions_month: 'Sessions / month', dash_see_plans: 'View plans →',
  dash_recs: 'Recommendations for you', dash_recs_generate: 'Generate new', dash_recs_empty: 'No recommendations yet. Generate your first ones!', dash_explore: 'Explore →', dash_close: 'Close',
  dash_err_session: 'We could not load your next session.', dash_err_plan: 'We could not load your plan.', dash_err_recs: 'We could not load your recommendations.',
}
registerCopy(dashboardEs, dashboardEn)
