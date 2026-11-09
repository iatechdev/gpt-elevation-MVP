import { positiveId } from '../pricing/plans.ts'
import { SpaceError } from './api.ts'
// ES-174: lee el plan propio (GET /api/user/plan/me). Solo lo que la pantalla muestra; sin la forma esperada es un error, no se inventa un plan.
export type Current = { id: number; name_es: string; name_en: string }
export function parseCurrent(value: unknown): Current | null {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'plan')) throw new SpaceError(502)
  const plan = (value as { plan: unknown }).plan
  if (plan === null) return null
  if (!plan || typeof plan !== 'object') throw new SpaceError(502)
  const p = plan as Record<string, unknown>
  if (!positiveId(p.id) || typeof p.name_es !== 'string' || typeof p.name_en !== 'string' || !p.name_es.trim() || !p.name_en.trim()) throw new SpaceError(502)
  return { id: p.id, name_es: p.name_es, name_en: p.name_en }
}
