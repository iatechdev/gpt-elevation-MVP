import { createContext } from 'react'
import { interpolate, type Params } from './format'

export type Lang = 'es' | 'en'

export interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  /** Acceso único por clave; `params` sustituye {name}, {n}… */
  t: (key: string, params?: Params) => string
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'es',
  setLang: () => undefined,
  t: (key: string, params?: Params) => interpolate(key, params),
})