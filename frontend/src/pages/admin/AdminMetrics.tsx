// frontend/src/pages/admin/AdminMetrics.tsx
// HU-047 + HU-081 — Métricas detalladas de la plataforma
// Fix: componente reconstruido tras ser pisado por commit DT-002

import { useState, useEffect } from 'react'
import { colors, radius, spacing, typography, cardStyle, labelStyle } from '../../styles/tokens'

const API      = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Metrics {
  totalUsers:       number
  activeUsers:      number
  totalTherapists:  number
  totalSessions:    number
  avgMood:          number | null
  avgRating:        number | null
  activeThisWeek:   number
  sessionsByDay:    { date: string; count: number }[]
  topTherapists:    { id: number; name: string; patientCount: number; avgRating: number | null }[]
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

const formatDateFull = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

export function AdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`${API}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setMetrics(data); setLoading(false) })
      .catch(() => { setError('No se pudieron cargar las métricas.'); setLoading(false) })
  }, [])

  if (loading) return (
    <p style={{ color: colors.textMuted, fontSize: 13, fontFamily: typography.fontBody }}>
      Cargando métricas...
    </p>
  )
  if (error) return (
    <p style={{ color: colors.danger, fontSize: 13, fontFamily: typography.fontBody }}>
      {error}
    </p>
  )
  if (!metrics) return null

  const maxCount = Math.max(...metrics.sessionsByDay.map(s => s.count), 1)

  // Calcular tasa de retención (usuarios activos / total)
  const retencion = metrics.totalUsers > 0
    ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100)
    : 0

  // Promedio sesiones por usuario activo
  const sesionesPerUser = metrics.activeUsers > 0
    ? Math.round((metrics.totalSessions / metrics.activeUsers) * 10) / 10
    : 0

  return (
    <div style={{ fontFamily: typography.fontBody }}>

      {/* HEADER */}
      <div style={{ marginBottom: spacing.xxl }}>
        <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 300, fontSize: '1.8rem', color: colors.text, margin: 0 }}>
          Métricas
        </h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>
          Indicadores de rendimiento de la plataforma
        </p>
      </div>

      {/* CARDS PRINCIPALES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.lg, marginBottom: spacing.xxl }}>
        {[
          { label: 'Total usuarios',       value: metrics.totalUsers,      color: colors.text },
          { label: 'Usuarios activos',     value: metrics.activeUsers,     color: colors.primary },
          { label: 'Terapeutas activos',   value: metrics.totalTherapists, color: colors.primary },
          { label: 'Total sesiones',       value: metrics.totalSessions,   color: colors.text },
          { label: 'Activos esta semana',  value: metrics.activeThisWeek,  color: colors.text },
          {
            label: 'Ánimo promedio',
            value: metrics.avgMood != null
              ? `${metrics.avgMood} ${MOOD_EMOJI[Math.round(metrics.avgMood)] ?? ''}`
              : '—',
            color: colors.text,
          },
          {
            label: 'Rating promedio',
            value: metrics.avgRating != null ? `${metrics.avgRating} ★` : '—',
            color: colors.text,
          },
          { label: 'Retención',            value: `${retencion}%`,         color: retencion >= 70 ? colors.success : colors.warning },
          { label: 'Sesiones / usuario',   value: sesionesPerUser,         color: colors.text },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* GRÁFICO DE ACTIVIDAD */}
      <div style={{ ...cardStyle, marginBottom: spacing.xl }}>
        <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>
          Actividad de sesiones — últimos 30 días
        </h2>

        {metrics.sessionsByDay.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Sin datos de sesiones aún.</p>
        ) : (
          <>
            {/* Gráfico de barras */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 120, marginBottom: spacing.sm }}>
              {metrics.sessionsByDay.map(s => (
                <div
                  key={s.date}
                  title={`${formatDateFull(s.date)}: ${s.count} sesión${s.count !== 1 ? 'es' : ''}`}
                  style={{
                    flex: 1,
                    height: `${Math.max((s.count / maxCount) * 100, 6)}%`,
                    background: colors.primary,
                    borderRadius: `${radius.sm} ${radius.sm} 0 0`,
                    opacity: 0.8,
                    cursor: 'default',
                    transition: 'opacity 0.15s, background 0.15s',
                    minWidth: 4,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = colors.primaryDark }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = colors.primary }}
                />
              ))}
            </div>

            {/* Eje X — fechas extremas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textSubtle }}>
              <span>{formatDate(metrics.sessionsByDay[0].date)}</span>
              <span>{formatDate(metrics.sessionsByDay[metrics.sessionsByDay.length - 1].date)}</span>
            </div>

            {/* Resumen del período */}
            <div style={{ display: 'flex', gap: spacing.xl, marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `0.5px solid ${colors.border}` }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text }}>
                  {metrics.sessionsByDay.reduce((a, s) => a + s.count, 0)}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>sesiones en 30 días</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text }}>
                  {Math.round(metrics.sessionsByDay.reduce((a, s) => a + s.count, 0) / 30 * 10) / 10}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>promedio diario</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text }}>
                  {Math.max(...metrics.sessionsByDay.map(s => s.count))}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>pico máximo</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* TOP TERAPEUTAS */}
      <div style={cardStyle}>
        <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>
          Top terapeutas
        </h2>

        {metrics.topTherapists.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Sin terapeutas activos aún.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Terapeuta', 'Pacientes', 'Calificación promedio', 'Nivel'].map(h => (
                  <th key={h} style={{
                    padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left',
                    ...labelStyle, borderBottom: `0.5px solid ${colors.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.topTherapists.map((th, i) => {
                const nivel = th.patientCount >= 5 ? { label: '⭐ Senior', color: colors.warning }
                  : th.patientCount >= 2 ? { label: '✓ Activo', color: colors.success }
                  : { label: '○ Nuevo', color: colors.textSubtle }
                return (
                  <tr key={th.id} style={{ background: i % 2 === 0 ? 'transparent' : colors.bgMuted }}>
                    <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: 13, color: colors.text, fontWeight: 500 }}>
                      {th.name}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: 13, color: colors.text }}>
                      {th.patientCount}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: 13, color: colors.text }}>
                      {th.avgRating != null ? (
                        <span>
                          {'★'.repeat(Math.round(th.avgRating))}
                          <span style={{ color: colors.border }}>{'★'.repeat(5 - Math.round(th.avgRating))}</span>
                          <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>{th.avgRating}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.md}` }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: nivel.color }}>
                        {nivel.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}