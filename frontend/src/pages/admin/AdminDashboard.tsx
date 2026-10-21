// frontend/src/pages/admin/AdminDashboard.tsx
// HU-047 + HU-063 — Executive metrics dashboard + panel alertas
// HU-076 — Usa design tokens

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { colors, radius, spacing, typography, cardStyle, labelStyle } from '../../styles/tokens'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Metrics {
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

interface PendingPrompt {
  id: number
  therapistName: string
  version: number
  proposedBy: string
  createdAt: string
}

interface AdminAlerts {
  pendingPrompts: number
  pendingPromptsList: PendingPrompt[]
  therapistsWithoutProfile: number
  manifestoVersion: string
  manifestoDate: string
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [alerts, setAlerts]           = useState<AdminAlerts | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setMetrics(data); setLoading(false) })
      .catch(() => { setError('Could not load metrics.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetch(`${API}/api/admin/usuarios/alerts`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setAlerts(data); setAlertsLoading(false) })
      .catch(() => setAlertsLoading(false))
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) return <p style={{ color: colors.textMuted, fontSize: '0.875rem', fontFamily: typography.fontBody }}>Cargando métricas...</p>
  if (error)   return <p style={{ color: colors.danger,    fontSize: '0.875rem', fontFamily: typography.fontBody }}>{error}</p>
  if (!metrics) return null

  const maxCount  = Math.max(...metrics.sessionsByDay.map(s => s.count), 1)
  const totalAlerts = (alerts?.pendingPrompts ?? 0) + (alerts?.therapistsWithoutProfile ?? 0)

  return (
    <div style={{ fontFamily: typography.fontBody }}>

      {/* HEADER */}
      <div style={{ marginBottom: spacing.xxl }}>
        <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 300, fontSize: '1.8rem', color: colors.text, margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: `${spacing.xs} 0 0` }}>
          Resumen de la plataforma
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.lg, marginBottom: spacing.xxl }}>
        {[
          { label: 'Total usuarios',      value: metrics.totalUsers },
          { label: 'Usuarios activos',    value: metrics.activeUsers },
          { label: 'Terapeutas',          value: metrics.totalTherapists },
          { label: 'Total sesiones',      value: metrics.totalSessions },
          { label: 'Activos esta semana', value: metrics.activeThisWeek },
          {
            label: 'Ánimo promedio',
            value: metrics.avgMood != null
              ? `${metrics.avgMood} ${MOOD_EMOJI[Math.round(metrics.avgMood)] ?? ''}`
              : '—',
          },
          {
            label: 'Calificación promedio',
            value: metrics.avgRating != null ? `${metrics.avgRating} ★` : '—',
          },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, color: colors.text }}>{card.value}</div>
            <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: spacing.xs }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: spacing.xl, alignItems: 'start' }}>

        {/* COLUMNA IZQUIERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>

          {/* ACTIVITY CHART */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>
              Actividad — últimos 30 días
            </h2>
            {metrics.sessionsByDay.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: '0.875rem' }}>Sin datos de sesiones aún.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 80 }}>
                {metrics.sessionsByDay.map(s => (
                  <div
                    key={s.date}
                    title={`${s.date}: ${s.count} sesión${s.count !== 1 ? 'es' : ''}`}
                    style={{
                      flex: 1,
                      height: `${Math.max((s.count / maxCount) * 100, 8)}%`,
                      background: colors.primary,
                      borderRadius: `${radius.sm} ${radius.sm} 0 0`,
                      opacity: 0.75,
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* TOP THERAPISTS */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.1rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>
              Top terapeutas
            </h2>
            {metrics.topTherapists.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: '0.875rem' }}>Sin terapeutas aún.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Terapeuta', 'Pacientes', 'Calificación'].map(h => (
                      <th key={h} style={{
                        padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left',
                        ...labelStyle, borderBottom: `0.5px solid ${colors.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.topTherapists.map((th, i) => (
                    <tr key={th.id} style={{ background: i % 2 === 0 ? 'transparent' : colors.bgMuted }}>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: '0.875rem', color: colors.text }}>{th.name}</td>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: '0.875rem', color: colors.text }}>{th.patientCount}</td>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, fontSize: '0.875rem', color: colors.text }}>
                        {th.avgRating != null ? `${th.avgRating} ★` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA — ALERTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, position: 'sticky', top: spacing.xl }}>

          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <div style={labelStyle}>🔔 Alertas</div>
              {totalAlerts > 0 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: colors.dangerLight, color: colors.danger, padding: `2px ${spacing.sm}`, borderRadius: radius.full }}>
                  {totalAlerts}
                </span>
              )}
            </div>

            {alertsLoading ? (
              <p style={{ fontSize: '0.82rem', color: colors.textMuted, margin: 0 }}>Cargando...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>

                {/* Prompts pendientes */}
                <div style={{
                  padding: spacing.md, borderRadius: radius.md,
                  background: (alerts?.pendingPrompts ?? 0) > 0 ? colors.warningLight : colors.bgMuted,
                  border: `0.5px solid ${(alerts?.pendingPrompts ?? 0) > 0 ? '#FCD34D' : colors.border}`,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: (alerts?.pendingPrompts ?? 0) > 0 ? colors.warning : colors.textMuted, marginBottom: '0.2rem' }}>
                    ⚠️ {alerts?.pendingPrompts ?? 0} prompt{(alerts?.pendingPrompts ?? 0) !== 1 ? 's' : ''} pendiente{(alerts?.pendingPrompts ?? 0) !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: (alerts?.pendingPrompts ?? 0) > 0 ? colors.warning : colors.textSubtle, marginBottom: spacing.sm }}>
                    Esperando revisión ética
                  </div>
                  <button
                    onClick={() => navigate('/admin/prompts')}
                    style={{ fontSize: '0.72rem', fontWeight: 600, color: colors.primary, background: 'none', border: `0.5px solid ${colors.primary}`, borderRadius: radius.sm, padding: `2px ${spacing.sm}`, cursor: 'pointer', fontFamily: typography.fontBody }}>
                    Revisar →
                  </button>
                </div>

                {/* Terapeutas sin perfil */}
                <div style={{
                  padding: spacing.md, borderRadius: radius.md,
                  background: (alerts?.therapistsWithoutProfile ?? 0) > 0 ? colors.infoLight : colors.bgMuted,
                  border: `0.5px solid ${(alerts?.therapistsWithoutProfile ?? 0) > 0 ? '#7DD3FC' : colors.border}`,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: (alerts?.therapistsWithoutProfile ?? 0) > 0 ? colors.info : colors.textMuted, marginBottom: '0.2rem' }}>
                    ℹ️ {alerts?.therapistsWithoutProfile ?? 0} terapeuta{(alerts?.therapistsWithoutProfile ?? 0) !== 1 ? 's' : ''} sin perfil
                  </div>
                  <div style={{ fontSize: '0.72rem', color: (alerts?.therapistsWithoutProfile ?? 0) > 0 ? colors.info : colors.textSubtle, marginBottom: spacing.sm }}>
                    TherapistProfile incompleto
                  </div>
                  <button
                    onClick={() => navigate('/admin/usuarios?role=therapist')}
                    style={{ fontSize: '0.72rem', fontWeight: 600, color: colors.primary, background: 'none', border: `0.5px solid ${colors.primary}`, borderRadius: radius.sm, padding: `2px ${spacing.sm}`, cursor: 'pointer', fontFamily: typography.fontBody }}>
                    Revisar →
                  </button>
                </div>

                {/* Manifiesto ético */}
                <div style={{
                  padding: spacing.md, borderRadius: radius.md,
                  background: colors.successLight, border: `0.5px solid #A8B5A2`,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: colors.success, marginBottom: '0.2rem' }}>
                    ✅ Manifiesto Ético
                  </div>
                  <div style={{ fontSize: '0.72rem', color: colors.success }}>
                    {alerts?.manifestoVersion ?? 'v1.0'} — activo desde {alerts?.manifestoDate ? formatDate(alerts.manifestoDate) : '02 abr 2026'}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Lista prompts pendientes */}
          {(alerts?.pendingPromptsList?.length ?? 0) > 0 && (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: spacing.md }}>📋 Prompts pendientes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {alerts!.pendingPromptsList.map(p => (
                  <div key={p.id} style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.warningLight,
                    borderRadius: radius.md,
                    border: `0.5px solid #FCD34D`,
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: colors.warning }}>{p.therapistName}</div>
                    <div style={{ fontSize: '0.72rem', color: colors.warning, marginTop: '0.1rem' }}>v{p.version} — {formatDate(p.createdAt)}</div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/admin/prompts')}
                  style={{ fontSize: '0.75rem', color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontBody, padding: `${spacing.xs} 0` }}>
                  Ver todos →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}