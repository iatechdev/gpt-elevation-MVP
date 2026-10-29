const copy = {
  title: ['Ejercicios opcionales', 'Optional exercises'], intro: ['Puedes elegir uno, omitirlo o cerrar cuando quieras.', 'You can choose one, skip it or close whenever you want.'],
  choose: ['Elegir', 'Choose'], skip: ['Omitir', 'Skip'], back: ['Volver', 'Back'], time: ['Tiempo orientativo: 3–5 minutos, a tu ritmo.', 'Suggested time: 3–5 minutes, at your own pace.'],
  notes: ['Notas opcionales', 'Optional notes'], private: ['Estas notas no se guardan ni se comparten.', 'These notes are not saved or shared.'],
  copy: ['Copiar mis notas', 'Copy my notes'], clipboard: ['Se copiarán al portapapeles de este dispositivo.', 'They will be copied to this device’s clipboard.'],
  copying: ['Copiando…', 'Copying…'], copied: ['Copiado al portapapeles', 'Copied to clipboard'], copy_error: ['No pudimos copiar. Puedes seleccionar tus notas y copiarlas manualmente.', 'We could not copy. You can select your notes and copy them manually.'],
  close: ['Cerrar ejercicio', 'Close exercise'], return: ['Volver al ejercicio', 'Back to exercise'], discard: ['Cerrar sin guardar', 'Close without saving'], leave: ['Las notas se perderán al cerrar.', 'Closing will discard your notes.'],
  closed: ['Lo dejamos aquí. Puedes volver cuando quieras.', 'We can stop here. You can return whenever you want.'], unavailable: ['Los ejercicios aún no están disponibles.', 'Exercises are not available yet.'],
  ai: ['Asistente de IA', 'AI assistant'], review: ['Contenido en revisión. No habilitado para el piloto.', 'Content under review. Not enabled for the pilot.'],
  language: ['Idioma de pantalla', 'Display language'], skip_content: ['Saltar al contenido', 'Skip to content'],
} as const
export const exerciseEs: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([key, value]) => [`exercise.${key}`, value[0]]))
export const exerciseEn: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([key, value]) => [`exercise.${key}`, value[1]]))
