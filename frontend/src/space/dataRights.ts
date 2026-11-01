// ES-135: cliente de los derechos de datos de ES-23 (exportar y eliminar la cuenta). Solo la exportación personal: la profesional no está disponible en el servidor.
import { request, SpaceError } from './api.ts'
import { hiddenSections } from './dataCopy.ts'
export type ExportPreview = { id: string; expiresAt: string; sections: { name: string; count: number | null }[] }
export type DataErrorKey = 'unavailable' | 'rate' | 'expired' | 'concurrent' | 'review' | 'pending' | 'session' | 'error'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Nombres y conteos salen del propio archivo; no se muestra su contenido ni se inventan secciones.
export function summarize(data: unknown): ExportPreview['sections'] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data as Record<string, unknown>).filter(([name]) => !hiddenSections.includes(name)).map(([name, value]) => ({ name, count: Array.isArray(value) ? value.length : null }))
}
export async function prepareExport(token: string, locale: 'es' | 'en'): Promise<ExportPreview> {
  const response = await request(token, '/api/exports/preview', { method: 'POST', body: JSON.stringify({ type: 'personal', locale }) }) as { id?: unknown; expiresAt?: unknown; data?: unknown }
  if (typeof response?.id !== 'string' || !UUID.test(response.id) || typeof response.expiresAt !== 'string' || !Number.isFinite(Date.parse(response.expiresAt))) throw new SpaceError(502)
  return { id: response.id, expiresAt: response.expiresAt, sections: summarize(response.data) }
}
// El archivo viaja solo en memoria hacia la descarga: nunca a la URL, a los logs ni al almacenamiento del navegador.
export async function downloadExport(token: string, id: string): Promise<Blob> {
  if (!UUID.test(id)) throw new SpaceError(404, 'export_not_found')
  const data = await request(token, `/api/exports/${id}/download`, { method: 'POST', body: '{}' })
  if (!data || typeof data !== 'object') throw new SpaceError(502)
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}
export async function requestDeletion(token: string): Promise<void> {
  const receipt = await request(token, '/api/account/deletion-requests', { method: 'POST', body: JSON.stringify({ confirm: true }) }) as { id?: unknown }
  if (typeof receipt?.id !== 'string') throw new SpaceError(502)
}
export function dataErrorKey(error: unknown): DataErrorKey {
  if (!(error instanceof SpaceError)) return 'error'
  if (error.status === 401) return 'session'
  if (error.code === 'data_rights_unavailable') return 'unavailable'
  if (error.code === 'rate_limited' || error.status === 429) return 'rate'
  if (error.code === 'export_not_found' || error.status === 404) return 'expired'
  if (error.code === 'concurrent_change') return 'concurrent'
  if (error.code === 'data_review_required') return 'review'
  if (error.code === 'deletion_pending' || error.status === 403) return 'pending'
  return 'error'
}
