// ES-314: UN solo mapa de etiquetas para las respuestas del emparejamiento (catálogo cerrado del servidor: ANSWER_CATALOG de backend/routes/matching.js).
// Lo usan el cuestionario de la persona (ProgressMatching) y la cola del equipo (AdminUsersQueues). El valor enviado al servidor NO cambia: solo cambia lo que se muestra.
// «anxiety» se muestra «Estrés y carga» / «Stress and workload». Un valor fuera del catálogo se muestra tal cual (nunca rompe).
export type AnswerKind = 'area' | 'style' | 'language'

// valor del servidor → clave del texto en el catálogo de progressCopy.ts
export const ANSWER_LABEL_KEYS: Record<AnswerKind, Record<string, string>> = {
  area: {
    anxiety: 'pr_a_anxiety', depression: 'pr_a_depression', relationships: 'pr_a_relationships', 'self-knowledge': 'pr_a_selfknowledge', habits: 'pr_a_habits',
    'personal growth': 'pr_a_growth', stress: 'pr_a_stress', other: 'pr_a_other',
  },
  style: {
    reflective: 'pr_s_reflective', structured: 'pr_s_structured', spiritual: 'pr_s_spiritual', practical: 'pr_s_practical',
    'reflective and exploratory': 'pr_s_reflective', 'structured with goals': 'pr_s_structured', 'empathetic and listening': 'pr_s_empathetic', any: 'pr_s_any',
  },
  language: { es: 'pr_l_es', en: 'pr_l_en', both: 'pr_l_both', Spanish: 'pr_l_es', English: 'pr_l_en', 'No preference': 'pr_l_none' },
}

// Opciones que ofrece el cuestionario [valor enviado, clave]: un subconjunto del catálogo, con el mismo orden de siempre.
export const AREA_OPTIONS: [string, string][] = [['anxiety', 'pr_a_anxiety'], ['depression', 'pr_a_depression'], ['relationships', 'pr_a_relationships'], ['personal growth', 'pr_a_growth'], ['stress', 'pr_a_stress'], ['other', 'pr_a_other']]
export const STYLE_OPTIONS: [string, string][] = [['reflective and exploratory', 'pr_s_reflective'], ['structured with goals', 'pr_s_structured'], ['empathetic and listening', 'pr_s_empathetic'], ['any', 'pr_s_any']]
export const LANGUAGE_OPTIONS: [string, string][] = [['Spanish', 'pr_l_es'], ['English', 'pr_l_en'], ['No preference', 'pr_l_none']]

/** Etiqueta legible de un valor de respuesta. `t` es la función de textos del idioma activo. Desconocido o vacío → el valor tal cual (o «—» si falta). */
export function answerLabel(kind: AnswerKind, value: string | null | undefined, t: (key: string) => string): string {
  if (value === undefined || value === null || value === '') return '—'
  const key = Object.prototype.hasOwnProperty.call(ANSWER_LABEL_KEYS[kind], value) ? ANSWER_LABEL_KEYS[kind][value] : undefined
  if (!key) return String(value)
  const text = t(key)
  return text && text !== key ? text : String(value)
}
