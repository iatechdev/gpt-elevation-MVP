// ES-159 (Hoy): servicios de ayuda del aviso de apoyo. Salen de GET /api/contact-entries (ES-193: solo entradas activas con verificación vigente, editables desde Contenido).
// Ningún número va escrito en la pantalla: sin entradas o con error, el aviso es el genérico, sin número.
import { backendUrl } from './moodLogic.ts'

export type ContactEntry = { id: number | string; country: string; name: string; contact: string; description: { es: string; en: string } }
export const DEFAULT_COUNTRY = 'CO'
const COUNTRY = /^[A-Za-z]{2}$/

export const countryFor = (residence: string | null | undefined): string => (residence && COUNTRY.test(residence) ? residence.toUpperCase() : DEFAULT_COUNTRY)

const isEntry = (value: unknown): value is ContactEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  const description = entry.description as Record<string, unknown> | undefined
  return typeof entry.name === 'string' && typeof entry.contact === 'string' && (typeof entry.id === 'number' || typeof entry.id === 'string')
    && !!description && typeof description.es === 'string' && typeof description.en === 'string'
}

export async function loadContactEntries(country: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<ContactEntry[]> {
  const res = await request(`${backendUrl}/api/contact-entries?country=${encodeURIComponent(countryFor(country))}`, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error('contact_entries_failed')
  const data: unknown = await res.json()
  const list = data && typeof data === 'object' ? (data as { entries?: unknown }).entries : undefined
  if (!Array.isArray(list)) throw new Error('contact_entries_shape')
  return list.filter(isEntry)
}
