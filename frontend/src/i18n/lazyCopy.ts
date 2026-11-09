// ES-232: textos de pantalla que NO viajan en el arranque. Cada pantalla perezosa registra su catálogo al evaluarse su módulo (import con efecto),
// es decir, ANTES de que se pinte por primera vez: sin parpadeos de clave cruda ni texto vacío. `t()` consulta primero los diccionarios del arranque,
// luego este registro y después el catálogo completo descargado (ES-154).
import type { Lang } from './context'

const registered: Record<Lang, Record<string, string>> = { es: {}, en: {} }

/** Añade un catálogo (es, en) al registro. Idempotente: registrar dos veces lo mismo no cambia nada. */
export function registerCopy(es: Record<string, string>, en: Record<string, string>): void {
  Object.assign(registered.es, es)
  Object.assign(registered.en, en)
}

export const lazyText = (lang: Lang, key: string): string | undefined => registered[lang][key]
