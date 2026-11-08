// ES-154: catálogo de textos (fuente: docs/ux/plataforma/textos.json) cargado bajo demanda, un bloque por idioma.
// No va en el bloque de entrada: pesa ~30 kB gzip por idioma y la carga inicial tiene poco margen (npm run build:check).
import type { Lang } from './context'

export type Catalog = Readonly<Record<string, string>>

const loaded: Partial<Record<Lang, Catalog>> = {}
const pending: Partial<Record<Lang, Promise<void>>> = {}
const listeners = new Set<() => void>()

export const getCatalog = (lang: Lang): Catalog | undefined => loaded[lang]

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Descarga el idioma una sola vez. Si falla, la interfaz sigue con los diccionarios que ya tiene (no se rompe la pantalla). */
export function loadCatalog(lang: Lang): Promise<void> {
  if (loaded[lang]) return Promise.resolve()
  pending[lang] ??= (lang === 'es' ? import('./catalog/es.json') : import('./catalog/en.json'))
    .then(module => { loaded[lang] = module.default as Catalog; listeners.forEach(listener => listener()) })
    .catch(() => { delete pending[lang] })
  return pending[lang]
}
