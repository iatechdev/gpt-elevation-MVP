// ES-172: lógica PURA de la vista de la persona del catálogo de rutas (sin React): filtros, fechas, estados con palabra + símbolo y nombres de habilidad.
import { array, object, string, type Data } from './schema'

export type Lang = 'es' | 'en'
export type Filters = { market: string; context: string; language: string }
export type Tone = 'ok' | 'wait' | 'bad' | 'neutral'
/** Estado de un dato: el símbolo y la palabra (clave de texto) acompañan al color; nunca solo el color. */
export type StatusView = { tone: Tone; symbol: string; key: string }

const LOCALE: Record<Lang, string> = { es: 'es-CO', en: 'en' }

/** Filtra los roles por mercado, contexto editorial e idioma del ROL (no de sus recursos). Un filtro vacío no restringe. */
export function filterRoles(roles: Data[], filters: Filters): Data[] {
  return roles.filter(role => (!filters.market || role.market === filters.market)
    && (!filters.context || array(role.contexts).includes(filters.context))
    && (!filters.language || array(role.languagesRequired).includes(filters.language)))
}

/** Fecha legible en el idioma de la pantalla. Acepta `AAAA-MM-DD` o una marca ISO; algo que no es una fecha devuelve null (la pantalla dice «Por confirmar»). */
export function dateText(value: unknown, lang: Lang): string | null {
  const raw = string(value).trim()
  if (!raw) return null
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const date = day ? new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12)) : new Date(raw) // mediodía UTC: ningún huso corre el día
  if (Number.isNaN(date.getTime())) return null
  if (day && (date.getUTCFullYear() !== Number(day[1]) || date.getUTCMonth() !== Number(day[2]) - 1 || date.getUTCDate() !== Number(day[3]))) return null // 2026-02-30 no existe
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

/** Estado de una oferta: vigente (comprobada), vencida o sin verificar. */
export function offerStatus(status: unknown): StatusView {
  if (status === 'current') return { tone: 'ok', symbol: '✓', key: 'checked' }
  if (status === 'expired') return { tone: 'bad', symbol: '⚠', key: 'expired' }
  return { tone: 'wait', symbol: '?', key: 'unverified' }
}

/** Base de la afirmación sobre la exposición a IA de una tarea: con fuente, hipótesis o no se sabe. */
export function exposureStatus(status: unknown): StatusView {
  if (status === 'sourced') return { tone: 'ok', symbol: '✓', key: 'sourced' }
  if (status === 'hypothesis') return { tone: 'wait', symbol: '?', key: 'hypothesis' }
  return { tone: 'neutral', symbol: '–', key: 'unknown' }
}

/** Lo que dice la tarjeta de la lista sobre la ficha: requiere verificación de una persona experta o consulta las fechas y fuentes. */
export function roleNotice(role: Data): StatusView {
  return role.verificationTask === true ? { tone: 'wait', symbol: '⚑', key: 'verificationTask' } : { tone: 'neutral', symbol: 'ℹ', key: 'sources_current' }
}

/** Una fuente sin fecha de consulta no se inventa: «Por confirmar». */
export const sourceNotice = (source: Data): StatusView | null => (source.stale === true ? { tone: 'bad', symbol: '⚠', key: 'stale' } : null)

/**
 * Nombres de habilidad desde la respuesta de `GET /api/skill-map` (decisión D1=B de ES-172, con condiciones de privacidad): SOLO las etiquetas en el idioma activo.
 * Nada más del mapa se lee ni se guarda (ni niveles, ni evidencias, ni rúbricas). Cualquier forma inesperada → mapa vacío (la pantalla dice «Capacidad por confirmar»).
 */
export function skillLabels(body: unknown, lang: Lang): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of array(object(body).skills)) {
    const skill = object(entry); const key = string(skill.skillKey); const label = string(object(skill.labels)[lang]).trim()
    if (key && label) out.set(key, label)
  }
  return out
}
