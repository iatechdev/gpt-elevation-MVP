// HU-046 + HU-049 + HU-062 — Therapist dashboard with patient list + prompt management + trend badges

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Patient {
  id: number
  name: string
  email: string
  active: boolean
  createdAt: string
  totalSessions: number
  sessionsThisWeek: number
  avgRating: number | null
  moodTrend: 'up' | 'down' | 'neutral'
  trend: 'improving' | 'stable' | 'declining' | null  // HU-062
  lastMood: {
    checkin_mood: number | null
    checkout_mood: number | null
    date: string
  } | null
}

interface PromptData {
  hasPrompt: boolean
  content: string | null
  active: {
    id: number
    version: number
    approved_by: string
    approved_at: string
  } | null
  pending: {
    id: number
    version: number
    proposed_by: string
    createdAt: string
  } | null
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

// HU-062 — Badge config
const TREND_BADGE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  improving: { label: 'Improving',  bg: '#EAF0E6', color: '#4A6741', icon: '📈' },
  stable:    { label: 'Stable',     bg: '#E0F2FE', color: '#0369A1', icon: '📊' },
  declining: { label: 'Declining',  bg: '#FEE2E2', color: '#DC2626', icon: '📉' },
}

export function TherapistDashboard() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [promptData, setPromptData]       = useState<PromptData | null>(null)
  const [promptLoading, setPromptLoading] = useState(true)
  const [showPromptSection, setShowPromptSection] = useState(false)
  const [showProposeModal, setShowProposeModal]   = useState(false)
  const [newPromptContent, setNewPromptContent]   = useState('')
  const [proposing, setProposing]     = useState(false)
  const [proposeError, setProposeError]   = useState('')
  const [proposeSuccess, setProposeSuccess] = useState('')

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/pacientes`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setPatients(data)
      } catch {
        setError('Could not load your patients.')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const res = await fetch(`${API}/api/therapist/prompt`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setPromptData(data)
      } catch {
        // non-blocking
      } finally {
        setPromptLoading(false)
      }
    }
    fetchPrompt()
  }, [])

  const handleProposePrompt = async () => {
    setProposeError('')
    setProposeSuccess('')
    if (newPromptContent.trim().length < 50) {
      setProposeError('Prompt must be at least 50 characters.')
      return
    }
    setProposing(true)
    try {
      const res = await fetch(`${API}/api/therapist/prompt/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: newPromptContent }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProposeError(data.error || 'Error submitting prompt.')
        return
      }
      setProposeSuccess('Prompt submitted for review. A superadmin will approve it shortly.')
      setNewPromptContent('')
      const refreshRes = await fetch(`${API}/api/therapist/prompt`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (refreshRes.ok) setPromptData(await refreshRes.json())
      setTimeout(() => { setShowProposeModal(false); setProposeSuccess('') }, 2500)
    } catch {
      setProposeError('Connection error.')
    } finally {
      setProposing(false)
    }
  }

  const activeThisWeek = patients.filter(p => p.sessionsThisWeek > 0).length
  const avgMoodAll = (() => {
    const moods = patients.map(p => p.lastMood?.checkin_mood).filter((m): m is number => m != null)
    return moods.length > 0
      ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
      : null
  })()
  const avgRatingAll = (() => {
    const ratings = patients.map(p => p.avgRating).filter((r): r is number => r != null)
    return ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  })()

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
          My Patients
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
          {patients.length} patient{patients.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total patients',     value: patients.length },
          { label: 'Active this week',   value: activeThisWeek },
          { label: 'Avg mood',           value: avgMoodAll ?? '—' },
          { label: 'Avg session rating', value: avgRatingAll ? `${avgRatingAll} ★` : '—' },
        ].map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.25rem' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* HU-049 — MY THERAPEUTIC PROMPT */}
      {!promptLoading && (
        <div style={{ ...cardStyle, marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPromptSection ? '1rem' : 0 }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                My Therapeutic Prompt
              </div>
              <div style={{ fontSize: '0.82rem', color: '#1C1917', marginTop: '0.2rem' }}>
                {promptData?.active
                  ? `Active v${promptData.active.version} — Approved ${formatDate(promptData.active.approved_at)}`
                  : 'No active prompt yet'}
                {promptData?.pending && (
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    v{promptData.pending.version} pending review
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowPromptSection(!showPromptSection)}
                style={{ padding: '0.45rem 0.85rem', background: 'transparent', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#78716C', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {showPromptSection ? 'Hide' : 'View current'}
              </button>
              {!promptData?.pending && (
                <button
                  onClick={() => { setShowProposeModal(true); setNewPromptContent(promptData?.content ?? '') }}
                  style={{ padding: '0.45rem 0.85rem', background: '#6B7D5C', border: 'none', borderRadius: '0.65rem', fontSize: '0.78rem', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                >
                  {promptData?.hasPrompt ? 'Propose new version' : 'Create prompt'}
                </button>
              )}
            </div>
          </div>

          {showPromptSection && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
              {promptData?.content
                ? <p style={{ fontSize: '0.875rem', color: '#1C1917', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{promptData.content}</p>
                : <p style={{ fontSize: '0.875rem', color: '#78716C', margin: 0, fontStyle: 'italic' }}>No active prompt. Create one to personalize how Elevation AI interacts with your patients.</p>
              }
            </div>
          )}
        </div>
      )}

      {/* LOADING / ERROR */}
      {loading && <p style={{ color: '#78716C', fontSize: '0.875rem' }}>Loading patients...</p>}
      {error   && <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>}

      {/* PATIENT LIST */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {patients.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#78716C', fontSize: '0.875rem' }}>
              No patients assigned yet.
            </div>
          ) : (
            patients.map(p => {
              const lastMoodValue = p.lastMood?.checkout_mood ?? p.lastMood?.checkin_mood ?? null
              const daysSince = p.lastMood
                ? Math.floor((Date.now() - new Date(p.lastMood.date).getTime()) / (1000 * 60 * 60 * 24))
                : null
              const trendBadge = p.trend ? TREND_BADGE[p.trend] : null  // HU-062

              return (
                <div key={p.id} style={{
                  ...cardStyle,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '1rem', flexWrap: 'wrap', opacity: p.active ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', background: '#EAF0E6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', fontWeight: 600, color: '#6B7D5C', flexShrink: 0,
                    }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + mood info */}
                    <div>
                      <div style={{ fontWeight: 500, color: '#1C1917', fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {lastMoodValue != null && (
                          <span style={{ fontSize: '0.85rem' }}>{MOOD_EMOJI[lastMoodValue] ?? '—'}</span>
                        )}
                        {daysSince != null && (
                          <span style={{ fontSize: '0.75rem', color: '#78716C' }}>
                            {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`}
                          </span>
                        )}
                        {/* HU-062 — Badge de tendencia */}
                        {trendBadge && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: trendBadge.bg,
                            color: trendBadge.color,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}>
                            {trendBadge.icon} {trendBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: '#78716C' }}>
                    <span>{p.totalSessions} session{p.totalSessions !== 1 ? 's' : ''}</span>
                    {p.avgRating != null && (
                      <span>{'★'.repeat(Math.round(p.avgRating))}{'☆'.repeat(5 - Math.round(p.avgRating))} {p.avgRating}</span>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => navigate(`/therapist/patient/${p.id}`)}
                    style={{
                      padding: '0.5rem 1.1rem', background: 'transparent',
                      border: '0.5px solid #6B7D5C', borderRadius: '0.85rem',
                      color: '#6B7D5C', fontSize: '0.82rem', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                    }}
                  >
                    View history
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* PROPOSE PROMPT MODAL */}
      {showProposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                {promptData?.hasPrompt ? 'Propose new prompt version' : 'Create therapeutic prompt'}
              </h2>
              <button
                onClick={() => { setShowProposeModal(false); setProposeError(''); setProposeSuccess('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C' }}
              >✕</button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#78716C', marginBottom: '1rem', lineHeight: 1.5 }}>
              Define how Elevation AI should interact with your patients. This prompt will be reviewed by a superadmin before becoming active.
            </p>

            {proposeError   && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{proposeError}</div>}
            {proposeSuccess && <div style={{ background: '#EAF0E6', color: '#4A6741', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{proposeSuccess}</div>}

            <textarea
              value={newPromptContent}
              onChange={e => setNewPromptContent(e.target.value)}
              placeholder="You are a therapeutic companion specialized in mindfulness and emotional regulation. Your approach is warm and non-directive..."
              rows={8}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.65rem',
                border: '0.5px solid #E7E5E4', fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif', color: '#1C1917',
                boxSizing: 'border-box', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#A8B5A2', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
              {newPromptContent.length} characters {newPromptContent.length < 50 ? `(minimum 50)` : '✓'}
            </div>

            <button
              onClick={handleProposePrompt}
              disabled={proposing}
              style={{
                width: '100%', padding: '0.75rem',
                background: proposing ? '#A8B5A2' : '#6B7D5C',
                color: '#fff', border: 'none', borderRadius: '0.85rem',
                fontSize: '0.9rem', fontWeight: 500,
                cursor: proposing ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {proposing ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}