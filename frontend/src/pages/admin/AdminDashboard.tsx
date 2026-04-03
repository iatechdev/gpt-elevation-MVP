// frontend/src/pages/admin/AdminDashboard.tsx
// HU-047 + HU-063 — Executive metrics dashboard + panel alertas

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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

// HU-063 — Alert types
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

  // HU-063
  const [alerts, setAlerts]           = useState<AdminAlerts | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API}/api/admin/metrics`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setMetrics(await res.json())
      } catch {
        setError('Could not load metrics.')
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  // HU-063 — fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API}/api/admin/usuarios/alerts`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setAlerts(await res.json())
      } catch {
        // non-blocking
      } finally {
        setAlertsLoading(false)
      }
    }
    fetchAlerts()
  }, [])

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#78716C',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) return <p style={{ color: '#78716C', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>Loading metrics...</p>
  if (error)   return <p style={{ color: '#DC2626', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>{error}</p>
  if (!metrics) return null

  const maxCount = Math.max(...metrics.sessionsByDay.map(s => s.count), 1)
  const totalAlerts = (alerts?.pendingPrompts ?? 0) + (alerts?.therapistsWithoutProfile ?? 0)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
          Platform overview
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total users',      value: metrics.totalUsers },
          { label: 'Active users',     value: metrics.activeUsers },
          { label: 'Therapists',       value: metrics.totalTherapists },
          { label: 'Total sessions',   value: metrics.totalSessions },
          { label: 'Active this week', value: metrics.activeThisWeek },
          {
            label: 'Avg mood',
            value: metrics.avgMood != null
              ? `${metrics.avgMood} ${MOOD_EMOJI[Math.round(metrics.avgMood)] ?? ''}`
              : '—',
          },
          {
            label: 'Avg rating',
            value: metrics.avgRating != null ? `${metrics.avgRating} ★` : '—',
          },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#78716C', marginTop: '0.2rem' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* HU-063 — TWO COLUMN LAYOUT: charts + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

        {/* COLUMNA IZQUIERDA — charts + top therapists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ACTIVITY CHART */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1.25rem' }}>
              Session activity — last 30 days
            </h2>
            {metrics.sessionsByDay.length === 0 ? (
              <p style={{ color: '#78716C', fontSize: '0.875rem' }}>No session data yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 80 }}>
                {metrics.sessionsByDay.map(s => (
                  <div
                    key={s.date}
                    title={`${s.date}: ${s.count} session${s.count !== 1 ? 's' : ''}`}
                    style={{
                      flex: 1,
                      height: `${Math.max((s.count / maxCount) * 100, 8)}%`,
                      background: '#6B7D5C',
                      borderRadius: '3px 3px 0 0',
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
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1.25rem' }}>
              Top therapists
            </h2>
            {metrics.topTherapists.length === 0 ? (
              <p style={{ color: '#78716C', fontSize: '0.875rem' }}>No therapists yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Therapist', 'Patients', 'Avg rating'].map(h => (
                      <th key={h} style={{
                        padding: '0.5rem 0.75rem', textAlign: 'left',
                        fontSize: '0.72rem', fontWeight: 600, color: '#78716C',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: '0.5px solid #E7E5E4',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.topTherapists.map((th, i) => (
                    <tr key={th.id} style={{ background: i % 2 === 0 ? 'transparent' : '#F5F3EF' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.875rem', color: '#1C1917' }}>{th.name}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.875rem', color: '#1C1917' }}>{th.patientCount}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.875rem', color: '#1C1917' }}>
                        {th.avgRating != null ? `${th.avgRating} ★` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA — HU-063 ALERTS PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>

          {/* Panel alertas */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={sectionLabel}>🔔 Alerts</div>
              {totalAlerts > 0 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                  {totalAlerts}
                </span>
              )}
            </div>

            {alertsLoading ? (
              <p style={{ fontSize: '0.82rem', color: '#78716C', margin: 0 }}>Loading...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Alerta 1 — Prompts pendientes */}
                <div style={{
                  padding: '0.75rem', borderRadius: '0.65rem',
                  background: alerts?.pendingPrompts ?? 0 > 0 ? '#FEF3C7' : '#F5F3EF',
                  border: `0.5px solid ${alerts?.pendingPrompts ?? 0 > 0 ? '#FCD34D' : '#E7E5E4'}`,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: alerts?.pendingPrompts ?? 0 > 0 ? '#92400E' : '#78716C', marginBottom: '0.2rem' }}>
                    ⚠️ {alerts?.pendingPrompts ?? 0} pending prompt{(alerts?.pendingPrompts ?? 0) !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: alerts?.pendingPrompts ?? 0 > 0 ? '#92400E' : '#A8A29E', marginBottom: '0.5rem' }}>
                    Awaiting ethical review
                  </div>
                  <button
                    onClick={() => navigate('/admin/prompts')}
                    style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', background: 'none', border: '0.5px solid #6B7D5C', borderRadius: '0.5rem', padding: '0.2rem 0.6rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    Review →
                  </button>
                </div>

                {/* Alerta 2 — Terapeutas sin perfil */}
                <div style={{
                  padding: '0.75rem', borderRadius: '0.65rem',
                  background: alerts?.therapistsWithoutProfile ?? 0 > 0 ? '#E0F2FE' : '#F5F3EF',
                  border: `0.5px solid ${alerts?.therapistsWithoutProfile ?? 0 > 0 ? '#7DD3FC' : '#E7E5E4'}`,
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: alerts?.therapistsWithoutProfile ?? 0 > 0 ? '#0369A1' : '#78716C', marginBottom: '0.2rem' }}>
                    ℹ️ {alerts?.therapistsWithoutProfile ?? 0} therapist{(alerts?.therapistsWithoutProfile ?? 0) !== 1 ? 's' : ''} without profile
                  </div>
                  <div style={{ fontSize: '0.72rem', color: alerts?.therapistsWithoutProfile ?? 0 > 0 ? '#0369A1' : '#A8A29E', marginBottom: '0.5rem' }}>
                    TherapistProfile incomplete
                  </div>
                  <button
                    onClick={() => navigate('/admin/usuarios?role=therapist')}
                    style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', background: 'none', border: '0.5px solid #6B7D5C', borderRadius: '0.5rem', padding: '0.2rem 0.6rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    Review →
                  </button>
                </div>

                {/* Alerta 3 — Manifiesto Ético */}
                <div style={{
                  padding: '0.75rem', borderRadius: '0.65rem',
                  background: '#EAF0E6', border: '0.5px solid #A8B5A2',
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4A6741', marginBottom: '0.2rem' }}>
                    ℹ️ Ethical Manifesto
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#4A6741' }}>
                    {alerts?.manifestoVersion ?? 'v1.0'} — active since {alerts?.manifestoDate ? formatDate(alerts.manifestoDate) : '02 Apr 2026'}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Lista prompts pendientes */}
          {(alerts?.pendingPromptsList?.length ?? 0) > 0 && (
            <div style={cardStyle}>
              <div style={sectionLabel}>📋 Pending prompts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {alerts!.pendingPromptsList.map(p => (
                  <div key={p.id} style={{
                    padding: '0.65rem 0.75rem',
                    background: '#FEF3C7',
                    borderRadius: '0.65rem',
                    border: '0.5px solid #FCD34D',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400E' }}>
                      {p.therapistName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#92400E', marginTop: '0.1rem' }}>
                      v{p.version} — {formatDate(p.createdAt)}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/admin/prompts')}
                  style={{ fontSize: '0.75rem', color: '#6B7D5C', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', padding: '0.2rem 0' }}
                >
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