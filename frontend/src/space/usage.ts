// ES-112: uso de IA de la propia persona (GET /api/ai/usage, ES-22). Solo se muestra lo que el servidor calcula: porcentaje del periodo y fecha de renovación.
// Nunca un conteo de mensajes ni de tokens inventado; sin límite definido (V-12 provisional) no hay barra.
export class UsageError extends Error { constructor() { super('Invalid usage response') } }

export type Usage = { configured: false } | { configured: true; limit: number; used: number; resetsAt: string }
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

export function parseUsage(value: unknown): Usage {
  if (!value || typeof value !== 'object') throw new UsageError()
  const u = value as Record<string, unknown>
  if (u.configured === false) return { configured: false }
  if (u.configured !== true || !count(u.limit) || u.limit < 1 || !count(u.used) || typeof u.resetsAt !== 'string' || !Number.isFinite(Date.parse(u.resetsAt))) throw new UsageError()
  return { configured: true, limit: u.limit, used: u.used, resetsAt: u.resetsAt }
}
export const usedPercent = (u: Extract<Usage, { configured: true }>) => Math.min(100, Math.round((u.used / u.limit) * 100))
export const isExhausted = (u: Usage) => u.configured && u.used >= u.limit
export const renewalDate = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'long', timeZone: 'UTC' })
