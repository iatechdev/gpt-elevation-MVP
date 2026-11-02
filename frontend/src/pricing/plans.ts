export type Plan = {
  id: number; slug: string | null; name_es: string; name_en: string
  description_es: string; description_en: string; features_es: string[]; features_en: string[]
  priceCents: number; currency: string; period: 'month' | 'year'; isHighlighted: boolean; order: number
}
export class PlansError extends Error {
  status: number
  constructor(status = 503) { super('Plans request failed'); this.status = status }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
export function planIntent(search: string): number | null {
  const values = new URLSearchParams(search).getAll('plan')
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null
  const id = Number(values[0])
  return positiveId(id) ? id : null
}
export const planDestination = (search: string) => { const id = planIntent(search); return id ? `/pricing?plan=${id}` : null }
export function accessParams(register: boolean, id: number | null): Record<string, string> {
  return { ...(register ? { mode: 'register' } : {}), ...(id ? { plan: String(id) } : {}) }
}
export const planLogin = (id: number) => `/login?${new URLSearchParams(accessParams(true, id))}`
export function priceCents(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) throw new PlansError()
  const [whole, fraction = ''] = String(value).split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
const text = (value: unknown, blank = false): value is string => typeof value === 'string' && value.length <= 5000 && (blank || !!value.trim())
export function parsePlans(value: unknown): Plan[] {
  if (!Array.isArray(value) || value.length > 1000) throw new PlansError()
  const ids = new Set<number>()
  const result = value.map(raw => {
    if (!object(raw) || !positiveId(raw.id) || ids.has(raw.id)
      || !text(raw.name_es) || !text(raw.name_en)
      || (raw.description_es != null && !text(raw.description_es, true)) || (raw.description_en != null && !text(raw.description_en, true))
      || ![raw.features_es, raw.features_en].every(list => Array.isArray(list) && list.length <= 100 && list.every(item => text(item)))
      || typeof raw.currency !== 'string' || !Intl.supportedValuesOf('currency').includes(raw.currency)
      || !['month', 'year'].includes(String(raw.period)) || typeof raw.isHighlighted !== 'boolean'
      || !Number.isSafeInteger(raw.order) || (raw.slug !== null && !text(raw.slug))) throw new PlansError()
    ids.add(raw.id)
    return { ...raw, description_es: raw.description_es ?? '', description_en: raw.description_en ?? '', priceCents: priceCents(raw.price) } as unknown as Plan
  })
  return result.sort((a, b) => a.order - b.order || a.id - b.id)
}
async function json(url: string, options: RequestInit = {}) {
  const timeout = new AbortController()
  const abort = () => timeout.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const timer = setTimeout(abort, 8000)
  try {
    const response = await fetch(url, { ...options, cache: 'no-store', signal: timeout.signal })
    if (!response.ok) throw new PlansError(response.status)
    return { status: response.status, data: await response.json() as unknown }
  } catch (error) { if (error instanceof PlansError) throw error; throw new PlansError() }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) }
}
export async function readPlans(base: string, signal?: AbortSignal) {
  const result = await json(`${base}/api/plans`, { signal })
  if (result.status !== 200) throw new PlansError()
  return parsePlans(result.data)
}
export type PendingRequest = { id: number; planId: number; status: 'pending' }
function pending(value: unknown): PendingRequest {
  if (!object(value) || !positiveId(value.id) || !positiveId(value.planId) || value.status !== 'pending') throw new PlansError()
  return { id: value.id, planId: value.planId, status: 'pending' }
}
export async function readPending(base: string, token: string, signal?: AbortSignal): Promise<PendingRequest | null> {
  const result = await json(`${base}/api/plan-requests/me`, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (result.status !== 200 || !object(result.data) || !Object.hasOwn(result.data, 'request')) throw new PlansError()
  return result.data.request === null ? null : pending(result.data.request)
}
export async function requestPlan(base: string, token: string, planId: number): Promise<PendingRequest> {
  if (!positiveId(planId)) throw new PlansError(400)
  const result = await json(`${base}/api/plan-requests`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) })
  if (result.status !== 201 || !object(result.data)) throw new PlansError()
  const value = pending(result.data.request)
  if (value.planId !== planId) throw new PlansError()
  return value
}
export function displayPrice(plan: Plan, lang: 'es' | 'en', free: string) {
  return plan.priceCents === 0 ? free : `${new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', { minimumFractionDigits: plan.priceCents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(plan.priceCents / 100)} ${plan.currency}`
}
