// ES-121: fuentes del análisis con IA de El Puente (chat, diario y hoja de vida). Lógica pura: permisos, errores y conversión de propuestas en insights.
// Una propuesta es una HIPÓTESIS con una frase de la propia persona como cita; nada de esto se guarda hasta que ella autoriza cada insight (flujo de ES-25).
import { fieldKeys } from '../compass/model.ts'
import type { FieldKey } from '../compass/model.ts'
import type { Insight, SourceId } from './logic.ts'

export const sourceIds: readonly SourceId[] = ['chat', 'diary', 'resume']
export const purposeOf: Record<SourceId, string> = { chat: 'insights_chat', diary: 'insights_diary', resume: 'insights_resume' }
const originTypeOf = { chat: 'chat_turn', diary: 'diary_entry', resume: 'resume_version' } as const

export type Failure = 'expired' | 'consent' | 'nothing' | 'limit' | 'unavailable' | 'invalid' | 'network'
export const retryable = (failure: Failure) => failure === 'unavailable' || failure === 'invalid' || failure === 'network'

// Mismo mapa que el contrato (docs/elevation-skillmap/45): 403 falta el permiso · 422/404 nada utilizable · 429 límite de IA · 502/503 proveedor.
export function failureOf(status: number, code: string): Failure {
  if (status === 401) return 'expired'
  if (status === 403 && code === 'consent_required') return 'consent'
  if (status === 422 || status === 404) return 'nothing'
  if (status === 429) return 'limit'
  if (status === 502 && code === 'invalid_model_output') return 'invalid'
  if (status === 400) return 'invalid'
  return 'unavailable'
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Solo `granted` autoriza: sin decidir, retirado o con versión anterior = apagado. null si la respuesta no tiene la forma esperada. */
export function parseConsents(value: unknown): Record<SourceId, boolean> | null {
  if (!object(value) || !Array.isArray(value.consents)) return null
  const rows = value.consents.filter(object)
  return Object.fromEntries(sourceIds.map(source => [source, rows.some(row => row.purpose === purposeOf[source] && row.status === 'granted')])) as Record<SourceId, boolean>
}

export type ResumeVersion = { id: number; version: number; createdAt: string }
export function parseResumes(value: unknown): ResumeVersion[] {
  if (!object(value) || !Array.isArray(value.resumes)) return []
  return value.resumes.filter(object)
    .filter(row => Number.isSafeInteger(row.id) && Number(row.id) > 0 && Number.isSafeInteger(row.version) && typeof row.createdAt === 'string')
    .map(row => ({ id: Number(row.id), version: Number(row.version), createdAt: String(row.createdAt) }))
    .sort((a, b) => b.version - a.version)
}

const skillKeyOk = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(value)

/**
 * Convierte la respuesta de `POST /api/insights/proposals` en insights de la pantalla. Lo que no tenga la forma exacta se descarta (nunca se arregla).
 * Cruza solo clave, texto, habilidad y el `id` del origen; la cita es solo para que la persona vea de dónde salió y nunca se envía.
 */
export function proposalsToInsights(value: unknown, source: SourceId, today: string): Insight[] {
  if (!object(value) || !Array.isArray(value.insights)) throw new Error('Invalid proposals')
  const out: Insight[] = []
  value.insights.forEach((item, index) => {
    if (!object(item) || typeof item.key !== 'string' || !fieldKeys.includes(item.key as FieldKey) || typeof item.text !== 'string') return
    const text = item.text.trim()
    if (!text || text.length > 500 || !Array.isArray(item.origins) || item.origins.length < 1 || item.origins.length > 3) return
    const origins = item.origins.filter(object).filter(origin => origin.type === originTypeOf[source] && Number.isSafeInteger(origin.id) && Number(origin.id) > 0 && typeof origin.quote === 'string' && origin.quote.length > 0)
    if (origins.length !== item.origins.length) return
    out.push({
      id: `${source}:${index}`, date: today, status: 'hypothesis', example: false, source, key: item.key as FieldKey, text,
      fragment: origins.map(origin => String(origin.quote)).join(' … '),
      origin: { type: originTypeOf[source], id: Number(origins[0].id) },
      ...(skillKeyOk(item.skillKey) ? { skillKey: item.skillKey } : {}),
    })
  })
  return out
}

/** Reemplaza las propuestas de UNA fuente y conserva las demás. */
export const withSource = (current: Record<SourceId, Insight[]>, source: SourceId, insights: Insight[]): Record<SourceId, Insight[]> => ({ ...current, [source]: insights })
export const emptyProposals = (): Record<SourceId, Insight[]> => ({ chat: [], diary: [], resume: [] })
