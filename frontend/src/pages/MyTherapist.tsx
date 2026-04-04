// frontend/src/pages/MyTherapist.tsx
// HU-071 — Vista "Mi terapeuta" para el usuario

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { MatchingModal } from '../components/MatchingModal'

const API      = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''



const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😔', 3: '😐', 4: '🙂', 5: '😊',
}

interface TherapistProfile {
  specialties: string | null
  approach:    string | null
  languages:   string | null
  bio:         string | null
}

interface Therapist {
  id:      number
  name:    string
  email:   string
  profile: TherapistProfile | null
}

interface UpcomingSession {
  id:          number
  scheduledAt: string
  duration:    number
  meetingUrl:  string | null
  status:      string
}

interface PastSession {
  id:               number
  scheduledAt:      string
  patientMoodAfter: number | null
  status:           string
}

interface MyTherapistData {
  therapist:        Therapist | null
  upcomingSessions: UpcomingSession[]
  pastSessions:     PastSession[]
}

export function MyTherapist() {
  const { lang } = useLanguage()
  const navigate = useNavigate()

  const [data, setData]       = useState<MyTherapistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [showMatching, setShowMatching] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/user/my-therapist`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        setData(json)
      } catch {
        setError(lang === 'es' ? 'Error cargando la información.' : 'Could not load therapist info.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      weekday: 'long', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })

  const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    })

  // Videollamada habilitada 15 min antes
  const isJoinable = (scheduledAt: string) => {
    const diff = new Date(scheduledAt).getTime() - Date.now()
    return diff <= 15 * 60 * 1000 && diff >= -60 * 60 * 1000
  }

  const cardStyle: React.CSSProperties = {
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
    letterSpacing: '0.08em',
    marginBottom: '0.75rem',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F9F9F7', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        background: 'rgba(249,249,247,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(231,229,228,0.5)',
        height: 60, display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            ← {lang === 'es' ? 'Volver' : 'Back'}
          </button>
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A8A29E', textTransform: 'uppercase' }}>
            ELEVATION
          </span>
          <div style={{ width: 60 }} />
        </div>
      </header>

      {/* BODY */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 1.5rem 3rem' }}>

        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: '0 0 1.5rem' }}>
          {lang === 'es' ? 'Mi terapeuta' : 'My therapist'}
        </h1>

        {loading && (
          <p style={{ color: '#78716C', fontSize: '0.875rem' }}>
            {lang === 'es' ? 'Cargando...' : 'Loading...'}
          </p>
        )}

        {error && (
          <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>
        )}

        {!loading && !error && !data?.therapist && (
          /* Sin terapeuta asignado */
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤝</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              {lang === 'es' ? 'Aún no tenés un terapeuta asignado' : 'You don\'t have a therapist yet'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0 0 1.5rem' }}>
              {lang === 'es'
                ? 'Encontrá al terapeuta ideal para vos según tus preferencias.'
                : 'Find the right therapist based on your preferences.'}
            </p>
            <button
              onClick={() => navigate('/app/dashboard')}
              style={{ padding: '0.65rem 1.5rem', background: '#6B7D5C', color: '#fff', border: 'none', borderRadius: '0.85rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {lang === 'es' ? '🔍 Buscar mi terapeuta' : '🔍 Find my therapist'}
            </button>
          </div>
        )}

        {!loading && !error && data?.therapist && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── PERFIL DEL TERAPEUTA ── */}
            <div style={cardStyle}>
              <div style={sectionLabel}>
                {lang === 'es' ? '👤 Perfil' : '👤 Profile'}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                {/* Avatar */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#EAF0E6', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 600, color: '#6B7D5C',
                }}>
                  {data.therapist.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1C1917' }}>
                    {data.therapist.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#78716C', marginTop: '0.15rem' }}>
                    {data.therapist.email}
                  </div>

                  {data.therapist.profile && (
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {data.therapist.profile.specialties && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#78716C' }}>
                            {lang === 'es' ? 'Especialidades: ' : 'Specialties: '}
                          </span>
                          {data.therapist.profile.specialties}
                        </div>
                      )}
                      {data.therapist.profile.languages && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#78716C' }}>
                            {lang === 'es' ? 'Idiomas: ' : 'Languages: '}
                          </span>
                          {data.therapist.profile.languages}
                        </div>
                      )}
                      {data.therapist.profile.approach && (
                        <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                          <span style={{ color: '#78716C' }}>
                            {lang === 'es' ? 'Enfoque: ' : 'Approach: '}
                          </span>
                          {data.therapist.profile.approach}
                        </div>
                      )}
                      {data.therapist.profile.bio && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#44403C', lineHeight: 1.6, fontStyle: 'italic', fontFamily: 'Noto Serif, serif' }}>
                          "{data.therapist.profile.bio}"
                        </div>
                      )}
                    </div>
                  )}

                  {!data.therapist.profile && (
                    <p style={{ fontSize: '0.82rem', color: '#A8A29E', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      {lang === 'es' ? 'Perfil no completado aún.' : 'Profile not completed yet.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── PRÓXIMAS SESIONES ── */}
            <div style={cardStyle}>
              <div style={sectionLabel}>
                📅 {lang === 'es' ? 'Próximas sesiones' : 'Upcoming sessions'}
              </div>

              {data.upcomingSessions.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#78716C', margin: 0 }}>
                  {lang === 'es'
                    ? 'Tu terapeuta aún no ha agendado una sesión.'
                    : 'Your therapist has not scheduled a session yet.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {data.upcomingSessions.map(s => {
                    const joinable = isJoinable(s.scheduledAt)
                    return (
                      <div key={s.id} style={{
                        padding: '0.85rem 1rem',
                        background: '#F5F3EF',
                        borderRadius: '0.65rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1C1917', textTransform: 'capitalize' }}>
                            {formatDateTime(s.scheduledAt)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#78716C', marginTop: '0.15rem' }}>
                            {s.duration} min
                          </div>
                        </div>
                        <button
                          disabled={!joinable}
                          onClick={() => s.meetingUrl && window.open(s.meetingUrl, '_blank')}
                          title={joinable ? '' : (lang === 'es' ? 'Disponible 15 min antes' : 'Available 15 min before')}
                          style={{
                            padding: '0.45rem 0.9rem',
                            background: joinable ? '#6B7D5C' : '#E7E5E4',
                            color: joinable ? '#fff' : '#A8A29E',
                            border: 'none', borderRadius: '0.65rem',
                            fontSize: '0.78rem', fontWeight: 500,
                            cursor: joinable ? 'pointer' : 'not-allowed',
                            fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                          }}
                        >
                          {lang === 'es' ? 'Entrar a videollamada' : 'Join videocall'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── SESIONES ANTERIORES ── */}
            {data.pastSessions.length > 0 && (
              <div style={cardStyle}>
                <div style={sectionLabel}>
                  🗂 {lang === 'es' ? 'Sesiones anteriores' : 'Past sessions'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.pastSessions.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.65rem 0', borderBottom: '0.5px solid #F5F3EF',
                    }}>
                      <div style={{ fontSize: '0.82rem', color: '#1C1917' }}>
                        {formatDateShort(s.scheduledAt)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', background: '#EAF0E6', color: '#4A6741', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                          {lang === 'es' ? 'Completada' : 'Completed'}
                        </span>
                        {s.patientMoodAfter != null && (
                          <span style={{ fontSize: '0.875rem' }}>
                            {MOOD_EMOJI[s.patientMoodAfter]} {s.patientMoodAfter}/5
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CAMBIAR TERAPEUTA ── */}
            <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
              <button
  onClick={() => setShowMatching(true)}
  style={{ background: 'none', border: 'none', color: '#78716C', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Inter, sans-serif' }}
>
  {lang === 'es' ? '¿Querés cambiar de terapeuta?' : 'Want to change therapist?'}
</button>

{showMatching && (
  <MatchingModal
    onClose={() => setShowMatching(false)}
    onSuccess={() => { setShowMatching(false); window.location.reload() }}
  />
)}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}