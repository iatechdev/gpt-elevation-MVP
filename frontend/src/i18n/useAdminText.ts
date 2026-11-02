import { useCallback } from 'react'
import { useLanguage } from './useLanguage'
import { adminText } from './adminCopy'
export function useAdminText() {
  const { lang } = useLanguage()
  return useCallback((value: string) => adminText(value, lang), [lang])
}
