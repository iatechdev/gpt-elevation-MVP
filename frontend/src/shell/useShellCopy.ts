// ES-153: textos de los marcos en el idioma activo.
import { useLanguage } from '../i18n/useLanguage'
import { shellCopy, type ShellCopy } from './copy'

export const useShellCopy = (): { c: ShellCopy; lang: 'es' | 'en' } => {
  const { lang } = useLanguage()
  const code = lang === 'en' ? 'en' : 'es'
  return { c: shellCopy[code], lang: code }
}
