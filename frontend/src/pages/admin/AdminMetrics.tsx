// frontend/src/pages/admin/AdminMetrics.tsx
import { useState, useEffect } from 'react'
import { colors, radius, shadow, cardStyle, labelStyle, spacing, typography } from '../../styles/tokens'

const API = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'
const token = () => localStorage.getItem('elevation_token') ?? ''

type Metrics = {
  totalUsers: number
  activeUsers: number
  totalTherapists: number
  totalSessions: number
  avgMood: number | null
  avgRating: number | null
  activeThisWeek: number
  sessionsByDay: { date: string; count: number }[]
  topTherapists: { id: number; name: string; patientCount: number; avgRating: number | null }[]
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊'
}

function Bar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{
          width: '100%',
          height: `${Math.max(pct, 4)}%`,
          background: colors.primary,
          borderRadius: `${radius.sm} ${radius.sm} 0 0`,
          opacity: 0.85,
        }} />
      </div>
      <span style={{ fontSize: 10, color: colors.textMuted }}>{count}</span>
    </div>
  )
}

export function AdminMetrics() {
  const [data, setData]       = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch(`${API}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('No se pudieron cargar las métricas.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div>
      <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.8rem', color: colors.text, marginBottom: '0.25rem' }}>Métricas</h1>
      <p style={{ fontSize: '0.875rem', color: colors.textMuted }}>Cargando...</p>
    </div>
  )

  if (error || !data) return (
    <div>
      <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.8rem', color: colors.text, marginBottom: '0.25rem' }}>Métricas</h1>
      <p style={{ fontSize: '0.875rem', color: colors.danger }}>{error || 'Sin datos.'}</p>
    </div>
  )

  const maxCount = Math.max(...data.sessionsByDay.map(d => d.count), 1)
  const moodEmoji = data.avgMood ? MOOD_EMOJI[Math.round(data.avgMood)] ?? '😐' : '—'

  return (
    <div>
      <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.8rem', color: colors.text, marginBottom: '0.25rem' }}>
        Métricas
      </h1>
      <p style={{ fontSize: '0.875rem', color: colors.textMuted, marginBottom: '1.5rem' }}>
        Resumen de actividad de la plataforma
      </p>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.md, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total usuarios',    value: data.totalUsers },
          { label: 'Usuarios activos',  value: data.activeUsers },
          { label: 'Terapeutas',        value: data.totalTherapists },
          { label: 'Total sesiones',    value: data.totalSessions },
          { label: 'Activos esta semana', value: data.activeThisWeek },
          { label: 'Ánimo promedio',    value: data.avgMood ? `${data.avgMood} ${moodEmoji}` : '—' },
          { label: 'Calificación prom.', value: data.avgRating ? `${data.avgRating} ★` : '—' },
        ].map(k => (
          <div key={k.label} style={{
            background: colors.bgCard,
            borderRadius: radius.lg,
            border: `0.5px solid ${colors.border}`,
            boxShadow: shadow.card,
            padding: `${spacing.lg} ${spacing.xl}`,
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 500, color: colors.text }}>{k.value}</div>
            <div style={{ ...labelStyle, marginTop: spacing.xs }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Actividad últimos 30 días */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <p style={{ ...labelStyle, marginBottom: spacing.lg }}>Actividad — últimos 30 días</p>
        {data.sessionsByDay.length === 0 ? (
          <p style={{ fontSize: 13, color: colors.textMuted }}>Sin actividad registrada.</p>
        ) : (
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 100 }}>
            {data.sessionsByDay.map(d => (
              <Bar key={d.date} count={d.count} max={maxCount} />
            ))}
          </div>
        )}
      </div>

      {/* Top terapeutas */}
      <div style={{ ...cardStyle }}>
        <p style={{ ...labelStyle, marginBottom: spacing.lg }}>Top terapeutas</p>
        {data.topTherapists.length === 0 ? (
          <p style={{ fontSize: 13, color: colors.textMuted }}>Sin terapeutas registrados.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Terapeuta', 'Pacientes', 'Calificación'].map(h => (
                  <th key={h} style={{ ...labelStyle, textAlign: 'left', padding: `${spacing.sm} ${spacing.md}`, borderBottom: `0.5px solid ${colors.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topTherapists.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? colors.bgCard : colors.bgMuted }}>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.text, fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textMuted }}>{t.patientCount}</td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textMuted }}>
                    {t.avgRating ? `${t.avgRating} ★` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}