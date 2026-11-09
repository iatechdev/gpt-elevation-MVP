// ES-154: sustitución de marcadores, plurales y formatos por idioma. Sin dependencias; usa Intl.
import type { Lang } from './context'

export type Params = Record<string, string | number>

const LOCALE: Record<Lang, string> = { es: 'es-CO', en: 'en-US' }

/** Sustituye {name}, {n}… Un marcador sin valor se deja tal cual (visible en pruebas, nunca «undefined»). */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : match))
}

/** Antepone un espacio de nombres a las claves de un texto de pantalla ('shell.skip'): evita choques entre diccionarios al unificarlos en t(). */
export const prefixed = (prefix: string, texts: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(texts).map(([key, value]) => [prefix + key, value]))

/** Marcadores {x} de un texto, ordenados y sin repetir (para comparar ES y EN). */
export function placeholdersOf(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort()
}

/** Número con la coma decimal de ES y el punto de EN. */
export function formatNumber(value: number, lang: Lang, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE[lang], options).format(value)
}

/** Fecha corta en el idioma activo. Una fecha inválida devuelve cadena vacía (no «Invalid Date»). */
export function formatDate(value: Date | string | number, lang: Lang, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(LOCALE[lang], options).format(date)
}

/** Elige la forma plural del idioma: forms.one / forms.other (ES y EN usan una y otra; 0 es «other»). */
export function pluralForm(count: number, lang: Lang, forms: { one: string; other: string }): string {
  return new Intl.PluralRules(LOCALE[lang]).select(count) === 'one' ? forms.one : forms.other
}
