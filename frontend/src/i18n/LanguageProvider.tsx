import { useEffect, useState, type ReactNode } from 'react'
import { LanguageContext, type Lang } from './context'
import { resolveInitialLang } from './resolveLang'
import { es } from './es'
import { en } from './en'

const translations: Record<string, Record<string, string>> = { es, en }

// El almacenamiento puede estar bloqueado (modo privado, datos del sitio bloqueados): la página debe seguir funcionando.
const readSavedLang = () => {
  try { return localStorage.getItem('elv_lang') } catch { return null }
}
const saveLang = (l: Lang) => {
  try { localStorage.setItem('elv_lang', l) } catch { /* sin persistencia */ }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => resolveInitialLang(readSavedLang(), navigator.language))

  // Semántica correcta para lectores de pantalla y traductores: <html lang> sigue al idioma elegido.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    saveLang(l)
  }

  const t = (key: string): string => translations[lang][key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}