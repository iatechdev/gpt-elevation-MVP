// ES-134: los avisos del chat se guardan como clave y se traducen al pintar, para que un cambio de idioma no deje un texto en el idioma anterior.
import { copy } from './copy.ts'
import { SpaceError } from './api.ts'
export type Notice = { k: 'sendError' | 'pending' | 'loadError' | 'contextChanged' | 'confirmed' | 'restored' | 'budgetGeneric' | 'budget'; scope?: string; resetsAt?: string }
type Lang = keyof typeof copy
// El reinicio es un instante: se muestra el día en la zona horaria de la persona (en Bogotá, 00:00 UTC es la tarde del día anterior).
const localDate = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'long' })
export function noticeText(notice: Notice | null, lang: Lang): string {
  if (!notice) return ''
  const c = copy[lang]
  if (notice.k === 'budgetGeneric') return c.budget
  if (notice.k !== 'budget') return c[notice.k]
  // Sin alcance reconocido no se afirma de quién es el límite.
  if (notice.scope !== 'person' && notice.scope !== 'cohort') return c.budget
  const when = notice.resetsAt && Number.isFinite(Date.parse(notice.resetsAt)) ? c.budgetWhen.replace('{date}', localDate(notice.resetsAt, lang)) : c.budgetNoDate
  return [notice.scope === 'cohort' ? c.budgetCohort : c.budgetPerson, when, c.budgetKeep].join(' ')
}
// Qué aviso corresponde a un fallo del envío: el rechazo de presupuesto conserva el alcance (persona o grupo) y la fecha de reinicio que manda el servidor.
export function noticeForError(error: unknown): Notice {
  if (!(error instanceof SpaceError)) return { k: 'sendError' }
  if (error.code === 'ai_budget_exhausted') return { k: 'budget', scope: error.scope, resetsAt: error.resetsAt }
  if (error.code === 'ai_budget_not_configured') return { k: 'budgetGeneric' }
  return { k: error.code === 'turn_in_progress' ? 'pending' : 'sendError' }
}
export const isAlert = (notice: Notice | null) => notice?.k === 'budget' || notice?.k === 'budgetGeneric'
