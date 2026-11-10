// ES-169 (PR1): textos de «Mi profesional» (/app/my-therapist). La ruta NO cambia (decisión de Mauricio); cambia el vocabulario de pantalla: «profesional», no «terapeuta».
// El ánimo al terminar se dice con las MISMAS palabras que ya usa el producto (room_t_mood_1..5), sin emojis.
import { registerCopy } from '../i18n/lazyCopy.ts'

export const myProfessionalEs: Record<string, string> = {
  mp_title: 'Mi profesional', mp_back: 'Volver', mp_loading: 'Cargando…',
  mp_load_error: 'No pudimos cargar la información de tu profesional ni de tus sesiones.', mp_retry: 'Reintentar',
  mp_none_title: 'Aún no tienes un profesional asignado', mp_none_desc: 'Encuentra a la persona indicada según tus preferencias.', mp_find: 'Buscar mi profesional',
  mp_profile: 'Perfil', mp_specialties: 'Especialidades', mp_languages: 'Idiomas', mp_approach: 'Enfoque', mp_profile_empty: 'Perfil no completado aún.',
  mp_upcoming: 'Próximas sesiones', mp_upcoming_empty: 'Tu profesional aún no ha agendado una sesión.', mp_join: 'Entrar a videollamada', mp_join_wait: 'Disponible 15 minutos antes',
  mp_past: 'Sesiones anteriores', mp_completed: 'Completada', mp_mood: 'Ánimo al terminar: {word} ({n}/5)', mp_change: '¿Quieres cambiar de profesional?', mp_minutes: '{n} min',
}
export const myProfessionalEn: Record<string, string> = {
  mp_title: 'My professional', mp_back: 'Back', mp_loading: 'Loading…',
  mp_load_error: 'We could not load your professional’s information or your sessions.', mp_retry: 'Try again',
  mp_none_title: 'You don’t have a professional assigned yet', mp_none_desc: 'Find the right person based on your preferences.', mp_find: 'Find my professional',
  mp_profile: 'Profile', mp_specialties: 'Specialties', mp_languages: 'Languages', mp_approach: 'Approach', mp_profile_empty: 'Profile not completed yet.',
  mp_upcoming: 'Upcoming sessions', mp_upcoming_empty: 'Your professional has not scheduled a session yet.', mp_join: 'Join videocall', mp_join_wait: 'Available 15 minutes before',
  mp_past: 'Past sessions', mp_completed: 'Completed', mp_mood: 'Mood at the end: {word} ({n}/5)', mp_change: 'Want to change professional?', mp_minutes: '{n} min',
}
registerCopy(myProfessionalEs, myProfessionalEn)
