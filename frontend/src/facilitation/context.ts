import { createContext, useContext } from 'react'
import type { Command, Snapshot, Fixture } from './fixture'
import { useLanguage } from '../i18n/useLanguage'
import { copy, type TextKey } from './copy'
export const FacilitationContext = createContext<{
  snapshot: Snapshot; service: Fixture; loading: boolean; failure: string; refresh: () => void;
  write: (id: string, command: Command, revision: number, actor: 'reviewer' | 'participant') => Promise<void>;
  dirty: boolean; setDirty: (id: string, value: boolean) => void;
} | null>(null)
export function useFacilitation() {
  const value = useContext(FacilitationContext)
  if (!value) throw new Error('Missing preview context')
  return value
}
export function useCopy() {
  const { lang, setLang } = useLanguage()
  return { lang, setLang, t: (key: TextKey) => copy[lang][`facilitation.${key}`] }
}

