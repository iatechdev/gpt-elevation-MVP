import { useState, type ReactNode } from 'react'
import { LanguageContext, type Lang } from './context'
import { es } from './es'
import { en } from './en'

const translations: Record<string, Record<string, string>> = { es, en }

export function LanguageProvider({ children }: { children: ReactNode }) {
  const saved = localStorage.getItem('elv_lang')
  const browser: Lang = navigator.language.startsWith('en') ? 'en' : 'es'
  const initial: Lang = saved === 'en' ? 'en' : saved === 'es' ? 'es' : browser

  const [lang, setLangState] = useState<Lang>(initial)

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('elv_lang', l)
  }

  const t = (key: string): string => translations[lang][key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}