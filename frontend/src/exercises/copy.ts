const copy = {
  title: ['Ejercicios opcionales', 'Optional exercises'], intro: ['Puedes elegir uno, omitirlo o cerrar cuando quieras.', 'You can choose one, skip it or close whenever you want.'],
  choose: ['Elegir', 'Choose'], skip: ['Omitir', 'Skip'], back: ['Volver', 'Back'], 
  notes: ['Notas opcionales', 'Optional notes'], private: ['Estas notas no se guardan ni se comparten.', 'These notes are not saved or shared.'],
  copy: ['Copiar mis notas', 'Copy my notes'], clipboard: ['Se copiarán al portapapeles de este dispositivo.', 'They will be copied to this device’s clipboard.'],
  copying: ['Copiando…', 'Copying…'], copied: ['Copiado al portapapeles', 'Copied to clipboard'], copy_error: ['No pudimos copiar. Puedes seleccionar tus notas y copiarlas manualmente.', 'We could not copy. You can select your notes and copy them manually.'],
  close: ['Cerrar ejercicio', 'Close exercise'], return: ['Volver al ejercicio', 'Back to exercise'], discard: ['Cerrar sin guardar', 'Close without saving'], leave: ['Las notas se perderán al cerrar.', 'Closing will discard your notes.'],
  closed: ['Lo dejamos aquí. Puedes volver cuando quieras.', 'We can stop here. You can return whenever you want.'],
  loading: ['Cargando ejercicios…', 'Loading exercises…'], empty: ['Aún no hay ejercicios publicados.', 'No exercises are published yet.'],
  load_error: ['No pudimos cargar los ejercicios.', 'We could not load the exercises.'], retry: ['Reintentar', 'Retry'],
  gone: ['Este ejercicio ya no está disponible.', 'This exercise is no longer available.'],
  time_range: ['Tiempo orientativo: {a}–{b} minutos, a tu ritmo.', 'Suggested time: {a}–{b} minutes, at your own pace.'],
  ai: ['Asistente de IA', 'AI assistant'], review: ['Contenido en revisión: aún no lo ha revisado una persona especialista.', 'Content under review: a specialist has not reviewed it yet.'],
  language: ['Idioma de pantalla', 'Display language'], skip_content: ['Saltar al contenido', 'Skip to content'],
} as const
export const exerciseEs: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([key, value]) => [`exercise.${key}`, value[0]]))
export const exerciseEn: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([key, value]) => [`exercise.${key}`, value[1]]))
