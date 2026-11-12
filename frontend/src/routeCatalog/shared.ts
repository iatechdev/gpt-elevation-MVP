// ES-172: piezas comunes de las pantallas del catálogo de rutas (persona y administración): sesión, textos, nombres de mercado/idioma y cliente de la API.
import { useEffect, useMemo, useRef, useState } from 'react'
import { catalogApi } from './api'
import { string } from './schema'
import { useLanguage } from '../i18n/useLanguage'

export const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
export const readSession = () => { try { return JSON.stringify([localStorage.getItem('elevation_token') ?? '', localStorage.getItem('elevation_role') ?? '']) } catch { return '["",""]' } }
export function useSession() {
  const [session, setSession] = useState(readSession)
  useEffect(() => { const update = () => setSession(readSession()); window.addEventListener('storage', update); window.addEventListener('focus', update); return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) } }, [])
  return session
}
export function useWords() { const language = useLanguage(); return { ...language, tr: (key: string, params?: Record<string, string | number>) => language.t(`catalog.${key}`, params) } }
// ES-255: mercado (país ISO) e idioma salen con su nombre en el idioma de la pantalla; si el navegador no lo conoce, «Por confirmar» (nunca el código crudo).
export function useNames() {
  const { lang, tr } = useWords()
  return useMemo(() => {
    const make = (type: 'region' | 'language') => { try { return new Intl.DisplayNames([lang], { type }) } catch { return null } }
    const regions = make('region'); const languages = make('language')
    const named = (names: Intl.DisplayNames | null, code: unknown) => { const value = string(code); if (!value || value === 'unknown') return tr('unknown'); try { const out = names?.of(value); return out && out.toLowerCase() !== value.toLowerCase() ? out : tr('unknown') } catch { return tr('unknown') } }
    return { country: (code: unknown) => named(regions, code), language: (code: unknown) => named(languages, code) }
  }, [lang, tr])
}
export function useClient(session: string) {
  const token = (JSON.parse(session) as string[])[0]
  const api = useMemo(() => catalogApi(API, token), [token])
  const live = useRef(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  return { api, current: () => live.current && session === readSession() }
}
