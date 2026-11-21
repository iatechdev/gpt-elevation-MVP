import { useLanguage } from '../i18n/useLanguage'
import { authText, type AuthKey } from './reviewAuthCopy'

export function useAuthCopy() {
  const { lang } = useLanguage()
  return { lang, t: (key: AuthKey, params?: Record<string, string | number>) => authText(lang, key, params) }
}
