// frontend/src/pages/UserProgress.tsx
// HU-052 + HU-060 — User progress panel + therapist matching

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

interface MoodLog {
  id: number
  date: string
  checkin_mood: number | null
  checkout_mood: number | null
}

interface SessionRating {
  id: number
  date: string
  rating: number
}

interface Recommendation {
  id: number
  category: string
  content: string
  generatedAt: string
  seenByUser: boolean
}

interface Stats {
  totalSessions: number
  avgMood: number | null
  avgRating: number | null
  streak: number
}

// HU-060
interface MatchingSuggestion {
  therapistId: number
  therapistName: string
  score: number
  reason: string
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
}

export function UserProgress() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()

  const [stats,           setStats]           = useState<Stats | null>(null)
  const [moodLogs,        setMoodLogs]        = useState<MoodLog[]>([])
  const [ratings,         setRatings]         = useState<SessionRating[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')

  // HU-060 — Matching
  const [showMatching,        setShowMatching]        = useState(false)
  const [matchingStep,        setMatchingStep]        = useState<'questionnaire' | 'results'>('questionnaire')
  const [matchingAnswers,     setMatchingAnswers]     = useState({ area: '', style: '', language: '' })
  const [matchingSuggestions, setMatchingSuggestions] = useState<MatchingSuggestion[]>([])
  const [matchingRequestId,   setMatchingRequestId]   = useState<number | null>(null)
  const [loadingMatching,     setLoadingMatching]     = useState(false)
  const [matchingError,       setMatchingError]       = useState('')
  const [matchingSuccess,     setMatchingSuccess]     = useState('')

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`${API}/api/user/progress`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setStats(data.stats)
        setMoodLogs(data.moodLogs)
        setRatings(data.ratings)
        setRecommendations(data.recommendations)
      } catch {
        setError(lang === 'es' ? 'No se pudo cargar tu progreso.' : 'Could not load your progress.')
      } finally {
        setLoading(false)
      }
    }
    fetchProgress()
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    })

  // HU-060 — Submit questionnaire to get AI suggestions
  const handleStartMatching = async () => {
    setLoadingMatching(true)
    setMatchingError('')
    try {
      const res = await fetch(`${API}/api/matching/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ answers: matchingAnswers }),
      })
      if (!res.ok) { const d = await res.json(); setMatchingError(d.error || 'Error'); return }
      const data = await res.json()
      setMatchingSuggestions(data.suggestions)
      setMatchingRequestId(data.requestId)
      setMatchingStep('results')
    } catch { setMatchingError('Connection error.') }
    finally   { setLoadingMatching(false) }
  }

  // HU-060 — User chooses a therapist
  const handleChooseTherapist = async (therapistId: number) => {
    if (!matchingRequestId) return
    try {
      const res = await fetch(`${API}/api/matching/choose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ requestId: matchingRequestId, therapistId }),
      })
      if (!res.ok) { const d = await res.json(); setMatchingError(d.error || 'Error'); return }
      setMatchingSuccess(
        lang === 'es'
          ? '¡Solicitud enviada! Un administrador confirmará tu terapeuta pronto.'
          : 'Request sent! An admin will confirm your therapist shortly.'
      )
      setTimeout(() => {
        setShowMatching(false)
        setMatchingStep('questionnaire')
        setMatchingSuccess('')
        setMatchingAnswers({ area: '', style: '', language: '' })
      }, 3000)
    } catch { setMatchingError('Connection error.') }
  }

  const closeMatching = () => {
    setShowMatching(false)
    setMatchingStep('questionnaire')
    setMatchingError('')
    setMatchingSuccess('')
    setMatchingAnswers({ area: '', style: '', language: '' })
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem 1.5rem',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.65rem',
    border: '0.5px solid #E7E5E4', fontSize: '0.875rem',
    fontFamily: 'Inter, sans-serif', color: '#1C1917', outline: 'none',
    background: '#fff',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ color: '#78716C', fontSize: '0.875rem' }}>
        {lang === 'es' ? 'Cargando tu progreso...' : 'Loading your progress...'}
      </p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        background: 'rgba(249,249,247,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(231,229,228,0.5)',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 760, width: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/app/chat')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#78716C', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: '0.35rem', padding: 0,
          }}>
            ← {lang === 'es' ? 'Volver al chat' : 'Back to chat'}
          </button>
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A8A29E', textTransform: 'uppercase' }}>
            {t('logo')}
          </span>
          {/* HU-060 — Find therapist button */}
          <button
            onClick={() => setShowMatching(true)}
            style={{
              padding: '0.4rem 0.85rem', background: '#6B7D5C', color: '#fff',
              border: 'none', borderRadius: '0.85rem', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            🤝 {lang === 'es' ? 'Buscar terapeuta' : 'Find therapist'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '80px 1.5rem 48px' }}>

        {/* Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
            {lang === 'es' ? 'Tu progreso' : 'Your progress'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
            {lang === 'es' ? 'Últimos 30 días' : 'Last 30 days'}
          </p>
        </div>

        {error && <p style={{ color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

        {/* STATS CARDS */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: lang === 'es' ? 'Sesiones totales' : 'Total sessions', value: stats.totalSessions },
              { label: lang === 'es' ? 'Mood promedio'   : 'Avg mood',        value: stats.avgMood != null ? `${stats.avgMood} ${MOOD_EMOJI[Math.round(stats.avgMood)] ?? ''}` : '—' },
              { label: lang === 'es' ? 'Rating promedio' : 'Avg rating',      value: stats.avgRating != null ? `${stats.avgRating} ★` : '—' },
              { label: lang === 'es' ? 'Racha actual'    : 'Current streak',  value: `${stats.streak} ${lang === 'es' ? (stats.streak === 1 ? 'día' : 'días') : (stats.streak === 1 ? 'day' : 'days')}` },
            ].map(card => (
              <div key={card.label} style={cardStyle}>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#78716C', marginTop: '0.2rem' }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* RECOMMENDATIONS */}
        {recommendations.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1rem' }}>
              {t('rec_title')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recommendations.map(rec => (
                <div key={rec.id} style={{ padding: '0.85rem 1rem', background: '#F5F3EF', borderRadius: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>
                    {t(`rec_category_${rec.category}`)}
                  </div>
                  <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.9rem', color: '#1C1917', lineHeight: 1.6, margin: 0 }}>
                    {rec.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* MOOD HISTORY */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1rem' }}>
              {lang === 'es' ? 'Historial emocional' : 'Emotional history'}
            </h2>
            {moodLogs.length === 0 ? (
              <p style={{ color: '#78716C', fontSize: '0.875rem' }}>{lang === 'es' ? 'Aún no hay registros.' : 'No records yet.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {moodLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#78716C' }}>{formatDate(log.date)}</span>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {log.checkin_mood != null && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.9rem' }}>{MOOD_EMOJI[log.checkin_mood]}</div>
                          <div style={{ fontSize: '0.6rem', color: '#A8B5A2' }}>in</div>
                        </div>
                      )}
                      {log.checkout_mood != null && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.9rem' }}>{MOOD_EMOJI[log.checkout_mood]}</div>
                          <div style={{ fontSize: '0.6rem', color: '#A8B5A2' }}>out</div>
                        </div>
                      )}
                      {log.checkin_mood != null && log.checkout_mood != null && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: log.checkout_mood >= log.checkin_mood ? '#22C55E' : '#EF4444' }}>
                          {log.checkout_mood >= log.checkin_mood ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SESSION RATINGS */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1rem' }}>
              {lang === 'es' ? 'Calificaciones' : 'Session ratings'}
            </h2>
            {ratings.length === 0 ? (
              <p style={{ color: '#78716C', fontSize: '0.875rem' }}>{lang === 'es' ? 'Aún no hay calificaciones.' : 'No ratings yet.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ratings.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#F5F3EF', borderRadius: '0.65rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#78716C' }}>{formatDate(r.date)}</span>
                    <span style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                      {'★'.repeat(r.rating)}
                      <span style={{ color: '#D6D2C4' }}>{'★'.repeat(5 - r.rating)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* HU-060 — MATCHING MODAL */}
      {showMatching && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif', margin: '0 1rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                {matchingStep === 'questionnaire'
                  ? (lang === 'es' ? '🤝 Encontrá tu terapeuta' : '🤝 Find your therapist')
                  : (lang === 'es' ? '✨ Tus matches' : '✨ Your matches')}
              </h2>
              <button onClick={closeMatching} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C' }}>✕</button>
            </div>

            {matchingError   && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{matchingError}</div>}
            {matchingSuccess && <div style={{ background: '#EAF0E6', color: '#4A6741', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{matchingSuccess}</div>}

            {matchingStep === 'questionnaire' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    {lang === 'es' ? '¿En qué área querés trabajar?' : 'What area do you want to work on?'}
                  </label>
                  <select value={matchingAnswers.area} onChange={e => setMatchingAnswers(p => ({ ...p, area: e.target.value }))} style={selectStyle}>
                    <option value="">{lang === 'es' ? 'Seleccioná...' : 'Select...'}</option>
                    <option value="anxiety">{lang === 'es' ? 'Ansiedad' : 'Anxiety'}</option>
                    <option value="depression">{lang === 'es' ? 'Depresión' : 'Depression'}</option>
                    <option value="relationships">{lang === 'es' ? 'Relaciones' : 'Relationships'}</option>
                    <option value="personal growth">{lang === 'es' ? 'Crecimiento personal' : 'Personal growth'}</option>
                    <option value="stress">{lang === 'es' ? 'Manejo del estrés' : 'Stress management'}</option>
                    <option value="other">{lang === 'es' ? 'Otro' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    {lang === 'es' ? '¿Qué estilo preferís?' : 'What style do you prefer?'}
                  </label>
                  <select value={matchingAnswers.style} onChange={e => setMatchingAnswers(p => ({ ...p, style: e.target.value }))} style={selectStyle}>
                    <option value="">{lang === 'es' ? 'Seleccioná...' : 'Select...'}</option>
                    <option value="reflective and exploratory">{lang === 'es' ? 'Reflexivo y exploratorio' : 'Reflective and exploratory'}</option>
                    <option value="structured with goals">{lang === 'es' ? 'Estructurado con objetivos' : 'Structured with goals'}</option>
                    <option value="empathetic and listening">{lang === 'es' ? 'Empático y de escucha' : 'Empathetic and listening'}</option>
                    <option value="any">{lang === 'es' ? 'Cualquier estilo' : 'Any style'}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    {lang === 'es' ? 'Idioma preferido para las sesiones' : 'Preferred session language'}
                  </label>
                  <select value={matchingAnswers.language} onChange={e => setMatchingAnswers(p => ({ ...p, language: e.target.value }))} style={selectStyle}>
                    <option value="">{lang === 'es' ? 'Seleccioná...' : 'Select...'}</option>
                    <option value="Spanish">{lang === 'es' ? 'Español' : 'Spanish'}</option>
                    <option value="English">{lang === 'es' ? 'Inglés' : 'English'}</option>
                    <option value="No preference">{lang === 'es' ? 'Sin preferencia' : 'No preference'}</option>
                  </select>
                </div>
                <button
                  onClick={handleStartMatching}
                  disabled={loadingMatching || !matchingAnswers.area || !matchingAnswers.style || !matchingAnswers.language}
                  style={{
                    width: '100%', padding: '0.75rem',
                    background: loadingMatching || !matchingAnswers.area || !matchingAnswers.style || !matchingAnswers.language ? '#A8B5A2' : '#6B7D5C',
                    color: '#fff', border: 'none', borderRadius: '0.85rem',
                    fontSize: '0.9rem', fontWeight: 500,
                    cursor: loadingMatching || !matchingAnswers.area || !matchingAnswers.style || !matchingAnswers.language ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {loadingMatching
                    ? (lang === 'es' ? 'Buscando tu match...' : 'Finding your match...')
                    : (lang === 'es' ? 'Encontrar mi terapeuta' : 'Find my therapist')}
                </button>
              </div>
            )}

            {matchingStep === 'results' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 0.5rem' }}>
                  {lang === 'es' ? 'Según tus respuestas, estos son tus mejores matches:' : 'Based on your answers, here are your top matches:'}
                </p>
                {matchingSuggestions.map((s, i) => (
                  <div key={s.therapistId} style={{
                    padding: '1rem', background: '#F5F3EF', borderRadius: '0.85rem',
                    border: i === 0 ? '1.5px solid #6B7D5C' : '0.5px solid #E7E5E4',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1C1917' }}>{s.therapistName}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, background: '#EAF0E6', color: '#4A6741', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        {s.score}/10
                      </div>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{s.reason}</p>
                    <button
                      onClick={() => handleChooseTherapist(s.therapistId)}
                      style={{
                        padding: '0.45rem 1rem', background: '#6B7D5C', color: '#fff',
                        border: 'none', borderRadius: '0.65rem', fontSize: '0.82rem',
                        fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {lang === 'es' ? 'Elegir este terapeuta' : 'Choose this therapist'}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setMatchingStep('questionnaire')}
                  style={{ background: 'none', border: 'none', color: '#78716C', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center', padding: '0.25rem' }}
                >
                  ← {lang === 'es' ? 'Volver al cuestionario' : 'Back to questionnaire'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}