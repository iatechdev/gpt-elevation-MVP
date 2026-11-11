export const exerciseFields = ['title', 'purpose', 'question', 'help'] as const
export type ExerciseField = typeof exerciseFields[number]
export type ExerciseLanguage = 'es' | 'en'
export type ExerciseText = Record<ExerciseField, string>
export type ExerciseContent = { es: ExerciseText; en: ExerciseText; minutes: [number, number] | null }
export type ExerciseForm = { es: ExerciseText; en: ExerciseText; minutesMin: string; minutesMax: string }

const emptyText = (): ExerciseText => ({ title: '', purpose: '', question: '', help: '' })
export const emptyExerciseForm = (): ExerciseForm => ({ es: emptyText(), en: emptyText(), minutesMin: '', minutesMax: '' })
const hasControl = (value: string): boolean => Array.from(value).some(char => {
  const code = char.charCodeAt(0)
  return code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0x7f
})

export function formFromContent(content: ExerciseContent): ExerciseForm {
  return {
    es: { ...content.es }, en: { ...content.en },
    minutesMin: content.minutes ? String(content.minutes[0]) : '',
    minutesMax: content.minutes ? String(content.minutes[1]) : '',
  }
}

export type FormError = 'minutes' | 'markup' | 'control' | 'tooLong'
export type FormErrors = Partial<Record<`${ExerciseLanguage}.${ExerciseField}` | 'minutes', FormError>>

export function validateExerciseForm(form: ExerciseForm): FormErrors {
  const errors: FormErrors = {}
  const min = form.minutesMin.trim()
  const max = form.minutesMax.trim()
  if ((min || max) && (!/^\d+$/.test(min) || !/^\d+$/.test(max) || Number(min) < 1 || Number(max) > 60 || Number(min) > Number(max))) {
    errors.minutes = 'minutes'
  }
  for (const lang of ['es', 'en'] as const) {
    for (const field of exerciseFields) {
      const value = form[lang][field]
      if (/[<>]/.test(value)) errors[`${lang}.${field}`] = 'markup'
      else if (hasControl(value)) errors[`${lang}.${field}`] = 'control'
      else if (value.trim().length > (field === 'title' ? 120 : 300)) errors[`${lang}.${field}`] = 'tooLong'
    }
  }
  return errors
}

export function contentFromForm(form: ExerciseForm): ExerciseContent {
  if (Object.keys(validateExerciseForm(form)).length) throw new Error('Invalid exercise form')
  const clean = (text: ExerciseText): ExerciseText => ({
    title: text.title.trim(), purpose: text.purpose.trim(), question: text.question.trim(), help: text.help.trim(),
  })
  return {
    es: clean(form.es), en: clean(form.en),
    minutes: form.minutesMin.trim() ? [Number(form.minutesMin), Number(form.minutesMax)] : null,
  }
}

export function exerciseFormChanged(a: ExerciseForm, b: ExerciseForm): boolean {
  return a.minutesMin !== b.minutesMin || a.minutesMax !== b.minutesMax
    || (['es', 'en'] as const).some(lang => exerciseFields.some(field => a[lang][field] !== b[lang][field]))
}
