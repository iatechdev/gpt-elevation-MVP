import { createContext } from 'react'

export type Lang = 'es' | 'en'

export interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'es',
  setLang: () => undefined,
  t: (key: string) => key,
})