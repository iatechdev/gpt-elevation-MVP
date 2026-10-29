// ES-90: textos de la landing que esperan un dato real. Nada de esto se inventa: el panel solo dice qué falta y deja el campo listo para pegarlo.
import landingFields from '../../../../shared/landing-content.json' with { type: 'json' }

export type PendingItem = { key: string; label: string; missing: string }
export type Lang = 'es' | 'en'

// ES-94: los textos de Elevation y de las tres rutas pasaron a ser definitivos (se editan en la lista general). La lista queda vacía y el panel no se muestra
// mientras no haya nada pendiente; un texto nuevo que espere un dato real se agrega aquí.
export const PENDING_ITEMS: readonly PendingItem[] = []

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
