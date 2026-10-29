// ES-90: textos de la landing que esperan un dato real. Nada de esto se inventa: el panel solo dice qué falta y deja el campo listo para pegarlo.
import landingFields from '../../../../shared/landing-content.json' with { type: 'json' }

export type PendingItem = { key: string; label: string; missing: string }
export type Lang = 'es' | 'en'

export const PENDING_ITEMS: readonly PendingItem[] = [
  { key: 'landing.modules.elevation.status', label: 'Estado de Elevation', missing: 'El estado real de Elevation para quien visita (por ejemplo «En piloto» o «Disponible»). Lo confirma el PO.' },
  { key: 'landing.skillmap.routes.continuity.pending', label: 'Ruta de continuidad', missing: 'Fuente verificada, fecha de verificación, barreras y brechas de esta ruta. Salen del catálogo de rutas verificado.' },
  { key: 'landing.skillmap.routes.adjacent.pending', label: 'Ruta adyacente', missing: 'Fuente verificada, fecha de verificación, barreras y brechas de esta ruta. Salen del catálogo de rutas verificado.' },
  { key: 'landing.skillmap.routes.exploratory.pending', label: 'Ruta exploratoria', missing: 'Fuente verificada, fecha de verificación, barreras y brechas de esta ruta. Salen del catálogo de rutas verificado.' },
  { key: 'landing.join.professional_pending', label: 'Alta de profesionales', missing: 'Decisión D-04: si existe el alta con validación de credenciales. Cuando exista, el texto y el destino del botón.' },
]

export const PENDING_KEYS: ReadonlySet<string> = new Set(PENDING_ITEMS.map(item => item.key))

// Texto provisional vigente en el catálogo (el que se ve mientras nadie lo reemplace).
export const provisionalText = (key: string, lang: Lang): string => {
  const entry = (landingFields as { key: string; es: string; en: string }[]).find(field => field.key === key)
  return entry ? entry[lang] : ''
}

export const hasMarker = (value: string): boolean => /\[[^\]]*\]/.test(value)

// Pendiente: vacío, con marcador entre corchetes o igual al texto provisional. Listo: el superadmin lo reemplazó por otro texto.
export const isPending = (key: string, value: string | undefined, lang: Lang): boolean => {
  const text = (value ?? '').trim()
  return !text || hasMarker(text) || text === provisionalText(key, lang).trim()
}

export const countPending = (content: Record<string, string>, lang: Lang) => {
  const pending = PENDING_ITEMS.filter(item => isPending(item.key, content[item.key], lang)).length
  return { pending, ready: PENDING_ITEMS.length - pending }
}
