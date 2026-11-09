// ES-180 (HU-P29) — Tipos y ganchos de /admin/dashboard y /admin/metrics (separados de los componentes para el refresco rápido).
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { colors, radius, spacing, typography } from '../../styles/tokens'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

export interface Metrics {
  totalUsers: number
  activeUsers: number
  totalTherapists: number
  totalSessions: number
  avgMood: number | null
  avgRating: number | null
  activeThisWeek: number
  days30: { date: string; count: number }[]
  total30: number
  max30: number
  dailyAverage30: number
  range: { start: string; end: string; timeZone: string }
  topTherapists: { id: number; name: string; patientCount: number; avgRating: number | null }[]
}

export type Section<T> = ({ status: 'ok' } & T) | { status: 'error' }
export interface AdminAlerts {
  sections: {
    guides: Section<{ count: number; items: { id: number; therapistName: string | null; version: number; createdAt: string }[] }>
    professionalsIncomplete: Section<{ count: number }>
    manifest: Section<{ version: string | null; date: string | null }>
  }
}

// Carga con estado propio y «Reintentar» (nunca se traga el error).
export function useAdminResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getToken()}` }, signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((json) => { setData(json); setState('ok') })
      .catch((e) => { if (e?.name !== 'AbortError') setState('error') })
    return () => controller.abort()
  }, [path, nonce])
  const retry = useCallback(() => { setState('loading'); setNonce((n) => n + 1) }, [])
  return { data, state, retry }
}

export function useFormat() {
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-US' : 'es-CO'
  const number = (n: number, digits = 0) => n.toLocaleString(locale, { maximumFractionDigits: digits })
  // «3,8 de 5» (ES) / «3.8 of 5» (EN). `null` o no numérico = «Sin datos».
  const outOfFive = (n: number | null | undefined, of: string) => (typeof n === 'number' ? `${number(n, 1)} ${of} 5` : null)
  // Las fechas llegan como AAAA-MM-DD en zona Bogotá: se formatean en UTC para que no se corran de día.
  const day = (iso: string, withYear = false) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  return { number, outOfFive, day, locale }
}

export const linkButton: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600, color: colors.primary, background: 'none', border: `0.5px solid ${colors.primary}`,
  borderRadius: radius.sm, padding: `2px ${spacing.md}`, minHeight: 44, cursor: 'pointer', fontFamily: typography.fontBody,
}

