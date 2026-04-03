// frontend/src/pages/admin/AdminDashboard.tsx
// HU-047 — Executive metrics dashboard

import { useState, useEffect } from 'react'

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

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API}/api/admin/metrics`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setMetrics(data)
      } catch {
        setError('Could not load metrics.')
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  if (loading) return <p style={{ color: '#78716C', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>Loading metrics...</p>
  if (error)   return <p style={{ color: '#DC2626', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>{error}</p>
  if (!metrics) return null

  const maxCount = Math.max(...metrics.sessionsByDay.map(s => s.count), 1)

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
          { label: 'Total users',       value: metrics.totalUsers },
          { label: 'Active users',      value: metrics.activeUsers },
          { label: 'Therapists',        value: metrics.totalTherapists },
          { label: 'Total sessions',    value: metrics.totalSessions },
          { label: 'Active this week',  value: metrics.activeThisWeek },
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

      {/* ACTIVITY CHART */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
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
  )
}