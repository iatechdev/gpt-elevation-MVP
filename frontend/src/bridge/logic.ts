// ES-111: El Puente. Autorizar un insight = confirmar una versión nueva del contexto aprobado (ES-25) con ese texto añadido a los ya autorizados.
// Revocar uno = confirmar la versión sin él; si no queda ninguno, se revoca la versión activa. Solo cruza el texto: clave y texto, nunca el fragmento del diario.
import { fieldKeys } from '../compass/model.ts'
import type { DirectField, Field, FieldKey } from '../compass/model.ts'

export const MAX_FIELDS = 12
export const MAX_PER_KEY = 3
export type InsightStatus = 'hypothesis' | 'unassessed'
// `example`: dato de ejemplo (interruptor VITE_BRIDGE_INSIGHTS_FIXTURES); nunca viene de una entrada real de la persona.
export type Insight = { id: string; date: string; status: InsightStatus; fragment: string; text: string; key: FieldKey; example: boolean }

const same = (a: Field, b: Field) => a.key === b.key && a.text === b.text
const direct = (field: Field): DirectField => ({ key: field.key, text: field.text, origin: { type: 'direct' } })

// ¿Es la misma lista (mismo orden, misma clave y texto)? Sirve para detectar que otra pestaña cambió el contexto desde que esta pantalla lo cargó.
export const sameFields = (a: readonly Field[], b: readonly Field[]) => a.length === b.length && a.every((field, index) => same(field, b[index]))
export const isCrossed = (active: readonly Field[], insight: Pick<Insight, 'key' | 'text'>) => active.some(field => same(field, insight))
export type Why = 'limit_total' | 'limit_key' | null
// ¿Cabe un insight más? Mismos topes que el servidor (12 en total y 3 por categoría), para avisar antes de pedir la vista previa.
export function whyNot(active: readonly Field[], insight: Pick<Insight, 'key'>): Why {
  if (active.length >= MAX_FIELDS) return 'limit_total'
  if (active.filter(field => field.key === insight.key).length >= MAX_PER_KEY) return 'limit_key'
  return null
}
export function withInsight(active: readonly Field[], insight: Pick<Insight, 'key' | 'text'>): DirectField[] {
  if (!fieldKeys.includes(insight.key)) throw new Error('Invalid key')
  return [...active.map(direct), direct(insight)]
}
export function withoutField(active: readonly Field[], field: Field): DirectField[] {
  return active.filter(item => !same(item, field)).map(direct)
}
export const pending = (insights: readonly Insight[], active: readonly Field[]) => insights.filter(insight => !isCrossed(active, insight))
export const sortInsights = (insights: readonly Insight[]) => [...insights].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))

export const formatDate = (date: string, lang: string) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : date
}
